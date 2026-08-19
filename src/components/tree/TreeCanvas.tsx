import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTreeLayout } from './useTreeLayout';
import { Vertex } from './Vertex';
import type { LaidOut, TreeCanvasHandle, TreeCanvasProps } from './types';

// React Flow provides the canvas: panning, zooming, drawing edges, skipping
// what is off-screen. Positions come from useTreeLayout, and each node draws
// the SVG Vertex.

type VertexData = {
  laid: LaidOut;
  selected: boolean;
  orientation: 'lr' | 'td';
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  [key: string]: unknown;
};

type StepEdgeData = {
  label?: string;
  title?: string;
  tint?: string;
  dimmed: boolean;
  highlighted: boolean;
  [key: string]: unknown;
};

const HIDDEN_HANDLE: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: 0,
  pointerEvents: 'none',
};

function VertexNode({ data }: NodeProps<Node<VertexData>>) {
  const { laid, selected, orientation, onSelect, onToggle } = data;
  const { w, h } = laid;
  // the Vertex draws centred on (x, y); place that centre mid-node
  const local: LaidOut = { ...laid, x: w / 2, y: h / 2, parent: null };
  return (
    <div style={{ width: w, height: h, position: 'relative' }}>
      <Handle
        type="target"
        position={orientation === 'lr' ? Position.Left : Position.Top}
        style={HIDDEN_HANDLE}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={orientation === 'lr' ? Position.Right : Position.Bottom}
        style={HIDDEN_HANDLE}
        isConnectable={false}
      />
      <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
        <Vertex laid={local} selected={selected} onSelect={onSelect} onToggle={onToggle} />
      </svg>
    </div>
  );
}

function StepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<StepEdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const d = data as StepEdgeData;
  const stroke =
    d.tint ?? (d.highlighted ? 'var(--color-selection)' : 'var(--color-hairline)');
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: d.tint ? 1.3 : d.highlighted ? 1.75 : 1,
          opacity: d.dimmed ? 0.28 : 1,
          transition: 'opacity 200ms cubic-bezier(0.33,1,0.68,1)',
        }}
      />
      {d.label ? (
        <EdgeLabelRenderer>
          <div
            title={d.title}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 10}px)`,
              background: 'var(--color-paper)',
              border: d.highlighted
                ? '1px solid var(--color-selection)'
                : '1px solid transparent',
              borderRadius: 3,
              padding: '0 4px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: '13px',
              color: d.highlighted ? 'var(--color-selection)' : 'var(--color-muted)',
              opacity: d.dimmed ? 0.3 : 1,
              pointerEvents: 'all',
            }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { vertex: VertexNode };
const EDGE_TYPES = { step: StepEdge };

const TreeCanvasInner = forwardRef<TreeCanvasHandle, TreeCanvasProps>(
  function TreeCanvasInner(props, ref) {
    const {
      root,
      orientation,
      selectedId,
      levelLabel,
      onSelect,
      onToggle,
      viewport,
      onViewportChange,
      initialView = 'fit',
      className,
      ariaLabel,
    } = props;

    const rf = useReactFlow();
    const wrapRef = useRef<HTMLDivElement>(null);
    const layout = useTreeLayout(root, orientation);
    const [zoom, setZoom] = useState(viewport?.k ?? 1);
    // true once the user has panned or zoomed by hand; after that, never re-frame
    const touched = useRef(false);

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ease = (ms: number): number => (reduceMotion ? 0 : ms);

    const nodes = useMemo(
      (): Node<VertexData>[] =>
        layout.nodes.map((n) => ({
          id: n.node.id,
          type: 'vertex',
          position: { x: n.x - n.w / 2, y: n.y - n.h / 2 },
          width: n.w,
          height: n.h,
          draggable: false,
          selectable: false,
          focusable: false,
          // pan starts on the empty pane only, never on a vertex
          className: 'nopan',
          // React Flow makes nodes ignore the mouse when nothing is draggable
          // or selectable; the Vertex handles its own clicks.
          style: { pointerEvents: 'all' as const },
          data: {
            laid: n,
            selected: selectedId === n.node.id,
            orientation,
            onSelect,
            onToggle,
          },
        })),
      [layout.nodes, selectedId, orientation, onSelect, onToggle],
    );

    const edges = useMemo(
      (): Edge<StepEdgeData>[] =>
        layout.nodes
          .filter((n): n is LaidOut & { parent: LaidOut } => n.parent !== null)
          .map((n) => ({
            id: `e-${n.node.id}`,
            source: n.parent.node.id,
            target: n.node.id,
            type: 'step',
            focusable: false,
            data: {
              label: n.node.edgeLabel,
              title: n.node.edgeTitle,
              tint: n.node.edgeTint,
              dimmed: !!(n.node.dimmed || n.parent.node.dimmed),
              highlighted:
                selectedId === n.node.id ||
                !!n.node.edgeHighlight ||
                // an edge belongs to a cone only when both its ends do
                (!!n.node.accented && !!n.parent.node.accented),
            },
          })),
      [layout.nodes, selectedId],
    );

    const fit = useCallback(
      (animate = true) => {
        void rf.fitView({ padding: 0.08, minZoom: 0.05, maxZoom: 1, duration: ease(animate ? 200 : 0) });
      },
      [rf], // eslint-disable-line react-hooks/exhaustive-deps
    );

    const centreOnRoot = useCallback(
      (animate = true, scale?: number) => {
        const r = layout.nodes[0];
        const el = wrapRef.current;
        if (!r || !el) return;
        const k = scale ?? rf.getViewport().zoom;
        void rf.setViewport(
          {
            x: orientation === 'lr' ? 120 : el.clientWidth / 2 - r.x * k,
            y: orientation === 'lr' ? el.clientHeight / 2 - r.y * k : 90,
            zoom: k,
          },
          { duration: ease(animate ? 200 : 0) },
        );
      },
      [layout.nodes, orientation, rf], // eslint-disable-line react-hooks/exhaustive-deps
    );

    const scrollTo = useCallback(
      (id: string) => {
        const n = layout.byId.get(id);
        const el = wrapRef.current;
        if (!n || !el) return;
        const vp = rf.getViewport();
        const sx = n.x * vp.zoom + vp.x;
        const sy = n.y * vp.zoom + vp.y;
        if (sx > 40 && sx < el.clientWidth - 40 && sy > 40 && sy < el.clientHeight - 40) return;
        void rf.setCenter(n.x, n.y, { zoom: vp.zoom, duration: ease(200) });
      },
      [layout.byId, rf], // eslint-disable-line react-hooks/exhaustive-deps
    );

    // a stored viewport is the user's place; never re-frame over it
    const restored = useRef(
      !!viewport && (viewport.k !== 1 || viewport.x !== 0 || viewport.y !== 0),
    );

    const onInit = useCallback(() => {
      if (restored.current || touched.current) return;
      if (layout.nodes.length === 0) return;
      if (initialView === 'root') centreOnRoot(false, 1);
      else fit(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout.nodes.length, initialView, centreOnRoot, fit]);

    // a different root is a different tree: re-frame, or it can land off-screen
    const framedRoot = useRef(root.id);
    useEffect(() => {
      if (framedRoot.current === root.id) return;
      framedRoot.current = root.id;
      if (layout.nodes.length === 0) return;
      touched.current = false;
      if (initialView === 'root') centreOnRoot(true, 1);
      else fit(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [root.id, layout.nodes.length]);

    useImperativeHandle(ref, (): TreeCanvasHandle => ({ scrollTo }), [scrollTo]);

    const guides = useMemo(() => {
      if (!levelLabel) return [];
      return [...layout.levels.entries()].sort((a, b) => a[0] - b[0]);
    }, [layout.levels, levelLabel]);

    const { minX, minY, maxX, maxY } = layout.bounds;

    return (
      <div
        ref={wrapRef}
        role="tree"
        aria-label={ariaLabel}
        className={`relative h-full w-full overflow-hidden ${className ?? ''}`}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === 'INPUT') return;
          if (e.key === '+' || e.key === '=') {
            void rf.zoomTo(rf.getZoom() * 1.25, { duration: ease(150) });
            e.preventDefault();
          } else if (e.key === '-') {
            void rf.zoomTo(rf.getZoom() * 0.8, { duration: ease(150) });
            e.preventDefault();
          } else if (e.key === '0') {
            fit(true);
            e.preventDefault();
          }
        }}
        tabIndex={-1}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultViewport={
            viewport ? { x: viewport.x, y: viewport.y, zoom: viewport.k } : undefined
          }
          minZoom={0.05}
          maxZoom={4}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements
          onInit={onInit}
          onPaneClick={() => onSelect?.('')}
          onMove={(event, vp) => {
            if (event != null) touched.current = true;
            setZoom(vp.zoom);
            onViewportChange?.({ k: vp.zoom, x: vp.x, y: vp.y });
          }}
          proOptions={{ hideAttribution: true }}
        >
          {guides.length > 0 ? (
            <ViewportPortal>
              {guides.map(([depth, coord]) => (
                <div key={`guide-${depth}`} style={{ pointerEvents: 'none' }}>
                  <div
                    style={
                      orientation === 'td'
                        ? {
                            position: 'absolute',
                            left: minX - 40,
                            top: coord,
                            width: maxX - minX + 80,
                            borderTop: '1px dashed var(--color-hairline)',
                            opacity: 0.7,
                          }
                        : {
                            position: 'absolute',
                            left: coord,
                            top: minY - 40,
                            height: maxY - minY + 80,
                            borderLeft: '1px dashed var(--color-hairline)',
                            opacity: 0.7,
                          }
                    }
                  />
                  <div
                    style={{
                      position: 'absolute',
                      ...(orientation === 'td'
                        ? {
                            left: minX - 86,
                            top: coord,
                            width: 40,
                            transform: 'translateY(-50%)',
                            textAlign: 'right' as const,
                          }
                        : {
                            left: coord,
                            top: minY - 46,
                            transform: 'translate(-50%, -50%)',
                          }),
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--color-dropped)',
                    }}
                  >
                    {levelLabel?.(depth)}
                  </div>
                </div>
              ))}
            </ViewportPortal>
          ) : null}
        </ReactFlow>

        <CanvasControls
          scale={zoom}
          onFit={() => fit(true)}
          onReset={() => void rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: ease(200) })}
          onCentre={() => centreOnRoot(true)}
          onZoom={(f) => void rf.zoomTo(rf.getZoom() * f, { duration: ease(150) })}
        />
      </div>
    );
  },
);

export const TreeCanvas = forwardRef<TreeCanvasHandle, TreeCanvasProps>(
  function TreeCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <TreeCanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    );
  },
);

function CanvasControls({
  scale,
  onFit,
  onReset,
  onCentre,
  onZoom,
}: {
  scale: number;
  onFit: () => void;
  onReset: () => void;
  onCentre: () => void;
  onZoom: (f: number) => void;
}) {
  const btn =
    'px-2 h-6 text-[11px] border border-[#D8D9D4] bg-[#FCFCFA] hover:bg-[#F4F4F1] rounded';
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 select-none">
      <button className={btn} onClick={onFit} title="fit to view (0)">
        fit
      </button>
      <button className={btn} onClick={onReset} title="100 %">
        100 %
      </button>
      <button className={btn} onClick={onCentre} title="centre on root">
        root
      </button>
      <button className={btn} onClick={() => onZoom(1.25)} title="zoom in (+)">
        +
      </button>
      <button className={btn} onClick={() => onZoom(0.8)} title="zoom out (−)">
        −
      </button>
      <span className="chip ml-1 text-[#8A8F98] tabular-nums">
        {Math.round(scale * 100)} %
      </span>
    </div>
  );
}
