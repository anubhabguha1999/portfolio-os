import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { FieldShell } from '@/components/ui/Field';
import { moveItem } from '@/utils/path';

export function StringListField({ label, help, itemLabel, value, onChange, disabled }: { label: string; help?: string; itemLabel: string; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <FieldShell label={label} help={help}>
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="group flex items-start gap-1">
            <textarea
              aria-label={`${itemLabel} ${i + 1}`}
              rows={1}
              value={item}
              disabled={disabled}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const next = [...value];
                  next.splice(i + 1, 0, '');
                  onChange(next);
                  requestAnimationFrame(() => {
                    const list = (e.target as HTMLElement).closest('ul');
                    list?.querySelectorAll('textarea')[i + 1]?.focus();
                  });
                } else if (e.key === 'Backspace' && !item && value.length > 0) {
                  e.preventDefault();
                  onChange(value.filter((_, j) => j !== i));
                  requestAnimationFrame(() => {
                    const list = (e.target as HTMLElement).closest('ul');
                    list?.querySelectorAll('textarea')[Math.max(0, i - 1)]?.focus();
                  });
                }
              }}
              className="app-input min-h-9 flex-1 resize-none [field-sizing:content]"
            />
            <div className="flex opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <IconButton size="xs" label="Move up" disabled={disabled || i === 0} onClick={() => onChange(moveItem(value, i, i - 1))}>
                <ArrowUp className="size-3" />
              </IconButton>
              <IconButton size="xs" label="Move down" disabled={disabled || i === value.length - 1} onClick={() => onChange(moveItem(value, i, i + 1))}>
                <ArrowDown className="size-3" />
              </IconButton>
              <IconButton size="xs" label={`Remove ${itemLabel.toLowerCase()}`} disabled={disabled} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="size-3" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, ''])}
        className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Add {itemLabel.toLowerCase()}
      </button>
    </FieldShell>
  );
}
