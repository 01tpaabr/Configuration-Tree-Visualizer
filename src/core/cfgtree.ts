import type { CfgVertex, NodeId, Skeleton } from './types';
import { chOfConfig } from './skeleton';
import { childCount, stepChildren, stepProb, vertexKey } from './probability';

// Never build more vertices than this.
export const VERTEX_CAP = 20_000;
// Open vertices on load only while the total stays under this.
export const AUTO_EXPAND_CAP = 200;
// A vertex with more than 2^12 children shows a placeholder instead.
export const MAX_DRAWN_FANOUT = 12;

function parseVertexKey(key: string): NodeId[][] {
  return key.split('|').map((level) => (level === '' ? [] : level.split(',')));
}

// The vertex reached by keeping exactly `cfg` out of the parent's available
// children.
function childVertex(sk: Skeleton, parent: CfgVertex, cfg: NodeId[]): CfgVertex {
  const step = stepProb(sk, parent.cfg, cfg);
  const path = [...parent.path, cfg];
  return {
    key: vertexKey(path),
    parentKey: parent.key,
    path,
    cfg,
    depth: parent.depth + 1,
    stepProb: step,
    reachProb: parent.reachProb * step,
    isLeaf: chOfConfig(sk, cfg).length === 0,
    childKeys: null,
  };
}

// Build the vertex for a descent. Path levels must already be sorted by
// document order.
export function vertexFromPath(sk: Skeleton, path: NodeId[][]): CfgVertex {
  let v: CfgVertex = {
    key: vertexKey([path[0]]),
    parentKey: null,
    path: [path[0]],
    cfg: path[0],
    depth: 0,
    stepProb: 1,
    reachProb: 1,
    isLeaf: chOfConfig(sk, path[0]).length === 0,
    childKeys: null,
  };
  for (let i = 1; i < path.length; i++) v = childVertex(sk, v, path[i]);
  return v;
}

export function vertexFromKey(sk: Skeleton, key: string): CfgVertex {
  return vertexFromPath(sk, parseVertexKey(key));
}

export function rootVertex(sk: Skeleton): CfgVertex {
  return vertexFromPath(sk, [[sk.root]]);
}

export function childrenOf(sk: Skeleton, v: CfgVertex): CfgVertex[] {
  if (v.isLeaf) return [];
  return stepChildren(sk, v.cfg).map((cfg) => childVertex(sk, v, cfg));
}

export function childCountOf(sk: Skeleton, v: CfgVertex): number {
  return v.isLeaf ? 0 : childCount(sk, v.cfg);
}

// The union of every level of the descent: the node set of the document a
// leaf determines.
export function nodesOf(leaf: CfgVertex): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<NodeId>();
  for (const level of leaf.path) {
    for (const id of level) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

// The leaves of the subtree below `key`, left to right.
export function leavesBelow(sk: Skeleton, key: string): CfgVertex[] {
  const out: CfgVertex[] = [];
  const walk = (v: CfgVertex): void => {
    if (v.isLeaf) {
      out.push(v);
      return;
    }
    for (const c of childrenOf(sk, v)) walk(c);
  };
  walk(vertexFromKey(sk, key));
  return out;
}

// Count the leaves below `key` without keeping them. Returns null once the
// count passes `cap`, so callers can say "more than n" instead of hanging.
export function countLeavesBelow(
  sk: Skeleton,
  key: string,
  cap = VERTEX_CAP,
): number | null {
  let n = 0;
  let overflowed = false;
  const walk = (v: CfgVertex): void => {
    if (overflowed) return;
    if (v.isLeaf) {
      n++;
      if (n > cap) overflowed = true;
      return;
    }
    for (const c of childrenOf(sk, v)) walk(c);
  };
  try {
    walk(vertexFromKey(sk, key));
  } catch {
    return null; // fan-out beyond the enumeration guard
  }
  return overflowed ? null : n;
}

// The leaf distribution from a vertex, keyed by leaf key. The empty product
// is 1, so a leaf maps to itself with probability 1.
export function leafDist(sk: Skeleton, fromKey: string): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (v: CfgVertex, acc: number): void => {
    if (v.isLeaf) {
      out.set(v.key, acc);
      return;
    }
    for (const c of childrenOf(sk, v)) walk(c, acc * c.stepProb);
  };
  walk(vertexFromKey(sk, fromKey), 1);
  return out;
}

// The product of step probabilities along the path between two vertices.
// Zero when the target is not below the start.
export function coneMeasure(
  sk: Skeleton,
  fromKey: string,
  targetKey: string,
): number {
  const from = parseVertexKey(fromKey);
  const to = parseVertexKey(targetKey);
  if (to.length < from.length) return 0;
  for (let i = 0; i < from.length; i++) {
    if (vertexKey([from[i]]) !== vertexKey([to[i]])) return 0;
  }
  let p = 1;
  for (let i = from.length; i < to.length; i++) {
    p *= stepProb(sk, to[i - 1], to[i]);
  }
  return p;
}

// Recompute stepProb and reachProb for vertices that already exist, without
// rebuilding the tree. Valid because the shape of the tree depends only on
// the skeleton, never on the probabilities.
export function rescore(
  sk: Skeleton,
  vertices: Map<string, CfgVertex>,
): Map<string, CfgVertex> {
  const out = new Map<string, CfgVertex>();
  const inOrder = [...vertices.values()].sort((a, b) => a.depth - b.depth);
  for (const v of inOrder) {
    if (v.parentKey == null) {
      out.set(v.key, { ...v, stepProb: 1, reachProb: 1 });
      continue;
    }
    const step = stepProb(sk, v.path[v.depth - 1], v.cfg);
    const parent = out.get(v.parentKey) ?? vertices.get(v.parentKey);
    out.set(v.key, {
      ...v,
      stepProb: step,
      reachProb: (parent ? parent.reachProb : 1) * step,
    });
  }
  return out;
}

export interface MaterializeResult {
  vertices: Map<string, CfgVertex>;
  order: CfgVertex[]; // pre-order
}

// Build the whole tree from the root, parents before children, stopping at
// `cap` vertices.
export function materialize(sk: Skeleton, cap: number = VERTEX_CAP): MaterializeResult {
  const vertices = new Map<string, CfgVertex>();
  const order: CfgVertex[] = [];

  const walk = (v: CfgVertex): void => {
    if (order.length >= cap) return;
    vertices.set(v.key, v);
    order.push(v);
    if (v.isLeaf) return;
    if (childCountOf(sk, v) > 2 ** MAX_DRAWN_FANOUT) return;
    const kids = childrenOf(sk, v);
    v.childKeys = kids.map((k) => k.key);
    for (const c of kids) walk(c);
  };
  walk(rootVertex(sk));
  return { vertices, order };
}
