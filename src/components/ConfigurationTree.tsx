import { useCallback, useMemo } from 'react';
import { useStore } from '../store';
import type { CfgVertex } from '../core/types';
import { childCountOf } from '../core/cfgtree';
import { chOfConfig, subscript } from '../core/skeleton';
import { formatConfig, formatDescent, formatProb, formatProbFull, vertexAriaLabel } from '../core/format';
import { TreeCanvas } from './tree/TreeCanvas';
import type { CanvasNode, TreeCanvasHandle } from './tree/types';

// The configuration-tree canvas. Left-to-right by default.
export function ConfigurationTree({
  canvasRef,
}: {
  canvasRef: React.RefObject<TreeCanvasHandle>;
}) {
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const orientation = useStore((s) => s.orientation);
  const selectedVertexKey = useStore((s) => s.selectedVertexKey);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const highlightConeKey = useStore((s) => s.highlightConeKey);
  const viewport = useStore((s) => s.viewport.configuration);
  const setViewport = useStore((s) => s.setViewport);
  const selectVertex = useStore((s) => s.selectVertex);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const scrubNodeId = useStore((s) => s.scrubNodeId);

  // A key spells out the descent, so the highlighted cone is exactly the keys
  // that start with the chosen vertex's key.
  const inCone = useCallback(
    (key: string): boolean =>
      highlightConeKey != null &&
      (key === highlightConeKey || key.startsWith(highlightConeKey + '|')),
    [highlightConeKey],
  );

  const root = useMemo((): CanvasNode | null => {
    const start = tree.vertices.get(skeleton.root);
    if (!start) return null;

    const build = (v: CfgVertex): CanvasNode => {
      const kids = (v.childKeys ?? [])
        .map((k) => tree.vertices.get(k))
        .filter((c): c is CfgVertex => c !== undefined);
      const total = childCountOf(skeleton, v);
      const reachCaption =
        `reach probability μ_root(lv(π)) = ${formatProbFull(v.reachProb)}: ` +
        (v.isLeaf
          ? 'the probability of the possible document this completed descent determines'
          : 'the chance the sampling passes through this vertex');
      return {
        id: v.key,
        label: formatConfig(skeleton, v.cfg),
        badge: {
          text: formatProb(v.reachProb),
          value: v.reachProb,
          caption: v.isLeaf ? `μ({τ}) = ${formatProbFull(v.reachProb)}` : reachCaption,
        },
        edgeLabel: v.parentKey ? formatProb(v.stepProb) : undefined,
        edgeTitle: v.parentKey
          ? `child-step probability ↓(π′,π) = ${formatProbFull(v.stepProb)}`
          : undefined,
        edgeHighlight:
          scrubNodeId != null && v.parentKey != null
            ? chOfConfig(skeleton, v.path[v.depth - 1]).includes(scrubNodeId)
            : false,
        isLeaf: v.isLeaf,
        zero: v.reachProb === 0,
        // two independent reasons to dim: a selected skeleton node, and a
        // highlighted cone
        dimmed:
          (selectedNodeId != null && !v.cfg.includes(selectedNodeId)) ||
          (highlightConeKey != null && !inCone(v.key)),
        accented: inCone(v.key),
        expanded: v.isLeaf ? undefined : kids.length > 0,
        hiddenChildren: kids.length > 0 ? undefined : total,
        tooWide: tree.tooWide.has(v.key) && kids.length === 0,
        title:
          `descent ${formatDescent(skeleton, v)}\n` +
          (v.parentKey ? `↓(π′,π) = ${formatProbFull(v.stepProb)}\n` : '') +
          (v.isLeaf ? `μ({τ}) = ` : `μ_root(lv(π)) = `) +
          formatProbFull(v.reachProb),
        aria: vertexAriaLabel(skeleton, v, total),
        children: kids.map(build),
      };
    };
    return build(start);
  }, [tree, skeleton, selectedNodeId, highlightConeKey, inCone, scrubNodeId]);

  const levelLabel = useCallback((depth: number) => `S${subscript(depth)}`, []);

  if (!root) return null;

  return (
    <TreeCanvas
      ref={canvasRef}
      root={root}
      orientation={orientation}
      initialView="root"
      ariaLabel="configuration tree"
      selectedId={selectedVertexKey}
      levelLabel={levelLabel}
      viewport={viewport}
      onViewportChange={(v) => setViewport('configuration', v)}
      onSelect={(key) => selectVertex(key || null)}
      onToggle={toggleExpand}
    />
  );
}
