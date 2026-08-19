import { useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { useQueryStore, type PathQuery } from '../../store/queries';
import { paletteColor } from '../../core/paths/palette';
import { PathContext, PathBudgetError } from '../../core/paths/context';
import { parseQuery, type PathParseError } from '../../core/paths/parse';
import {
  evaluateNodeExpr,
  evaluatePath,
  liveRoutes,
  type Evaluation,
} from '../../core/paths/evaluate';
import { printQuery } from '../../core/paths/ast';

export interface QueryResult {
  query: PathQuery;
  color: string;
  // null while the text is empty
  kind: 'path' | 'node' | null;
  errors: PathParseError[];
  pretty: string | null;
  // path mode
  evaluation: Evaluation | null;
  live: Set<string>;
  targets: Set<string>;
  // node-expression mode
  satisfying: Set<string> | null;
  budgetError: string | null;
  // this highlight is from the last text that parsed, kept while the current
  // text does not; the canvas draws it greyed rather than clearing
  stale: boolean;
}

// Evaluate every path expression against the current document. Re-runs on any
// document change; sometimes more often than needed, never less.
export function useEvaluations(): {
  results: QueryResult[];
  startKey: string;
  ctx: PathContext;
} {
  const skeleton = useStore((s) => s.skeleton);
  const materialized = useStore((s) => s.tree.vertices);
  const queries = useQueryStore((s) => s.queries);
  const requestedStart = useQueryStore((s) => s.startKey);

  const startKey =
    requestedStart && materialized.has(requestedStart) ? requestedStart : skeleton.root;

  // the last result that parsed, per expression
  const lastGood = useRef(new Map<string, QueryResult>());

  return useMemo(() => {
    const ctx = new PathContext(skeleton);

    const results = queries.map((query): QueryResult => {
      const color = query.colorIndex === null ? '#8A8F98' : paletteColor(query.colorIndex);
      const base: QueryResult = {
        query,
        color,
        kind: null,
        errors: [],
        pretty: null,
        evaluation: null,
        live: new Set(),
        targets: new Set(),
        satisfying: null,
        budgetError: null,
        stale: false,
      };
      if (query.text.trim() === '') {
        lastGood.current.delete(query.id);
        return base;
      }

      const parsed = parseQuery(query.text);
      if (!parsed.ok) {
        // never clear the canvas on a parse error; keep the last good highlight
        const previous = lastGood.current.get(query.id);
        return previous
          ? { ...previous, query, errors: parsed.errors, stale: true }
          : { ...base, errors: parsed.errors };
      }

      try {
        if (parsed.kind === 'node') {
          const ok: QueryResult = {
            ...base,
            kind: 'node',
            pretty: printQuery(parsed.ast),
            satisfying: evaluateNodeExpr(ctx, materialized.keys(), parsed.ast),
          };
          lastGood.current.set(query.id, ok);
          return ok;
        }
        const evaluation = evaluatePath(ctx, startKey, parsed.ast);
        const ok: QueryResult = {
          ...base,
          kind: 'path',
          pretty: printQuery(parsed.ast),
          evaluation,
          live: liveRoutes(startKey, evaluation.raw.targets),
          targets: new Set(evaluation.raw.targets),
        };
        lastGood.current.set(query.id, ok);
        return ok;
      } catch (e) {
        if (e instanceof PathBudgetError) return { ...base, budgetError: e.message };
        return {
          ...base,
          errors: [
            {
              message: e instanceof Error ? e.message : String(e),
              from: 0,
              to: query.text.length,
            },
          ],
        };
      }
    });

    return { results, startKey, ctx };
  }, [skeleton, queries, startKey, materialized]);
}
