import { useEffect } from 'react';
import { useStore } from '../store';
import { useQueryStore } from '../store/queries';
import { Split } from '../components/Split';
import { Button, CentredNotice, Panel, SetupLink } from '../components/ui';
import { MuxGate } from '../components/MuxGate';
import { QueryTree } from '../components/paths/QueryTree';
import { QueryList } from '../components/paths/QueryList';
import { PathInspector } from '../components/paths/PathInspector';
import { useEvaluations } from '../components/paths/useEvaluations';

// Path expressions over the configuration tree. The tree is read-only here:
// clicking a vertex moves the start state, and nothing on this page edits the
// document.
export function QueryPage() {
  const skeleton = useStore((s) => s.skeleton);
  const issues = useStore((s) => s.issues);
  const muxPresent = useStore((s) => s.muxPresent);
  const orientation = useStore((s) => s.orientation);
  const setOrientation = useStore((s) => s.setOrientation);
  const addQuery = useQueryStore((s) => s.addQuery);
  const focusedId = useQueryStore((s) => s.focusedId);
  const focusQuery = useQueryStore((s) => s.focusQuery);

  const { results, startKey, ctx } = useEvaluations();
  const focusedResult = results.find((r) => r.query.id === focusedId) ?? null;
  // the inspector always has something to show; the canvas only solos on an
  // explicit focus
  const focused = focusedResult ?? results[0] ?? null;
  const activeCount = results.filter(
    (r) => r.query.enabled && (r.evaluation || r.satisfying),
  ).length;

  // Start with one expression so the page is never an empty form. React can
  // run this twice when the page opens; reading the live store avoids adding
  // the expression twice.
  useEffect(() => {
    if (useQueryStore.getState().queries.length === 0) addQuery('↓[B]');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = muxPresent;
  const empty = skeleton.byId.size <= 1 && issues.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {muxPresent ? <MuxGate /> : null}
      <div className="min-h-0 flex-1">
        <Split
          direction="horizontal"
          initial={58}
          min={30}
          max={75}
          a={
            <Panel
              title="configuration tree T (read only)"
              right={
                <span className="flex items-center gap-1">
                  {activeCount > 1 ? (
                    <Button
                      active={!!focusedResult}
                      onClick={() =>
                        focusQuery(focusedResult ? null : (results[0]?.query.id ?? null))
                      }
                      title={
                        focusedResult
                          ? 'showing one expression in full detail; click to show every expression at once'
                          : 'showing every expression in its own hue; click to focus one'
                      }
                    >
                      {focusedResult
                        ? 'focused ' + focusedResult.query.name + ', show all'
                        : 'show all'}
                    </Button>
                  ) : null}
                  <Button
                    active={orientation === 'lr'}
                    onClick={() => setOrientation('lr')}
                    title="left to right"
                  >
                    →
                  </Button>
                  <Button
                    active={orientation === 'td'}
                    onClick={() => setOrientation('td')}
                    title="top down"
                  >
                    ↓
                  </Button>
                </span>
              }
              className="h-full border-r border-[#D8D9D4]"
              bodyClassName="overflow-hidden relative"
            >
              {blocked ? (
                <Blocked />
              ) : empty ? (
                <Empty />
              ) : (
                <QueryTree results={results} startKey={startKey} />
              )}
            </Panel>
          }
          b={
            <Split
              direction="vertical"
              initial={46}
              min={20}
              max={80}
              a={
                <Panel
                  title="path expressions"
                  className="h-full border-b border-[#D8D9D4]"
                >
                  <QueryList results={results} />
                </Panel>
              }
              b={<PathInspector result={focused} startKey={startKey} ctx={ctx} />}
            />
          }
        />
      </div>
    </div>
  );
}

function Blocked() {
  return (
    <CentredNotice>
      Path expressions navigate the configuration tree, which is computed only for pure-
      <code>ind</code> documents. Change the <code>mux</code> blocks back to{' '}
      <code>ind</code> on the <SetupLink />.
    </CentredNotice>
  );
}

function Empty() {
  return (
    <CentredNotice>
      The document is just the root, so there is nothing to navigate. Add possible nodes
      on the <SetupLink />.
    </CentredNotice>
  );
}
