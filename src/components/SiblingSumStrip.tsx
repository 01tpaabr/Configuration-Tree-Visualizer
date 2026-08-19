import { useMemo } from 'react';
import { InlineMath } from 'react-katex';
import { useStore } from '../store';
import { childrenOf } from '../core/cfgtree';
import { formatConfig, formatDescent, formatProb, formatProbFull } from '../core/format';
import { TOLERANCE } from '../core/types';

// Every sibling of the selected vertex with its step probability and the
// running sum, which must be 1. Red when it is not, within tolerance.
export function SiblingSumStrip({ vertexKey }: { vertexKey: string }) {
  const skeleton = useStore((s) => s.skeleton);
  const tree = useStore((s) => s.tree);
  const selectVertex = useStore((s) => s.selectVertex);

  const data = useMemo(() => {
    const v = tree.vertices.get(vertexKey);
    if (!v) return null;
    const parent = v.parentKey ? tree.vertices.get(v.parentKey) : null;
    if (!parent) return null;
    const siblings = childrenOf(skeleton, parent);
    return { parent, siblings };
  }, [vertexKey, tree.vertices, skeleton]);

  if (!data) {
    return (
      <p className="px-3 py-2 text-[11.5px] text-[#8A8F98]">
        The root vertex has no siblings: <InlineMath math="\downarrow = 1" /> and{' '}
        <InlineMath math="reach = 1" />.
      </p>
    );
  }

  const sum = data.siblings.reduce((a, s) => a + s.stepProb, 0);
  const ok = Math.abs(sum - 1) <= TOLERANCE;
  let running = 0;

  return (
    <div className="px-3 py-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] text-[#5C6068]">
          siblings under{' '}
          <span className="font-mono">{formatDescent(skeleton, data.parent)}</span>
        </span>
        <span
          className={`chip rounded border px-1.5 py-[3px] ${
            ok ? 'border-[#0F8A5F] text-[#0F8A5F]' : 'border-[#B4321F] text-[#B4321F]'
          }`}
          title={`Σ ↓ = ${formatProbFull(sum)}; must be exactly 1`}
        >
          Σ ↓ = {formatProb(sum)}
        </span>
      </div>
      <div className="max-h-40 overflow-auto rounded border border-[#D8D9D4]">
        <table className="w-full text-[11.5px]">
          <tbody>
            {data.siblings.map((s) => {
              running += s.stepProb;
              const current = s.key === vertexKey;
              return (
                <tr
                  key={s.key}
                  className={`cursor-pointer border-b border-[#D8D9D4] last:border-0 ${
                    current ? 'bg-[#2B5CE6]/8' : 'hover:bg-[#F4F4F1]'
                  }`}
                  onClick={() => selectVertex(s.key)}
                >
                  <td className="px-2 py-1 font-mono">{formatConfig(skeleton, s.cfg)}</td>
                  <td
                    className="px-2 py-1 text-right font-mono tabular-nums"
                    title={formatProbFull(s.stepProb)}
                  >
                    {formatProb(s.stepProb)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-[#8A8F98]">
                    {formatProb(running)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
