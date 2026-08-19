import { useEffect, useState } from 'react';
import { useStore } from '../store';

// A slider plus a numeric input accepting exact values, plus 0 / 0.5 / 1
// quick buttons. A whole drag counts as one undo step.
export function ProbControl({
  nodeId,
  value,
  disabled,
}: {
  nodeId: string;
  value: number;
  disabled?: boolean;
}) {
  const setProb = useStore((s) => s.setProb);
  const beginScrub = useStore((s) => s.beginScrub);
  const endScrub = useStore((s) => s.endScrub);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = (raw: string): void => {
    const n = Number(raw);
    if (Number.isFinite(n)) setProb(nodeId, Math.min(1, Math.max(0, n)));
    else setDraft(String(value));
  };

  return (
    <div className="space-y-1.5">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        aria-label="PD(v) slider"
        className="w-full"
        onPointerDown={() => beginScrub(nodeId)}
        onPointerUp={() => endScrub()}
        onBlur={() => endScrub()}
        onChange={(e) => setProb(nodeId, Number(e.target.value))}
      />
      <div className="flex items-center gap-1">
        <input
          value={draft}
          disabled={disabled}
          aria-label="PD(v) exact value"
          inputMode="decimal"
          className="h-6 w-[68px] rounded border border-[#D8D9D4] bg-[#FCFCFA] px-1.5 text-right font-mono text-[11.5px] tabular-nums focus:border-[#2B5CE6] focus:outline-none disabled:opacity-40"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
        />
        {[0, 0.5, 1].map((p) => (
          <button
            key={p}
            disabled={disabled}
            className="h-6 rounded border border-[#D8D9D4] bg-[#FCFCFA] px-1.5 font-mono text-[11px] hover:bg-[#F4F4F1] disabled:opacity-40"
            onClick={() => setProb(nodeId, p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
