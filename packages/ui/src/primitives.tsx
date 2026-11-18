import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

/* ───────────── Button ───────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-subtle',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  soft: 'bg-brand-soft text-brand-ink hover:bg-brand-accent/20',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-xl gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.985]',
        'disabled:opacity-50 disabled:active:scale-100',
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Same look as Button, for links. */
export function ButtonLink({ variant = 'primary', size = 'md', block, className, children, ...rest }: Omit<ButtonProps, 'type' | 'loading' | 'disabled'> & { href: string } & Omit<HTMLAttributes<HTMLAnchorElement>, 'color'>) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.985]',
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── Form controls ───────────── */

const controlBase =
  'w-full rounded-xl border border-line-strong bg-surface text-[15px] text-ink placeholder:text-muted/70 transition ' +
  'hover:border-muted/60 focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 ' +
  'disabled:bg-subtle disabled:text-muted';

export function Field({ label, hint, error, htmlFor, className, children, right }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; htmlFor?: string; className?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || right) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
              {label}
            </label>
          )}
          {right && <span className="text-xs text-muted">{right}</span>}
        </div>
      )}
      {children}
      {error ? <p className="text-xs font-medium text-danger-ink">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
}

export function Input({ leading, trailing, invalid, className, ...rest }: InputProps) {
  const input = (
    <input
      className={cn(controlBase, 'h-11 px-3.5', leading && 'pl-10', trailing && 'pr-10', invalid && 'border-danger focus:border-danger focus:ring-danger/15', className)}
      {...rest}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{leading}</span>}
      {input}
      {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-muted">{trailing}</span>}
    </div>
  );
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2369635e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1rem] bg-[right_0.875rem_center] bg-no-repeat";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlBase, chevron, 'h-11 appearance-none px-3.5 pr-10', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, 'min-h-24 resize-y px-3.5 py-2.5', className)} {...rest} />;
}

/* ───────────── Surfaces ───────────── */

export function Card({ className, padded = true, children, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface shadow-card', padded && 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}

/* ───────────── Status ───────────── */

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2 ring-line-strong',
  brand: 'bg-brand-soft text-brand-ink ring-brand-accent/30',
  success: 'bg-success-soft text-success-ink ring-success/20',
  warning: 'bg-warning-soft text-warning-ink ring-warning/25',
  danger: 'bg-danger-soft text-danger-ink ring-danger/20',
  info: 'bg-info-soft text-info-ink ring-info/20',
};
const dotTones: Record<Tone, string> = {
  neutral: 'bg-muted',
  brand: 'bg-brand-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', badgeTones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])} />}
      {children}
    </span>
  );
}

const noticeTones: Record<Tone, string> = {
  neutral: 'bg-subtle border-line text-ink-2',
  brand: 'bg-brand-soft border-brand-accent/30 text-brand-ink',
  success: 'bg-success-soft border-success/20 text-success-ink',
  warning: 'bg-warning-soft border-warning/25 text-warning-ink',
  danger: 'bg-danger-soft border-danger/20 text-danger-ink',
  info: 'bg-info-soft border-info/20 text-info-ink',
};

export function Notice({ tone = 'neutral', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', noticeTones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Label/value rows separated by hairlines. */
export function Rows({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line text-sm', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-muted">{it.label}</dt>
          <dd className="tabular text-right font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────── Segmented control ───────────── */

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-grid auto-cols-fr grid-flow-col rounded-xl bg-subtle p-1 ring-1 ring-inset ring-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
            value === o.value ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Progress steps ───────────── */

export interface StepItem {
  title: ReactNode;
  detail?: ReactNode;
  status: 'done' | 'active' | 'pending' | 'error';
}

export function Steps({ steps, className }: { steps: StepItem[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-5', className)}>
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-3.5">
          {i < steps.length - 1 && (
            <span className={cn('absolute left-[11px] top-7 h-[calc(100%-0.25rem)] w-px', s.status === 'done' ? 'bg-success/40' : 'bg-line-strong')} aria-hidden />
          )}
          <span
            className={cn(
              'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset transition-colors',
              s.status === 'done' && 'bg-success text-white ring-success',
              s.status === 'active' && 'bg-surface text-brand ring-brand-accent',
              s.status === 'pending' && 'bg-surface text-muted ring-line-strong',
              s.status === 'error' && 'bg-danger text-white ring-danger'
            )}
          >
            {s.status === 'done' ? '✓' : s.status === 'error' ? '!' : s.status === 'active' ? <Spinner className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <div className="min-w-0 pb-0.5">
            <p className={cn('text-[15px] font-medium', s.status === 'pending' ? 'text-muted' : 'text-ink')}>{s.title}</p>
            {s.detail && <p className={cn('mt-0.5 text-sm', s.status === 'error' ? 'text-danger-ink' : 'text-ink-2')}>{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
