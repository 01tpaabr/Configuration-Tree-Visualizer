import { useEffect, useRef } from 'react';
import { useQueryStore } from '../../store/queries';
import { MAX_ACTIVE_PATHS } from '../../core/paths/palette';
import { formatProb } from '../../core/format';
import { Button } from '../ui';
import type { QueryResult } from './useEvaluations';

const PRESETS: Array<{ text: string; note: string }> = [
  { text: 'ε', note: 'the empty step: value 1' },
  { text: '↓', note: 'one step reaches a node: 0.90' },
  { text: '↓↓', note: 'two steps: 0.8476' },
  { text: '↓ ∪ ↓↓', note: 'one step or two: 0.90, not 1.7476' },
  { text: '↓[B]', note: 'a B-child: 0.50 = PD(B)' },
  { text: '↓↓[F]', note: 'an F-grandchild: 0.35' },
  { text: '↓[A]↓[F]', note: 'an A-child then an F: 0.28' },
  { text: '↓[A ∧ ¬B]↓[F]', note: 'excluding B: 0' },
  { text: '↓[B ∧ ¬A]↓[F]', note: 'B without A: 0.07' },
];

const TOKENS = ['↓', 'ε', '[', ']', '∪', '¬', '∧', '∨', '⟨', '⟩_'];

export function QueryList({ results }: { results: QueryResult[] }) {
  const addQuery = useQueryStore((s) => s.addQuery);
  const setQueryText = useQueryStore((s) => s.setQueryText);
  const removeQuery = useQueryStore((s) => s.removeQuery);
  const toggleQuery = useQueryStore((s) => s.toggleQuery);
  const focusQuery = useQueryStore((s) => s.focusQuery);
  const focusedId = useQueryStore((s) => s.focusedId);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const pendingCaret = useRef<{ id: string; at: number } | null>(null);

  // Insert a symbol into the expression being edited, at the caret. A new
  // expression is created only when there is none at all.
  const insert = (token: string): void => {
    const id = focusedId ?? results[0]?.query.id ?? addQuery('');
    const el = inputs.current.get(id);
    const text = useQueryStore.getState().queries.find((q) => q.id === id)?.text ?? '';
    const editing = !!el && document.activeElement === el;
    const from = editing ? (el.selectionStart ?? text.length) : text.length;
    const to = editing ? (el.selectionEnd ?? from) : from;

    setQueryText(id, text.slice(0, from) + token + text.slice(to));
    // React applies the new text a moment later; restore the caret after
    // that, or it jumps to the end.
    pendingCaret.current = { id, at: from + token.length };
  };

  useEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pendingCaret.current = null;
    const el = inputs.current.get(pending.id);
    el?.focus();
    el?.setSelectionRange(pending.at, pending.at);
  });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-1.5 p-3">
        {results.length === 0 ? (
          <p className="text-[11.5px] text-[#8A8F98]">
            No path expressions yet. Add one, or start from a preset below.
          </p>
        ) : null}

        {results.map((r) => {
          const focused = r.query.id === focusedId;
          const err = r.errors[0] ?? null;
          return (
            <div
              key={r.query.id}
              className={`rounded border px-2 py-1.5 ${
                focused ? 'border-[#2B5CE6] bg-[#2B5CE6]/5' : 'border-[#D8D9D4]'
              }`}
              // Selects, never deselects; clearing the focus is the header's
              // "show all" button. A toggle here fired on every click into
              // the input.
              onClick={() => focusQuery(r.query.id)}
            >
              <div className="flex items-center gap-1.5">
                <button
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  title={
                    r.query.colorIndex === null
                      ? `no hue left; at most ${MAX_ACTIVE_PATHS} expressions can be shown at once`
                      : r.query.enabled
                        ? 'shown on the canvas; click to hide'
                        : 'hidden; click to show'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleQuery(r.query.id);
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full border"
                    style={{
                      background: r.query.enabled ? r.color : 'transparent',
                      borderColor: r.query.colorIndex === null ? '#D8D9D4' : r.color,
                    }}
                  />
                </button>
                <span className="w-5 shrink-0 text-center font-mono text-[13px]">
                  {r.query.name}
                </span>
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(r.query.id, el);
                    else inputs.current.delete(r.query.id);
                  }}
                  value={r.query.text}
                  placeholder="↓[B]"
                  aria-label={`path expression ${r.query.name}`}
                  spellCheck={false}
                  className={`h-6 min-w-0 flex-1 rounded border bg-[#FCFCFA] px-1.5 font-mono text-[12px] focus:outline-none ${
                    err ? 'border-[#B4321F]' : 'border-[#D8D9D4] focus:border-[#2B5CE6]'
                  }`}
                  onChange={(e) => setQueryText(r.query.id, e.target.value)}
                  onFocus={() => focusQuery(r.query.id)}
                  onBlur={() => {
                    // rewrite in the Unicode spelling when the input loses focus
                    if (r.pretty && r.pretty !== r.query.text) {
                      setQueryText(r.query.id, r.pretty);
                    }
                  }}
                />
                <span
                  className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums"
                  title="the probability this expression reaches a non-empty configuration"
                >
                  {r.evaluation ? formatProb(r.evaluation.value) : ''}
                  {r.satisfying ? `${r.satisfying.size} ⊨` : ''}
                </span>
                <button
                  className="shrink-0 px-1 text-[11px] text-[#8A8F98] hover:text-[#B4321F]"
                  title="remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeQuery(r.query.id);
                  }}
                >
                  ⌫
                </button>
              </div>

              {err ? (
                <p className="mt-1 pl-8 text-[10.5px] text-[#B4321F]">{err.message}</p>
              ) : null}
              {r.budgetError ? (
                <p className="mt-1 pl-8 text-[10.5px] text-[#B4321F]">{r.budgetError}</p>
              ) : null}
              {r.query.colorIndex === null ? (
                <p className="mt-1 pl-8 text-[10.5px] text-[#8A8F98]">
                  no hue left; at most {MAX_ACTIVE_PATHS} expressions can be shown at
                  once; hide one to show this
                </p>
              ) : null}
              {r.kind === 'node' ? (
                <p className="mt-1 pl-8 text-[10.5px] text-[#8A8F98]">
                  a node expression: every state is coloured by satisfaction
                </p>
              ) : null}
            </div>
          );
        })}

        <Button onClick={() => addQuery('')}>Add path expression</Button>
      </div>

      <div className="border-t border-[#D8D9D4] px-3 py-2">
        <p className="mb-1 text-[10.5px] font-medium text-[#5C6068]">insert</p>
        <div className="flex flex-wrap gap-1">
          {TOKENS.map((t) => (
            <button
              key={t}
              className="h-6 rounded border border-[#D8D9D4] px-1.5 font-mono text-[12px] hover:bg-[#F4F4F1]"
              // keep the caret where it is: a plain click would take focus
              // from the input first
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#D8D9D4] px-3 py-2">
        <p className="mb-1 text-[10.5px] font-medium text-[#5C6068]">
          worked examples
        </p>
        <div className="space-y-0.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.text}
              className="block w-full rounded px-1.5 py-1 text-left hover:bg-[#F4F4F1]"
              onClick={() => {
                const id = addQuery(preset.text);
                focusQuery(id);
              }}
            >
              <span className="font-mono text-[12px]">{preset.text}</span>
              <span className="ml-2 text-[10.5px] text-[#8A8F98]">{preset.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
