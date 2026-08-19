import type { CfgVertex, NodeId, Skeleton } from './types';
import { labelOf } from './skeleton';

export function formatConfig(sk: Skeleton, cfg: NodeId[]): string {
  if (cfg.length === 0) return '∅';
  return cfg.map((id) => labelOf(sk, id)).join('');
}

export function formatDescent(sk: Skeleton, v: CfgVertex): string {
  return v.path.map((level) => formatConfig(sk, level)).join(' / ');
}

// Six significant digits for display; the exact value belongs in a tooltip.
export function formatProb(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p === 0) return '0';
  if (p === 1) return '1';
  const s = p.toPrecision(6);
  if (s.includes('e')) return s;
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatProbFull(p: number): string {
  return String(p);
}

// Shortest exact decimal: 0.8 stays "0.8", 1 stays "1".
export function exactDecimal(p: number): string {
  if (Number.isInteger(p)) return String(p);
  const s = String(p);
  return s.length <= 10 ? s : p.toPrecision(10).replace(/0+$/, '').replace(/\.$/, '');
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen',
];

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function vertexAriaLabel(
  sk: Skeleton,
  v: CfgVertex,
  childCount: number,
): string {
  const cfg =
    v.cfg.length === 0
      ? 'empty configuration'
      : `configuration ${v.cfg.map((id) => labelOf(sk, id)).join(' ')}`;
  const kind = v.isLeaf ? 'leaf' : `${countWord(childCount)} children`;
  return `${cfg}, step probability ${formatProb(v.stepProb)}, reach probability ${formatProb(v.reachProb)}, ${kind}`;
}
