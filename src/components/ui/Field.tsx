import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';

export function FieldShell({ label, help, error, htmlFor, children, className, trailing }: { label?: ReactNode; help?: ReactNode; error?: ReactNode; htmlFor?: string; children: ReactNode; className?: string; trailing?: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="app-label">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-danger" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-fg-subtle">{help}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; help?: ReactNode; error?: ReactNode }>(function TextInput(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} help={help} error={error} htmlFor={fid} className={className}>
      <input ref={ref} id={fid} className="app-input" aria-invalid={error ? true : undefined} {...rest} />
    </FieldShell>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; help?: ReactNode; error?: ReactNode; mono?: boolean }>(function TextArea(
  { label, help, error, className, id, mono, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} help={help} error={error} htmlFor={fid} className={className}>
      <textarea ref={ref} id={fid} className={cn('app-input resize-y', mono && 'font-mono text-[12px] leading-relaxed')} aria-invalid={error ? true : undefined} {...rest} />
    </FieldShell>
  );
});

export function Select({ label, help, className, id, options, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; help?: ReactNode; options: Array<{ value: string; label: string }> }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} help={help} htmlFor={fid} className={className}>
      <div className="relative">
        <select id={fid} className="app-input appearance-none pr-8" {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}

export function Switch({ checked, onChange, label, help, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; help?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={fid} className="block cursor-pointer text-[13px] text-fg">
          {label}
        </label>
        {help && <p className="mt-0.5 text-[11.5px] leading-snug text-fg-subtle">{help}</p>}
      </div>
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40', checked ? 'border-accent bg-accent' : 'border-line-strong bg-hover')}
      >
        <span className={cn('inline-block size-3.5 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-[2px]')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'sm', className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode; title?: string }>; label?: ReactNode; size?: 'xs' | 'sm'; className?: string }) {
  const auto = useId();
  return (
    <FieldShell label={label} htmlFor={auto} className={className}>
      <div role="radiogroup" id={auto} className="flex w-full rounded-[10px] border border-line bg-bg p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(i + 1) % options.length]!.value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length]!.value);
              }
            }}
            tabIndex={value === o.value ? 0 : -1}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-lg font-medium transition-all duration-150',
              size === 'xs' ? 'h-6 px-1.5 text-[11.5px]' : 'h-7 px-2 text-[12px]',
              value === o.value ? 'bg-elevated text-fg shadow-[0_1px_2px_rgba(0,0,0,.25),0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </FieldShell>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '', format }: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; format?: (v: number) => string }) {
  const auto = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={auto} className="text-[12px] font-medium text-fg-muted">
          {label}
        </label>
        <span className="font-mono text-[11px] text-fg-subtle tabular-nums">{format ? format(value) : `${value}${unit}`}</span>
      </div>
      <input
        id={auto}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-hover accent-[var(--app-accent)]"
        style={{ background: `linear-gradient(to right, var(--app-accent) ${pct}%, var(--app-hover) ${pct}%)` }}
      />
    </div>
  );
}
