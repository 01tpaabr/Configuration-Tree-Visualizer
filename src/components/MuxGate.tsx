import { Chip, SetupLink } from './ui';

// The configuration tree is computed only for pure-ind documents. The editor
// accepts and validates mux, but the child-step probability is the ind
// product and nothing else, so a document containing mux blocks this page.
export function MuxGate() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#D8D9D4] bg-[#B4321F]/5 px-3 py-2">
      <Chip tone="error">mux</Chip>
      <p className="flex-1 text-[11.5px] leading-relaxed">
        <strong>
          <code>mux</code> nodes fall outside the child-step definition used here.
        </strong>{' '}
        <span className="text-[#5C6068]">
          The child-step probability is the <code>ind</code> product only; it is not valid
          for <code>mux</code>, because <code>mux</code> correlates siblings while the
          child-step formula assumes they are independent. Change the <code>mux</code>{' '}
          blocks back to <code>ind</code> on the <SetupLink /> to unfold a configuration
          tree.
        </span>
      </p>
    </div>
  );
}
