import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Split } from '../components/Split';
import { Button, CentredNotice, Panel, SetupLink } from '../components/ui';
import { ConfigurationTree } from '../components/ConfigurationTree';
import { VertexInspector } from '../components/VertexInspector';
import { MuxGate } from '../components/MuxGate';
import type { TreeCanvasHandle } from '../components/tree/types';

// The configuration-tree page. The vertex inspector on the right appears only
// once a vertex is selected; until then the canvas has the full width.
export function ConfigurationTreePage() {
  const canvasRef = useRef<TreeCanvasHandle>(null);
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const issues = useStore((s) => s.issues);
  const muxPresent = useStore((s) => s.muxPresent);
  const orientation = useStore((s) => s.orientation);
  const setOrientation = useStore((s) => s.setOrientation);
  const highlightConeKey = useStore((s) => s.highlightConeKey);
  const setHighlightCone = useStore((s) => s.setHighlightCone);
  const selectedVertexKey = useStore((s) => s.selectedVertexKey);

  // If the selected vertex moved off-screen, ease it back into view.
  useEffect(() => {
    if (!selectedVertexKey) return;
    canvasRef.current?.scrollTo(selectedVertexKey);
  }, [selectedVertexKey]);

  // How many of the drawn vertices lie in the highlighted cone.
  const inCone = useMemo(() => {
    if (!highlightConeKey) return 0;
    let n = 0;
    for (const key of tree.vertices.keys()) {
      if (key === highlightConeKey || key.startsWith(highlightConeKey + '|')) n++;
    }
    return n;
  }, [tree.vertices, highlightConeKey]);

  const blocked = muxPresent;
  const empty = skeleton.byId.size <= 1 && issues.length === 0;
  const inspectorOpen = !!selectedVertexKey && !blocked && !empty;

  const canvas = (
    <Panel
      title="configuration tree T"
      right={
        <span className="flex items-center gap-1">
          {highlightConeKey ? (
            <Button
              active
              onClick={() => setHighlightCone(null)}
              title="stop highlighting the cone; the whole tree is drawn either way"
            >
              cone: {inCone.toLocaleString()} vertices, clear
            </Button>
          ) : null}
          <Button
            active={orientation === 'lr'}
            onClick={() => setOrientation('lr')}
            title="left to right; configuration trees are shallow and wide"
          >
            →
          </Button>
          <Button
            active={orientation === 'td'}
            onClick={() => setOrientation('td')}
            title="top down"
          >
            ↓
          </Button>
          <span
            className="chip text-[#8A8F98] tabular-nums"
            title="materialized vertices; hard cap 20 000"
          >
            {tree.vertices.size.toLocaleString()} vertices
          </span>
        </span>
      }
      className="h-full"
      bodyClassName="overflow-hidden relative"
    >
      {blocked ? (
        <BlockedState />
      ) : empty ? (
        <EmptyState />
      ) : (
        <>
          <ConfigurationTree canvasRef={canvasRef} />
          {tree.capped ? (
            <p className="absolute top-2 left-2 rounded border border-[#B4321F] bg-[#FCFCFA] px-2 py-1 text-[10.5px] text-[#B4321F]">
              the 20 000-vertex cap was reached; the deepest subtrees below{' '}
              {tree.cappedAt.length} vertex/vertices stay collapsed. The document edit was
              kept.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {muxPresent ? <MuxGate /> : null}
      <div className="min-h-0 flex-1">
        {inspectorOpen ? (
          <Split
            direction="horizontal"
            initial={62}
            min={30}
            max={80}
            a={<div className="h-full border-r border-[#D8D9D4]">{canvas}</div>}
            b={<VertexInspector />}
          />
        ) : (
          canvas
        )}
      </div>
    </div>
  );
}

function BlockedState() {
  return (
    <CentredNotice>
      The configuration tree is computed only for pure-<code>ind</code> documents.
      Change the <code>mux</code> blocks back to <code>ind</code> on the <SetupLink />.
    </CentredNotice>
  );
}

function EmptyState() {
  return (
    <CentredNotice>
      The document is just the root, so <code>T</code> is the single vertex{' '}
      <code>({'{r}'})</code>. Add possible nodes on the <SetupLink /> to unfold a
      configuration tree.
    </CentredNotice>
  );
}
