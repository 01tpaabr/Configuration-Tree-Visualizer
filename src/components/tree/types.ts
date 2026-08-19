// The three trees (skeleton, configuration, query) all draw through the same
// TreeCanvas, and this is the shape it draws.
export interface CanvasNode {
  id: string;
  label: string;
  // small pill below the label (the node probability on the skeleton page)
  pill?: string;
  // muted chip after the label (the data value)
  sub?: string;
  // vertex badge: numeral plus a bar proportional to the value
  badge?: { text: string; value: number; caption?: string };
  // label at the midpoint of the incoming edge
  edgeLabel?: string;
  edgeTitle?: string;
  // the incoming edge is affected by the slider currently being dragged
  edgeHighlight?: boolean;
  // the parent's distributional type, shown at the fan-out point
  fanChip?: string;
  fanChipInvalid?: boolean;
  isLeaf: boolean;
  dimmed?: boolean;
  // part of a highlighted cone: drawn in the accent while the rest dims
  accented?: boolean;
  // hues of the path expressions whose support contains this vertex
  tints?: string[];
  // their names, so identity never rests on colour alone
  tags?: string[];
  // colour for the incoming edge: a live route in the focused expression's hue
  edgeTint?: string;
  // its configuration is empty; excluded before summing
  emptyMarker?: boolean;
  // greyed with a 0 badge, never hidden
  zero?: boolean;
  // undefined when the node can never have children
  expanded?: boolean;
  // a collapsed vertex shows its hidden child count
  hiddenChildren?: number;
  // too many children to draw
  tooWide?: boolean;
  title?: string;
  aria?: string;
  children: CanvasNode[];
}

export interface LaidOut {
  node: CanvasNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  parent: LaidOut | null;
}

export interface TreeCanvasHandle {
  scrollTo: (id: string) => void;
}

export interface TreeCanvasProps {
  root: CanvasNode;
  orientation: 'lr' | 'td';
  selectedId?: string | null;
  levelLabel?: (depth: number) => string;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  // how the canvas positions itself when first shown
  initialView?: 'fit' | 'root';
  viewport?: { k: number; x: number; y: number };
  onViewportChange?: (v: { k: number; x: number; y: number }) => void;
  className?: string;
  ariaLabel?: string;
}
