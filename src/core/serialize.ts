import type { PDocument, PNode } from './types';
import { exactDecimal } from './format';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrsOf(node: PNode, isRoot: boolean): string {
  const parts: string[] = [];
  if (!isRoot) parts.push(` prob="${exactDecimal(node.prob)}"`);
  if (node.data !== undefined && node.data !== '') {
    parts.push(` data="${esc(String(node.data))}"`);
  }
  return parts.join('');
}

export function serializePDocument(doc: PDocument): string {
  const lines: string[] = [];
  const emit = (node: PNode, indent: string, isRoot: boolean): void => {
    const attrs = attrsOf(node, isRoot);
    if (node.children.length === 0) {
      lines.push(`${indent}<${node.label}${attrs}/>`);
      return;
    }
    const block = node.distType ?? 'ind';
    lines.push(`${indent}<${node.label}${attrs}>`);
    lines.push(`${indent}  <${block}>`);
    for (const c of node.children) emit(c, indent + '    ', false);
    lines.push(`${indent}  </${block}>`);
    lines.push(`${indent}</${node.label}>`);
  };
  emit(doc.root, '', true);
  return lines.join('\n') + '\n';
}

// The document a leaf determines, as plain XML: the sampling has already
// happened, so no distributional blocks and no probabilities.
export function serializePossibleDocument(
  root: PNode,
  keep: Set<string>,
): string {
  const lines: string[] = [];
  const emit = (node: PNode, indent: string): void => {
    const kept = node.children.filter((c) => keep.has(c.id));
    const attrs =
      node.data !== undefined && node.data !== ''
        ? ` data="${esc(String(node.data))}"`
        : '';
    if (kept.length === 0) {
      lines.push(`${indent}<${node.label}${attrs}/>`);
      return;
    }
    lines.push(`${indent}<${node.label}${attrs}>`);
    for (const c of kept) emit(c, indent + '  ');
    lines.push(`${indent}</${node.label}>`);
  };
  emit(root, '');
  return lines.join('\n') + '\n';
}
