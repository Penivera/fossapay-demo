import type { ReactNode } from 'react';
import { cn } from './cn';
import { ModeProvider, type AppMode } from './mode';
import { NavLinks } from './nav';

export interface AppShellProps {
  /** Product name, e.g. "SafeDeal" */
  name: string;
  /** One or two letters shown in the logo mark */
  mark: string;
  nav?: Array<{ href: string; label: string }>;
  mode: AppMode;
  /** Right-aligned header slot (e.g. wallet button) */
  actions?: ReactNode;
  children: ReactNode;
}

export function ModeBadge({ mode }: { mode: AppMode }) {
  const live = mode === 'live';
  return (
    <span
      title={live ? 'Connected to FossaPay production. Real money moves.' : 'Sandbox: simulated FossaPay ledger, no real money.'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        live ? 'bg-success-soft text-success-ink ring-success/25' : 'bg-brand-soft text-brand-ink ring-brand-accent/30'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-success' : 'bg-brand-accent')} />
      {live ? 'Live' : 'Sandbox'}
    </span>
  );
}

/**
 * Page chrome shared by every demo: sticky translucent header, a main region that fills the viewport
 * (so content can centre itself instead of hugging the top), and a quiet footer.
 */
export function AppShell({ name, mark, nav = [], mode, actions, children }: AppShellProps) {
  return (
    <ModeProvider mode={mode}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 lg:px-8">
            <a href="/" className="group flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-[13px] font-semibold tracking-tight text-white transition group-hover:bg-brand">{mark}</span>
              <span className="text-[17px] font-semibold tracking-tight text-ink">{name}</span>
            </a>
            <div className="flex items-center gap-1 sm:gap-2">
              <NavLinks items={nav} />
              <ModeBadge mode={mode} />
              {actions}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="py-6 text-center text-xs text-muted">
          Built on <a href="https://docs.fossapay.com" target="_blank" rel="noreferrer" className="font-medium text-ink-2 underline-offset-2 hover:underline">FossaPay</a>
          <span className="mx-2">·</span>
          {mode === 'live' ? 'Live mode' : 'Sandbox data, no real money moves'}
        </footer>
      </div>
    </ModeProvider>
  );
}
