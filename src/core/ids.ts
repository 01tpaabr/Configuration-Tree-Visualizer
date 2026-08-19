import type { NodeId } from './types';

// A node gets its id once, when it is created, and keeps it: open vertices,
// selection and undo all refer to nodes by id.
let counter = 0;

export function newId(): NodeId {
  counter += 1;
  return `n${counter}`;
}

// Raise the counter above every id already in use, so new ids never clash
// with ids arriving from the XML pane.
export function reserveIds(ids: Iterable<NodeId>): void {
  for (const id of ids) {
    const m = /^n(\d+)$/.exec(id);
    if (m) counter = Math.max(counter, Number(m[1]));
  }
}
