// Plain types; nothing in src/core/ depends on React.

export type NodeId = string; // stable, generated once at creation; not the label

export type DistType = 'ind' | 'mux';

// A possible node of the p-document.
export interface PNode {
  id: NodeId;
  label: string;
  data?: string | number; // display only, never used in probabilities
  prob: number; // conditional existence probability PD; 1 for the root
  distType: DistType | null; // type of the block governing this node's children
  children: PNode[]; // document order
}

export interface PDocument {
  root: PNode; // root.prob is always 1
}

// Lookup tables over the skeleton, rebuilt whenever its structure changes.
export interface Skeleton {
  root: NodeId;
  byId: Map<NodeId, PNode>;
  parent: Map<NodeId, NodeId | null>;
  depth: Map<NodeId, number>;
  docOrder: Map<NodeId, number>; // pre-order index; sorts every configuration
  childIds: Map<NodeId, NodeId[]>;
  // "A₁" / "A₂" when a label occurs more than once, plain "A" when unique.
  displayLabel: Map<NodeId, string>;
}

// A vertex of the configuration tree: the descent (S₀,…,S_k).
export interface CfgVertex {
  key: string; // built from node ids, e.g. "r|A,B|C,F"; '' for an empty level
  parentKey: string | null;
  path: NodeId[][]; // each level sorted by docOrder
  cfg: NodeId[]; // the last level, S_k
  depth: number;
  stepProb: number; // probability of the step from the parent; 1 at the root
  reachProb: number; // product of step probabilities from the root
  isLeaf: boolean; // no available children
  childKeys: string[] | null; // null = not yet expanded
}

// One tile of the editable factorization strip.
export interface Factor {
  id: NodeId;
  label: string;
  kept: boolean;
  factor: number;
}

export interface ParseError {
  message: string;
  // positions in the source text, counted from 0, when known
  from?: number;
  to?: number;
}

export type ParseResult =
  | { ok: true; doc: PDocument }
  | { ok: false; errors: ParseError[] };

export interface ValidationIssue {
  nodeId: NodeId | null;
  message: string;
}

export const TOLERANCE = 1e-9;
