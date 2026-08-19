import type { NodeExpr, Path, VertexKey } from './ast';
import { downCount } from './ast';
import { isBelow, type PathContext } from './context';
import { align, ancestorMaximal, familyMeasure, isReduced, sortByKey } from './families';
import { TOLERANCE } from '../types';

export interface Support {
  targets: VertexKey[]; // deduplicated, in tree order
  reduced: boolean; // no element a strict ancestor of another
}

export interface RowEntry {
  target: VertexKey;
  value: number;
}

export interface Evaluation {
  start: VertexKey;
  raw: Support;
  // Aligned; the only family whose entries may be summed.
  normalized: Support;
  row: RowEntry[];
  // The modality value: the probability of reaching a non-empty configuration.
  value: number;
  // Raw targets whose configuration is empty, excluded before summing.
  excludedEmpty: VertexKey[];
  // Ancestor-maximal positive targets: the ones the value actually sums.
  contributing: VertexKey[];
}

interface Memo {
  support: Map<string, VertexKey[]>;
  satisfies: Map<string, boolean>;
  value: Map<string, number>;
  ids: Map<Path | NodeExpr, number>;
  nextId: number;
}

function newMemo(): Memo {
  return {
    support: new Map(),
    satisfies: new Map(),
    value: new Map(),
    ids: new Map(),
    nextId: 0,
  };
}

function idOf(memo: Memo, x: Path | NodeExpr): number {
  let id = memo.ids.get(x);
  if (id === undefined) {
    id = memo.nextId++;
    memo.ids.set(x, id);
  }
  return id;
}

// The support of a path from a start state: the set of states it can reach.
export function rawSupport(
  ctx: PathContext,
  start: VertexKey,
  alpha: Path,
  memo: Memo = newMemo(),
): VertexKey[] {
  const key = `${start}#${idOf(memo, alpha)}`;
  const hit = memo.support.get(key);
  if (hit) return hit;

  let out: VertexKey[];
  switch (alpha.k) {
    case 'eps':
      out = [start];
      break;
    case 'test':
      out = satisfies(ctx, start, alpha.phi, memo) ? [start] : [];
      break;
    case 'down':
      out = ctx.children(start);
      break;
    case 'union':
      out = [
        ...new Set([
          ...rawSupport(ctx, start, alpha.left, memo),
          ...rawSupport(ctx, start, alpha.right, memo),
        ]),
      ];
      break;
    case 'comp': {
      // The same target can be reached through several intermediates.
      const seen = new Set<VertexKey>();
      for (const rho of rawSupport(ctx, start, alpha.left, memo)) {
        for (const s of rawSupport(ctx, rho, alpha.right, memo)) seen.add(s);
      }
      out = [...seen];
      break;
    }
  }

  out = sortByKey(out);
  memo.support.set(key, out);
  return out;
}

export function satisfies(
  ctx: PathContext,
  pi: VertexKey,
  phi: NodeExpr,
  memo: Memo = newMemo(),
): boolean {
  const key = `${pi}#${idOf(memo, phi)}`;
  const hit = memo.satisfies.get(key);
  if (hit !== undefined) return hit;

  let out: boolean;
  switch (phi.k) {
    // A label test reads only the last level of the descent.
    case 'label':
      out = ctx.labelsAt(pi).has(phi.label);
      break;
    // The complement is over all states, so an empty configuration satisfies
    // a negated label.
    case 'not':
      out = !satisfies(ctx, pi, phi.sub, memo);
      break;
    case 'and':
      out = satisfies(ctx, pi, phi.left, memo) && satisfies(ctx, pi, phi.right, memo);
      break;
    case 'or':
      out = satisfies(ctx, pi, phi.left, memo) || satisfies(ctx, pi, phi.right, memo);
      break;
    case 'modality':
      out = value(ctx, pi, phi.path, memo) >= phi.q - TOLERANCE;
      break;
  }

  memo.satisfies.set(key, out);
  return out;
}

// The modality value: filter empty-configuration targets first, take the
// ancestor-maximal survivors, sum their cone measures.
export function value(
  ctx: PathContext,
  start: VertexKey,
  alpha: Path,
  memo: Memo = newMemo(),
): number {
  const key = `${start}#${idOf(memo, alpha)}`;
  const hit = memo.value.get(key);
  if (hit !== undefined) return hit;

  const positive = rawSupport(ctx, start, alpha, memo).filter((s) => ctx.isPositive(s));
  const maximal = ancestorMaximal(positive);
  const out = familyMeasure(ctx, start, maximal);

  memo.value.set(key, out);
  return out;
}

// Everything the UI needs for one (start, path) pair.
export function evaluatePath(
  ctx: PathContext,
  start: VertexKey,
  alpha: Path,
): Evaluation {
  const memo = newMemo();
  const raw = rawSupport(ctx, start, alpha, memo);

  const maxDepth = ctx.depth(start) + downCount(alpha);
  for (const s of raw) {
    if (!isBelow(s, start)) {
      throw new Error(`support target ${s} is not below the start state ${start}`);
    }
    if (ctx.depth(s) > maxDepth) {
      throw new Error(`support target ${s} is deeper than depth(π) + downCount(α)`);
    }
  }

  const positive = raw.filter((s) => ctx.isPositive(s));
  const excludedEmpty = raw.filter((s) => !ctx.isPositive(s));
  const contributing = ancestorMaximal(positive);
  const normalized = align(ctx, positive);

  // An entry is never a partial sum: it is worth the full cone measure or 0.
  const row: RowEntry[] = raw.map((target) => ({
    target,
    value: ctx.coneMeasure(start, target),
  }));

  return {
    start,
    raw: { targets: raw, reduced: isReduced(raw) },
    normalized: { targets: normalized, reduced: isReduced(normalized) },
    row,
    value: familyMeasure(ctx, start, contributing),
    excludedEmpty,
    contributing,
  };
}

// Every vertex on the path from the start state to a target, targets and
// start included. Drives route highlighting on the canvas.
export function liveRoutes(start: VertexKey, targets: VertexKey[]): Set<VertexKey> {
  const live = new Set<VertexKey>([start]);
  for (const t of targets) {
    live.add(t);
    let k = t;
    while (k !== start && k.length > start.length) {
      const cut = k.lastIndexOf('|');
      if (cut < 0) break;
      k = k.slice(0, cut);
      live.add(k);
    }
  }
  return live;
}

// Node-expression mode: which of the given vertices satisfy the expression.
export function evaluateNodeExpr(
  ctx: PathContext,
  vertices: Iterable<VertexKey>,
  phi: NodeExpr,
): Set<VertexKey> {
  const memo = newMemo();
  const out = new Set<VertexKey>();
  for (const key of vertices) if (satisfies(ctx, key, phi, memo)) out.add(key);
  return out;
}
