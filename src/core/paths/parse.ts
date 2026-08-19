import type { NodeExpr, Path } from './ast';
import { parse, SyntaxError as GrammarError } from './grammar.js';

// The concrete syntax lives in grammar.pegjs; Peggy generates grammar.js from
// it (`npm run gen:parser`). This file only converts the generated parser's
// errors into the {message, from, to} shape the app uses.

export interface PathParseError {
  message: string;
  from: number;
  to: number;
}

export type ParsedQuery =
  | { ok: true; kind: 'path'; ast: Path }
  | { ok: true; kind: 'node'; ast: NodeExpr }
  | { ok: false; errors: PathParseError[] };

export function parseQuery(src: string): ParsedQuery {
  if (src.trim() === '') {
    return { ok: false, errors: [{ message: 'empty expression', from: 0, to: 0 }] };
  }
  try {
    const r = parse(src);
    return { ok: true, kind: r.kind, ast: r.ast } as ParsedQuery;
  } catch (e) {
    if (e instanceof GrammarError) {
      const from = e.location?.start.offset ?? 0;
      const to = e.location?.end.offset ?? from;
      return {
        ok: false,
        errors: [{ message: e.message, from, to: Math.max(to, from + 1) }],
      };
    }
    return {
      ok: false,
      errors: [
        { message: e instanceof Error ? e.message : String(e), from: 0, to: src.length },
      ],
    };
  }
}

export function parsePath(
  src: string,
): { ok: true; ast: Path } | { ok: false; errors: PathParseError[] } {
  const r = parseQuery(src);
  if (!r.ok) return r;
  if (r.kind !== 'path') {
    return {
      ok: false,
      errors: [{ message: 'expected a path expression', from: 0, to: src.length }],
    };
  }
  return { ok: true, ast: r.ast };
}
