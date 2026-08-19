// Text widths are measured once per string and remembered, so vertex boxes
// can be sized to fit their labels. An edited label is a new string, so it is
// measured again.
const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  return ctx;
}

export function measureText(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = context();
  // the test environment cannot measure text; estimate by character count
  const w = c ? ((c.font = font), c.measureText(text).width) : text.length * 7.4;
  cache.set(key, w);
  return w;
}

export const LABEL_FONT = "600 13px 'Inter Variable', Inter, system-ui, sans-serif";
export const MONO_FONT =
  "500 12px 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";
export const PILL_FONT =
  "500 11px 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";
