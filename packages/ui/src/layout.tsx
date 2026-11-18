import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Two-column desktop layout that fills the viewport and centres vertically: narrative on the left,
 * the primary card on the right. Collapses to one column on small screens.
 */
export function Stage({ intro, children, wide = false, className }: { intro: ReactNode; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <section
      className={cn(
        'mx-auto grid w-full max-w-[1200px] flex-1 content-center items-center gap-10 px-5 py-10 lg:gap-16 lg:px-8 xl:gap-24',
        wide ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]',
        className
      )}
    >
      <div className="animate-fade-up">{intro}</div>
      <div className="animate-fade-up [animation-delay:90ms]">{children}</div>
    </section>
  );
}

export function Intro({ eyebrow, title, lead, children }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-xl">
      {eyebrow && <div className="mb-4">{eyebrow}</div>}
      <h1 className="text-display text-ink">{title}</h1>
      {lead && <p className="mt-4 text-lead text-ink-2">{lead}</p>}
      {children && <div className="mt-7">{children}</div>}
    </div>
  );
}

/** Short checklist used under an Intro. */
export function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] text-ink-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Content page container (dashboards, detail views). */
export function Page({ children, narrow = false, className }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return (
    <div className={cn('mx-auto w-full animate-fade-up px-5 py-8 sm:py-10 lg:px-8', narrow ? 'max-w-3xl' : 'max-w-[1200px]', className)}>{children}</div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-title text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
