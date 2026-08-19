import { useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { useQueryStore } from '../../store/queries';
import type { CfgVertex } from '../../core/types';
import { childCountOf } from '../../core/cfgtree';
import { subscript } from '../../core/skeleton';
import { formatConfig, formatDescent, formatProb, formatProbFull, vertexAriaLabel } from '../../core/format';
import { TreeCanvas } from '../tree/TreeCanvas';
import type { CanvasNode } from '../tree/types';
import type { QueryResult } from './useEvaluations';

// The configuration tree, read-only, with the path-expression overlay. With a
// single expression focused, its routes draw in its hue and everything else
// dims; with several enabled at once each contributes its own hue.
export function QueryTree({
  results,
  startKey,
}: {
  results: QueryResult[];
  startKey: string;
}) {
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const orientation = useStore((s) => s.orientation);
  const viewport = useStore((s) => s.viewport.query);
  const setViewport = useStore((s) => s.setViewport);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const focusedId = useQueryStore((s) => s.focusedId);
  const setStartKey = useQueryStore((s) => s.setStartKey);

  const active = useMemo(
    () => results.filter((r) => r.query.enabled && (r.evaluation || r.satisfying)),
    [results],
  );
  const focused = useMemo(
    () => active.find((r) => r.query.id === focusedId) ?? null,
    [active, focusedId],
  );
  // with one expression focused, the canvas follows it alone
  const solo = focused ?? (active.length === 1 ? active[0] : null);

  const root = useMemo((): CanvasNode | null => {
    const start = tree.vertices.get(skeleton.root);
    if (!start) return null;

    const build = (v: CfgVertex): CanvasNode => {
      const kids = (v.childKeys ?? [])
        .map((k) => tree.vertices.get(k))
        .filter((c): c is CfgVertex => c !== undefined);
      const total = childCountOf(skeleton, v);

      const hits = active
        .filter((r) => (r.satisfying ? r.satisfying.has(v.key) : r.targets.has(v.key)))
        // the focused expression leads, so the vertex ring matches its routes
        .sort((a, b) =>
          a.query.id === solo?.query.id ? -1 : b.query.id === solo?.query.id ? 1 : 0,
        );
      const isStart = v.key === startKey;
      const inSolo = solo
        ? solo.satisfying
          ? solo.satisfying.has(v.key)
          : solo.live.has(v.key)
        : false;

      return {
        id: v.key,
        label: formatConfig(skeleton, v.cfg),
        badge: {
          text: formatProb(v.reachProb),
          value: v.reachProb,
          caption: v.isLeaf
            ? `μ({τ}) = ${formatProbFull(v.reachProb)}`
            : `μ_root(lv(π)) = ${formatProbFull(v.reachProb)}`,
        },
        edgeLabel: v.parentKey ? formatProb(v.stepProb) : undefined,
        edgeTitle: v.parentKey
          ? `child-step probability ↓(π′,π) = ${formatProbFull(v.stepProb)}`
          : undefined,
        // an edge is live only when both its ends are on a route
        edgeTint:
          solo && v.parentKey && solo.live.has(v.key) && solo.live.has(v.parentKey)
            ? solo.color
            : undefined,
        isLeaf: v.isLeaf,
        zero: v.reachProb === 0,
        accented: isStart,
        // a highlight left over from the last text that parsed is greyed, not cleared
        tints: hits.map((r) => (r.stale ? '#8A8F98' : r.color)),
        tags: hits.map((r) => (r.stale ? `${r.query.name}?` : r.query.name)),
        emptyMarker: solo?.evaluation?.excludedEmpty.includes(v.key) ?? false,
        dimmed: solo ? !inSolo && !isStart : active.length > 0 && hits.length === 0,
        expanded: v.isLeaf ? undefined : kids.length > 0,
        hiddenChildren: kids.length > 0 ? undefined : total,
        tooWide: tree.tooWide.has(v.key) && kids.length === 0,
        title:
          `descent ${formatDescent(skeleton, v)}\n` +
          (isStart ? 'start state π\n' : '') +
          hits
            .map(
              (r) =>
                `${r.query.name}: target, c_π(σ) = ${formatProbFull(
                  r.evaluation?.row.find((e) => e.target === v.key)?.value ?? 0,
                )}`,
            )
            .join('\n'),
        aria: vertexAriaLabel(skeleton, v, total),
        children: kids.map(build),
      };
    };
    return build(start);
  }, [tree, skeleton, active, solo, startKey]);

  const levelLabel = useCallback((depth: number) => `S${subscript(depth)}`, []);

  if (!root) return null;

  return (
    <TreeCanvas
      root={root}
      orientation={orientation}
      initialView="root"
      ariaLabel="configuration tree with the path-expression overlay"
      selectedId={startKey}
      levelLabel={levelLabel}
      viewport={viewport}
      onViewportChange={(v) => setViewport('query', v)}
      // the tree is not editable here: clicking a vertex only moves the start state π
      onSelect={(key) => setStartKey(key || null)}
      onToggle={toggleExpand}
    />
  );
}
