import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { modKey } from '@/utils/download';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('app-kbd', className)}>{children}</kbd>;
}

/** Renders a shortcut like "mod+shift+z" as key caps. */
export function Shortcut({ keys, className }: { keys: string; className?: string }) {
  const parts = keys.split('+').map((k) => {
    const key = k.trim().toLowerCase();
    if (key === 'mod') return modKey;
    if (key === 'shift') return '⇧';
    if (key === 'alt') return modKey === '⌘' ? '⌥' : 'Alt';
    if (key === 'enter') return '↵';
    if (key === 'esc') return 'Esc';
    return key.length === 1 ? key.toUpperCase() : key;
  });
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={keys.replace('mod', modKey)}>
      {parts.map((p, i) => (
        <Kbd key={i}>{p}</Kbd>
      ))}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-hover text-fg-muted border-line',
    accent: 'bg-accent-soft text-accent border-accent/25',
    ok: 'bg-ok/10 text-ok border-ok/25',
    warn: 'bg-warn/10 text-warn border-warn/25',
    danger: 'bg-danger/10 text-danger border-danger/25',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>;
}

export function SectionLabel({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{children}</h3>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-elevated text-fg-muted shadow-float">{icon}</div>
      <p className="text-[14px] font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cn('rounded-[var(--radius-panel)] border border-line bg-panel', className)}>{children}</As>;
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-hover', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${v}%` }} />
    </div>
  );
}
