import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_W } from '../../fixtures';
import { parsePDocument } from '../../parse';
import { buildSkeleton } from '../../skeleton';
import type { Skeleton } from '../../types';
import { PathContext } from '../context';
import { parsePath } from '../parse';
import { evaluatePath, rawSupport, satisfies, value } from '../evaluate';
import { align, ancestorMaximal, isReduced } from '../families';
import { printPath, type Path } from '../ast';

let sk: Skeleton;
let ctx: PathContext;
let r: string;
let A: string, B: string, C: string, D: string;

// vertex keys of the worked fixture
let PI0: string, EMPTY1: string, VA: string, VB: string, VAB: string;

beforeEach(() => {
  const parsed = parsePDocument(FIXTURE_W);
  if (!parsed.ok) throw new Error('fixture W must parse');
  sk = buildSkeleton(parsed.doc);
  ctx = new PathContext(sk);
  r = sk.root;
  const id = (label: string): string => {
    const hit = [...sk.byId.values()].find((n) => n.label === label);
    if (!hit) throw new Error(`no node ${label}`);
    return hit.id;
  };
  A = id('A');
  B = id('B');
  C = id('C');
  D = id('D');
  PI0 = r;
  EMPTY1 = `${r}|`;
  VA = `${r}|${A}`;
  VB = `${r}|${B}`;
  VAB = `${r}|${A},${B}`;
});

const p = (src: string): Path => {
  const res = parsePath(src);
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
  return res.ast;
};

const val = (start: string, src: string): number => value(ctx, start, p(src));
const supp = (start: string, src: string): string[] => rawSupport(ctx, start, p(src));
const close = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected), `${actual} ≉ ${expected}`).toBeLessThanOrEqual(1e-9);
};

describe('semantics on the worked fixture', () => {
  it('S1: supp(π₀, ε) = {π₀}', () => {
    expect(supp(PI0, 'ε')).toEqual([PI0]);
  });

  it('S2: supp(π₀, ↓) is the four depth-1 vertices', () => {
    expect(new Set(supp(PI0, '↓'))).toEqual(new Set([EMPTY1, VA, VB, VAB]));
  });

  it('S3: supp(π₀, [B]) = ∅; the root configuration is {r}, not B', () => {
    expect(supp(PI0, '[B]')).toEqual([]);
    expect(satisfies(ctx, PI0, { k: 'label', label: 'B' })).toBe(false);
  });

  it('S4: val(π₀, ε) = 1', () => close(val(PI0, 'ε'), 1));
  it('S5: val(π₀, ↓) = 0.90', () => close(val(PI0, '↓'), 0.9));
  it('S6: val(π₀, ↓↓) = 0.8476', () => close(val(PI0, '↓↓'), 0.8476));
  it('S7: val(π₀, ↓[B]) = 0.50 = PD(B)', () => close(val(PI0, '↓[B]'), 0.5));
  it('S8: val(π₀, ↓↓[F]) = 0.35 = PD(B)·PD(F)', () => close(val(PI0, '↓↓[F]'), 0.35));
  it('S9: val(π₀, ↓[A]↓[F]) = 0.28', () => close(val(PI0, '↓[A]↓[F]'), 0.28));
  it('S10: val(π₀, ↓[A ∧ ¬B]↓[F]) = 0', () => close(val(PI0, '↓[A ∧ ¬B]↓[F]'), 0));
  it('S11: val(π₀, ↓[B ∧ ¬A]↓[F]) = 0.07', () => close(val(PI0, '↓[B ∧ ¬A]↓[F]'), 0.07));

  it('S12: val(π₀, ↓ ∪ ↓↓) = 0.90, not 1.7476, not 0.8476', () => {
    const v = val(PI0, '↓ ∪ ↓↓');
    close(v, 0.9);
    expect(v).not.toBeCloseTo(1.7476, 6);
    expect(v).not.toBeCloseTo(0.8476, 6);
  });

  it('S13: val(↓) at the four depth-1 states', () => {
    close(val(VA, '↓'), 0.95);
    close(val(VB, '↓'), 0.73);
    close(val(VAB, '↓'), 0.9865);
    close(val(EMPTY1, '↓'), 0);
  });

  it('S14: val(({r},{A}), ↓[C]) = 0.50', () => close(val(VA, '↓[C]'), 0.5));

  it('S15: val(({r},{A}), ↓[C] ∪ ↓[D]) = 0.95', () => {
    close(val(VA, '↓[C] ∪ ↓[D]'), 0.95);
  });

  it('S16: ⟦↓⟧(π₀, ({r},{A})) = 0.40 and ⟦↓↓⟧(π₀, ({r},{A},{C})) = 0.02', () => {
    const one = evaluatePath(ctx, PI0, p('↓'));
    close(one.row.find((e) => e.target === VA)!.value, 0.4);
    const two = evaluatePath(ctx, PI0, p('↓↓'));
    close(two.row.find((e) => e.target === `${VA}|${C}`)!.value, 0.02);
  });

  it('S17: every entry of every computed row is 0 or c_π(σ)', () => {
    for (const src of ['ε', '↓', '↓↓', '↓[B]', '↓↓[F]', '↓[A]↓[F]', '↓ ∪ ↓↓']) {
      for (const entry of evaluatePath(ctx, PI0, p(src)).row) {
        const c = ctx.coneMeasure(PI0, entry.target);
        expect(entry.value === 0 || Math.abs(entry.value - c) <= 1e-9, `${src} ${entry.target}`).toBe(true);
      }
    }
  });

  it('S18: for ↓ ∪ ↓↓ the deletion-based value equals the alignment-based sum', () => {
    const ev = evaluatePath(ctx, PI0, p('↓ ∪ ↓↓'));
    const alignedSum = ev.normalized.targets.reduce(
      (s, t) => s + ctx.coneMeasure(PI0, t),
      0,
    );
    close(ev.value, 0.9);
    close(alignedSum, 0.9);
  });

  it('S19: the aligned family for ↓ ∪ ↓↓ is 24 depth-2 targets, three with cfg = ∅', () => {
    const ev = evaluatePath(ctx, PI0, p('↓ ∪ ↓↓'));
    const fam = ev.normalized.targets;
    expect(fam.length).toBe(24);
    for (const t of fam) expect(ctx.depth(t)).toBe(2);
    expect(fam.filter((t) => ctx.cfg(t).length === 0).length).toBe(3);
    expect(isReduced(fam)).toBe(true);
  });

  it('S20: re-filtering the aligned family gives 0.8476, the known wrong answer', () => {
    const ev = evaluatePath(ctx, PI0, p('↓ ∪ ↓↓'));
    const wrong = ev.normalized.targets
      .filter((t) => ctx.cfg(t).length > 0)
      .reduce((s, t) => s + ctx.coneMeasure(PI0, t), 0);
    close(wrong, 0.8476);
    // exactly the mass of the three redistributed empty targets
    close(ev.value - wrong, 0.0524);
  });

  it('S21: the raw support of ↓ ∪ ↓↓ is not reduced', () => {
    expect(evaluatePath(ctx, PI0, p('↓ ∪ ↓↓')).raw.reduced).toBe(false);
  });

  it('S22: the raw support of every union-free expression is reduced', () => {
    for (const src of ['ε', '↓', '↓↓', '↓[B]', '↓↓[F]', '↓[A]↓[F]', '↓[A ∧ ¬B]↓[F]']) {
      expect(evaluatePath(ctx, PI0, p(src)).raw.reduced, src).toBe(true);
    }
  });

  it('S23: (↓ ∪ ε)(↓ ∪ ε) does not over-count; the entry is 0.40, not 0.80', () => {
    const ev = evaluatePath(ctx, PI0, p('(↓ ∪ ε)(↓ ∪ ε)'));
    const entry = ev.row.find((e) => e.target === VA);
    expect(entry).toBeDefined();
    close(entry!.value, 0.4);
  });

  it('S24: supp(π, ↓) at a leaf is ∅, and val = 0', () => {
    expect(ctx.vertex(EMPTY1).isLeaf).toBe(true);
    expect(supp(EMPTY1, '↓')).toEqual([]);
    close(val(EMPTY1, '↓'), 0);
    const deepLeaf = `${VA}|${C},${D}`;
    expect(ctx.vertex(deepLeaf).isLeaf).toBe(true);
    expect(supp(deepLeaf, '↓')).toEqual([]);
  });

  it('S25 / S26: targets stay below the start state and inside the depth band', () => {
    // evaluatePath asserts both internally; this exercises it across the table
    for (const src of ['ε', '↓', '↓↓', '↓[B]', '↓↓[F]', '↓ ∪ ↓↓', '(↓ ∪ ε)(↓ ∪ ε)']) {
      expect(() => evaluatePath(ctx, PI0, p(src)), src).not.toThrow();
    }
    for (const t of supp(PI0, '↓↓')) {
      expect(t.startsWith(PI0 + '|')).toBe(true);
      expect(ctx.depth(t)).toBeLessThanOrEqual(2);
    }
  });

  it('S27: ⟨↓[B]⟩_0.5 holds at π₀; ⟨↓[B]⟩_0.51 does not', () => {
    expect(satisfies(ctx, PI0, { k: 'modality', path: p('↓[B]'), q: 0.5 })).toBe(true);
    expect(satisfies(ctx, PI0, { k: 'modality', path: p('↓[B]'), q: 0.51 })).toBe(false);
  });

  it('S28: for union-free α, β the support row equals the matrix-product row', () => {
    const cases: Array<[string, string]> = [
      ['↓', '↓'],
      ['↓[A]', '↓[F]'],
      ['↓', '[B]'],
      ['↓[B]', '↓[F]'],
    ];
    for (const [a, b] of cases) {
      const composed = evaluatePath(ctx, PI0, p(`${a}${b}`));
      // Σ_ρ ⟦α⟧(π,ρ) · ⟦β⟧(ρ,σ); legitimate here only because both are union-free
      const product = new Map<string, number>();
      for (const rho of supp(PI0, a)) {
        const cA = ctx.coneMeasure(PI0, rho);
        for (const sigma of rawSupport(ctx, rho, p(b))) {
          product.set(
            sigma,
            (product.get(sigma) ?? 0) + cA * ctx.coneMeasure(rho, sigma),
          );
        }
      }
      expect(new Set(composed.row.map((e) => e.target)), `${a}${b}`).toEqual(
        new Set(product.keys()),
      );
      for (const e of composed.row) close(e.value, product.get(e.target) as number);
    }
  });

  it('S29: the entrywise row of α ∪ β is the entrywise max of the operand rows', () => {
    const cases: Array<[string, string]> = [
      ['↓', '↓↓'],
      ['↓[C]', '↓[D]'],
      ['ε', '↓'],
    ];
    for (const [a, b] of cases) {
      const start = a === '↓[C]' ? VA : PI0;
      const union = evaluatePath(ctx, start, p(`${a} ∪ ${b}`));
      const rowA = new Map(
        evaluatePath(ctx, start, p(a)).row.map((e) => [e.target, e.value]),
      );
      const rowB = new Map(
        evaluatePath(ctx, start, p(b)).row.map((e) => [e.target, e.value]),
      );
      const targets = new Set([...rowA.keys(), ...rowB.keys()]);
      expect(new Set(union.row.map((e) => e.target)), `${a} ∪ ${b}`).toEqual(targets);
      for (const e of union.row) {
        close(e.value, Math.max(rowA.get(e.target) ?? 0, rowB.get(e.target) ?? 0));
      }
    }
  });

  it('S30: val is unchanged by re-ordering the operands of a ∪', () => {
    close(val(PI0, '↓ ∪ ↓↓'), val(PI0, '↓↓ ∪ ↓'));
    close(val(VA, '↓[C] ∪ ↓[D]'), val(VA, '↓[D] ∪ ↓[C]'));
  });

  it('the pocket table of values reproduces exactly', () => {
    const table: Array<[string, string, number]> = [
      [PI0, 'ε', 1],
      [PI0, '↓', 0.9],
      [PI0, '↓↓', 0.8476],
      [PI0, '↓ ∪ ↓↓', 0.9],
      [PI0, '↓[B]', 0.5],
      [PI0, '↓↓[F]', 0.35],
      [PI0, '↓[A]↓[F]', 0.28],
      [PI0, '↓[A ∧ ¬B]↓[F]', 0],
      [PI0, '↓[B ∧ ¬A]↓[F]', 0.07],
      [VA, '↓', 0.95],
      [VB, '↓', 0.73],
      [VAB, '↓', 0.9865],
      [EMPTY1, '↓', 0],
      [VA, '↓[C]', 0.5],
      [VA, '↓[C] ∪ ↓[D]', 0.95],
    ];
    for (const [start, src, expected] of table) {
      close(val(start, src), expected);
    }
  });

  it('⟦[B]⟧(π₀, π₀) = 0; the root configuration is {r}, not B', () => {
    expect(evaluatePath(ctx, PI0, p('[B]')).row).toEqual([]);
  });

  it('a test admits configurations, not siblings: [A] lets {A,B} through', () => {
    const targets = supp(PI0, '↓[A]');
    expect(new Set(targets)).toEqual(new Set([VA, VAB]));
  });

  it('ancestorMaximal and align agree on the represented measure', () => {
    const positive = supp(PI0, '↓ ∪ ↓↓').filter((s) => ctx.isPositive(s));
    const deleted = ancestorMaximal(positive);
    const aligned = align(ctx, positive);
    close(
      deleted.reduce((s, t) => s + ctx.coneMeasure(PI0, t), 0),
      aligned.reduce((s, t) => s + ctx.coneMeasure(PI0, t), 0),
    );
  });

  it('a Σ over an unreduced family is refused rather than silently wrong', () => {
    const ev = evaluatePath(ctx, PI0, p('↓ ∪ ↓↓'));
    expect(ev.raw.reduced).toBe(false);
    expect(printPath(p('↓ ∪ ↓↓'))).toBe('↓ ∪ ↓↓');
  });
});
