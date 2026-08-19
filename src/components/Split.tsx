import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// A resizable two-pane split. Panes stack below 1024 px.
export function Split({
  direction,
  initial = 50,
  min = 15,
  max = 85,
  a,
  b,
}: {
  direction: 'horizontal' | 'vertical';
  initial?: number;
  min?: number;
  max?: number;
  a: ReactNode;
  b: ReactNode;
}) {
  const [pct, setPct] = useState(initial);
  const [stacked, setStacked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onResize = (): void => setStacked(window.innerWidth < 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const next =
        direction === 'horizontal'
          ? ((e.clientX - r.left) / r.width) * 100
          : ((e.clientY - r.top) / r.height) * 100;
      setPct(Math.min(max, Math.max(min, next)));
    },
    [direction, min, max],
  );

  useEffect(() => {
    const up = (): void => {
      dragging.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
    };
  }, [onMove]);

  const horizontal = direction === 'horizontal' && !stacked;

  return (
    <div
      ref={ref}
      className={`flex min-h-0 min-w-0 ${horizontal ? 'flex-row' : 'flex-col'} h-full w-full`}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={horizontal ? { width: `${pct}%` } : { height: `${pct}%` }}
      >
        {a}
      </div>
      <div
        role="separator"
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        tabIndex={0}
        onPointerDown={() => {
          dragging.current = true;
          document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setPct((p) => Math.max(min, p - 2));
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setPct((p) => Math.min(max, p + 2));
        }}
        className={
          'shrink-0 bg-[#D8D9D4] transition-colors hover:bg-[#2B5CE6] ' +
          (horizontal ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize')
        }
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{b}</div>
    </div>
  );
}
