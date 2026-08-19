import type { VertexKey } from './ast';
import { isStrictAncestor, type PathContext } from './context';

// A family of target vertices is "reduced" when no element is a strict
// ancestor of another. Only then are the cones pairwise disjoint, and only
// then may their measures be summed.

export function isReduced(family: VertexKey[]): boolean {
  const sorted = [...family].sort();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = 0; j < sorted.length; j++) {
      if (i !== j && isStrictAncestor(sorted[i], sorted[j])) return false;
    }
  }
  return true;
}

// Keep only the elements with no strict ancestor in the family. Coarsens by
// discarding the deeper entries.
export function ancestorMaximal(family: VertexKey[]): VertexKey[] {
  const set = new Set(family);
  return family.filter((y) => {
    for (const x of set) if (x !== y && isStrictAncestor(x, y)) return false;
    return true;
  });
}

// Replace `x` by its children. Represents the same event, because the cone of
// `x` is the disjoint union of its children's cones.
function redistribute(
  ctx: PathContext,
  family: VertexKey[],
  x: VertexKey,
): VertexKey[] {
  const kids = ctx.children(x);
  const out = family.filter((s) => s !== x);
  for (const k of kids) if (!out.includes(k)) out.push(k);
  return out;
}

// Repeatedly redistribute any element that is a strict ancestor of another,
// until the family is reduced. Refines rather than coarsens: every deeper
// target keeps an entry.
export function align(ctx: PathContext, family: VertexKey[]): VertexKey[] {
  let current = [...new Set(family)];
  for (let guard = 0; guard < 10_000; guard++) {
    const offender = current.find((x) =>
      current.some((y) => x !== y && isStrictAncestor(x, y)),
    );
    if (!offender) return sortByKey(current);
    current = redistribute(ctx, current, offender);
  }
  throw new Error('alignment failed to terminate');
}

// The measure of the event a reduced family represents. Refuses an unreduced
// family: overlapping cones must not be summed.
export function familyMeasure(
  ctx: PathContext,
  start: VertexKey,
  family: VertexKey[],
): number {
  if (!isReduced(family)) {
    throw new Error(
      'familyMeasure: the family is not reduced; its cones overlap and must not be summed',
    );
  }
  let sum = 0;
  for (const s of family) sum += ctx.coneMeasure(start, s);
  return sum;
}

export function sortByKey(family: VertexKey[]): VertexKey[] {
  return [...family].sort((a, b) => {
    const da = a.split('|').length;
    const db = b.split('|').length;
    return da === db ? (a < b ? -1 : a > b ? 1 : 0) : da - db;
  });
}
