import { useMemo } from 'react';
import { InlineMath } from 'react-katex';
import { useStore } from '../store';
import { ch, existenceProb } from '../core/skeleton';
import { subtreeSize } from '../core/commands';
import { formatProb, formatProbFull } from '../core/format';
import { isMuxInvalid, muxSum } from '../core/validate';
import { isValidLabel } from '../core/parse';
import { Button, Chip, Field, Panel, TextInput } from './ui';
import { ProbControl } from './ProbControl';

export function NodeInspector() {
  const doc = useStore((s) => s.doc);
  const skeleton = useStore((s) => s.skeleton);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const tree = useStore((s) => s.tree);
  const setLabel = useStore((s) => s.setLabel);
  const setData = useStore((s) => s.setData);
  const setDistType = useStore((s) => s.setDistType);
  const normaliseMux = useStore((s) => s.normaliseMux);
  const addChild = useStore((s) => s.addChild);
  const addSibling = useStore((s) => s.addSibling);
  const deleteNode = useStore((s) => s.deleteNode);
  const moveChild = useStore((s) => s.moveChild);
  const selectNode = useStore((s) => s.selectNode);

  const node = selectedNodeId ? skeleton.byId.get(selectedNodeId) : null;

  const occurrences = useMemo(() => {
    if (!selectedNodeId) return 0;
    let n = 0;
    for (const v of tree.vertices.values()) if (v.cfg.includes(selectedNodeId)) n++;
    return n;
  }, [tree.vertices, selectedNodeId]);

  if (!node || !selectedNodeId) {
    return (
      <Panel title="node inspector">
        <p className="p-3 text-[12px] text-[#8A8F98]">
          Select a possible node in the skeleton to edit its label, data value,
          probability and distributional type.
        </p>
      </Panel>
    );
  }

  const isRoot = selectedNodeId === doc.root.id;
  const parentId = skeleton.parent.get(selectedNodeId) ?? null;
  const siblings = parentId ? ch(skeleton, parentId) : [];
  const index = siblings.indexOf(selectedNodeId);
  const childIds = ch(skeleton, selectedNodeId);
  const sum = muxSum(node);
  const muxInvalid = isMuxInvalid(node);

  return (
    <Panel
      title={
        <span>
          node inspector: <span className="font-mono normal-case">{node.label}</span>
        </span>
      }
      right={
        <Chip tone="dropped" title="stable node id, never regenerated">
          {selectedNodeId}
        </Chip>
      }
    >
      <div className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_minmax(220px,1.2fr)] gap-4 p-3">
        <div className="space-y-3">
          <Field
            label="label"
            hint={
              isValidLabel(node.label)
                ? 'duplicates are legal'
                : 'not a valid XML element name'
            }
          >
            <TextInput
              value={node.label}
              onChange={(e) => setLabel(selectedNodeId, e.target.value)}
              className={isValidLabel(node.label) ? '' : 'border-[#B4321F]'}
            />
          </Field>

          <Field
            label="data value"
            hint="display only; never used in any probability"
          >
            <div className="flex gap-1">
              <TextInput
                value={node.data === undefined ? '' : String(node.data)}
                onChange={(e) => setData(selectedNodeId, e.target.value)}
              />
              <Button
                onClick={() => setData(selectedNodeId, undefined)}
                title="clear the data value"
              >
                clear
              </Button>
            </div>
          </Field>
        </div>

        <div className="space-y-3">
          <Field
            label={
              <span>
                <InlineMath math="PD(v)" />, the conditional existence probability
              </span>
            }
            hint={
              isRoot
                ? 'the root exists with probability 1'
                : 'given that the parent exists'
            }
          >
            <ProbControl nodeId={selectedNodeId} value={node.prob} disabled={isRoot} />
          </Field>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-[#5C6068]">
              distributional type, governs this node's children
            </span>
            <div className="flex items-center gap-1">
              {(['ind', 'mux'] as const).map((t) => (
                <Button
                  key={t}
                  active={node.distType === t}
                  disabled={childIds.length === 0}
                  onClick={() => setDistType(selectedNodeId, t)}
                >
                  {t}
                </Button>
              ))}
              <span
                className={`chip ml-1 ${muxInvalid ? 'text-[#B4321F]' : 'text-[#8A8F98]'}`}
                title={
                  node.distType === 'mux'
                    ? 'a mux block requires Σ p ≤ 1'
                    : 'ind siblings are never checked against a sum'
                }
              >
                Σ p = {formatProb(sum)}
              </span>
              {muxInvalid ? (
                <Button onClick={() => normaliseMux(selectedNodeId)}>Normalise mux</Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-[#5C6068]">
              derived read-outs
            </span>
            <dl className="space-y-1 text-[11.5px]">
              <Row
                term={<InlineMath math="\mu(E_v)" />}
                note="unconditional existence"
                value={formatProb(existenceProb(skeleton, selectedNodeId))}
                title={formatProbFull(existenceProb(skeleton, selectedNodeId))}
              />
              <Row
                term={<InlineMath math="d(v)" />}
                note="depth in the skeleton"
                value={String(skeleton.depth.get(selectedNodeId) ?? 0)}
              />
              <Row
                term={<InlineMath math="|ch(v)|" />}
                note="children in the skeleton"
                value={String(childIds.length)}
              />
              <Row
                term={<InlineMath math="|\{\pi \mid v \in cfg(\pi)\}|" />}
                note="materialized vertices containing v"
                value={String(occurrences)}
              />
            </dl>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-[#5C6068]">
              structure
            </span>
            <div className="flex flex-wrap gap-1">
              <Button onClick={() => addChild(selectedNodeId)}>Add child</Button>
              <Button
                disabled={isRoot}
                onClick={() => addSibling(selectedNodeId, 'before')}
              >
                Add sibling before
              </Button>
              <Button
                disabled={isRoot}
                onClick={() => addSibling(selectedNodeId, 'after')}
              >
                Add sibling after
              </Button>
              <Button
                disabled={isRoot}
                onClick={() => {
                  const size = subtreeSize(node);
                  if (size > 1 && !window.confirm(`Delete subtree: ${size} possible nodes?`)) {
                    return;
                  }
                  selectNode(parentId);
                  deleteNode(selectedNodeId);
                }}
              >
                Delete subtree
              </Button>
              <Button
                disabled={isRoot || index <= 0}
                onClick={() => moveChild(selectedNodeId, -1)}
              >
                Move up
              </Button>
              <Button
                disabled={isRoot || index < 0 || index >= siblings.length - 1}
                onClick={() => moveChild(selectedNodeId, 1)}
              >
                Move down
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Row({
  term,
  note,
  value,
  title,
}: {
  term: React.ReactNode;
  note: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[#5C6068]">
        {term} <span className="text-[10.5px] text-[#8A8F98]">{note}</span>
      </dt>
      <dd className="font-mono tabular-nums" title={title}>
        {value}
      </dd>
    </div>
  );
}
