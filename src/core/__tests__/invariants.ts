import type { CfgVertex, Skeleton } from '../types';
import { TOLERANCE } from '../types';
import { allNodes, chOfConfig, existenceProb, pd, skeletonPath } from '../skeleton';
import { childrenOf, leavesBelow, materialize } from '../cfgtree';

export interface InvariantResult {
  id: string;
  title: string;
  pass: boolean;
  detail: string;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE;

// Consequences of the definitions, checked by the tests.
export function checkInvariants(
  sk: Skeleton,
  materialized?: CfgVertex[],
): InvariantResult[] {
  const all = materialized ?? materialize(sk).order;
  const byKey = new Map(all.map((v) => [v.key, v]));
  const results: InvariantResult[] = [];

  // `find` returns a failure description, or null when the invariant holds.
  const check = (id: string, title: string, find: () => string | null): void => {
    const failure = find();
    results.push({ id, title, pass: failure === null, detail: failure ?? 'exact' });
  };

  // I1: the step probabilities over the children of a non-leaf vertex sum to 1.
  {
    let worst = 0;
    let worstKey = '';
    for (const v of all) {
      if (v.isLeaf) continue;
      const kids = childrenOf(sk, v);
      if (kids.length === 0) continue;
      const sum = kids.reduce((s, c) => s + c.stepProb, 0);
      if (Math.abs(sum - 1) > worst) {
        worst = Math.abs(sum - 1);
        worstKey = v.key;
      }
    }
    results.push({
      id: 'I1',
      title: 'Σ ↓(π′, π) over the children of every non-leaf vertex = 1',
      pass: worst <= TOLERANCE,
      detail: worst === 0 ? 'exact' : `max deviation ${worst.toExponential(2)} at ${worstKey}`,
    });
  }

  // I2: the leaf probabilities sum to 1.
  {
    const sum = all.filter((v) => v.isLeaf).reduce((s, v) => s + v.reachProb, 0);
    results.push({
      id: 'I2',
      title: 'Σ_{τ ∈ lv(root)} μ_root({τ}) = 1',
      pass: near(sum, 1),
      detail: `Σ = ${sum}`,
    });
  }

  check('I3', 'reach(σ) = reach(pa σ) · ↓(pa σ, σ)', () => {
    for (const v of all) {
      const p = v.parentKey ? byKey.get(v.parentKey) : undefined;
      if (p && !near(v.reachProb, p.reachProb * v.stepProb)) {
        return `mismatch at ${v.key}`;
      }
    }
    return null;
  });

  check('I4', 'μ(E_v) = ∏ PD(u) along the skeleton path', () => {
    for (const id of allNodes(sk)) {
      const expect = skeletonPath(sk, id).reduce((p, u) => p * pd(sk, u), 1);
      if (!near(existenceProb(sk, id), expect)) return `mismatch at ${id}`;
    }
    return null;
  });

  check('I5', 'cones nest below; incomparable cones are disjoint', () => {
    const isBelow = (a: CfgVertex, b: CfgVertex): boolean =>
      a.key === b.key || a.key.startsWith(b.key + '|');
    const sample = all.slice(0, 40);
    for (const a of sample) {
      const lvA = leavesBelow(sk, a.key).map((t) => t.key);
      for (const b of sample) {
        const lvB = new Set(leavesBelow(sk, b.key).map((t) => t.key));
        if (isBelow(a, b)) {
          if (lvA.some((t) => !lvB.has(t))) return `lv(${a.key}) ⊄ lv(${b.key})`;
        } else if (!isBelow(b, a)) {
          if (lvA.some((t) => lvB.has(t))) return `lv(${a.key}) ∩ lv(${b.key}) ≠ ∅`;
        }
      }
    }
    return null;
  });

  check('I6', 'a depth-k vertex contains only depth-k skeleton nodes', () => {
    for (const v of all) {
      for (const id of v.cfg) {
        if (sk.depth.get(id) !== v.depth) {
          return `${id} at skeleton depth ${sk.depth.get(id)} inside a depth-${v.depth} vertex`;
        }
      }
    }
    return null;
  });

  check('I7', 'ch(cfg(π)) = ∅ ⟹ no children', () => {
    for (const v of all) {
      if (chOfConfig(sk, v.cfg).length === 0 && childrenOf(sk, v).length !== 0) {
        return `${v.key} enumerated children from an empty ch(cfg)`;
      }
    }
    return null;
  });

  check('I8', '|children(π)| = 2^{|ch(cfg(π))|}', () => {
    for (const v of all) {
      if (v.isLeaf) continue;
      const expected = 2 ** chOfConfig(sk, v.cfg).length;
      const actual = childrenOf(sk, v).length;
      if (actual !== expected) return `${v.key} has ${actual}, expected ${expected}`;
    }
    return null;
  });

  // I9: the shape of the tree depends only on the skeleton, never on the
  // probabilities.
  {
    const shape = (probs: (id: string) => number): string => {
      const saved = new Map<string, number>();
      for (const [id, node] of sk.byId) {
        saved.set(id, node.prob);
        node.prob = probs(id);
      }
      const keys = materialize(sk).order.map((v) => v.key).join(';');
      for (const [id, node] of sk.byId) node.prob = saved.get(id) ?? node.prob;
      return keys;
    };
    const a = shape((id) => sk.byId.get(id)?.prob ?? 0.5);
    const b = shape(() => 0.25);
    results.push({
      id: 'I9',
      title: 'the shape of T depends only on (N, →)',
      pass: a === b,
      detail: a === b ? 'vertex and edge sets unchanged under a PD rewrite' : 'shape changed',
    });
  }

  return results;
}
