import { useMemo } from 'react';
import { InlineMath } from 'react-katex';
import { useStore } from '../store';
import type { CfgVertex, NodeId } from '../core/types';
import { chOfConfig, labelOf, subscript } from '../core/skeleton';
import { countLeavesBelow, nodesOf } from '../core/cfgtree';
import { factorization } from '../core/probability';
import { formatConfig, formatProb, formatProbFull } from '../core/format';
import { serializePossibleDocument } from '../core/serialize';
import { Button, Panel, SectionHeading as H } from './ui';
import { FactorizationStrip } from './FactorizationStrip';
import { SiblingSumStrip } from './SiblingSumStrip';

// What clicking a configuration-tree vertex shows. Formulas render with KaTeX.
export function VertexInspector() {
  const skeleton = useStore((s) => s.skeleton);
  const doc = useStore((s) => s.doc);
  const tree = useStore((s) => s.tree);
  const selectedVertexKey = useStore((s) => s.selectedVertexKey);
  const highlightConeKey = useStore((s) => s.highlightConeKey);
  const selectVertex = useStore((s) => s.selectVertex);
  const selectNode = useStore((s) => s.selectNode);
  const setHighlightCone = useStore((s) => s.setHighlightCone);

  const v = selectedVertexKey ? tree.vertices.get(selectedVertexKey) : null;

  const chain = useMemo(() => {
    if (!v) return [];
    const out: CfgVertex[] = [];
    let cur: CfgVertex | undefined = v;
    while (cur) {
      out.unshift(cur);
      cur = cur.parentKey ? tree.vertices.get(cur.parentKey) : undefined;
    }
    return out;
  }, [v, tree.vertices]);

  const leafCount = useMemo(
    () => (v ? countLeavesBelow(skeleton, v.key, 20_000) : null),
    [v, skeleton],
  );

  if (!v) {
    return (
      <Panel title="vertex inspector">
        <p className="p-3 text-[12px] text-[#8A8F98]">
          Click a vertex of <InlineMath math="T" /> to see its descent, the fully
          attributed factorization of <InlineMath math="\downarrow" />, and the chain of
          child-steps that produces its reach probability.
        </p>
      </Panel>
    );
  }

  const parent = v.parentKey ? tree.vertices.get(v.parentKey) : null;
  const available = chOfConfig(skeleton, v.cfg);
  const factors = parent
    ? factorization(skeleton, parent.cfg, v.cfg)
    : [];

  return (
    <Panel
      title={
        <span>
          vertex inspector: <InlineMath math="\pi" />
        </span>
      }
      right={
        <Button onClick={() => selectVertex(null)} title="close the inspector">
          close
        </Button>
      }
    >
      <div className="space-y-4 p-3">
        <section>
          <H>
            1 · the descent <InlineMath math="\pi = (\{r\}, S_1, \ldots, S_k)" />
          </H>
          <ol className="space-y-1">
            {chain.map((a, i) => (
              <li key={a.key} className="flex items-center gap-1.5">
                <span className="chip w-6 text-[#8A8F98]">S{subscript(i)}</span>
                <button
                  className={`rounded border px-1.5 py-[3px] font-mono text-[11.5px] ${
                    a.key === v.key
                      ? 'border-[#2B5CE6] bg-[#2B5CE6]/8 text-[#2B5CE6]'
                      : 'border-[#D8D9D4] hover:bg-[#F4F4F1]'
                  }`}
                  onClick={() => selectVertex(a.key)}
                  title="highlight this ancestor vertex"
                >
                  {formatConfig(skeleton, a.cfg)}
                </button>
                {a.cfg.map((id) => (
                  <NodeChip key={id} id={id} onSelect={selectNode} />
                ))}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <H>
            2 · <InlineMath math="cfg(\pi)" /> and <InlineMath math="ch(cfg(\pi))" />
          </H>
          <div className="flex flex-wrap items-center gap-1">
            <span className="chip text-[#8A8F98]">cfg</span>
            {v.cfg.length === 0 ? (
              <span className="font-mono text-[12px]">∅</span>
            ) : (
              v.cfg.map((id) => <NodeChip key={id} id={id} onSelect={selectNode} />)
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="chip text-[#8A8F98]">ch</span>
            {available.length === 0 ? (
              <span className="text-[11.5px] text-[#5C6068]">
                <span className="font-mono">∅</span>: no further level can be generated
                below, so this vertex is a <strong>leaf</strong> recording a completed
                descent.
              </span>
            ) : (
              available.map((id) => <NodeChip key={id} id={id} onSelect={selectNode} />)
            )}
          </div>
        </section>

        <section>
          <H>
            3 · child-step <InlineMath math="\downarrow(\pi', \pi)" />
          </H>
          <FactorizationStrip factors={factors} product={v.stepProb} />
        </section>

        <section>
          <H>
            4 · reach <InlineMath math="reach(\pi) = \mu_{\{r\}}(lv(\pi))" />
          </H>
          <table className="w-full text-[11.5px]">
            <tbody>
              {chain.map((a, i) => (
                <tr key={a.key} className="border-b border-[#D8D9D4] last:border-0">
                  <td className="py-1 font-mono">{formatConfig(skeleton, a.cfg)}</td>
                  <td className="py-1 text-right font-mono tabular-nums text-[#8A8F98]">
                    {i === 0 ? '—' : `× ${formatProb(a.stepProb)}`}
                  </td>
                  <td
                    className="py-1 text-right font-mono tabular-nums"
                    title={formatProbFull(a.reachProb)}
                  >
                    {formatProb(a.reachProb)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10.5px] text-[#8A8F98]">
            {v.isLeaf
              ? 'For a leaf this same number is μ({τ}), the probability of the possible document it determines.'
              : 'The cone measure collapses to a product along the path because everything below the apex sums to 1.'}
          </p>
        </section>

        <section>
          <H>
            5 · cone <InlineMath math="lv(\pi)" />
          </H>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] tabular-nums">
              |lv(π)| = {leafCount === null ? '> 20 000' : leafCount}
            </span>
            <Button
              active={highlightConeKey === v.key}
              onClick={() => setHighlightCone(highlightConeKey === v.key ? null : v.key)}
            >
              {highlightConeKey === v.key ? 'Clear cone highlight' : 'Highlight this cone'}
            </Button>
          </div>
          <p className="mt-1 text-[10.5px] text-[#8A8F98]">
            the completed descents passing through this vertex. Highlighting keeps the
            whole of <span className="font-mono">T</span> on the canvas and dims
            everything outside <span className="font-mono">T_π</span>.
          </p>
        </section>

        {v.isLeaf ? (
          <section>
            <H>
              6 · possible document{' '}
              <InlineMath math="nodes(\tau) = S_0 \cup \ldots \cup S_m" />
            </H>
            <pre className="overflow-x-auto rounded border border-[#D8D9D4] bg-[#F4F4F1] p-2 font-mono text-[11.5px] leading-relaxed">
              {serializePossibleDocument(doc.root, new Set(nodesOf(v)))}
            </pre>
            <p className="mt-1 text-[11.5px]">
              <InlineMath math="\mu(\{\tau\})" /> ={' '}
              <span className="font-mono tabular-nums" title={formatProbFull(v.reachProb)}>
                {formatProb(v.reachProb)}
              </span>
            </p>
          </section>
        ) : null}

        <section className="border-t border-[#D8D9D4] pt-2">
          <SiblingSumStrip vertexKey={v.key} />
        </section>

      </div>
    </Panel>
  );
}

function NodeChip({ id, onSelect }: { id: NodeId; onSelect: (id: NodeId) => void }) {
  const skeleton = useStore((s) => s.skeleton);
  const node = skeleton.byId.get(id);
  if (!node) return null;
  return (
    <button
      onClick={() => onSelect(id)}
      title={
        `PD(${node.label}) = ${formatProbFull(node.prob)}` +
        (node.data !== undefined && node.data !== ''
          ? `\ndata value ${node.data}, display only`
          : '\nno data value')
      }
      className="chip rounded border border-[#D8D9D4] px-1.5 py-[3px] hover:border-[#2B5CE6] hover:text-[#2B5CE6]"
    >
      {labelOf(skeleton, id)}
    </button>
  );
}
