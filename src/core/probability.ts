import type { Factor, NodeId, Skeleton } from './types';
import { chOfConfig, labelOf, pd } from './skeleton';

const MAX_FANOUT = 20;

// Subsets ordered by size, then by document order within each size.
// `ids` must already be in document order.
export function subsetsOf(ids: NodeId[]): NodeId[][] {
  const k = ids.length;
  if (k > MAX_FANOUT) {
    throw new RangeError(
      `subsetsOf: fan-out ${k} exceeds the ${MAX_FANOUT}-child guard (2^${k} subsets)`,
    );
  }
  const out: NodeId[][] = [];
  const combo: number[] = [];
  for (let size = 0; size <= k; size++) {
    const emit = (start: number, left: number): void => {
      if (left === 0) {
        out.push(combo.map((i) => ids[i]));
        return;
      }
      for (let i = start; i <= k - left; i++) {
        combo.push(i);
        emit(i + 1, left - 1);
        combo.pop();
      }
    };
    emit(0, size);
  }
  return out;
}

// The child-step probability: one factor per child available at the *parent*
// (not per kept child), PD(v) if kept and 1 - PD(v) if dropped. Only valid for
// `ind`; `mux` correlates siblings.
export function stepProb(
  sk: Skeleton,
  parentCfg: NodeId[],
  childCfg: NodeId[],
): number {
  const kept = new Set(childCfg);
  let p = 1;
  for (const v of chOfConfig(sk, parentCfg)) {
    p *= kept.has(v) ? pd(sk, v) : 1 - pd(sk, v);
  }
  return p;
}

// The same product, one labelled entry per factor. Multiplying the factors
// gives stepProb.
export function factorization(
  sk: Skeleton,
  parentCfg: NodeId[],
  childCfg: NodeId[],
): Factor[] {
  const kept = new Set(childCfg);
  return chOfConfig(sk, parentCfg).map((v) => ({
    id: v,
    label: labelOf(sk, v),
    kept: kept.has(v),
    factor: kept.has(v) ? pd(sk, v) : 1 - pd(sk, v),
  }));
}

// A configuration with no available children is a leaf and generates nothing.
export function stepChildren(sk: Skeleton, cfg: NodeId[]): NodeId[][] {
  const available = chOfConfig(sk, cfg);
  if (available.length === 0) return [];
  return subsetsOf(available);
}

export function childCount(sk: Skeleton, cfg: NodeId[]): number {
  const available = chOfConfig(sk, cfg);
  return available.length === 0 ? 0 : 2 ** available.length;
}

// Vertex keys: levels joined with `|`, ids within a level with `,`.
export function vertexKey(path: NodeId[][]): string {
  return path.map((level) => level.join(',')).join('|');
}
