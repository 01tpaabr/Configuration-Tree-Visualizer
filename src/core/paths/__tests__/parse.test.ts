import { describe, expect, it } from 'vitest';
import { parseQuery, parsePath } from '../parse';
import { printPath, printQuery, type Path } from '../ast';

function ast(src: string): Path {
  const r = parsePath(src);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.ast;
}

function errorOf(src: string): string {
  const r = parseQuery(src);
  if (r.ok) throw new Error(`"${src}" unexpectedly parsed`);
  return r.errors[0].message;
}

describe('parser', () => {
  it('P1: `down [B]` and `↓[B]` give identical ASTs', () => {
    expect(ast('down [B]')).toEqual(ast('↓[B]'));
    expect(printPath(ast('down [B]'))).toBe('↓[B]');
  });

  it('P2: composition binds tighter than union', () => {
    const a = ast('down [A] down [F] | down [B]');
    expect(a.k).toBe('union');
    expect(printPath(a)).toBe('↓[A]↓[F] ∪ ↓[B]');
    expect(a).toEqual(ast('↓[A]↓[F] ∪ ↓[B]'));
    // explicit grouping of the same shape parses identically
    expect(a).toEqual(ast('(↓[A]↓[F]) ∪ (↓[B])'));
  });

  it('P3: `[A and !B]` and `[A ∧ ¬B]` give identical ASTs', () => {
    expect(ast('[A and !B]')).toEqual(ast('[A ∧ ¬B]'));
    expect(printPath(ast('[A and !B]'))).toBe('[A ∧ ¬B]');
  });

  it('P4: `<down [F]>_0.5` and `⟨↓[F]⟩_1/2` give identical ASTs with q = 0.5', () => {
    const a = parseQuery('[<down [F]>_0.5]');
    const b = parseQuery('[⟨↓[F]⟩_1/2]');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.ast).toEqual(b.ast);
    const test = a.ast as Extract<Path, { k: 'test' }>;
    expect(test.phi.k).toBe('modality');
    if (test.phi.k === 'modality') expect(test.phi.q).toBe(0.5);
  });

  it('P5: a threshold outside [0,1] is a parse error', () => {
    expect(errorOf('[<down>_1.5]')).toMatch(/outside \[0,1\]/);
    expect(errorOf('[<down>_-1]')).toBeTruthy();
  });

  it('P6: `down*`, `up`, `↓*` are rejected; only the child step is defined', () => {
    for (const src of ['down*', 'up', '↓*', '↑', '↑*']) {
      expect(errorOf(src), src).toBe('only the child step ↓ is defined in this fragment');
    }
  });

  it('P7: data comparison is rejected', () => {
    expect(errorOf('[<down [A] = down [B]>_0.5]')).toBe(
      'data comparison is not yet defined for this logic',
    );
    expect(errorOf('[<down [A] ≠ down [B]>_0.5]')).toBe(
      'data comparison is not yet defined for this logic',
    );
  });

  it('P8: `[down]` is a reserved word; `[\'down\']` is a label', () => {
    expect(errorOf('[down]')).toBeTruthy();
    const a = ast("['down']");
    expect(a).toEqual({ k: 'test', phi: { k: 'label', label: 'down' } });
    expect(printPath(a)).toBe("['down']");
  });

  it('P9: pretty-printing round-trips', () => {
    const sources = [
      '↓',
      'ε',
      '↓↓',
      '↓[B]',
      '↓↓[F]',
      '↓[A]↓[F]',
      '↓[A ∧ ¬B]↓[F]',
      '↓ ∪ ↓↓',
      '(↓ ∪ ε)(↓ ∪ ε)',
      '[⟨↓[F]⟩_0.5]',
      '↓[A ∨ B ∧ ¬C]',
      "['down']",
    ];
    for (const src of sources) {
      const first = ast(src);
      const printed = printPath(first);
      expect(ast(printed), `${src} → ${printed}`).toEqual(first);
    }
  });

  it('accepts a node expression on its own', () => {
    const r = parseQuery('A and !B');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kind).toBe('node');
    expect(printQuery(r.ast)).toBe('A ∧ ¬B');
  });

  it('a bare test parses as a path, not a node expression', () => {
    const r = parseQuery('[A]');
    expect(r.ok && r.kind).toBe('path');
  });

  it('reports a span for the offending token', () => {
    const r = parseQuery('↓ ∪');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].from).toBeGreaterThan(0);
  });
});
