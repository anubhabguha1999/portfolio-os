import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Group({ title, children, defaultOpen = true, action }: { title: string; children: ReactNode; defaultOpen?: boolean; action?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-center justify-between py-3 text-left">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{title}</span>
          <ChevronDown className={cn('size-3.5 text-fg-subtle transition-transform', !open && '-rotate-90')} />
        </button>
        {action}
      </div>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </section>
  );
}
