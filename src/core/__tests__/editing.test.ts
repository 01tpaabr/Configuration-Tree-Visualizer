import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_W, FIXTURE_X } from '../fixtures';

// A mux document: accepted by the editor and validated, never unfolded.
const MUX_DOC = `<r>
  <mux>
    <A prob="0.3"><ind><C prob="0.5"/></ind></A>
    <B prob="0.5"/>
  </mux>
</r>`;
import { expectClose, idOf, sk } from './helpers';
import * as cmd from '../commands';
import { buildSkeleton } from '../skeleton';
import { materialize, vertexFromKey } from '../cfgtree';
import { factorization, stepProb } from '../probability';
import { validateDocument } from '../validate';
import { serializePDocument } from '../serialize';
import { parsePDocument } from '../parse';
import { useStore } from '../../store';

const W = () => {
  const s = sk(FIXTURE_W);
  return {
    s,
    doc: { root: s.byId.get(s.root)! },
    r: s.root,
    A: idOf(s, 'A'),
    B: idOf(s, 'B'),
    C: idOf(s, 'C'),
    D: idOf(s, 'D'),
    E: idOf(s, 'E'),
    F: idOf(s, 'F'),
  };
};

describe('editing, pure commands', () => {
  it('T21: setProb(D, 0.5) → ↓(({r},{A}), ({r},{A},{C,D})) = 0.25 (was 0.45)', () => {
    const { s, doc, A, C, D } = W();
    expectClose(stepProb(s, [A], [C, D]), 0.45);
    const next = buildSkeleton(cmd.setProb(doc, D, 0.5));
    expectClose(stepProb(next, [A], [C, D]), 0.25);
  });

  it('T22: after that edit the vertex set and edge set of T are unchanged (I9)', () => {
    const { s, doc, D } = W();
    const before = materialize(s).order.map((v) => `${v.parentKey ?? ''}->${v.key}`);
    const after = materialize(buildSkeleton(cmd.setProb(doc, D, 0.5))).order.map(
      (v) => `${v.parentKey ?? ''}->${v.key}`,
    );
    expect(after).toEqual(before);
  });

  it('T24: setProb(A, 0) → reach of r/A and r/AB is 0; both vertices remain', () => {
    const { doc, r, A, B } = W();
    const next = buildSkeleton(cmd.setProb(doc, A, 0));
    expectClose(vertexFromKey(next, `${r}|${A}`).reachProb, 0);
    expectClose(vertexFromKey(next, `${r}|${A},${B}`).reachProb, 0);
    const keys = materialize(next).order.map((v) => v.key);
    expect(keys).toContain(`${r}|${A}`);
    expect(keys).toContain(`${r}|${A},${B}`);
    expect(keys.length).toBe(29);
  });

  it('T25: setData(C, 42) leaves every stepProb and reachProb bit-identical', () => {
    const { s, doc, C } = W();
    const before = materialize(s).order.map((v) => [v.key, v.stepProb, v.reachProb]);
    const after = materialize(buildSkeleton(cmd.setData(doc, C, 42))).order.map(
      (v) => [v.key, v.stepProb, v.reachProb],
    );
    expect(after).toEqual(before);
  });

  it('T26: setLabel(C, "Z") leaves every vertex key, stepProb and reachProb unchanged', () => {
    const { s, doc, C } = W();
    const before = materialize(s).order.map((v) => [v.key, v.stepProb, v.reachProb]);
    const after = materialize(buildSkeleton(cmd.setLabel(doc, C, 'Z'))).order.map(
      (v) => [v.key, v.stepProb, v.reachProb],
    );
    expect(after).toEqual(before);
  });

  it('T27: addChild(C) → r/A/C stops being a leaf and gains 2^1 children; leaf sum stays 1', () => {
    const { s, doc, r, A, C } = W();
    expect(vertexFromKey(s, `${r}|${A}|${C}`).isLeaf).toBe(true);
    const next = buildSkeleton(cmd.addChild(doc, C));
    const v = vertexFromKey(next, `${r}|${A}|${C}`);
    expect(v.isLeaf).toBe(false);
    const { order } = materialize(next);
    const kids = order.filter((x) => x.parentKey === v.key);
    expect(kids.length).toBe(2);
    expectClose(
      order.filter((x) => x.isLeaf).reduce((a, x) => a + x.reachProb, 0),
      1,
    );
  });

  it('T28: deleteNode(B) → 7 vertices / 5 leaves, leaf sum 1', () => {
    const { doc, B } = W();
    const next = buildSkeleton(cmd.deleteNode(doc, B));
    const { order } = materialize(next);
    expect(order.length).toBe(7);
    const leaves = order.filter((v) => v.isLeaf);
    expect(leaves.length).toBe(5);
    expectClose(leaves.reduce((a, v) => a + v.reachProb, 0), 1);
  });

  it('T29: moveChild(B, -1) reorders display and enumeration; probabilities unchanged', () => {
    const { s, doc, r, A, B } = W();
    const moved = buildSkeleton(cmd.moveChild(doc, B, -1));
    // document order now puts B first
    expect((moved.docOrder.get(B) ?? 0) < (moved.docOrder.get(A) ?? 0)).toBe(true);
    // the depth-1 vertices are the same four configurations, in the new order
    const level1 = materialize(moved).order.filter((v) => v.depth === 1);
    expect(level1.map((v) => v.cfg.join(','))).toEqual([
      '',
      B,
      A,
      `${B},${A}`,
    ]);
    // ↓ is unchanged for the same configuration
    expectClose(stepProb(moved, [r], [A]), stepProb(s, [r], [A]));
    expectClose(stepProb(moved, [r], [A, B]), stepProb(s, [r], [A, B]));
  });

  it('T30: node ids are preserved across setLabel, setProb, setData and moveChild', () => {
    const { doc, B, C } = W();
    let d = doc;
    d = cmd.setLabel(d, C, 'Z');
    d = cmd.setProb(d, C, 0.1);
    d = cmd.setData(d, C, 'x');
    d = cmd.moveChild(d, B, -1);
    const ids = [...buildSkeleton(d).byId.keys()].sort();
    expect(ids).toEqual([...buildSkeleton(doc).byId.keys()].sort());
  });

  it('T31: setProb on the root is rejected and leaves the document untouched', () => {
    const { doc, r } = W();
    expect(cmd.setProb(doc, r, 0.3)).toBe(doc);
    expect(doc.root.prob).toBe(1);
  });

  it('T32: deleteNode on the last child clears the parent distType to null', () => {
    const { doc, C, D, A } = W();
    let d = cmd.deleteNode(doc, C);
    expect(cmd.findNode(d, A)!.distType).toBe('ind');
    d = cmd.deleteNode(d, D);
    expect(cmd.findNode(d, A)!.distType).toBeNull();
    expect(cmd.findNode(d, A)!.children).toEqual([]);
  });

  it('T39: ind siblings with Σ p = 1.7 produce no validation error', () => {
    const { doc, C, D } = W();
    let d = cmd.setProb(doc, C, 0.8);
    d = cmd.setProb(d, D, 0.9);
    expect(validateDocument(d)).toEqual([]);
  });

  it('a mux block with Σ p > 1 is an error, and "normalise" fixes it', () => {
    const parsed = parsePDocument(MUX_DOC);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = buildSkeleton(parsed.doc);
    const r = s.root;
    let d = cmd.setProb(parsed.doc, idOf(s, 'A'), 0.8);
    d = cmd.setProb(d, idOf(s, 'B'), 0.9);
    expect(validateDocument(d).some((i) => i.message.includes('Σ p'))).toBe(true);
    const fixed = cmd.normaliseMux(d, r);
    expect(validateDocument(fixed)).toEqual([]);
    expectClose(
      cmd.findNode(fixed, r)!.children.reduce((a, c) => a + c.prob, 0),
      1,
    );
  });

  it('new nodes take the next unused single uppercase letter, then A1, A2', () => {
    const { doc, r } = W();
    let d = cmd.addChild(doc, r);
    expect(d.root.children.at(-1)!.label).toBe('G');
    for (let i = 0; i < 20; i++) d = cmd.addChild(d, r);
    const labels = d.root.children.map((c) => c.label);
    expect(labels).toContain('Z');
    expect(labels.at(-1)).toBe('A1');
  });
});

function reset(xml = FIXTURE_W): void {
  const parsed = parsePDocument(xml);
  if (!parsed.ok) throw new Error('fixture must parse');
  useStore.setState({
    undoStack: [],
    redoStack: [],
    selectedNodeId: null,
    selectedVertexKey: null,
    expansion: { expanded: new Set(), collapsed: new Set() },
  });
  useStore.getState().replaceDocument(parsed.doc);
  useStore.setState({ undoStack: [], redoStack: [] });
}

const S = () => useStore.getState();
const nodeId = (label: string, occurrence = 0): string =>
  idOf(S().skeleton, label, occurrence);

describe('live synchronisation through the store', () => {
  beforeEach(() => reset());

  it('fixture W loads fully expanded: 29 vertices, 25 leaves', () => {
    expect(S().tree.vertices.size).toBe(29);
    expect(S().tree.order.length).toBe(29);
    expect(S().tree.order.filter((v) => v.isLeaf).length).toBe(25);
  });

  it('T22/T23: setProb keeps the vertex set, expansion, selection, zoom and pan', () => {
    const r = S().skeleton.root;
    const A = nodeId('A');
    S().selectVertex(`${r}|${A}`);
    S().selectNode(A);
    S().setViewport('configuration', { k: 1.7, x: 40, y: -12 });
    const beforeKeys = [...S().tree.vertices.keys()].sort();
    const beforeExpansion = [...S().expansion.expanded].sort();

    S().setProb(nodeId('D'), 0.5);

    expect([...S().tree.vertices.keys()].sort()).toEqual(beforeKeys);
    expect([...S().expansion.expanded].sort()).toEqual(beforeExpansion);
    expect(S().selectedVertexKey).toBe(`${r}|${A}`);
    expect(S().selectedNodeId).toBe(A);
    expect(S().viewport.configuration).toEqual({ k: 1.7, x: 40, y: -12 });
    expect(S().lastRecompute?.policy).toBe('rescore');
    expectClose(S().tree.vertices.get(`${r}|${A}|${nodeId('C')},${nodeId('D')}`)!.stepProb, 0.25);
  });

  it('T25: setData fires the "no recompute" policy row', () => {
    const before = S().tree.order.map((v) => [v.key, v.stepProb, v.reachProb]);
    S().setData(nodeId('C'), 42);
    expect(S().lastRecompute?.policy).toBe('none');
    expect(S().tree.order.map((v) => [v.key, v.stepProb, v.reachProb])).toEqual(before);
  });

  it('T26: setLabel fires the "captions" policy row and moves no key', () => {
    const before = S().tree.order.map((v) => v.key);
    S().setLabel(nodeId('C'), 'Z');
    expect(S().lastRecompute?.policy).toBe('captions');
    expect(S().tree.order.map((v) => v.key)).toEqual(before);
    expect(S().skeleton.byId.get(nodeId('Z'))!.label).toBe('Z');
  });

  it('T33: undo after a scrub gesture restores the pre-gesture probability in one step', () => {
    const D = nodeId('D');
    expect(S().skeleton.byId.get(D)!.prob).toBe(0.9);
    S().beginScrub();
    for (const p of [0.8, 0.7, 0.6, 0.5, 0.4]) S().setProb(D, p);
    S().endScrub();
    expect(S().skeleton.byId.get(D)!.prob).toBe(0.4);
    expect(S().undoStack.length).toBe(1);
    S().undo();
    expect(S().skeleton.byId.get(D)!.prob).toBe(0.9);
  });

  it('T34: undo / redo across a mixed sequence restores exact documents', () => {
    const snapshots: string[] = [serializePDocument(S().doc)];
    S().addChild(nodeId('C'));
    snapshots.push(serializePDocument(S().doc));
    S().setProb(nodeId('D'), 0.25);
    snapshots.push(serializePDocument(S().doc));
    S().setLabel(nodeId('E'), 'Q');
    snapshots.push(serializePDocument(S().doc));
    S().deleteNode(nodeId('B'));
    snapshots.push(serializePDocument(S().doc));
    S().moveChild(nodeId('D'), -1);
    snapshots.push(serializePDocument(S().doc));

    for (let i = snapshots.length - 2; i >= 0; i--) {
      S().undo();
      expect(serializePDocument(S().doc)).toBe(snapshots[i]);
    }
    for (let i = 1; i < snapshots.length; i++) {
      S().redo();
      expect(serializePDocument(S().doc)).toBe(snapshots[i]);
    }
  });

  it('T35: an unparseable XML edit leaves the last valid document and trees intact', () => {
    const before = serializePDocument(S().doc);
    const beforeKeys = [...S().tree.vertices.keys()].sort();
    S().editXml('<r><ind><A prob="0.8"></ind></r>');
    expect(S().xmlErrors.length).toBeGreaterThan(0);
    expect(serializePDocument(S().doc)).toBe(before);
    expect([...S().tree.vertices.keys()].sort()).toEqual(beforeKeys);
  });

  it('a valid XML edit preserves ids where shape and position match', () => {
    const beforeIds = [...S().skeleton.byId.keys()].sort();
    S().editXml(serializePDocument(S().doc).replace('prob="0.9"', 'prob="0.25"'));
    expect(S().xmlErrors).toEqual([]);
    expect([...S().skeleton.byId.keys()].sort()).toEqual(beforeIds);
    expect(S().skeleton.byId.get(nodeId('D'))!.prob).toBe(0.25);
  });

  it('T36: a structural edit deep in one branch preserves expansion of unrelated branches', () => {
    const r = S().skeleton.root;
    const A = nodeId('A');
    const B = nodeId('B');
    // collapse everything, then open only r and r/B
    S().collapseVertex(r);
    S().expandVertex(r);
    S().expandVertex(`${r}|${B}`);
    expect(S().tree.vertices.has(`${r}|${B}|${nodeId('F')}`)).toBe(true);

    S().addChild(nodeId('C')); // deep inside the A branch
    expect(S().tree.vertices.has(`${r}|${B}|${nodeId('F')}`)).toBe(true);
    expect(S().expansion.expanded.has(`${r}|${B}`)).toBe(true);
    expect(S().tree.vertices.has(`${r}|${A}`)).toBe(true);
  });

  it('T37: after deleting a selected vertex member, selection falls back to the nearest ancestor', () => {
    const r = S().skeleton.root;
    const A = nodeId('A');
    const C = nodeId('C');
    S().selectVertex(`${r}|${A}|${C}`);
    S().deleteNode(C);
    expect(S().selectedVertexKey).toBe(`${r}|${A}`);
  });

  it('T38: switching to mux gates the configuration tree; switching back restores the view', () => {
    const r = S().skeleton.root;
    const beforeKeys = [...S().tree.vertices.keys()].sort();
    expect(S().muxPresent).toBe(false);

    S().setDistType(r, 'mux');
    // the gate is on: the page shows the blocking banner, but the tree state is retained
    // so turning `mux` back restores the view.
    expect(S().muxPresent).toBe(true);

    S().setDistType(r, 'ind');
    expect(S().muxPresent).toBe(false);
    expect([...S().tree.vertices.keys()].sort()).toEqual(beforeKeys);
  });

  it('T40: editing a factorization tile calls setProb and updates the whole tree', () => {
    const r = S().skeleton.root;
    const A = nodeId('A');
    const B = nodeId('B');
    const parentKey = `${r}|${A},${B}`;
    const parent = S().tree.vertices.get(parentKey)!;
    const childKey = `${parentKey}|${nodeId('C')},${nodeId('F')}`;
    const child = S().tree.vertices.get(childKey)!;
    const tiles = factorization(S().skeleton, parent.cfg, child.cfg);
    expect(tiles.map((t) => `${t.label}:${t.kept}`)).toEqual([
      'C:true', 'D:false', 'E:false', 'F:true',
    ]);
    expectClose(tiles.reduce((p, t) => p * t.factor, 1), 0.0315);

    // drag the D tile down to 0.5
    const dTile = tiles.find((t) => t.label === 'D')!;
    S().setProb(dTile.id, 0.5);
    // ↓ = PD(C)·(1−PD(D))·(1−PD(E))·PD(F) = 0.5 · 0.5 · 0.9 · 0.7
    expectClose(S().tree.vertices.get(childKey)!.stepProb, 0.1575);
    expectClose(S().tree.vertices.get(`${r}|${A}|${nodeId('C')},${nodeId('D')}`)!.stepProb, 0.25);
  });

  it('the sibling-sum strip reads 1 for every non-leaf vertex (invariant I1)', () => {
    for (const v of S().tree.order) {
      if (v.isLeaf) continue;
      const kids = S().tree.order.filter((c) => c.parentKey === v.key);
      if (kids.length === 0) continue;
      expectClose(kids.reduce((a, c) => a + c.stepProb, 0), 1);
    }
  });

  it('fixture X: zero-probability vertices survive in the store', () => {
    reset(FIXTURE_X);
    expect(S().tree.vertices.size).toBe(9);
    // r/∅, r/A₁, r/A₁/∅ and r/A₁/A₂ all have reach 0 because PD(B) = 1
    const zeroes = S().tree.order.filter((v) => v.reachProb === 0);
    expect(zeroes.length).toBe(4);
  });
});
