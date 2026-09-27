import type { ReactNode } from 'react';
import { Segmented, Select, Slider, Switch, TextInput } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import type { DocxExportOptions, HtmlExportOptions, PdfExportOptions, ZipExportOptions } from '@/lib/export';
import type { ResumeSettings } from './model';

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

const LENGTHS = [
  { value: 'one-page' as const, label: 'One page' },
  { value: 'two-page' as const, label: 'Two pages' },
  { value: 'full' as const, label: 'Full' },
];

const TEMPLATES = [
  { value: 'modern' as const, label: 'Modern', title: 'Accent colour, bold left-aligned header' },
  { value: 'classic' as const, label: 'Classic', title: 'Serif type, centered header, rules' },
  { value: 'ats' as const, label: 'ATS', title: 'Single column, plain text, standard headings — best for applicant tracking systems' },
];

const TEMPLATE_HELP: Record<'modern' | 'classic' | 'ats', string> = {
  modern: 'Accent-coloured headings with a bold, left-aligned header.',
  classic: 'Serif typography, centered header and thin rules.',
  ats: 'Single column, black text, standard section names and no images — parses cleanly in applicant tracking systems.',
};

function FontDelivery({ value, onChange }: { value: 'system' | 'cdn'; onChange: (v: 'system' | 'cdn') => void }) {
  return (
    <Segmented
      label="Fonts & dependencies"
      value={value}
      onChange={onChange}
      options={[
        { value: 'system', label: 'Self-contained', title: 'System font stacks; works fully offline' },
        { value: 'cdn', label: 'CDN-based', title: 'Loads the theme fonts from Google Fonts' },
      ]}
    />
  );
}

export function HtmlOptionsPanel({ value, onChange }: { value: HtmlExportOptions; onChange: (v: HtmlExportOptions) => void }) {
  return (
    <Group title="HTML options">
      <FontDelivery value={value.fontDelivery} onChange={(fontDelivery) => onChange({ ...value, fontDelivery })} />
      <p className="text-[11.5px] leading-snug text-fg-subtle">
        {value.fontDelivery === 'system'
          ? 'One file with every image, font, style and script inside. Opens from disk with zero network requests.'
          : 'One file with everything inline except theme fonts, which load from Google Fonts when online.'}
      </p>
      <Switch checked={value.embedData} onChange={(embedData) => onChange({ ...value, embedData })} label="Embed project data" help="Adds the portfolio JSON so the file can be re-imported later." />
    </Group>
  );
}

export function ZipOptionsPanel({ value, onChange }: { value: ZipExportOptions; onChange: (v: ZipExportOptions) => void }) {
  return (
    <Group title="Website options">
      <FontDelivery value={value.fontDelivery} onChange={(fontDelivery) => onChange({ ...value, fontDelivery })} />
      <Switch checked={value.includeProjectJson} onChange={(includeProjectJson) => onChange({ ...value, includeProjectJson })} label="Include portfolio.json" help="Full project backup (with images) so the site can be re-imported." />
      <Switch checked={value.embedData} onChange={(embedData) => onChange({ ...value, embedData })} label="Embed data in index.html" />
    </Group>
  );
}

export function ResumeFields({
  length,
  template,
  onLength,
  onTemplate,
}: {
  length: ResumeSettings['length'];
  template: ResumeSettings['template'];
  onLength: (v: ResumeSettings['length']) => void;
  onTemplate: (v: ResumeSettings['template']) => void;
}) {
  return (
    <>
      <Segmented label="Length" value={length} onChange={onLength} options={LENGTHS} />
      <div>
        <Segmented label="Template" value={template} onChange={onTemplate} options={TEMPLATES} />
        <p className="mt-1.5 text-[11.5px] leading-snug text-fg-subtle">{TEMPLATE_HELP[template]}</p>
      </div>
      {length !== 'full' && <p className="text-[11.5px] leading-snug text-fg-subtle">Fit-to-pages shrinks type and spacing (down to 78%) until the resume fits.</p>}
    </>
  );
}

function num(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function PdfOptionsPanel({ value, onChange }: { value: PdfExportOptions; onChange: (v: PdfExportOptions) => void }) {
  const set = <K extends keyof PdfExportOptions>(k: K, v: PdfExportOptions[K]) => onChange({ ...value, [k]: v });
  const ats = value.mode === 'resume' && value.resumeTemplate === 'ats';
  return (
    <div className="space-y-6">
      <Group title="Document">
        <Segmented
          value={value.mode}
          onChange={(mode) => set('mode', mode)}
          options={[
            { value: 'portfolio', label: 'Portfolio PDF' },
            { value: 'resume', label: 'Resume PDF' },
          ]}
        />
        {value.mode === 'resume' && <ResumeFields length={value.resumeLength} template={value.resumeTemplate} onLength={(v) => set('resumeLength', v)} onTemplate={(v) => set('resumeTemplate', v)} />}
      </Group>
      <Group title="Page">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Size"
            value={value.pageSize}
            onChange={(e) => set('pageSize', e.target.value as PdfExportOptions['pageSize'])}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'US Letter' },
              { value: 'a3', label: 'A3' },
              { value: 'custom', label: 'Custom…' },
            ]}
          />
          <Segmented
            label="Orientation"
            value={value.orientation}
            onChange={(v) => set('orientation', v)}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
        </div>
        {value.pageSize === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Width (mm)" type="number" min={50} max={1200} value={value.customSize.width} onChange={(e) => set('customSize', { ...value.customSize, width: num(e.target.value, value.customSize.width) })} />
            <TextInput label="Height (mm)" type="number" min={50} max={1200} value={value.customSize.height} onChange={(e) => set('customSize', { ...value.customSize, height: num(e.target.value, value.customSize.height) })} />
          </div>
        )}
        <Slider label="Margins" min={6} max={32} value={value.margins} unit=" mm" onChange={(v) => set('margins', v)} />
      </Group>
      <Group title="Header & footer">
        <TextInput label="Header text" placeholder="e.g. Ada Lovelace — Portfolio" value={value.headerText} onChange={(e) => set('headerText', e.target.value)} />
        <TextInput label="Footer text" placeholder="e.g. ada.dev" value={value.footerText} onChange={(e) => set('footerText', e.target.value)} />
        <Switch checked={value.pageNumbers} onChange={(v) => set('pageNumbers', v)} label="Page numbers" help={'"Page n of N" in the footer.'} />
      </Group>
      <Group title="Content">
        <Switch checked={value.sectionPageBreaks} onChange={(v) => set('sectionPageBreaks', v)} label="Start each section on a new page" />
        <Switch checked={value.includeImages && !ats} disabled={ats} onChange={(v) => set('includeImages', v)} label="Include images" help={ats ? 'ATS resumes never include images.' : value.mode === 'resume' ? 'Adds your hero photo to the header.' : 'Project images, gallery and photo.'} />
      </Group>
    </div>
  );
}

export function DocxOptionsPanel({ value, onChange }: { value: DocxExportOptions; onChange: (v: DocxExportOptions) => void }) {
  const set = <K extends keyof DocxExportOptions>(k: K, v: DocxExportOptions[K]) => onChange({ ...value, [k]: v });
  const ats = value.mode === 'resume' && value.resumeTemplate === 'ats';
  return (
    <div className="space-y-6">
      <Group title="Document">
        <Segmented
          value={value.mode}
          onChange={(mode) => set('mode', mode)}
          options={[
            { value: 'resume', label: 'Resume DOCX' },
            { value: 'portfolio', label: 'Full Portfolio DOCX' },
          ]}
        />
        {value.mode === 'resume' && <ResumeFields length={value.resumeLength} template={value.resumeTemplate} onLength={(v) => set('resumeLength', v)} onTemplate={(v) => set('resumeTemplate', v)} />}
        {value.mode === 'resume' && value.resumeLength !== 'full' && <p className="text-[11.5px] leading-snug text-fg-subtle">Word reflows text itself, so length controls how much content is included.</p>}
      </Group>
      <Group title="Content">
        <Switch checked={value.includeImages && !ats} disabled={ats} onChange={(v) => set('includeImages', v)} label="Include images" help={ats ? 'ATS resumes never include images.' : undefined} />
        <Switch checked={value.pageNumbers} onChange={(v) => set('pageNumbers', v)} label="Page numbers" help="Live Word fields: Page X of Y." />
      </Group>
    </div>
  );
}

export function ResumeOptionsPanel({ value, onChange }: { value: ResumeSettings; onChange: (v: ResumeSettings) => void }) {
  const set = <K extends keyof ResumeSettings>(k: K, v: ResumeSettings[K]) => onChange({ ...value, [k]: v });
  const ats = value.template === 'ats';
  return (
    <div className="space-y-6">
      <Group title="Resume">
        <ResumeFields length={value.length} template={value.template} onLength={(v) => set('length', v)} onTemplate={(v) => set('template', v)} />
      </Group>
      <Group title="Options">
        <Segmented
          label="Paper (PDF)"
          value={value.pageSize}
          onChange={(v) => set('pageSize', v)}
          options={[
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'US Letter' },
          ]}
        />
        <Switch checked={value.includePhoto && !ats} disabled={ats} onChange={(v) => set('includePhoto', v)} label="Include photo" help={ats ? 'ATS resumes never include images.' : 'Uses the hero image.'} />
        <Switch checked={value.pageNumbers} onChange={(v) => set('pageNumbers', v)} label="Page numbers" />
      </Group>
    </div>
  );
}
