import type { NodeId, PDocument, PNode, Skeleton } from './types';

const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

// 0 -> ₀, 12 -> ₁₂. Used for display labels and the level guides.
export function subscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPTS[Number(d)])
    .join('');
}

// The skeleton holds ordinary nodes only. Distributional nodes are not
// vertices: PNode.children already skips over them, and PNode.distType
// carries the type of the block governing those children.
export function buildSkeleton(doc: PDocument): Skeleton {
  const byId = new Map<NodeId, PNode>();
  const parent = new Map<NodeId, NodeId | null>();
  const depth = new Map<NodeId, number>();
  const docOrder = new Map<NodeId, number>();
  const childIds = new Map<NodeId, NodeId[]>();

  let order = 0;
  const walk = (node: PNode, par: NodeId | null, d: number): void => {
    byId.set(node.id, node);
    parent.set(node.id, par);
    depth.set(node.id, d);
    docOrder.set(node.id, order++);
    childIds.set(
      node.id,
      node.children.map((c) => c.id),
    );
    for (const c of node.children) walk(c, node.id, d + 1);
  };
  walk(doc.root, null, 0);

  return {
    root: doc.root.id,
    byId,
    parent,
    depth,
    docOrder,
    childIds,
    displayLabel: buildDisplayLabels(byId, docOrder),
  };
}

// Labels are not identities. When a label occurs more than once, the display
// disambiguates the occurrences (A₁, A₂) in document order.
function buildDisplayLabels(
  byId: Map<NodeId, PNode>,
  docOrder: Map<NodeId, number>,
): Map<NodeId, string> {
  const byLabel = new Map<string, NodeId[]>();
  for (const [id, node] of byId) {
    const bucket = byLabel.get(node.label);
    if (bucket) bucket.push(id);
    else byLabel.set(node.label, [id]);
  }
  const out = new Map<NodeId, string>();
  for (const [label, ids] of byLabel) {
    if (ids.length === 1) {
      out.set(ids[0], label);
      continue;
    }
    ids
      .slice()
      .sort((a, b) => (docOrder.get(a) ?? 0) - (docOrder.get(b) ?? 0))
      .forEach((id, i) => out.set(id, label + subscript(i + 1)));
  }
  return out;
}

export function ch(sk: Skeleton, id: NodeId): NodeId[] {
  return sk.childIds.get(id) ?? [];
}

// The pooled children of every node in the configuration, in document order.
export function chOfConfig(sk: Skeleton, ids: NodeId[]): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<NodeId>();
  for (const id of ids) {
    for (const c of ch(sk, id)) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return sortByDocOrder(sk, out);
}

function sortByDocOrder(sk: Skeleton, ids: NodeId[]): NodeId[] {
  return ids
    .slice()
    .sort((a, b) => (sk.docOrder.get(a) ?? 0) - (sk.docOrder.get(b) ?? 0));
}

export function pd(sk: Skeleton, id: NodeId): number {
  if (id === sk.root) return 1;
  return sk.byId.get(id)?.prob ?? 0;
}

export function labelOf(sk: Skeleton, id: NodeId): string {
  return sk.displayLabel.get(id) ?? sk.byId.get(id)?.label ?? id;
}

// The root-to-v path in the skeleton, root first.
export function skeletonPath(sk: Skeleton, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  let cur: NodeId | null | undefined = id;
  while (cur != null) {
    out.push(cur);
    cur = sk.parent.get(cur) ?? null;
  }
  return out.reverse();
}

// The unconditional existence probability: the product of PD along the
// root-to-v path. Distinct from PD(v), which is conditional on the parent.
export function existenceProb(sk: Skeleton, id: NodeId): number {
  let p = 1;
  for (const u of skeletonPath(sk, id)) p *= pd(sk, u);
  return p;
}

export function allNodes(sk: Skeleton): NodeId[] {
  return sortByDocOrder(sk, [...sk.byId.keys()]);
}

export function hasMux(sk: Skeleton): boolean {
  for (const node of sk.byId.values()) {
    if (node.distType === 'mux' && node.children.length > 0) return true;
  }
  return false;
}
