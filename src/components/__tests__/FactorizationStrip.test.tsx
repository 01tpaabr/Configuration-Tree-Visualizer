import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FactorizationStrip } from '../FactorizationStrip';
import { useStore } from '../../store';
import { factorization } from '../../core/probability';
import { parsePDocument } from '../../core/parse';
import { FIXTURE_W } from '../../core/fixtures';

function nodeId(label: string): string {
  const s = useStore.getState().skeleton;
  const hit = [...s.byId.values()].find((n) => n.label === label);
  if (!hit) throw new Error(`no node ${label}`);
  return hit.id;
}

function Strip() {
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const r = skeleton.root;
  const parentKey = `${r}|${nodeId('A')},${nodeId('B')}`;
  const childKey = `${parentKey}|${nodeId('C')},${nodeId('F')}`;
  const parent = tree.vertices.get(parentKey)!;
  const child = tree.vertices.get(childKey)!;
  const factors = factorization(skeleton, parent.cfg, child.cfg);
  return <FactorizationStrip factors={factors} product={child.stepProb} />;
}

describe('the editable factorization strip', () => {
  beforeEach(() => {
    const parsed = parsePDocument(FIXTURE_W);
    if (!parsed.ok) throw new Error('fixture must parse');
    useStore.setState({
      undoStack: [],
      redoStack: [],
      expansion: { expanded: new Set(), collapsed: new Set() },
    });
    useStore.getState().replaceDocument(parsed.doc);
  });

  it('renders one tile per element of ch(cfg(π′)), attributed kept / dropped', () => {
    render(<Strip />);
    expect(screen.getByText('PD(C)')).toBeDefined();
    expect(screen.getByText('1−PD(D)')).toBeDefined();
    expect(screen.getByText('1−PD(E)')).toBeDefined();
    expect(screen.getByText('PD(F)')).toBeDefined();
    expect(screen.getAllByText('kept').length).toBe(2);
    expect(screen.getAllByText('dropped').length).toBe(2);
    // the product of the tiles is the child-step probability
    expect(screen.getByText('0.0315')).toBeDefined();
  });

  it('T40: typing on a tile calls setProb and updates the whole tree', () => {
    render(<Strip />);
    const D = nodeId('D');
    fireEvent.doubleClick(screen.getByText('1−PD(D)').parentElement as HTMLElement);
    const input = screen.getByLabelText('PD of D') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const s = useStore.getState();
    expect(s.skeleton.byId.get(D)!.prob).toBe(0.5);
    const r = s.skeleton.root;
    const A = nodeId('A');
    const C = nodeId('C');
    // ↓(({r},{A}), ({r},{A},{C,D})) = 0.5 · 0.5 = 0.25  (T21)
    expect(s.tree.vertices.get(`${r}|${A}|${C},${D}`)!.stepProb).toBeCloseTo(0.25, 12);
    expect(s.lastRecompute?.policy).toBe('rescore');
  });

  it('the root vertex shows the empty product', () => {
    render(<FactorizationStrip factors={[]} product={1} />);
    expect(screen.getByText(/the empty product is/)).toBeDefined();
  });
});
