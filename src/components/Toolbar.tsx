import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '../store';
import { EXAMPLES } from '../core/fixtures';
import { Button, Chip, Divider } from './ui';

export function Toolbar() {
  const issues = useStore((s) => s.issues);
  const xmlErrors = useStore((s) => s.xmlErrors);
  const undoStack = useStore((s) => s.undoStack);
  const redoStack = useStore((s) => s.redoStack);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const loadXml = useStore((s) => s.loadXml);
  const [openMenu, setOpenMenu] = useState<'examples' | 'issues' | null>(null);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.cm-editor')) return; // CodeMirror keeps its own history
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const errorCount = issues.length + xmlErrors.length;

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[#D8D9D4] bg-[#F4F4F1] px-3">
      <span className="mr-1 text-[12.5px] font-semibold tracking-tight">
        p-document &amp; configuration tree
      </span>

      <nav className="flex items-center gap-1">
        {(
          [
            ['/setup', 'Setup'],
            ['/configuration-tree', 'Configuration tree'],
            ['/query', 'Queries'],
          ] as const
        ).map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'px-2.5 h-7 inline-flex items-center rounded text-[12px] border transition-colors ' +
              (isActive
                ? 'border-[#2B5CE6] bg-[#2B5CE6]/8 text-[#2B5CE6]'
                : 'border-transparent text-[#5C6068] hover:bg-[#FCFCFA]')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Divider />

      <div className="relative">
        <Button onClick={() => setOpenMenu(openMenu === 'examples' ? null : 'examples')}>
          examples ▾
        </Button>
        {openMenu === 'examples' ? (
          <div className="absolute top-8 left-0 z-30 w-72 rounded border border-[#D8D9D4] bg-[#FCFCFA] p-1 shadow-lg">
            {EXAMPLES.map((ex) => (
              <MenuItem
                key={ex.id}
                label={ex.name}
                hint={ex.note}
                onClick={() => {
                  loadXml(ex.xml, `example ${ex.id}`);
                  setOpenMenu(null);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Divider />

      <Button onClick={undo} disabled={undoStack.length === 0} title="Cmd/Ctrl+Z">
        Undo
      </Button>
      <Button onClick={redo} disabled={redoStack.length === 0} title="Cmd/Ctrl+Shift+Z">
        Redo
      </Button>

      <div className="relative ml-auto">
        <button
          onClick={() => setOpenMenu(openMenu === 'issues' ? null : 'issues')}
          title="validation; click for the list"
        >
          <Chip tone={errorCount === 0 ? 'kept' : 'error'}>
            {errorCount === 0
              ? 'valid'
              : `${errorCount} issue${errorCount === 1 ? '' : 's'}`}
          </Chip>
        </button>
        {openMenu === 'issues' ? (
          <div className="absolute top-8 right-0 z-30 w-96 rounded border border-[#D8D9D4] bg-[#FCFCFA] p-2 shadow-lg">
            {errorCount === 0 ? (
              <p className="px-1 py-1 text-[11.5px] text-[#5C6068]">
                No issues. Remember that <code>ind</code> sibling probabilities may
                legally sum above 1; that is never an error.
              </p>
            ) : (
              <ul className="space-y-1">
                {xmlErrors.map((e, i) => (
                  <li key={`x${i}`} className="rounded px-1 py-1 text-[11.5px] text-[#B4321F]">
                    XML: {e.message}
                  </li>
                ))}
                {issues.map((iss, i) => (
                  <li key={`i${i}`}>
                    <button
                      className="block w-full rounded px-1 py-1 text-left text-[11.5px] text-[#B4321F] hover:bg-[#F4F4F1]"
                      onClick={() => {
                        if (iss.nodeId) useStore.getState().selectNode(iss.nodeId);
                        setOpenMenu(null);
                      }}
                    >
                      {iss.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {openMenu ? (
        <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
      ) : null}
    </header>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      className="block w-full rounded px-2 py-1.5 text-left hover:bg-[#F4F4F1]"
      onClick={onClick}
    >
      <span className="block text-[12px]">{label}</span>
      <span className="block text-[10.5px] text-[#8A8F98]">{hint}</span>
    </button>
  );
}
