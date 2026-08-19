import { InlineMath } from 'react-katex';
import { useStore } from '../../store';
import { useQueryStore } from '../../store/queries';
import { formatConfig, formatDescent, formatProb, formatProbFull } from '../../core/format';
import { Panel, SectionHeading as H } from '../ui';
import type { QueryResult } from './useEvaluations';
import type { PathContext } from '../../core/paths/context';

// The inspector for the focused expression.
export function PathInspector({
  result,
  startKey,
  ctx,
}: {
  result: QueryResult | null;
  startKey: string;
  ctx: PathContext;
}) {
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const setStartKey = useQueryStore((s) => s.setStartKey);

  const descentOf = (key: string): string => {
    try {
      return formatDescent(skeleton, tree.vertices.get(key) ?? ctx.vertex(key));
    } catch {
      return key;
    }
  };

  if (!result || (!result.evaluation && !result.satisfying)) {
    return (
      <Panel title="path inspector">
        <p className="p-3 text-[12px] text-[#8A8F98]">
          Write a path expression to see its targets, its support, and the probability it
          reaches a non-empty configuration. Click any vertex to move the start state{' '}
          <InlineMath math="\pi" />.
        </p>
      </Panel>
    );
  }

  const ev = result.evaluation;

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: result.color }}
          />
          <span className="font-mono normal-case">{result.query.name}</span>
          <span className="font-mono normal-case text-[#5C6068]">{result.pretty}</span>
        </span>
      }
      right={
        <button
          className="chip rounded border border-[#D8D9D4] px-1.5 py-[3px] hover:border-[#2B5CE6]"
          title="the start state; click any vertex on the canvas to move it"
          onClick={() => setStartKey(null)}
        >
          from {descentOf(startKey)}
        </button>
      }
    >
      {result.satisfying ? (
        <div className="space-y-2 p-3">
          <p className="text-[12px]">
            <span className="font-mono text-[16px] tabular-nums">
              {result.satisfying.size}
            </span>{' '}
            <span className="text-[#5C6068]">
              of {tree.vertices.size} drawn states satisfy this node expression
            </span>
          </p>
          <p className="text-[10.5px] text-[#8A8F98]">
            A node expression denotes a set of states, <InlineMath math="[\![\varphi]\!]" />.
            A label test reads only <InlineMath math="cfg(\pi)" />, the last level of the
            descent, and admits whole configurations, never individual siblings.
          </p>
        </div>
      ) : null}

      {ev ? (
        <div className="space-y-4 p-3">
          <section>
            <p className="font-mono text-[26px] leading-none tabular-nums">
              {formatProb(ev.value)}
            </p>
            <p className="mt-1.5 text-[11.5px] text-[#5C6068]">
              {result.pretty} reaches a non-empty configuration with probability{' '}
              <span className="font-mono" title={formatProbFull(ev.value)}>
                {formatProb(ev.value)}
              </span>
              .
            </p>
            <p className="mt-0.5 text-[10.5px] text-[#8A8F98]">
              <InlineMath math="\pi \vDash \langle \alpha \rangle_q" /> iff{' '}
              <span className="font-mono">q ≤ {formatProb(ev.value)}</span>
            </p>
          </section>

          <section>
            <H>
              support <InlineMath math="supp_\pi(\alpha)" />
            </H>
            {ev.raw.targets.length === 0 ? (
              <p className="text-[11.5px] text-[#5C6068]">
                empty: this expression reaches no target from here
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  {ev.raw.targets.map((t) => {
                    const empty = ev.excludedEmpty.includes(t);
                    const counts = ev.contributing.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setStartKey(t)}
                        title={`${descentOf(t)}: c_π(σ) = ${formatProbFull(
                          ctx.coneMeasure(startKey, t),
                        )}${empty ? '\nexcluded by the V⁺ filter: its configuration is empty' : ''}`}
                        className={`chip rounded border px-1.5 py-[3px] ${
                          empty
                            ? 'border-[#D8D9D4] text-[#8A8F98] line-through'
                            : counts
                              ? 'border-current'
                              : 'border-[#D8D9D4] text-[#5C6068]'
                        }`}
                        style={counts && !empty ? { color: result.color } : undefined}
                      >
                        {formatConfig(skeleton, ctx.cfg(t))}{' '}
                        <span className="opacity-70">
                          {formatProb(ctx.coneMeasure(startKey, t))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!ev.raw.reduced ? (
                  <p className="mt-1.5 rounded border border-[#B4321F] bg-[#B4321F]/5 px-2 py-1 text-[10.5px] text-[#B4321F]">
                    these targets are nested: one is a strict ancestor of another, so
                    their cones overlap and their values must <strong>not</strong> be
                    added. The value below sums the ancestor-maximal ones only.
                  </p>
                ) : null}
              </>
            )}
          </section>

          {ev.contributing.length > 0 ? (
            <section>
              <H>decomposition</H>
              <table className="w-full text-[11.5px]">
                <tbody>
                  {ev.contributing.map((t) => (
                    <tr
                      key={t}
                      className="cursor-pointer border-b border-[#D8D9D4] last:border-0 hover:bg-[#F4F4F1]"
                      onClick={() => setStartKey(t)}
                    >
                      <td className="py-1 font-mono">{descentOf(t)}</td>
                      <td
                        className="py-1 text-right font-mono tabular-nums"
                        title={formatProbFull(ctx.coneMeasure(startKey, t))}
                      >
                        {formatProb(ctx.coneMeasure(startKey, t))}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-1 text-right text-[10.5px] text-[#8A8F98]">
                      Σ over the ancestor-maximal targets
                    </td>
                    <td className="pt-1 text-right font-mono tabular-nums">
                      {formatProb(ev.value)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          ) : null}

          {ev.excludedEmpty.length > 0 ? (
            <section>
              <H>excluded for empty configurations</H>
              <p className="text-[10.5px] text-[#8A8F98]">
                {ev.excludedEmpty.length} target
                {ev.excludedEmpty.length === 1 ? '' : 's'} whose configuration is empty,
                marked <span className="font-mono">∅</span> on the canvas. The filter is
                applied once, when the family is formed, never again after normalization,
                which would discard mass belonging to cones that did reach a node.
              </p>
            </section>
          ) : null}

          <section>
            <H>normalized family</H>
            <p className="text-[11.5px]">
              <span className="font-mono tabular-nums">
                {ev.normalized.targets.length}
              </span>{' '}
              <span className="text-[#5C6068]">
                aligned targets, Σ ={' '}
                <span className="font-mono">
                  {formatProb(
                    ev.normalized.targets.reduce(
                      (s, t) => s + ctx.coneMeasure(startKey, t),
                      0,
                    ),
                  )}
                </span>
              </span>
            </p>
            <p className="mt-1 text-[10.5px] text-[#8A8F98]">
              Redistribution replaces a target by its children (the same completed
              descents, the same measure) until no element is a strict ancestor of
              another. Only then may the entries be summed, and the sum is the value above.
            </p>
          </section>
        </div>
      ) : null}
    </Panel>
  );
}
