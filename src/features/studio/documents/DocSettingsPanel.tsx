import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Segmented, Select, Slider, Switch, TextInput } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import { ColorField } from '@/features/builder/fields/ColorField';
import type { StudioDocument } from '@/studio/model/types';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { useWorkspace } from '@/studio/store/workspace';
import { COLOR_PRESETS } from '@/studio/templates/kit';
import { DOC_TEMPLATES } from '@/studio/templates/document';
import { LETTER_TEMPLATES } from '@/studio/templates/letter';
import { documentMetaDefaults } from '@/studio/model/compose-document';
import { documentFileName } from '@/studio/export/pipeline';
import { cn } from '@/utils/cn';
import { LanguageField } from '../shared/LanguageField';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

const LETTER_SWATCHES: Record<string, [string, string, string]> = {
  'letter-minimal': ['#ffffff', '#111111', '#e5e7eb'],
  'letter-professional': ['#ffffff', '#1e3a8a', '#dbeafe'],
  'letter-executive': ['#ffffff', '#111111', '#881337'],
  'letter-creative': ['#1e3a8a', '#ffffff', '#c7d2fe'],
};

export function TemplatePicker({ doc }: { doc: StudioDocument }) {
  const setTemplate = useDocumentEditor((s) => s.setTemplate);
  const letter = doc.kind === 'cover-letter';
  const list = letter ? LETTER_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, swatch: LETTER_SWATCHES[t.id] ?? ['#fff', '#111', '#ddd'] })) : DOC_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, swatch: t.swatch }));
  return (
    <ul className="grid grid-cols-2 gap-2">
      {list.map((t) => {
        const active = t.id === doc.templateId;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setTemplate(t.id)}
              aria-pressed={active}
              title={t.description}
              className={cn('relative w-full overflow-hidden rounded-xl border text-left transition-colors', active ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong')}
            >
              <div className="relative h-16" style={{ background: t.swatch[0] }}>
                <span className="absolute left-2.5 top-2.5 h-1.5 w-10 rounded-full" style={{ background: t.swatch[1] }} />
                <span className="absolute left-2.5 top-5 h-1 w-16 rounded-full opacity-60" style={{ background: t.swatch[2] }} />
                <span className="absolute left-2.5 top-7 h-1 w-12 rounded-full opacity-60" style={{ background: t.swatch[2] }} />
                <span className="absolute bottom-2.5 right-2.5 size-4 rounded" style={{ background: t.swatch[1] }} />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1.5">
                <span className="flex-1 truncate text-[12px] font-medium">{t.name}</span>
                {active && <Check className="size-3.5 text-accent" />}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function DocSettingsPanel({ doc }: { doc: StudioDocument }) {
  const updatePage = useDocumentEditor((s) => s.updatePage);
  const updateMeta = useDocumentEditor((s) => s.updateMeta);
  const setFileName = useDocumentEditor((s) => s.setFileName);
  const rename = useDocumentEditor((s) => s.rename);
  const profile = useWorkspace((s) => s.profile);
  const p = doc.page;
  const defaults = documentMetaDefaults(doc, profile);
  const label = doc.kind === 'cover-letter' ? 'Cover_Letter' : doc.name;
  return (
    <div>
      <Group title="Template">
        <TemplatePicker doc={doc} />
        <p className="text-[11.5px] leading-snug text-fg-subtle">Switching templates only changes the design — your content stays exactly as it is.</p>
      </Group>
      <Group title="Page">
        <Segmented label="Paper" value={p.paper} onChange={(v) => updatePage({ paper: v })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }]} />
        {doc.kind !== 'cover-letter' && <Segmented label="Orientation" value={p.orientation} onChange={(v) => updatePage({ orientation: v })} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />}
        <Segmented label="Margins" value={p.margins} onChange={(v) => updatePage({ margins: v })} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Wide' }]} />
        <Switch label="Page numbers" checked={p.pageNumbers} onChange={(v) => updatePage({ pageNumbers: v })} />
        <LanguageField value={p.language} onChange={(v) => updatePage({ language: v })} />
        <TextInput label="Header text" placeholder="Shown at the top of each page" value={p.headerText} onChange={(e) => updatePage({ headerText: e.target.value }, 'header')} />
        <TextInput label="Footer text" placeholder="Shown at the bottom of each page" value={p.footerText} onChange={(e) => updatePage({ footerText: e.target.value }, 'footer')} />
      </Group>
      <Group title="Typography & colour">
        <Select
          label="Font"
          value={p.font}
          onChange={(e) => updatePage({ font: e.target.value as typeof p.font })}
          options={[
            { value: 'template', label: 'Template default' },
            { value: 'sans', label: 'Sans serif (Helvetica / Arial)' },
            { value: 'serif', label: 'Serif (Times)' },
            { value: 'mono', label: 'Monospace (Courier)' },
          ]}
        />
        <Slider label="Body size" value={p.baseSize} min={8} max={14} step={0.5} unit=" pt" onChange={(v) => updatePage({ baseSize: v }, 'size')} />
        <Slider label="Line height" value={p.lineHeight} min={1.1} max={1.9} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => updatePage({ lineHeight: v }, 'lh')} />
        <div>
          <p className="app-label">Accent</p>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={`${c.label} accent`}
                aria-pressed={p.accent.toLowerCase() === c.accent.toLowerCase()}
                onClick={() => updatePage({ accent: c.accent })}
                className={cn('size-7 rounded-full border-2 transition-transform hover:scale-110', p.accent.toLowerCase() === c.accent.toLowerCase() ? 'border-fg' : 'border-transparent')}
                style={{ background: c.accent }}
              />
            ))}
          </div>
        </div>
        <ColorField label="Custom accent" value={p.accent} onChange={(v) => updatePage({ accent: v }, 'accent')} />
      </Group>
      <Group title="Document">
        <TextInput label="Name" value={doc.name} onChange={(e) => rename(e.target.value)} />
        <TextInput label="File name" placeholder={documentFileName(profile.name, label, 'pdf').replace(/\.pdf$/, '')} value={doc.fileName} onChange={(e) => setFileName(e.target.value)} help={`Exports as ${documentFileName(profile.name, label, 'pdf', doc.fileName)}`} />
      </Group>
      <Group title="Metadata">
        <TextInput label="Title" placeholder={defaults.title} value={doc.meta.title} onChange={(e) => updateMeta({ title: e.target.value })} />
        <TextInput label="Author" placeholder={defaults.author} value={doc.meta.author} onChange={(e) => updateMeta({ author: e.target.value })} />
        <TextInput label="Subject" placeholder={defaults.subject} value={doc.meta.subject} onChange={(e) => updateMeta({ subject: e.target.value })} />
        <TextInput label="Keywords" help="Comma separated." value={doc.meta.keywords.join(', ')} onChange={(e) => updateMeta({ keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })} />
        <TextInput label="Creator" placeholder={defaults.creator} value={doc.meta.creator} onChange={(e) => updateMeta({ creator: e.target.value })} />
      </Group>
    </div>
  );
}
