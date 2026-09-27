import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { SECTION_CATEGORIES, SECTION_REGISTRY, SECTION_TYPES } from '@/sections/registry';
import { useEditor } from '@/stores/editor';
import { useShallow } from 'zustand/react/shallow';

const EMPTY: SectionType[] = [];
import { SectionIcon } from './SectionIcon';
import type { SectionType } from '@/types/portfolio';
import { cn } from '@/utils/cn';

export function AddSectionDialog({ open, onClose, index }: { open: boolean; onClose: () => void; index?: number }) {
  const add = useEditor((s) => s.addSection);
  const existing = useEditor(useShallow((s) => s.portfolio?.sections.map((x) => x.type) ?? EMPTY));
  const [q, setQ] = useState('');
  const list = useMemo(
    () => SECTION_TYPES.filter((t) => {
      const d = SECTION_REGISTRY[t];
      return !q || `${d.label} ${d.description}`.toLowerCase().includes(q.toLowerCase());
    }),
    [q],
  );
  const pick = (t: SectionType) => {
    add(t, index);
    setQ('');
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a section" description="Every section works in the live site, PDF and Word exports." size="lg">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sections…"
          className="app-input !pl-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && list[0]) pick(list[0]);
          }}
        />
      </div>
      {SECTION_CATEGORIES.map((cat) => {
        const items = list.filter((t) => SECTION_REGISTRY[t].category === cat.id);
        if (!items.length) return null;
        return (
          <div key={cat.id} className="mb-5 last:mb-0">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{cat.label}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((t) => {
                const d = SECTION_REGISTRY[t];
                const taken = d.singleton && existing.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pick(t)}
                    className={cn('group flex items-start gap-3 rounded-xl border border-line bg-bg/50 p-3 text-left transition-all hover:-translate-y-px hover:border-accent/50 hover:bg-accent-soft/40 focus-visible:border-accent', taken && 'opacity-60')}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-fg-muted transition-colors group-hover:text-accent">
                      <SectionIcon name={d.icon} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">
                        {d.label} {taken && <span className="text-[11px] font-normal text-fg-subtle">· already added</span>}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{d.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Dialog>
  );
}
