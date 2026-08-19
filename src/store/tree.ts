import type { CfgVertex, Skeleton } from '../core/types';
import {
  AUTO_EXPAND_CAP,
  MAX_DRAWN_FANOUT,
  VERTEX_CAP,
  childCountOf,
  childrenOf,
  rootVertex,
} from '../core/cfgtree';

export interface ExpansionState {
  // keys the user (or the automatic opening below) opened
  expanded: Set<string>;
  // keys the user closed by hand; they must not be reopened automatically
  collapsed: Set<string>;
}

export interface TreeState {
  vertices: Map<string, CfgVertex>;
  // the built vertices in drawing order, parents before children
  order: CfgVertex[];
  expanded: Set<string>;
  // vertices with too many children to draw, shown as placeholders
  tooWide: Set<string>;
  // true when the vertex limit forced the build to stop
  capped: boolean;
  cappedAt: string[];
}

// Build the tree in two rounds: first reopen every vertex the user had open,
// then keep opening more while the total stays small, so a small document
// opens fully and a large one does not.
export function buildTree(
  sk: Skeleton,
  state: ExpansionState,
): TreeState {
  const vertices = new Map<string, CfgVertex>();
  const tooWide = new Set<string>();
  const nextExpanded = new Set<string>();
  const cappedAt: string[] = [];
  let capped = false;

  const root = rootVertex(sk);
  vertices.set(root.key, root);

  const canExpand = (v: CfgVertex): boolean => {
    if (v.isLeaf) return false;
    if (childCountOf(sk, v) > 2 ** MAX_DRAWN_FANOUT) {
      tooWide.add(v.key);
      return false;
    }
    return true;
  };

  const expand = (v: CfgVertex): CfgVertex[] => {
    const kids = childrenOf(sk, v);
    v.childKeys = kids.map((k) => k.key);
    for (const k of kids) vertices.set(k.key, k);
    nextExpanded.add(v.key);
    return kids;
  };

  // Restore the user's open vertices.
  const queue: CfgVertex[] = [root];
  while (queue.length) {
    const v = queue.shift() as CfgVertex;
    if (!state.expanded.has(v.key) || !canExpand(v)) continue;
    if (vertices.size + childCountOf(sk, v) > VERTEX_CAP) {
      capped = true;
      cappedAt.push(v.key);
      continue;
    }
    queue.push(...expand(v));
  }

  // Keep opening more vertices while the total stays under the limit.
  const frontier: CfgVertex[] = [...vertices.values()].filter(
    (v) => !nextExpanded.has(v.key),
  );
  while (frontier.length) {
    const v = frontier.shift() as CfgVertex;
    if (state.collapsed.has(v.key) || nextExpanded.has(v.key)) continue;
    if (!canExpand(v)) continue;
    if (vertices.size + childCountOf(sk, v) > AUTO_EXPAND_CAP) continue;
    frontier.push(...expand(v));
  }

  return {
    vertices,
    order: preOrder(vertices, root),
    expanded: nextExpanded,
    tooWide,
    capped,
    cappedAt,
  };
}

export function preOrder(
  vertices: Map<string, CfgVertex>,
  root: CfgVertex,
): CfgVertex[] {
  const out: CfgVertex[] = [];
  const walk = (v: CfgVertex): void => {
    out.push(v);
    for (const k of v.childKeys ?? []) {
      const c = vertices.get(k);
      if (c) walk(c);
    }
  };
  walk(root);
  return out;
}

// The nearest surviving ancestor of a key that no longer exists.
export function nearestSurviving(
  vertices: Map<string, CfgVertex>,
  key: string,
): string | null {
  const levels = key.split('|');
  for (let n = levels.length; n > 0; n--) {
    const candidate = levels.slice(0, n).join('|');
    if (vertices.has(candidate)) return candidate;
  }
  return null;
}
