import { expect } from 'vitest';
import { parsePDocument } from '../parse';
import { buildSkeleton } from '../skeleton';
import { formatDescent } from '../format';
import { materialize } from '../cfgtree';
import type { PDocument, Skeleton } from '../types';

export function doc(xml: string): PDocument {
  const r = parsePDocument(xml);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.doc;
}

export function sk(xml: string): Skeleton {
  return buildSkeleton(doc(xml));
}

// id of the skeleton node carrying `label`
export function idOf(skel: Skeleton, label: string, occurrence = 0): string {
  const hits = [...skel.byId.values()]
    .filter((n) => n.label === label)
    .sort((a, b) => (skel.docOrder.get(a.id) ?? 0) - (skel.docOrder.get(b.id) ?? 0));
  const hit = hits[occurrence];
  if (!hit) throw new Error(`no node labelled ${label}#${occurrence}`);
  return hit.id;
}

// The expected table, one row per vertex, parents before children.
export function table(
  skel: Skeleton,
): Array<[string, number, number, number, boolean]> {
  return materialize(skel).order.map((v) => [
    formatDescent(skel, v),
    v.depth,
    round(v.stepProb),
    round(v.reachProb),
    v.isLeaf,
  ]);
}

export function round(n: number): number {
  return Number(n.toPrecision(12));
}

export function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9);
}
