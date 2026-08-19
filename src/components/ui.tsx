import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Button({
  active,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={
        'inline-flex h-7 items-center gap-1 rounded border px-2 text-[12px] transition-colors ' +
        'disabled:cursor-not-allowed disabled:opacity-40 ' +
        (active
          ? 'border-[#2B5CE6] bg-[#2B5CE6]/8 text-[#2B5CE6] '
          : 'border-[#D8D9D4] bg-[#FCFCFA] text-[#16181D] hover:bg-[#F4F4F1] ') +
        className
      }
    />
  );
}

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col ${className}`}>
      {title !== undefined ? (
        <header className="flex h-8 shrink-0 items-center justify-between border-b border-[#D8D9D4] bg-[#F4F4F1] px-3">
          <h2 className="text-[11px] font-semibold tracking-wide text-[#5C6068] uppercase">
            {title}
          </h2>
          {right}
        </header>
      ) : null}
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[#5C6068]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] text-[#8A8F98]">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={
        'h-7 w-full rounded border border-[#D8D9D4] bg-[#FCFCFA] px-2 text-[12px] ' +
        'focus:border-[#2B5CE6] focus:outline-none ' +
        className
      }
    />
  );
}

export function Chip({
  children,
  tone = 'plain',
  title,
  className = '',
}: {
  children: ReactNode;
  tone?: 'plain' | 'kept' | 'dropped' | 'selection' | 'error';
  title?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    plain: 'border-[#D8D9D4] text-[#16181D] bg-[#FCFCFA]',
    kept: 'border-[#0F8A5F] text-[#0F8A5F] bg-[#0F8A5F]/6',
    dropped: 'border-[#8A8F98] text-[#8A8F98] bg-[#8A8F98]/6',
    selection: 'border-[#2B5CE6] text-[#2B5CE6] bg-[#2B5CE6]/8',
    error: 'border-[#B4321F] text-[#B4321F] bg-[#B4321F]/6',
  };
  return (
    <span
      title={title}
      className={`chip inline-flex items-center rounded border px-1.5 py-[3px] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Divider() {
  return <div className="h-4 w-px bg-[#D8D9D4]" />;
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-[#5C6068] uppercase">
      {children}
    </h3>
  );
}

// A short explanation centred in an otherwise empty canvas pane.
export function CentredNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center text-[12px] leading-relaxed text-[#5C6068]">
        {children}
      </p>
    </div>
  );
}

export function SetupLink() {
  return (
    <Link to="/setup" className="text-[#2B5CE6] hover:underline">
      Setup page
    </Link>
  );
}
