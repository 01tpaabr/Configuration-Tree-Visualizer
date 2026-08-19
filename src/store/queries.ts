import { create } from 'zustand';
import { greekName, MAX_ACTIVE_PATHS } from '../core/paths/palette';

export interface PathQuery {
  id: string;
  name: string;
  text: string;
  // which palette colour this expression uses; null when every colour is taken
  colorIndex: number | null;
  enabled: boolean;
}

let counter = 0;
const newId = (): string => `q${++counter}`;

export interface QueryState {
  queries: PathQuery[];
  focusedId: string | null;
  // the start state; null means the root vertex
  startKey: string | null;

  addQuery: (text?: string) => string;
  setQueryText: (id: string, text: string) => void;
  removeQuery: (id: string) => void;
  toggleQuery: (id: string) => void;
  focusQuery: (id: string | null) => void;
  setStartKey: (key: string | null) => void;
}

// The lowest palette slot not already taken by an enabled expression.
function freeColorIndex(queries: PathQuery[], exceptId?: string): number | null {
  const taken = new Set(
    queries
      .filter((q) => q.id !== exceptId && q.enabled && q.colorIndex !== null)
      .map((q) => q.colorIndex as number),
  );
  for (let i = 0; i < MAX_ACTIVE_PATHS; i++) if (!taken.has(i)) return i;
  return null;
}

function makeQuery(queries: PathQuery[], text: string): PathQuery {
  const colorIndex = freeColorIndex(queries);
  return {
    id: newId(),
    name: greekName(queries.length),
    text,
    colorIndex,
    // with no hue left, the expression starts disabled
    enabled: colorIndex !== null,
  };
}

export const useQueryStore = create<QueryState>()((set, get) => ({
  queries: [],
  focusedId: null,
  startKey: null,

  addQuery: (text = '') => {
    const q = makeQuery(get().queries, text);
    set((s) => ({ queries: [...s.queries, q], focusedId: q.id }));
    return q.id;
  },

  setQueryText: (id, text) =>
    set((s) => ({
      queries: s.queries.map((q) => (q.id === id ? { ...q, text } : q)),
    })),

  removeQuery: (id) =>
    set((s) => {
      const queries = s.queries.filter((q) => q.id !== id);
      // hand the freed colour to the first expression waiting on one
      const waiting = queries.find((q) => q.colorIndex === null);
      const rebalanced = waiting
        ? queries.map((q) =>
            q.id === waiting.id ? { ...q, colorIndex: freeColorIndex(queries, q.id) } : q,
          )
        : queries;
      return {
        queries: rebalanced,
        focusedId: s.focusedId === id ? (rebalanced[0]?.id ?? null) : s.focusedId,
      };
    }),

  toggleQuery: (id) =>
    set((s) => ({
      queries: s.queries.map((q) => {
        if (q.id !== id) return q;
        if (q.enabled) return { ...q, enabled: false };
        const colorIndex = q.colorIndex ?? freeColorIndex(s.queries, q.id);
        // no free hue left: leave it off rather than reuse one
        return colorIndex === null ? q : { ...q, enabled: true, colorIndex };
      }),
    })),

  focusQuery: (id) => set({ focusedId: id }),
  setStartKey: (key) => set({ startKey: key }),
}));
