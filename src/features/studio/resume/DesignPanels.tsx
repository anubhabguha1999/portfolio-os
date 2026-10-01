import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Sparkles, XCircle, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented, Select, Slider, Switch } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import type { ResumeDoc, ResumeStyle } from '@/studio/model/types';
import { COLOR_PRESETS } from '@/studio/templates/kit';
import { getResumeTemplate } from '@/studio/templates/resume';
import { useResumeEditor } from '@/studio/store/resume-editor';
import { useWorkspace } from '@/studio/store/workspace';
import { atsCheck, ATS_DISCLAIMER } from '@/studio/analysis/ats';
import { analyzeContent } from '@/studio/analysis/content';
import { renderFlowText } from '@/studio/engine/render-text';
import type { ResumeLayout } from './useResumeLayout';
import { cn } from '@/utils/cn';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line pb-4 last:border-0">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

export function DesignPanel({ onBrowse }: { onBrowse: () => void }) {
  const resume = useResumeEditor((s) => s.resume)!;
  const setStyle = useResumeEditor((s) => s.setStyle);
  const st = resume.style;
  const tpl = getResumeTemplate(resume.templateId);
  const has = (c: string) => tpl.controls.includes(c as never);
  const set = <K extends keyof ResumeStyle>(k: K) => (v: ResumeStyle[K]) => setStyle({ [k]: v } as Partial<ResumeStyle>);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBrowse} className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg p-3 text-left hover:border-accent">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
          <LayoutTemplate className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{tpl.name}</span>
          <span className="block truncate text-[11.5px] text-fg-subtle">{tpl.description}</span>
        </span>
        <span className="text-[11.5px] font-medium text-accent">Change</span>
      </button>

      <Group title="Colour">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour preset">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={st.colorPreset === p.id}
              title={p.label}
              onClick={() => setStyle({ colorPreset: p.id, accent: p.accent })}
              className={cn('size-7 rounded-full ring-offset-2 ring-offset-panel transition', st.colorPreset === p.id ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-line-strong')}
              style={{ background: p.accent }}
            />
          ))}
          <label className={cn('relative size-7 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-panel', st.colorPreset === 'custom' ? 'ring-2 ring-accent' : 'ring-1 ring-line')} title="Custom colour" style={{ background: st.colorPreset === 'custom' ? st.accent : 'conic-gradient(#ef4444,#f59e0b,#10b981,#3b82f6,#8b5cf6,#ef4444)' }}>
            <input type="color" className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" value={st.accent} onChange={(e) => setStyle({ colorPreset: 'custom', accent: e.target.value }, 'accent')} />
          </label>
        </div>
        <Switch label="ATS-safe mode" help="Removes decorative colour, fills, chips, icons and photos; two-column templates collapse to one column." checked={st.atsSafe} onChange={set('atsSafe')} />
      </Group>

      <Group title="Typography">
        {has('font') && <Segmented label="Typeface" value={st.font} onChange={set('font')} options={[{ value: 'template', label: 'Template' }, { value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]} />}
        {has('baseSize') && <Slider label="Body size" min={8.5} max={12} step={0.1} value={st.baseSize} onChange={set('baseSize')} format={(v) => `${v.toFixed(1)} pt`} />}
        {has('lineHeight') && <Slider label="Line height" min={1.1} max={1.7} step={0.02} value={st.lineHeight} onChange={set('lineHeight')} format={(v) => v.toFixed(2)} />}
      </Group>

      <Group title="Layout">
        {has('spacing') && <Slider label="Section spacing" min={0.6} max={1.6} step={0.05} value={st.spacing} onChange={set('spacing')} format={(v) => `${Math.round(v * 100)}%`} />}
        {has('sidebarWidth') && <Slider label="Sidebar width" min={0.24} max={0.42} step={0.01} value={st.sidebarWidth} onChange={set('sidebarWidth')} format={(v) => `${Math.round(v * 100)}%`} />}
        {has('headerAlign') && <Segmented label="Header alignment" value={st.headerAlign} onChange={set('headerAlign')} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />}
        {has('headerHeight') && <Segmented label="Header size" value={st.headerHeight} onChange={set('headerHeight')} options={[{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'tall', label: 'Tall' }]} />}
        {has('borderStyle') && <Segmented label="Rules & borders" value={st.borderStyle} onChange={set('borderStyle')} options={[{ value: 'none', label: 'None' }, { value: 'hairline', label: 'Hairline' }, { value: 'thick', label: 'Bold' }]} />}
        {has('iconStyle') && <Segmented label="Contact markers" value={st.iconStyle} onChange={set('iconStyle')} options={[{ value: 'none', label: 'None' }, { value: 'label', label: 'Labels' }, { value: 'glyph', label: 'Glyphs' }]} />}
      </Group>

      {tpl.supportsPhoto && (
        <Group title="Photo">
          <Select
            label="Photo"
            value={st.photo}
            onChange={(e) => setStyle({ photo: e.target.value as ResumeStyle['photo'] })}
            options={[
              { value: 'none', label: 'No photo' },
              { value: 'circle', label: 'Circle' },
              { value: 'square', label: 'Square' },
              { value: 'rounded', label: 'Rounded square' },
              { value: 'small-portrait', label: 'Small portrait' },
              { value: 'large-portrait', label: 'Large portrait' },
            ]}
          />
          {st.photo !== 'none' && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
              <AlertTriangle className="mt-px size-3 shrink-0 text-warn" /> Some employers and parsers don’t expect photos. Consider a photo-free version for ATS portals.
            </p>
          )}
        </Group>
      )}
    </div>
  );
}

export function PagePanel({ layout, onFit, fitting }: { layout: ResumeLayout | null; onFit: (target: number) => void; fitting: boolean }) {
  const resume = useResumeEditor((s) => s.resume)!;
  const setStyle = useResumeEditor((s) => s.setStyle);
  const apply = useResumeEditor((s) => s.apply);
  const st = resume.style;
  const pages = layout?.laid.pages.length ?? 0;
  return (
    <div className="space-y-4">
      <Group title="Document">
        <Segmented label="Type" value={resume.kind} onChange={(v) => apply('Document type', (r) => ({ ...r, kind: v, style: { ...r.style, pageLimit: v === 'cv' ? 0 : r.style.pageLimit } }))} options={[{ value: 'resume', label: 'Resume' }, { value: 'cv', label: 'CV (multi-page)' }]} />
        <Segmented label="Paper" value={st.paper} onChange={(v) => setStyle({ paper: v })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }]} />
        <Segmented label="Margins" value={st.margins} onChange={(v) => setStyle({ margins: v })} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Wide' }]} />
      </Group>
      <Group title="Length">
        <Segmented label="Page limit" value={String(st.pageLimit)} onChange={(v) => setStyle({ pageLimit: Number(v) })} options={[{ value: '1', label: '1 page' }, { value: '2', label: '2 pages' }, { value: '3', label: '3 pages' }, { value: '0', label: 'Unlimited' }]} />
        <div className="rounded-xl border border-line bg-bg p-3">
          {st.pageLimit > 0 && pages <= st.pageLimit ? (
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ok">
              <CheckCircle2 className="size-4" /> Fits on {pages} page{pages === 1 ? '' : 's'}
            </p>
          ) : st.pageLimit > 0 ? (
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-warn">
              <AlertTriangle className="size-4" /> {pages} pages required (limit {st.pageLimit})
            </p>
          ) : (
            <p className="text-[12.5px] text-fg-muted">
              {pages} page{pages === 1 ? '' : 's'} · sections continue across pages automatically
            </p>
          )}
          {st.fit && <p className="mt-1 text-[11.5px] text-fg-subtle">Optimised: spacing {Math.round(st.fit.spacing * 100)}%, margins {Math.round(st.fit.margins * 100)}%, type {Math.round(st.fit.font * 100)}%.</p>}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" loading={fitting} icon={<Sparkles className="size-3.5" />} onClick={() => onFit(st.pageLimit > 0 ? st.pageLimit : 1)}>
              {st.pageLimit > 1 ? `Fit to ${st.pageLimit} pages` : 'Fit to one page'}
            </Button>
            {st.fit && (
              <Button size="sm" variant="ghost" onClick={() => setStyle({ fit: null })}>
                Reset
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-fg-subtle">Tightens spacing first, then margins and line height, and only then type size — never below a readable 8.5 pt.</p>
        </div>
      </Group>
      <Group title="Pages">
        <Switch label="Page numbers" checked={st.pageNumbers} onChange={(v) => setStyle({ pageNumbers: v })} />
        <Switch label="Repeat headings on new pages" help="“Experience (continued)” when a section runs onto the next page." checked={st.repeatHeadings} onChange={(v) => setStyle({ repeatHeadings: v })} />
        <Segmented label="Dates" value={st.dateFormat} onChange={(v) => setStyle({ dateFormat: v })} options={[{ value: 'short', label: 'Jan 2024' }, { value: 'long', label: 'January 2024' }, { value: 'numeric', label: '01/2024' }]} />
      </Group>
    </div>
  );
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="mt-px size-3.5 shrink-0 text-ok" />,
  warn: <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" />,
  fail: <XCircle className="mt-px size-3.5 shrink-0 text-danger" />,
  info: <Info className="mt-px size-3.5 shrink-0 text-fg-subtle" />,
  error: <XCircle className="mt-px size-3.5 shrink-0 text-danger" />,
};

export function ChecksPanel({ layout, resume }: { layout: ResumeLayout | null; resume: ResumeDoc }) {
  const library = useWorkspace((s) => s.library);
  const selectRef = useResumeEditor((s) => s.selectRef);
  const result = useMemo(() => {
    if (!layout) return null;
    const text = renderFlowText(layout.flow);
    return { ats: atsCheck({ resolved: layout.resolved, templateId: resume.templateId, laid: layout.laid, text }), content: analyzeContent(layout.resolved, resume, library) };
  }, [layout, resume, library]);
  if (!result) return null;
  const passed = result.ats.filter((c) => c.status === 'pass').length;
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel>ATS compatibility</SectionLabel>
          <span className="font-mono text-[11px] text-fg-subtle">
            {passed}/{result.ats.length} checks passed
          </span>
        </div>
        <ul className="mt-2.5 space-y-2">
          {result.ats.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              {STATUS_ICON[c.status]}
              <div>
                <p className="text-[12.5px]">{c.label}</p>
                {c.detail && <p className="mt-0.5 text-[11.5px] leading-snug text-fg-subtle">{c.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-hover px-2.5 py-2 text-[11px] leading-snug text-fg-muted">
          <ShieldCheck className="mt-px size-3.5 shrink-0" /> {ATS_DISCLAIMER}
        </p>
      </section>
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel>Content review</SectionLabel>
          <span className="font-mono text-[11px] text-fg-subtle">{result.content.length ? `${result.content.length} suggestion${result.content.length === 1 ? '' : 's'}` : 'All clear'}</span>
        </div>
        {result.content.length === 0 ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-ok">
            <CheckCircle2 className="size-4" /> No issues found by the rule checks.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1">
            {result.content.map((f) => (
              <li key={f.id}>
                <button type="button" disabled={!f.ref} onClick={() => f.ref && selectRef(f.ref)} className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-hover disabled:hover:bg-transparent">
                  {STATUS_ICON[f.level === 'error' ? 'fail' : f.level]}
                  <span className="text-[12.5px] leading-snug">{f.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-fg-subtle">Deterministic rules run on this device — no AI service, nothing uploaded.</p>
      </section>
    </div>
  );
}
