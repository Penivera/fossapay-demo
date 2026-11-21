import type { ReactNode } from 'react';
import { cn } from './cn';
import { ModeProvider, type AppMode } from './mode';
import { NavLinks } from './nav';

export interface AppShellProps {
  /** Product name, e.g. "SafeDeal" */
  name: string;
  /** One or two letters shown in the logo mark */
  mark: string;
  homeHref?: string;
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

export function FossaPayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 40" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M34.6725 7.6099L32.0762 18.2279C31.6788 19.8529 30.0407 21.1694 28.4157 21.1694H23.2256L24.2728 16.8814C24.6924 15.161 23.6374 13.7648 21.917 13.7648H11.0793C9.35761 13.7648 7.62149 15.161 7.20184 16.8814L6.87109 18.2279L9.46873 7.6099C9.86354 5.98491 11.5042 4.67105 13.1266 4.67105H32.4514C34.0738 4.67105 35.0699 5.98491 34.6725 7.6099Z" fill="#1A4BDB"/>
      <path d="M24.2746 16.8814L23.2274 21.1694H9.09269C7.4873 21.1694 6.49766 19.8817 6.85979 18.2815L6.87286 18.2279L7.20361 16.8814C7.62326 15.161 9.35938 13.7647 11.0811 13.7647H21.9188C23.6392 13.7647 24.6942 15.161 24.2746 16.8814Z" fill="#366CF2"/>
      <path d="M23.2274 21.1694L22.4325 24.4168C22.0103 26.1385 20.2742 27.5334 18.5524 27.5334H7.71346C5.99303 27.5334 4.93802 26.1372 5.35767 24.4168L6.85978 18.2815C6.49634 19.8817 7.48729 21.1694 9.09268 21.1694H23.2274Z" fill="#4E7FF9"/>
      <path d="M13.7367 32.3509C13.5354 33.1732 13.0203 33.9184 12.3484 34.457C11.6777 34.9969 10.8515 35.3303 10.0292 35.3303H5.6706C4.02468 35.3303 3.01805 33.9968 3.4207 32.3509C3.62203 31.5286 4.13711 30.7834 4.80907 30.2448C5.47973 29.7049 6.30595 29.3715 7.12825 29.3715H11.4869C13.1328 29.3715 14.1394 30.705 13.7367 32.3509Z" fill="#7EA8FC"/>
    </svg>
  );
}

/**
 * Page chrome shared by every demo: sticky translucent header, a main region that fills the viewport
 * (so content can centre itself instead of hugging the top), and a quiet footer.
 */
export function AppShell({ name, mark, homeHref, nav = [], mode, actions, children }: AppShellProps) {
  const brandHref = homeHref || (nav[0]?.href ?? '/');
  return (
    <ModeProvider mode={mode}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 lg:px-8">
            <a href={brandHref} className="group flex items-center gap-2.5">
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
          <div className="flex items-center justify-center gap-1.5">
            <FossaPayIcon className="h-3.5 w-3.5 shrink-0 inline-block" />
            <span>Built on <a href="https://docs.fossapay.com" target="_blank" rel="noreferrer" className="font-medium text-ink-2 underline-offset-2 hover:underline">FossaPay</a></span>
            <span className="mx-1">·</span>
            <span>{mode === 'live' ? 'Live mode' : 'Sandbox data, no real money moves'}</span>
          </div>
        </footer>
      </div>
    </ModeProvider>
  );
}
