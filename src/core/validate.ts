import type { PDocument, PNode, ValidationIssue } from './types';
import { isValidLabel } from './parse';

// `ind` sibling probabilities may legally sum above 1; only `mux` is constrained.
export function validateDocument(doc: PDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (Math.abs(doc.root.prob - 1) > 1e-12) {
    issues.push({
      nodeId: doc.root.id,
      message: 'the root exists with probability 1',
    });
  }

  const walk = (node: PNode, isRoot: boolean): void => {
    if (!isValidLabel(node.label)) {
      issues.push({
        nodeId: node.id,
        message: `"${node.label}" is not a valid XML element name`,
      });
    }
    if (!isRoot && !(node.prob >= 0 && node.prob <= 1)) {
      issues.push({
        nodeId: node.id,
        message: `${node.label}: prob must lie in [0,1]`,
      });
    }
    if (node.children.length > 0 && node.distType == null) {
      issues.push({
        nodeId: node.id,
        message: `children of an ordinary node must sit inside an \`ind\` or \`mux\` block`,
      });
    }
    if (isMuxInvalid(node)) {
      issues.push({
        nodeId: node.id,
        message: `mux block under ${node.label}: Σ p = ${muxSum(node).toPrecision(6)} > 1`,
      });
    }
    node.children.forEach((c) => walk(c, false));
  };
  walk(doc.root, true);
  return issues;
}

export function muxSum(node: PNode): number {
  return node.children.reduce((s, c) => s + c.prob, 0);
}

export function isMuxInvalid(node: PNode): boolean {
  return node.distType === 'mux' && muxSum(node) > 1 + 1e-12;
}
