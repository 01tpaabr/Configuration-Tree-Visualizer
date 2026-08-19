import { Outlet } from 'react-router-dom';
import { Toolbar } from './components/Toolbar';
import { useStore } from './store';

// A live region announcing edits to screen readers.
function LiveRegion() {
  const lastRecompute = useStore((s) => s.lastRecompute);
  const vertices = useStore((s) => s.tree.vertices.size);
  return (
    <div aria-live="polite" className="sr-only absolute h-px w-px overflow-hidden">
      {lastRecompute
        ? `${lastRecompute.command}: ${lastRecompute.policy}, ${vertices} materialized vertices`
        : ''}
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar />
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
      <LiveRegion />
    </div>
  );
}
