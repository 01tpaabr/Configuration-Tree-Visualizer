import { create } from 'zustand';
import type {
  DistType,
  NodeId,
  ParseError,
  PDocument,
  Skeleton,
  ValidationIssue,
} from '../core/types';
import * as cmd from '../core/commands';
import { buildSkeleton, hasMux } from '../core/skeleton';
import { parsePDocument, reconcileIds } from '../core/parse';
import { serializePDocument } from '../core/serialize';
import { validateDocument } from '../core/validate';
import { rescore } from '../core/cfgtree';
import { FIXTURE_W } from '../core/fixtures';
import {
  buildTree,
  nearestSurviving,
  preOrder,
  type ExpansionState,
  type TreeState,
} from './tree';

// How much the last edit had to recompute.
export type RecomputePolicy =
  | 'rescore'
  | 'none'
  | 'captions'
  | 'gate'
  | 'reorder'
  | 'rebuild';

export interface RecomputeLog {
  command: string;
  policy: RecomputePolicy;
  ms: number;
  vertices: number;
}

function recomputeLog(
  command: string,
  policy: RecomputePolicy,
  t0: number,
  vertices: number,
): RecomputeLog {
  return { command, policy, ms: performance.now() - t0, vertices };
}

interface HistoryEntry {
  doc: PDocument;
  selectedNodeId: NodeId | null;
  selectedVertexKey: string | null;
  label: string;
}

const HISTORY_LIMIT = 100;

export type CanvasId = 'skeleton' | 'configuration' | 'query';
export interface Viewport {
  k: number;
  x: number;
  y: number;
}
const IDENTITY_VIEWPORT: Viewport = { k: 1, x: 0, y: 0 };

export interface AppState {
  doc: PDocument;
  skeleton: Skeleton;
  issues: ValidationIssue[];

  tree: TreeState;
  expansion: ExpansionState;
  // true when the document contains a mux block, which blocks the tree pages
  muxPresent: boolean;

  selectedNodeId: NodeId | null;
  selectedVertexKey: string | null;
  highlightConeKey: string | null;

  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  scrubbing: boolean;
  // the node whose slider is being dragged, so the affected edges can highlight
  scrubNodeId: NodeId | null;

  xmlText: string;
  xmlOrigin: 'pane' | 'model';
  xmlErrors: ParseError[];

  orientation: 'lr' | 'td';
  lastRecompute: RecomputeLog | null;
  // zoom and pan live here so edits and page navigation never reset them
  viewport: Record<CanvasId, Viewport>;

  addChild: (parentId: NodeId, at?: number) => void;
  addSibling: (nodeId: NodeId, side: 'before' | 'after') => void;
  deleteNode: (nodeId: NodeId) => void;
  setLabel: (nodeId: NodeId, label: string) => void;
  setData: (nodeId: NodeId, data: string | number | undefined) => void;
  setProb: (nodeId: NodeId, p: number) => void;
  setDistType: (nodeId: NodeId, type: DistType) => void;
  normaliseMux: (nodeId: NodeId) => void;
  moveChild: (nodeId: NodeId, delta: number) => void;
  replaceDocument: (doc: PDocument, label?: string) => void;
  loadXml: (xml: string, label?: string) => boolean;
  editXml: (text: string) => void;

  undo: () => void;
  redo: () => void;
  beginScrub: (nodeId?: NodeId) => void;
  endScrub: () => void;

  selectNode: (id: NodeId | null) => void;
  selectVertex: (key: string | null) => void;
  toggleExpand: (key: string) => void;
  expandVertex: (key: string) => void;
  collapseVertex: (key: string) => void;
  setOrientation: (o: 'lr' | 'td') => void;
  setHighlightCone: (key: string | null) => void;
  setViewport: (canvas: CanvasId, v: Viewport) => void;
}

function initialDocument(): PDocument {
  const parsed = parsePDocument(FIXTURE_W);
  if (!parsed.ok) throw new Error('the shipped fixture W must parse');
  return parsed.doc;
}

function freshExpansion(): ExpansionState {
  return { expanded: new Set(), collapsed: new Set() };
}

export const useStore = create<AppState>()((set, get) => {
  // Rebuild everything from the document, keeping the selection and the open
  // vertices where possible.
  const rebuild = (
    doc: PDocument,
    label: string,
    policy: RecomputePolicy,
    opts?: { keepExpansion?: boolean; xmlFromPane?: boolean },
  ): void => {
    const t0 = performance.now();
    const prev = get();
    const skeleton = buildSkeleton(doc);
    const expansion = opts?.keepExpansion === false ? freshExpansion() : prev.expansion;
    const tree = buildTree(skeleton, expansion);

    let selectedVertexKey = prev.selectedVertexKey;
    if (selectedVertexKey && !tree.vertices.has(selectedVertexKey)) {
      selectedVertexKey = nearestSurviving(tree.vertices, selectedVertexKey);
    }
    const selectedNodeId =
      prev.selectedNodeId && skeleton.byId.has(prev.selectedNodeId)
        ? prev.selectedNodeId
        : null;

    set({
      doc,
      skeleton,
      issues: validateDocument(doc),
      tree,
      expansion: { expanded: tree.expanded, collapsed: expansion.collapsed },
      muxPresent: hasMux(skeleton),
      selectedVertexKey,
      selectedNodeId,
      highlightConeKey:
        prev.highlightConeKey && tree.vertices.has(prev.highlightConeKey)
          ? prev.highlightConeKey
          : null,
      xmlText: opts?.xmlFromPane ? prev.xmlText : serializePDocument(doc),
      xmlOrigin: opts?.xmlFromPane ? 'pane' : 'model',
      xmlErrors: [],
      lastRecompute: recomputeLog(label, policy, t0, tree.vertices.size),
    });
  };

  // A probability edit changes no structure, so only the numbers on the
  // existing vertices are recomputed. Open vertices, selection and zoom stay.
  const rescoreOnly = (doc: PDocument, label: string): void => {
    const t0 = performance.now();
    const prev = get();
    const skeleton = buildSkeleton(doc);
    const vertices = rescore(skeleton, prev.tree.vertices);
    const root = vertices.get(skeleton.root);
    set({
      doc,
      skeleton,
      issues: validateDocument(doc),
      tree: {
        ...prev.tree,
        vertices,
        order: root ? preOrder(vertices, root) : prev.tree.order,
      },
      xmlText: serializePDocument(doc),
      xmlOrigin: 'model',
      lastRecompute: recomputeLog(label, 'rescore', t0, vertices.size),
    });
  };

  // A label or data edit changes no number and no key; only the text shown
  // on screen changes.
  const captionsOnly = (
    doc: PDocument,
    label: string,
    policy: RecomputePolicy,
  ): void => {
    const t0 = performance.now();
    const prev = get();
    const skeleton = buildSkeleton(doc);
    set({
      doc,
      skeleton,
      issues: validateDocument(doc),
      xmlText: serializePDocument(doc),
      xmlOrigin: 'model',
      lastRecompute: recomputeLog(label, policy, t0, prev.tree.vertices.size),
    });
  };

  // Take the newest entry from one history list; the current state moves onto
  // the other.
  const timeTravel = (dir: 'undo' | 'redo'): void => {
    const s = get();
    const stack = dir === 'undo' ? s.undoStack : s.redoStack;
    const entry = stack[0];
    if (!entry) return;
    const counterpart: HistoryEntry = {
      doc: s.doc,
      selectedNodeId: s.selectedNodeId,
      selectedVertexKey: s.selectedVertexKey,
      label: entry.label,
    };
    const other = dir === 'undo' ? s.redoStack : s.undoStack;
    const pushed = [counterpart, ...other].slice(0, HISTORY_LIMIT);
    set(
      dir === 'undo'
        ? { undoStack: stack.slice(1), redoStack: pushed }
        : { redoStack: stack.slice(1), undoStack: pushed },
    );
    rebuild(entry.doc, `${dir} ${entry.label}`, 'rebuild');
    set({
      selectedNodeId: entry.selectedNodeId,
      selectedVertexKey: entry.selectedVertexKey,
    });
  };

  const pushHistory = (label: string): void => {
    const s = get();
    // a whole slider drag counts as one undo step
    if (s.scrubbing && s.undoStack.length > 0 && s.undoStack[0].label === label) return;
    const entry: HistoryEntry = {
      doc: s.doc,
      selectedNodeId: s.selectedNodeId,
      selectedVertexKey: s.selectedVertexKey,
      label,
    };
    set({
      undoStack: [entry, ...s.undoStack].slice(0, HISTORY_LIMIT),
      redoStack: [],
    });
  };

  const initialDoc = initialDocument();
  const initialSkeleton = buildSkeleton(initialDoc);
  const initialTree = buildTree(initialSkeleton, freshExpansion());

  return {
    doc: initialDoc,
    skeleton: initialSkeleton,
    issues: validateDocument(initialDoc),
    tree: initialTree,
    expansion: { expanded: initialTree.expanded, collapsed: new Set() },
    muxPresent: hasMux(initialSkeleton),

    selectedNodeId: null,
    selectedVertexKey: null,
    highlightConeKey: null,

    undoStack: [],
    redoStack: [],
    scrubbing: false,
    scrubNodeId: null,

    xmlText: serializePDocument(initialDoc),
    xmlOrigin: 'model',
    xmlErrors: [],

    orientation: 'lr',
    lastRecompute: null,
    viewport: {
      skeleton: IDENTITY_VIEWPORT,
      configuration: IDENTITY_VIEWPORT,
      query: IDENTITY_VIEWPORT,
    },

    addChild: (parentId, at) => {
      pushHistory('add child');
      const next = cmd.addChild(get().doc, parentId, at);
      rebuild(next, 'addChild', 'rebuild');
    },

    addSibling: (nodeId, side) => {
      if (nodeId === get().doc.root.id) return; // disabled on the root
      pushHistory('add sibling');
      rebuild(cmd.addSibling(get().doc, nodeId, side), 'addSibling', 'rebuild');
    },

    deleteNode: (nodeId) => {
      if (nodeId === get().doc.root.id) return; // disabled on the root
      pushHistory('delete subtree');
      rebuild(cmd.deleteNode(get().doc, nodeId), 'deleteNode', 'rebuild');
    },

    setLabel: (nodeId, label) => {
      pushHistory('rename');
      captionsOnly(cmd.setLabel(get().doc, nodeId, label), 'setLabel', 'captions');
    },

    setData: (nodeId, data) => {
      pushHistory('set data value');
      captionsOnly(cmd.setData(get().doc, nodeId, data), 'setData', 'none');
    },

    setProb: (nodeId, p) => {
      const s = get();
      if (nodeId === s.doc.root.id) return; // the root's probability is fixed at 1
      pushHistory(`probability of ${nodeId}`);
      rescoreOnly(cmd.setProb(get().doc, nodeId, p), 'setProb');
    },

    setDistType: (nodeId, type) => {
      pushHistory('distributional type');
      const next = cmd.setDistType(get().doc, nodeId, type);
      rebuild(next, 'setDistType', 'gate');
    },

    normaliseMux: (nodeId) => {
      pushHistory('normalise mux');
      rescoreOnly(cmd.normaliseMux(get().doc, nodeId), 'normaliseMux');
    },

    moveChild: (nodeId, delta) => {
      pushHistory('reorder');
      rebuild(cmd.moveChild(get().doc, nodeId, delta), 'moveChild', 'reorder');
    },

    replaceDocument: (doc, label = 'replaceDocument') => {
      pushHistory('replace document');
      rebuild(cmd.replaceDocument(doc), label, 'rebuild', {
        keepExpansion: false,
      });
    },

    loadXml: (xml, label = 'loadXml') => {
      const parsed = parsePDocument(xml);
      if (!parsed.ok) {
        set({ xmlErrors: parsed.errors });
        return false;
      }
      pushHistory('load document');
      rebuild(parsed.doc, label, 'rebuild', { keepExpansion: false });
      return true;
    },

    editXml: (text) => {
      const s = get();
      const parsed = parsePDocument(text);
      if (!parsed.ok) {
        // keep the last valid document; the trees do not clear or flicker
        set({ xmlText: text, xmlOrigin: 'pane', xmlErrors: parsed.errors });
        return;
      }
      const reconciled = reconcileIds(s.doc, parsed.doc);
      if (serializePDocument(reconciled) === serializePDocument(s.doc)) {
        set({ xmlText: text, xmlOrigin: 'pane', xmlErrors: [] });
        return;
      }
      pushHistory('edit XML');
      set({ xmlText: text });
      rebuild(reconciled, 'replaceDocument (XML pane)', 'rebuild', {
        xmlFromPane: true,
      });
    },

    undo: () => timeTravel('undo'),
    redo: () => timeTravel('redo'),

    beginScrub: (nodeId) => set({ scrubbing: true, scrubNodeId: nodeId ?? null }),
    endScrub: () => set({ scrubbing: false, scrubNodeId: null }),

    selectNode: (id) => set({ selectedNodeId: id }),
    selectVertex: (key) => set({ selectedVertexKey: key }),

    expandVertex: (key) => {
      const s = get();
      const expanded = new Set(s.expansion.expanded).add(key);
      const collapsed = new Set(s.expansion.collapsed);
      collapsed.delete(key);
      set({
        expansion: { expanded, collapsed },
        tree: buildTree(s.skeleton, { expanded, collapsed }),
      });
    },

    collapseVertex: (key) => {
      const s = get();
      const expanded = new Set(s.expansion.expanded);
      expanded.delete(key);
      // also drop everything below, so reopening does not resurrect a deep subtree
      for (const k of expanded) if (k.startsWith(key + '|')) expanded.delete(k);
      const collapsed = new Set(s.expansion.collapsed).add(key);
      const expansion = { expanded, collapsed };
      const tree = buildTree(s.skeleton, expansion);
      set({ expansion: { expanded: tree.expanded, collapsed }, tree });
    },

    toggleExpand: (key) => {
      const s = get();
      const isOpen = (s.tree.vertices.get(key)?.childKeys?.length ?? 0) > 0;
      if (isOpen) get().collapseVertex(key);
      else get().expandVertex(key);
    },

    setOrientation: (o) => set({ orientation: o }),
    setHighlightCone: (key) => set({ highlightConeKey: key }),
    setViewport: (canvas, v) =>
      set((s) => ({ viewport: { ...s.viewport, [canvas]: v } })),
  };
});

// During development the store is reachable from the browser console.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { __store?: unknown }).__store = useStore;
}
