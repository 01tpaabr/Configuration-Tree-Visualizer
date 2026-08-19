// Types for the Peggy-generated parser (grammar.js, built from grammar.pegjs).
import type { NodeExpr, Path } from './ast';

export type QueryAst =
  | { kind: 'path'; ast: Path }
  | { kind: 'node'; ast: NodeExpr };

export function parse(input: string): QueryAst;

export class SyntaxError extends Error {
  location: {
    start: { offset: number };
    end: { offset: number };
  };
}
