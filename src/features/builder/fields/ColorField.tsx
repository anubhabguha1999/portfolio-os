import { useEffect, useId, useState } from 'react';
import { FieldShell } from '@/components/ui/Field';
import { parseColor, toHex } from '@/utils/color';
import { X } from 'lucide-react';

export function ColorField({ label, help, value, onChange, disabled, allowEmpty, trailing }: { label: string; help?: string; value: string; onChange: (v: string) => void; disabled?: boolean; allowEmpty?: boolean; trailing?: React.ReactNode }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const parsed = parseColor(value);
  const hex = parsed ? toHex(parsed) : '#000000';
  return (
    <FieldShell label={label} help={help} htmlFor={id} trailing={trailing}>
      <div className="flex items-center gap-2">
        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong" style={{ background: parsed ? value : 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 50% / 10px 10px' }}>
          <span className="sr-only">Pick {label}</span>
          <input type="color" value={hex} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <input
          id={id}
          value={draft}
          disabled={disabled}
          spellCheck={false}
          placeholder={allowEmpty ? 'Theme default' : '#000000'}
          onChange={(e) => {
            setDraft(e.target.value);
            if (parseColor(e.target.value) || (allowEmpty && !e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => setDraft(value)}
          className="app-input font-mono !text-[12px] uppercase"
        />
        {allowEmpty && value && (
          <button type="button" aria-label="Clear colour" onClick={() => onChange('')} className="grid size-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg">
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </FieldShell>
  );
}
