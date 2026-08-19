import { describe, expect, it } from 'vitest';
import { FIXTURE_W, FIXTURE_X } from '../fixtures';
import { doc, expectClose, idOf, round, sk, table } from './helpers';
import {
  childrenOf,
  coneMeasure,
  leafDist,
  leavesBelow,
  materialize,
  nodesOf,
  rootVertex,
  vertexFromKey,
} from '../cfgtree';
import { stepProb, subsetsOf } from '../probability';
import { chOfConfig, existenceProb, labelOf } from '../skeleton';
import { checkInvariants } from './invariants';
import { parsePDocument } from '../parse';
import { serializePDocument } from '../serialize';
import { formatConfig, formatDescent } from '../format';

const W = () => {
  const s = sk(FIXTURE_W);
  return {
    s,
    r: s.root,
    A: idOf(s, 'A'),
    B: idOf(s, 'B'),
    C: idOf(s, 'C'),
    D: idOf(s, 'D'),
    E: idOf(s, 'E'),
    F: idOf(s, 'F'),
  };
};

describe('core mathematics, fixture W', () => {
  it('T1-T4: one level of ↓, unrolled', () => {
    const { s, r, A, B } = W();
    expectClose(stepProb(s, [r], []), 0.1);
    expectClose(stepProb(s, [r], [A]), 0.4);
    expectClose(stepProb(s, [r], [B]), 0.1);
    expectClose(stepProb(s, [r], [A, B]), 0.4);
  });

  it('T5: those four sum to 1', () => {
    const { s, r, A, B } = W();
    const sum =
      stepProb(s, [r], []) +
      stepProb(s, [r], [A]) +
      stepProb(s, [r], [B]) +
      stepProb(s, [r], [A, B]);
    expectClose(sum, 1);
  });

  it('T6: ↓(({r},{A,B}), ({r},{A,B},{C,F})) = 0.0315', () => {
    const { s, A, B, C, F } = W();
    expectClose(stepProb(s, [A, B], [C, F]), 0.0315);
  });

  it('T7: the full 29-row table, vertex by vertex, in order', () => {
    const { s } = W();
    expect(table(s)).toEqual([
      ['r', 0, 1, 1, false],
      ['r / ∅', 1, 0.1, 0.1, true],
      ['r / A', 1, 0.4, 0.4, false],
      ['r / A / ∅', 2, 0.05, 0.02, true],
      ['r / A / C', 2, 0.05, 0.02, true],
      ['r / A / D', 2, 0.45, 0.18, true],
      ['r / A / CD', 2, 0.45, 0.18, true],
      ['r / B', 1, 0.1, 0.1, false],
      ['r / B / ∅', 2, 0.27, 0.027, true],
      ['r / B / E', 2, 0.03, 0.003, true],
      ['r / B / F', 2, 0.63, 0.063, true],
      ['r / B / EF', 2, 0.07, 0.007, true],
      ['r / AB', 1, 0.4, 0.4, false],
      ['r / AB / ∅', 2, 0.0135, 0.0054, true],
      ['r / AB / C', 2, 0.0135, 0.0054, true],
      ['r / AB / D', 2, 0.1215, 0.0486, true],
      ['r / AB / E', 2, 0.0015, 0.0006, true],
      ['r / AB / F', 2, 0.0315, 0.0126, true],
      ['r / AB / CD', 2, 0.1215, 0.0486, true],
      ['r / AB / CE', 2, 0.0015, 0.0006, true],
      ['r / AB / CF', 2, 0.0315, 0.0126, true],
      ['r / AB / DE', 2, 0.0135, 0.0054, true],
      ['r / AB / DF', 2, 0.2835, 0.1134, true],
      ['r / AB / EF', 2, 0.0035, 0.0014, true],
      ['r / AB / CDE', 2, 0.0135, 0.0054, true],
      ['r / AB / CDF', 2, 0.2835, 0.1134, true],
      ['r / AB / CEF', 2, 0.0035, 0.0014, true],
      ['r / AB / DEF', 2, 0.0315, 0.0126, true],
      ['r / AB / CDEF', 2, 0.0315, 0.0126, true],
    ]);
  });

  it('T8: vertex count / leaf count = 29 / 25', () => {
    const { s } = W();
    const { order } = materialize(s);
    expect(order.length).toBe(29);
    expect(order.filter((v) => v.isLeaf).length).toBe(25);
  });

  it('T9: Σ over leaves of μ_root({τ}) = 1', () => {
    const { s } = W();
    const dist = leafDist(s, rootVertex(s).key);
    expect(dist.size).toBe(25);
    expectClose([...dist.values()].reduce((a, b) => a + b, 0), 1);
  });

  it('T10: |lv(({r},{A}))| = 4 and its cone measure is 0.40', () => {
    const { s, r, A } = W();
    const key = `${r}|${A}`;
    const leaves = leavesBelow(s, key);
    expect(leaves.length).toBe(4);
    expectClose(coneMeasure(s, rootVertex(s).key, key), 0.4);
    expectClose(vertexFromKey(s, key).reachProb, 0.4);
    // the cone reading: 0.02 + 0.02 + 0.18 + 0.18 = 0.4
    expectClose(leaves.reduce((a, t) => a + t.reachProb, 0), 0.4);
  });

  it('T11: μ(E_C), μ(E_D), μ(E_E), μ(E_F)', () => {
    const { s, A, B, C, D, E, F } = W();
    expectClose(existenceProb(s, A), 0.8);
    expectClose(existenceProb(s, B), 0.5);
    expectClose(existenceProb(s, C), 0.4);
    expectClose(existenceProb(s, D), 0.72);
    expectClose(existenceProb(s, E), 0.05);
    expectClose(existenceProb(s, F), 0.35);
  });

  it('T12: leaves sit at mixed depths', () => {
    const { s, r, A, B, C, D, E, F } = W();
    const empty = vertexFromKey(s, `${r}|`);
    expect(empty.isLeaf).toBe(true);
    expect(empty.depth).toBe(1);
    const deep = vertexFromKey(s, `${r}|${A},${B}|${C},${D},${E},${F}`);
    expect(deep.isLeaf).toBe(true);
    expect(deep.depth).toBe(2);
  });

  it('T13: child order under ({r},{A,B}) follows the fixed order', () => {
    const { s, r, A, B } = W();
    const v = vertexFromKey(s, `${r}|${A},${B}`);
    expect(childrenOf(s, v).map((c) => formatConfig(s, c.cfg))).toEqual([
      '∅', 'C', 'D', 'E', 'F',
      'CD', 'CE', 'CF', 'DE', 'DF', 'EF',
      'CDE', 'CDF', 'CEF', 'DEF',
      'CDEF',
    ]);
  });

  it('T14: XML → PDocument → XML round trip preserves order, probabilities, and data', () => {
    const src = `<r>
  <ind>
    <A prob="0.8" data="42">
      <ind>
        <C prob="0.5"/>
        <D prob="0.9" data="hello"/>
      </ind>
    </A>
    <B prob="0.5"/>
  </ind>
</r>
`;
    const first = doc(src);
    const out = serializePDocument(first);
    const second = parsePDocument(out);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(serializePDocument(second.doc)).toBe(out);

    const flat = (d = first.root, acc: string[] = []): string[] => {
      acc.push(`${d.label}:${d.prob}:${d.data ?? ''}:${d.distType ?? ''}`);
      d.children.forEach((c) => flat(c, acc));
      return acc;
    };
    expect(flat()).toEqual([
      'r:1::ind',
      'A:0.8:42:ind',
      'C:0.5::',
      'D:0.9:hello:',
      'B:0.5::',
    ]);
    expect(out).toBe(src);
  });

  it('T19: a vertex with ch(cfg) = ∅ returns [] from childrenOf', () => {
    const { s, r } = W();
    const empty = vertexFromKey(s, `${r}|`);
    expect(chOfConfig(s, empty.cfg)).toEqual([]);
    expect(childrenOf(s, empty)).toEqual([]);
  });

  it('T20: invariants I1–I9 hold', () => {
    const { s } = W();
    for (const r of checkInvariants(s)) {
      expect(r.pass, `${r.id}: ${r.detail}`).toBe(true);
    }
  });

  it('nodesOf(τ) = S₀ ∪ … ∪ S_m', () => {
    const { s, r, A, B, C, F } = W();
    const leaf = vertexFromKey(s, `${r}|${A},${B}|${C},${F}`);
    expect(nodesOf(leaf)).toEqual([r, A, B, C, F]);
  });

  it('subsetsOf orders by size, then document order', () => {
    expect(subsetsOf(['c', 'd', 'e']).map((s) => s.join(''))).toEqual([
      '', 'c', 'd', 'e', 'cd', 'ce', 'de', 'cde',
    ]);
  });
});

const X = () => {
  const s = sk(FIXTURE_X);
  return { s, r: s.root, A1: idOf(s, 'A', 0), A2: idOf(s, 'A', 1), B: idOf(s, 'B') };
};

describe('core mathematics, fixture X', () => {
  it('T15: the full 9-row table', () => {
    const { s } = X();
    expect(table(s)).toEqual([
      ['r', 0, 1, 1, false],
      ['r / ∅', 1, 0, 0, true],
      ['r / A₁', 1, 0, 0, false],
      ['r / A₁ / ∅', 2, 0.8, 0, true],
      ['r / A₁ / A₂', 2, 0.2, 0, true],
      ['r / B', 1, 0.5, 0.5, true],
      ['r / A₁B', 1, 0.5, 0.5, false],
      ['r / A₁B / ∅', 2, 0.8, 0.4, true],
      ['r / A₁B / A₂', 2, 0.2, 0.1, true],
    ]);
  });

  it('T16: vertex count / leaf count / leaf sum = 9 / 6 / 1.00', () => {
    const { s } = X();
    const { order } = materialize(s);
    expect(order.length).toBe(9);
    const leaves = order.filter((v) => v.isLeaf);
    expect(leaves.length).toBe(6);
    expectClose(leaves.reduce((a, v) => a + v.reachProb, 0), 1);
  });

  it('T17: r / A₁ and r / A₁ / A₂ exist despite ↓ = 0 and reach = 0', () => {
    const { s, r, A1, A2 } = X();
    const keys = materialize(s).order.map((v) => v.key);
    expect(keys).toContain(`${r}|${A1}`);
    expect(keys).toContain(`${r}|${A1}|${A2}`);
    expect(round(vertexFromKey(s, `${r}|${A1}`).reachProb)).toBe(0);
  });

  it('T18: the two A-labelled skeleton nodes stay distinct in every configuration', () => {
    const { s, A1, A2 } = X();
    expect(A1).not.toBe(A2);
    expect(labelOf(s, A1)).toBe('A₁');
    expect(labelOf(s, A2)).toBe('A₂');
    for (const v of materialize(s).order) {
      expect(new Set(v.cfg).size).toBe(v.cfg.length);
    }
    // `r / A₁` and `r / A₁B` are different vertices carrying the same label letter.
    const descents = materialize(s).order.map((v) => formatDescent(s, v));
    expect(new Set(descents).size).toBe(descents.length);
  });

  it('invariants I1–I9 hold on fixture X', () => {
    const { s } = X();
    for (const r of checkInvariants(s)) {
      expect(r.pass, `${r.id}: ${r.detail}`).toBe(true);
    }
  });

  it('r / B is a leaf at depth 1 because ch({B}) = ∅', () => {
    const { s, r, B } = X();
    const v = vertexFromKey(s, `${r}|${B}`);
    expect(v.isLeaf).toBe(true);
    expect(v.depth).toBe(1);
  });
});
