import type { CfgVertex, NodeId, Skeleton } from '../types';
import { childrenOf, vertexFromKey, MAX_DRAWN_FANOUT, VERTEX_CAP } from '../cfgtree';
import { chOfConfig } from '../skeleton';
import type { VertexKey } from './ast';

// Evaluation touches only a band of the tree below the start state, but that
// band still grows as 2^k per level, so the walk counts what it builds and
// stops with an error instead of freezing.
export class PathBudgetError extends Error {
  readonly expanded: number;
  readonly cap: number;
  constructor(expanded: number, cap: number) {
    super(
      `evaluating this path would expand more than ${cap.toLocaleString()} vertices`,
    );
    this.expanded = expanded;
    this.cap = cap;
  }
}

// The evaluator's window onto the configuration tree: vertices are built only
// when asked for, and remembered. A key spells out the whole descent, so
// checking ancestry is checking a prefix.
export class PathContext {
  private readonly vertices = new Map<VertexKey, CfgVertex>();
  private readonly kids = new Map<VertexKey, VertexKey[]>();
  private expanded = 0;

  readonly sk: Skeleton;
  readonly cap: number;

  constructor(sk: Skeleton, cap: number = VERTEX_CAP) {
    this.sk = sk;
    this.cap = cap;
  }

  vertex(key: VertexKey): CfgVertex {
    let v = this.vertices.get(key);
    if (!v) {
      v = vertexFromKey(this.sk, key);
      this.vertices.set(key, v);
    }
    return v;
  }

  cfg(key: VertexKey): NodeId[] {
    return this.vertex(key).cfg;
  }

  // Whether the state's configuration is non-empty.
  isPositive(key: VertexKey): boolean {
    return this.cfg(key).length > 0;
  }

  depth(key: VertexKey): number {
    return this.vertex(key).depth;
  }

  children(key: VertexKey): VertexKey[] {
    const hit = this.kids.get(key);
    if (hit) return hit;

    const v = this.vertex(key);
    if (v.isLeaf) {
      this.kids.set(key, []);
      return [];
    }
    const fanout = chOfConfig(this.sk, v.cfg).length;
    if (fanout > MAX_DRAWN_FANOUT) throw new PathBudgetError(2 ** fanout, this.cap);
    this.expanded += 2 ** fanout;
    if (this.expanded > this.cap) throw new PathBudgetError(this.expanded, this.cap);

    const kids = childrenOf(this.sk, v);
    const keys = kids.map((c) => {
      this.vertices.set(c.key, c);
      return c.key;
    });
    this.kids.set(key, keys);
    return keys;
  }

  // The product of step probabilities from `from` down to `target`; 1 when
  // they are equal, 0 when the target is not below.
  coneMeasure(from: VertexKey, target: VertexKey): number {
    if (from === target) return 1;
    if (!isBelow(target, from)) return 0;
    const a = this.vertex(from);
    const b = this.vertex(target);
    let p = 1;
    for (let d = a.depth + 1; d <= b.depth; d++) {
      p *= this.vertex(keyOfPrefix(b.key, d)).stepProb;
    }
    return p;
  }

  // Every label present in the state's configuration.
  labelsAt(key: VertexKey): Set<string> {
    const out = new Set<string>();
    for (const id of this.cfg(key)) {
      const node = this.sk.byId.get(id);
      if (node) out.add(node.label);
    }
    return out;
  }
}

export function isBelow(sigma: VertexKey, pi: VertexKey): boolean {
  return sigma === pi || sigma.startsWith(pi + '|');
}

export function isStrictAncestor(x: VertexKey, y: VertexKey): boolean {
  return y.startsWith(x + '|');
}

// The ancestor of `key` at depth `d`.
function keyOfPrefix(key: VertexKey, d: number): VertexKey {
  let seen = 0;
  for (let i = 0; i < key.length; i++) {
    if (key[i] !== '|') continue;
    seen++;
    if (seen > d) return key.slice(0, i);
  }
  return key;
}
