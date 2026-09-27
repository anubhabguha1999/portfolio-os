import { useMemo, useState } from 'react';
import { ICON_NAMES, iconSvg } from '@/sections/icons';
import { FieldShell } from '@/components/ui/Field';
import { cn } from '@/utils/cn';
import { safeMediaSrc } from '@/utils/url';

/** Picker for the built-in (exported) icon set; also accepts an image URL. */
export function IconField({ label, help, value, onChange, disabled }: { label: string; help?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => ICON_NAMES.filter((n) => n.includes(q.toLowerCase())), [q]);
  const isUrl = Boolean(safeMediaSrc(value));
  return (
    <FieldShell label={label} help={help}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-9 flex-1 items-center gap-2 rounded-[9px] border border-line bg-bg px-2.5 text-left text-[13px] hover:border-line-strong"
        >
          {value && !isUrl && <span className="size-4 text-accent [&_svg]:size-4" dangerouslySetInnerHTML={{ __html: iconSvg(value) }} />}
          <span className={cn('truncate', !value && 'text-fg-subtle')}>{value || 'Choose icon'}</span>
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-elevated p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons or paste an image URL" className="app-input mb-2" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (safeMediaSrc(t)) { e.preventDefault(); onChange(t); setOpen(false); }
          }} />
          <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto" role="listbox" aria-label="Icons">
            {list.map((n) => (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={value === n}
                title={n}
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                }}
                className={cn('grid aspect-square place-items-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg [&_svg]:size-4', value === n && 'bg-accent-soft text-accent')}
                dangerouslySetInnerHTML={{ __html: iconSvg(n) }}
              />
            ))}
          </div>
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mt-2 text-[12px] text-fg-subtle hover:text-fg">
              Remove icon
            </button>
          )}
        </div>
      )}
    </FieldShell>
  );
}
