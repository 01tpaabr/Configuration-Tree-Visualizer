import { useMemo } from 'react';
import { useStore } from '../store';
import type { PNode } from '../core/types';
import { existenceProb, labelOf } from '../core/skeleton';
import { formatProb, formatProbFull } from '../core/format';
import { isMuxInvalid } from '../core/validate';
import { TreeCanvas } from './tree/TreeCanvas';
import type { CanvasNode } from './tree/types';

// The skeleton tree: label and probability on each vertex. Read-only; click a
// vertex to edit it in the node inspector. Distributional nodes are never
// drawn as vertices; their type appears as an ind/mux chip at the fan-out.
export function SkeletonTree() {
  const doc = useStore((s) => s.doc);
  const skeleton = useStore((s) => s.skeleton);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectedVertexKey = useStore((s) => s.selectedVertexKey);
  const tree = useStore((s) => s.tree);
  const viewport = useStore((s) => s.viewport.skeleton);
  const setViewport = useStore((s) => s.setViewport);
  const selectNode = useStore((s) => s.selectNode);

  // The members of the selected configuration-tree vertex, highlighted here.
  const highlighted = useMemo(() => {
    const v = selectedVertexKey ? tree.vertices.get(selectedVertexKey) : null;
    return v ? new Set(v.cfg) : null;
  }, [selectedVertexKey, tree.vertices]);

  const root = useMemo((): CanvasNode => {
    const build = (n: PNode, isRoot: boolean): CanvasNode => {
      const mu = existenceProb(skeleton, n.id);
      return {
        id: n.id,
        label: labelOf(skeleton, n.id),
        pill: isRoot ? '1' : formatProb(n.prob),
        sub: n.data === undefined || n.data === '' ? undefined : String(n.data),
        fanChip: n.children.length > 0 ? (n.distType ?? 'ind') : undefined,
        fanChipInvalid: isMuxInvalid(n),
        isLeaf: n.children.length === 0,
        dimmed: highlighted ? !highlighted.has(n.id) : false,
        title:
          `${n.label}: PD(v) = ${isRoot ? '1 (the root exists with probability 1)' : formatProbFull(n.prob)}\n` +
          `μ(E_v) = ${formatProbFull(mu)}, the unconditional existence probability` +
          (n.data !== undefined && n.data !== ''
            ? `\ndata value ${n.data}, display only, not used in any probability`
            : ''),
        aria: `possible node ${n.label}, PD ${formatProb(n.prob)}, unconditional existence ${formatProb(mu)}, ${n.children.length} children`,
        children: n.children.map((c) => build(c, false)),
      };
    };
    return build(doc.root, true);
  }, [doc, skeleton, highlighted]);

  return (
    <TreeCanvas
      root={root}
      orientation="td"
      ariaLabel="skeleton of the p-document"
      selectedId={selectedNodeId}
      viewport={viewport}
      onViewportChange={(v) => setViewport('skeleton', v)}
      onSelect={(id) => selectNode(id || null)}
    />
  );
}
