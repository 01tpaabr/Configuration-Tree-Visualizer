import type { DistType, NodeId, PDocument, PNode } from './types';
import { newId } from './ids';

export function findNode(doc: PDocument, id: NodeId): PNode | null {
  let found: PNode | null = null;
  const walk = (n: PNode): void => {
    if (found) return;
    if (n.id === id) {
      found = n;
      return;
    }
    n.children.forEach(walk);
  };
  walk(doc.root);
  return found;
}

function findParent(doc: PDocument, id: NodeId): PNode | null {
  let found: PNode | null = null;
  const walk = (n: PNode): void => {
    if (found) return;
    for (const c of n.children) {
      if (c.id === id) {
        found = n;
        return;
      }
      walk(c);
    }
  };
  walk(doc.root);
  return found;
}

function allLabels(doc: PDocument): string[] {
  const out: string[] = [];
  const walk = (n: PNode): void => {
    out.push(n.label);
    n.children.forEach(walk);
  };
  walk(doc.root);
  return out;
}

export function subtreeSize(node: PNode): number {
  return 1 + node.children.reduce((s, c) => s + subtreeSize(c), 0);
}

function nextLabel(doc: PDocument): string {
  const used = new Set(allLabels(doc));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  for (let n = 1; ; n++) {
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i) + n;
      if (!used.has(c)) return c;
    }
  }
}

// Copies only the nodes between the root and the target; the rest is reused.
function mapNode(
  node: PNode,
  id: NodeId,
  fn: (n: PNode) => PNode,
): PNode {
  if (node.id === id) return fn(node);
  let changed = false;
  const children = node.children.map((c) => {
    const next = mapNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...node, children } : node;
}

function mapDoc(doc: PDocument, id: NodeId, fn: (n: PNode) => PNode): PDocument {
  const root = mapNode(doc.root, id, fn);
  return root === doc.root ? doc : { root };
}

function makeNode(label: string, prob = 0.5): PNode {
  return { id: newId(), label, prob, distType: null, children: [] };
}

// Appends (or inserts at index `at`) a new node under `parentId`. A parent
// gaining its first child gets an `ind` block.
export function addChild(doc: PDocument, parentId: NodeId, at?: number): PDocument {
  const fresh = makeNode(nextLabel(doc));
  return mapDoc(doc, parentId, (n) => {
    const children = n.children.slice();
    const idx = at == null ? children.length : Math.max(0, Math.min(at, children.length));
    children.splice(idx, 0, fresh);
    return { ...n, children, distType: n.distType ?? 'ind' };
  });
}

export function addSibling(
  doc: PDocument,
  nodeId: NodeId,
  side: 'before' | 'after',
): PDocument {
  const parent = findParent(doc, nodeId);
  if (!parent) return doc; // the root has no siblings
  const idx = parent.children.findIndex((c) => c.id === nodeId);
  return addChild(doc, parent.id, side === 'before' ? idx : idx + 1);
}

// Removes the node and its whole subtree. A parent left childless has its
// distType cleared.
export function deleteNode(doc: PDocument, nodeId: NodeId): PDocument {
  const parent = findParent(doc, nodeId);
  if (!parent) return doc;
  return mapDoc(doc, parent.id, (n) => {
    const children = n.children.filter((c) => c.id !== nodeId);
    return {
      ...n,
      children,
      distType: children.length === 0 ? null : n.distType,
    };
  });
}

// Duplicate labels are legal and must not warn.
export function setLabel(doc: PDocument, nodeId: NodeId, label: string): PDocument {
  return mapDoc(doc, nodeId, (n) => (n.label === label ? n : { ...n, label }));
}

export function setData(
  doc: PDocument,
  nodeId: NodeId,
  data: string | number | undefined,
): PDocument {
  return mapDoc(doc, nodeId, (n) => {
    const next: PNode = { ...n };
    if (data === undefined || data === '') delete next.data;
    else next.data = data;
    return next;
  });
}

// Clamped to [0,1]; rejected on the root, whose probability is always 1.
export function setProb(doc: PDocument, nodeId: NodeId, p: number): PDocument {
  if (nodeId === doc.root.id) return doc;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return mapDoc(doc, nodeId, (n) => (n.prob === clamped ? n : { ...n, prob: clamped }));
}

export function setDistType(
  doc: PDocument,
  nodeId: NodeId,
  type: DistType,
): PDocument {
  return mapDoc(doc, nodeId, (n) =>
    n.children.length === 0 || n.distType === type ? n : { ...n, distType: type },
  );
}

// Scale a mux block's children so their probabilities sum to 1.
export function normaliseMux(doc: PDocument, nodeId: NodeId): PDocument {
  return mapDoc(doc, nodeId, (n) => {
    const sum = n.children.reduce((s, c) => s + c.prob, 0);
    if (sum === 0 || n.children.length === 0) return n;
    return {
      ...n,
      children: n.children.map((c) => ({ ...c, prob: c.prob / sum })),
    };
  });
}

export function moveChild(doc: PDocument, nodeId: NodeId, delta: number): PDocument {
  const parent = findParent(doc, nodeId);
  if (!parent) return doc;
  const from = parent.children.findIndex((c) => c.id === nodeId);
  const to = from + delta;
  if (to < 0 || to >= parent.children.length) return doc;
  return mapDoc(doc, parent.id, (n) => {
    const children = n.children.slice();
    const [moved] = children.splice(from, 1);
    children.splice(to, 0, moved);
    return { ...n, children };
  });
}

export function replaceDocument(next: PDocument): PDocument {
  return { root: { ...next.root, prob: 1 } };
}
