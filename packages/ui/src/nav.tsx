'use client';

import { usePathname } from 'next/navigation';
import { cn } from './cn';

export function NavLinks({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname() || '/';
  return (
    <nav className="flex items-center gap-0.5">
      {items.map((it) => {
        const active = path === it.href;
        return (
          <a
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', active ? 'bg-subtle text-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink')}
          >
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}
