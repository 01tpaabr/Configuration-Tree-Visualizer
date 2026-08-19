import { useRef, useState } from 'react';
import { InlineMath } from 'react-katex';
import { useStore } from '../store';
import type { Factor } from '../core/types';
import { formatProb, formatProbFull } from '../core/format';

const SCRUB_PER_PX = 0.005;

// One tile per available child, kept or dropped, each draggable, with the
// product recomputing live. The product of the tiles equals the step
// probability.
export function FactorizationStrip({
  factors,
  product,
}: {
  factors: Factor[];
  product: number;
}) {
  if (factors.length === 0) {
    return (
      <p className="text-[11.5px] text-[#8A8F98]">
        the empty product is <span className="font-mono">1</span>: the root vertex has
        <InlineMath math="\ \downarrow = 1" />
      </p>
    );
  }

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] text-[#5C6068]">
        <InlineMath math="\downarrow(\pi', \pi) = \prod_{v \in ch(\pi')} \begin{cases} PD(v) \\ 1 - PD(v)\end{cases}" />
      </div>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {factors.map((f, i) => (
          <div key={`${f.id}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-[13px] text-[#8A8F98]">·</span> : null}
            <Tile factor={f} />
          </div>
        ))}
        <span className="self-center text-[13px] text-[#8A8F98]">=</span>
        <div
          className="flex flex-col justify-center rounded border border-[#16181D] px-2 py-1"
          title={formatProbFull(product)}
        >
          <span className="chip text-[#5C6068]">↓</span>
          <span
            key={String(product)}
            className="numeral-changed font-mono text-[13px] tabular-nums"
          >
            {formatProb(product)}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[10.5px] text-[#8A8F98]">
        Drag a tile horizontally, or double-click to type in it, to change that
        node's <span className="font-mono">PD</span>; every dependent number
        updates live.
      </p>
    </div>
  );
}

function Tile({ factor }: { factor: Factor }) {
  const skeleton = useStore((s) => s.skeleton);
  const setProb = useStore((s) => s.setProb);
  const beginScrub = useStore((s) => s.beginScrub);
  const endScrub = useStore((s) => s.endScrub);
  const rootId = useStore((s) => s.doc.root.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const scrub = useRef<{ x: number; value: number } | null>(null);

  const node = skeleton.byId.get(factor.id);
  const editable = !!node && factor.id !== rootId;
  const pd = node?.prob ?? 0;

  const tone = factor.kept
    ? 'text-[#0F8A5F] border-[#0F8A5F]'
    : 'text-[#8A8F98] border-[#8A8F98]';

  const commit = (raw: string): void => {
    const n = Number(raw);
    setEditing(false);
    if (Number.isFinite(n) && editable) setProb(factor.id, Math.min(1, Math.max(0, n)));
  };

  return (
    <div
      className={`flex min-w-[76px] flex-col items-center rounded border px-2 py-1 select-none ${tone} ${
        editable ? 'cursor-ew-resize' : ''
      }`}
      title={
        `${factor.kept ? 'kept' : 'dropped'}, factor ${formatProbFull(factor.factor)}` +
        (editable ? `\nPD(${factor.label}) = ${formatProbFull(pd)}; drag to scrub` : '')
      }
      onPointerDown={(e) => {
        if (!editable) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        scrub.current = { x: e.clientX, value: pd };
        beginScrub(factor.id);
      }}
      onPointerMove={(e) => {
        if (!scrub.current || !editable) return;
        const next = Math.min(
          1,
          Math.max(0, scrub.current.value + (e.clientX - scrub.current.x) * SCRUB_PER_PX),
        );
        setProb(factor.id, Math.round(next * 100) / 100);
      }}
      onPointerUp={(e) => {
        if (!scrub.current) return;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        scrub.current = null;
        endScrub();
      }}
      onDoubleClick={() => {
        if (!editable) return;
        setDraft(String(pd));
        setEditing(true);
      }}
    >
      <span className="chip mb-0.5 whitespace-nowrap">
        {factor.kept ? `PD(${factor.label})` : `1−PD(${factor.label})`}
      </span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          aria-label={`PD of ${factor.label}`}
          className="h-5 w-[56px] rounded border border-[#2B5CE6] bg-[#FCFCFA] text-center font-mono text-[12px]"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          key={String(factor.factor)}
          className="numeral-changed font-mono text-[13px] tabular-nums"
        >
          {formatProb(factor.factor)}
        </span>
      )}
      <span className="chip mt-0.5 text-[9.5px] opacity-60">
        {factor.kept ? 'kept' : 'dropped'}
      </span>
    </div>
  );
}
