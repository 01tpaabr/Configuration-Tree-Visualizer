import { exactDecimal } from '../format';

// The path fragment:
//   paths:            down | eps | [phi] | composition | union
//   node expressions: label | not | and | or | modality with a threshold
// The two sorts are mutually recursive: a test holds a node expression, which
// may hold a modality, which holds a path.

export type Path =
  | { k: 'down' }
  | { k: 'eps' }
  | { k: 'test'; phi: NodeExpr }
  | { k: 'comp'; left: Path; right: Path }
  | { k: 'union'; left: Path; right: Path };

export type NodeExpr =
  | { k: 'label'; label: string }
  | { k: 'not'; sub: NodeExpr }
  | { k: 'and'; left: NodeExpr; right: NodeExpr }
  | { k: 'or'; left: NodeExpr; right: NodeExpr }
  | { k: 'modality'; path: Path; q: number };

export type VertexKey = string;

function isPath(x: Path | NodeExpr): x is Path {
  return (
    x.k === 'down' || x.k === 'eps' || x.k === 'test' || x.k === 'comp' || x.k === 'union'
  );
}

// Upper bound on how many levels a path can descend. Every target sits at
// depth at most depth(start) + downCount(path), which bounds evaluation to a
// band of the tree.
export function downCount(a: Path): number {
  switch (a.k) {
    case 'down':
      return 1;
    case 'eps':
      return 0;
    case 'test':
      return 0; // a modality inside a test starts from its own state
    case 'comp':
      return downCount(a.left) + downCount(a.right);
    case 'union':
      return Math.max(downCount(a.left), downCount(a.right));
  }
}

function flattenComp(a: Path): Path[] {
  return a.k === 'comp' ? [...flattenComp(a.left), ...flattenComp(a.right)] : [a];
}

function flattenUnion(a: Path): Path[] {
  return a.k === 'union' ? [...flattenUnion(a.left), ...flattenUnion(a.right)] : [a];
}

// The app displays the Unicode spelling; the parser accepts both.
export function printPath(a: Path, parentPrec = 0): string {
  const prec = { union: 1, comp: 2, atom: 3 } as const;
  const wrap = (s: string, p: number): string => (p < parentPrec ? `(${s})` : s);
  switch (a.k) {
    case 'down':
      return '↓';
    case 'eps':
      return 'ε';
    case 'test':
      return `[${printNode(a.phi)}]`;
    case 'comp':
      return wrap(
        flattenComp(a)
          .map((x) => printPath(x, prec.comp))
          .join(''),
        prec.comp,
      );
    case 'union':
      return wrap(
        flattenUnion(a)
          .map((x) => printPath(x, prec.union + 1))
          .join(' ∪ '),
        prec.union,
      );
  }
}

function printNode(f: NodeExpr, parentPrec = 0): string {
  const prec = { or: 1, and: 2, not: 3, atom: 4 } as const;
  const wrap = (s: string, p: number): string => (p < parentPrec ? `(${s})` : s);
  switch (f.k) {
    case 'label':
      return RESERVED.has(f.label) ? `'${f.label}'` : f.label;
    case 'not':
      return wrap(`¬${printNode(f.sub, prec.not)}`, prec.not);
    case 'and':
      return wrap(
        `${printNode(f.left, prec.and)} ∧ ${printNode(f.right, prec.and + 1)}`,
        prec.and,
      );
    case 'or':
      return wrap(
        `${printNode(f.left, prec.or)} ∨ ${printNode(f.right, prec.or + 1)}`,
        prec.or,
      );
    case 'modality':
      return `⟨${printPath(f.path)}⟩_${exactDecimal(f.q)}`;
  }
}

export function printQuery(x: Path | NodeExpr): string {
  return isPath(x) ? printPath(x) : printNode(x);
}

// A label colliding with one of these must be quoted.
export const RESERVED = new Set(['down', 'eps', 'and', 'or', 'not']);
