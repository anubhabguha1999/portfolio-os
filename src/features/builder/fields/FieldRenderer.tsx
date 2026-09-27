import { memo, useId, useState } from 'react';
import type { FieldDef } from '@/types/fields';
import { getIn, type PathKey } from '@/utils/path';
import { TextInput, TextArea, Select, Switch, Segmented, FieldShell } from '@/components/ui/Field';
import { TagsInput } from './TagsInput';
import { StringListField } from './StringListField';
import { ListField } from './ListField';
import { ImageField, ImageListField } from './ImageField';
import { IconField } from './IconField';
import { ColorField } from './ColorField';
import { MarkdownField, CodeField } from './TextFields';
import { checkUrl } from '@/utils/url';
import type { ImageRef } from '@/types/portfolio';

export type FieldChange = (path: PathKey[], value: unknown) => void;

export interface FieldRendererProps {
  fields: FieldDef[];
  value: Record<string, unknown>;
  basePath: PathKey[];
  onChange: FieldChange;
  disabled?: boolean;
}

function visible(f: FieldDef, value: Record<string, unknown>): boolean {
  if (!f.showWhen) return true;
  const v = value[f.showWhen.key];
  return f.showWhen.equals.some((e) => e === v || String(e) === String(v));
}

/** Renders any section's editing form from its declarative field list. */
export const FieldRenderer = memo(function FieldRenderer({ fields, value, basePath, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="space-y-4">
      {fields.filter((f) => visible(f, value)).map((f, i) => (
        <FieldControl key={`${f.key}-${i}`} field={f} value={value[f.key]} path={[...basePath, f.key]} onChange={onChange} disabled={disabled} parent={value} />
      ))}
    </div>
  );
});

function UrlInput({ label, help, value, onChange, disabled, placeholder, kind }: { label: string; help?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; kind: 'url' | 'email' | 'tel' }) {
  const [touched, setTouched] = useState(false);
  let error: string | undefined;
  if (touched && value.trim()) {
    if (kind === 'url') {
      const r = checkUrl(value);
      if (!r.ok) error = `Invalid link: ${r.reason}`;
    } else if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) error = 'Enter a valid email address';
  }
  return (
    <TextInput
      label={label}
      help={help}
      error={error}
      type={kind === 'url' ? 'text' : kind}
      inputMode={kind === 'url' ? 'url' : kind === 'tel' ? 'tel' : 'email'}
      value={value}
      placeholder={placeholder ?? (kind === 'url' ? 'https://' : '')}
      disabled={disabled}
      spellCheck={false}
      autoComplete="off"
      onBlur={() => setTouched(true)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FieldControl({ field: f, value, path, onChange, disabled, parent }: { field: FieldDef; value: unknown; path: PathKey[]; onChange: FieldChange; disabled?: boolean; parent: Record<string, unknown> }) {
  const set = (v: unknown) => onChange(path, v);
  const str = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  const id = useId();
  switch (f.kind) {
    case 'text':
      return <TextInput label={f.label} help={f.help} placeholder={f.placeholder} value={str} disabled={disabled} onChange={(e) => set(e.target.value)} />;
    case 'url':
    case 'email':
    case 'tel':
      return <UrlInput kind={f.kind} label={f.label} help={f.help} placeholder={f.placeholder} value={str} disabled={disabled} onChange={set} />;
    case 'month':
      return (
        <TextInput
          label={f.label}
          help={f.help ?? 'YYYY-MM, a year, or any text'}
          placeholder="2024-05"
          value={str}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
        />
      );
    case 'textarea':
      return <TextArea label={f.label} help={f.help} rows={f.rows ?? 3} placeholder={f.placeholder} value={str} disabled={disabled} onChange={(e) => set(e.target.value)} />;
    case 'markdown':
      return <MarkdownField label={f.label} help={f.help} value={str} disabled={disabled} onChange={set} />;
    case 'code':
      return <CodeField label={f.label} help={f.help} language={f.language ?? 'html'} value={str} disabled={disabled} onChange={set} />;
    case 'number':
      return (
        <TextInput
          label={f.label}
          help={f.help}
          type="number"
          min={f.min}
          max={f.max}
          step={f.step ?? 1}
          value={Number.isFinite(Number(value)) ? String(value) : '0'}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            const clamped = Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n));
            set(clamped);
          }}
        />
      );
    case 'toggle':
      return <Switch label={f.label} help={f.help} checked={value === true} disabled={disabled} onChange={set} />;
    case 'select':
      return (
        <Select
          label={f.label}
          help={f.help}
          value={str}
          disabled={disabled}
          options={f.options}
          onChange={(e) => {
            const v = e.target.value;
            set(typeof parent[f.key] === 'number' ? Number(v) : v);
          }}
        />
      );
    case 'segmented':
      return <Segmented label={f.label} value={str} options={f.options.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => !disabled && set(v)} />;
    case 'tags':
      return (
        <FieldShell label={f.label} help={f.help ?? 'Press Enter or comma to add'} htmlFor={id}>
          <TagsInput id={id} value={Array.isArray(value) ? value.map(String) : []} onChange={set} disabled={disabled} />
        </FieldShell>
      );
    case 'stringList':
      return <StringListField label={f.label} help={f.help} itemLabel={f.itemLabel ?? 'Item'} value={Array.isArray(value) ? value.map(String) : []} onChange={set} disabled={disabled} />;
    case 'image':
      return <ImageField label={f.label} help={f.help} value={(value as ImageRef | undefined) ?? { src: '', alt: '' }} onChange={set} disabled={disabled} />;
    case 'imageList':
      return <ImageListField label={f.label} value={Array.isArray(value) ? (value as ImageRef[]) : []} onChange={set} disabled={disabled} />;
    case 'icon':
      return <IconField label={f.label} help={f.help} value={str} onChange={set} disabled={disabled} />;
    case 'color':
      return <ColorField label={f.label} help={f.help} value={str} onChange={set} disabled={disabled} allowEmpty />;
    case 'list':
      return <ListField field={f} items={Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []} path={path} onChange={onChange} disabled={disabled} />;
  }
}

export { getIn };
