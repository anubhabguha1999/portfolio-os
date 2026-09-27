import { useState } from 'react';
import { X } from 'lucide-react';

export function TagsInput({ value, onChange, disabled, id, placeholder = 'Add…' }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; id?: string; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const commit = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  return (
    <div className="app-input flex min-h-9 flex-wrap items-center gap-1.5 !py-1.5 focus-within:!border-accent focus-within:shadow-[0_0_0_3px_var(--app-accent-soft)]">
      {value.map((tag, i) => (
        <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-line bg-elevated py-0.5 pl-2 pr-1 text-[12px]">
          {tag}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${tag}`}
            className="rounded p-0.5 text-fg-subtle hover:bg-hover hover:text-fg"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && commit(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            commit(text);
          }
        }}
        className="min-w-[80px] flex-1 bg-transparent py-0.5 text-[13px] outline-none placeholder:text-fg-subtle"
      />
    </div>
  );
}
