import { useMemo } from 'react';
import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import type { HierarchyPointNode } from 'd3-hierarchy';
import { LABEL_FONT, MONO_FONT, PILL_FONT, measureText } from './measure';
import type { CanvasNode, LaidOut } from './types';

const PAD_X = 11;
const MIN_W = 30;
const BASE_H = 26;
const PILL_H = 15;
const BADGE_H = 13;
const SIB_GAP = 16;
const DEPTH_GAP_LR = 118;
const DEPTH_GAP_TD = 74;

export interface Layout {
  nodes: LaidOut[];
  byId: Map<string, LaidOut>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  // depth to depth-axis coordinate, for the level guides
  levels: Map<number, number>;
}

function boxOf(n: CanvasNode): { w: number; h: number } {
  const labelW = measureText(n.label, LABEL_FONT);
  const pillW = n.pill ? measureText(n.pill, PILL_FONT) : 0;
  const subW = n.sub ? measureText(`(${n.sub})`, PILL_FONT) + 4 : 0;
  const badgeW = n.badge ? measureText(n.badge.text, MONO_FONT) : 0;
  const w = Math.max(MIN_W, Math.max(labelW + subW, pillW, badgeW) + PAD_X * 2);
  let h = BASE_H;
  if (n.pill) h += PILL_H;
  if (n.badge) h += BADGE_H;
  return { w: Math.round(w), h };
}

// d3.tree only computes positions; React draws everything. Gaps come from the
// widest measured box so nothing is cut off, and the same input always gives
// the same positions.
export function useTreeLayout(
  root: CanvasNode,
  orientation: 'lr' | 'td',
): Layout {
  return useMemo(() => {
    const h = hierarchy<CanvasNode>(root, (d) =>
      d.expanded === false ? [] : d.children,
    );

    const boxes = new Map<CanvasNode, { w: number; h: number }>();
    h.each((d) => boxes.set(d.data, boxOf(d.data)));
    let maxW = 0;
    let maxH = 0;
    for (const b of boxes.values()) {
      maxW = Math.max(maxW, b.w);
      maxH = Math.max(maxH, b.h);
    }

    const breadth =
      orientation === 'td' ? maxW + SIB_GAP : maxH + SIB_GAP - 4;
    const depth =
      orientation === 'td' ? maxH + DEPTH_GAP_TD : maxW + DEPTH_GAP_LR;

    const laid = d3tree<CanvasNode>().nodeSize([breadth, depth])(h);

    const nodes: LaidOut[] = [];
    const byId = new Map<string, LaidOut>();
    const levels = new Map<number, number>();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const visit = (d: HierarchyPointNode<CanvasNode>, parent: LaidOut | null): void => {
      const b = boxes.get(d.data) ?? { w: MIN_W, h: BASE_H };
      const x = orientation === 'td' ? d.x : d.y;
      const y = orientation === 'td' ? d.y : d.x;
      const out: LaidOut = { node: d.data, x, y, w: b.w, h: b.h, depth: d.depth, parent };
      nodes.push(out);
      byId.set(d.data.id, out);
      levels.set(d.depth, orientation === 'td' ? y : x);
      minX = Math.min(minX, x - b.w / 2);
      maxX = Math.max(maxX, x + b.w / 2);
      minY = Math.min(minY, y - b.h / 2);
      maxY = Math.max(maxY, y + b.h / 2);
      for (const c of d.children ?? []) visit(c, out);
    };
    visit(laid, null);

    return {
      nodes,
      byId,
      bounds: {
        minX: Number.isFinite(minX) ? minX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
      },
      levels,
    };
  }, [root, orientation]);
}
