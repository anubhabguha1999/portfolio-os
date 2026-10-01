import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Info, Lock, Play, RefreshCw, Wrench, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented, TextInput } from '@/components/ui/Field';
import { Badge, ProgressBar } from '@/components/ui/misc';
import type { ExportIssue, ExportOptions } from '@/lib/codegen/types';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Group } from '../OptionPanels';
import { checkSiteUrl, previewProjectName, type FrameworkFormat } from './model';
import { projectBytes, type FrameworkExportState, type Fixes } from './useFrameworkExport';

/* ------------------------------------------------------------------ */
/* Framework cards                                                     */
/* ------------------------------------------------------------------ */

const CARDS: Array<{ id: FrameworkFormat; glyph: string; title: string; subtitle: string }> = [
  { id: 'react', glyph: '⚛', title: 'React + Vite', subtitle: 'Fast client-side React app' },
  { id: 'next', glyph: '▲', title: 'Next.js', subtitle: 'Production Next.js app' },
];

export function FrameworkCards({ value, onChange }: { value: FrameworkFormat; onChange: (v: FrameworkFormat) => void }) {
  return (
    <div role="radiogroup" aria-label="Framework" className="grid gap-2">
      {CARDS.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            onKeyDown={(e) => {
              if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                onChange(c.id === 'react' ? 'next' : 'react');
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', active ? 'border-accent bg-accent-soft/60' : 'border-line bg-bg hover:border-line-strong')}
          >
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border text-[17px]', active ? 'border-accent/40 bg-elevated text-accent' : 'border-line bg-elevated text-fg-muted')} aria-hidden="true">
              {c.glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{c.title}</span>
              <span className="block text-[11.5px] text-fg-subtle">{c.subtitle}</span>
            </span>
            <span className={cn('size-4 shrink-0 rounded-full border-2', active ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--app-panel)]' : 'border-line-strong')} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="app-label">{label}</p>
      <p className="flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-bg px-2.5 text-[12px] text-fg-muted">
        <Lock className="size-3 text-fg-subtle" aria-hidden="true" /> {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export function FrameworkOptionsPanel({ format, value, onChange }: { format: FrameworkFormat; value: ExportOptions; onChange: (v: ExportOptions) => void }) {
  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => onChange({ ...value, [k]: v });
  const url = checkSiteUrl(value.siteUrl);
  const next = format === 'next';
  return (
    <>
      {next && (
        <Group title="Next.js configuration">
          <Segmented
            label="Rendering"
            value={value.rendering}
            onChange={(v) => set('rendering', v)}
            options={[
              { value: 'static', label: 'Static Export', title: 'output: "export" — deploy the out/ folder to any static host' },
              { value: 'standard', label: 'Standard Next.js', title: 'A regular Next.js app for Next.js-compatible hosting' },
            ]}
          />
          <p className="text-[11.5px] leading-snug text-fg-subtle">
            {value.rendering === 'static'
              ? 'Builds plain HTML/CSS/JS into out/ — GitHub Pages, Netlify, Cloudflare Pages, S3 or any static server. No server features are used.'
              : 'A normal Next.js app for Next.js-compatible hosting. You can add API routes, server actions or dynamic rendering later — nothing here requires a backend.'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Fixed label="Router" value="App Router" />
            <Fixed label="Language" value="TypeScript" />
          </div>
        </Group>
      )}
      <Group title={next ? 'Styling & assets' : 'React + Vite configuration'}>
        {!next && (
          <div className="grid grid-cols-2 gap-3">
            <Fixed label="Bundler" value="Vite" />
            <Fixed label="Language" value="TypeScript" />
          </div>
        )}
        <Segmented
          label="Styling"
          value={value.styling}
          onChange={(v) => set('styling', v)}
          options={[
            { value: 'tailwind', label: 'Tailwind CSS' },
            { value: 'css-modules', label: 'CSS Modules' },
            { value: 'css', label: 'Plain CSS' },
          ]}
        />
        {next ? (
          <Segmented label="Images" value={value.images} onChange={(v) => set('images', v)} options={[{ value: 'optimized', label: 'Next/Image' }, { value: 'img', label: 'Standard <img>' }]} />
        ) : (
          <Fixed label="Images" value="Standard <img> (lazy-loaded, sized)" />
        )}
        <Segmented label="Animations" value={value.animations ? 'on' : 'off'} onChange={(v) => set('animations', v === 'on')} options={[{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]} />
        {value.animations && <p className="text-[11.5px] leading-snug text-fg-subtle">Entrance animations live in small client components and respect “reduce motion”.</p>}
      </Group>
      <Group title="Project">
        <Segmented
          label="Structure"
          value={value.structure}
          onChange={(v) => set('structure', v)}
          options={[
            { value: 'single', label: 'Single page', title: 'One page with anchor navigation' },
            { value: 'multi', label: 'Multiple pages', title: '/, /about, /projects, /contact — only pages with content' },
          ]}
        />
        <TextInput
          label="Site URL (optional)"
          type="url"
          inputMode="url"
          placeholder="https://your-domain.com"
          value={value.siteUrl}
          onChange={(e) => set('siteUrl', e.target.value)}
          error={url.ok ? undefined : url.message}
          help={url.ok && url.origin ? `Used for canonical URLs, sitemap.xml and Open Graph: ${url.origin}` : 'Used for the sitemap, robots.txt and Open Graph URLs. Leave empty and a clearly marked placeholder is used — no domain is invented.'}
        />
        <TextInput label="Project folder" value={value.projectName} onChange={(e) => set('projectName', e.target.value)} help={`Folder and package name: ${previewProjectName(value.projectName)}`} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

export function FrameworkComparison() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const col = (title: string, best: string[], output: string) => (
    <div className="rounded-lg border border-line bg-bg/60 p-3">
      <p className="text-[12.5px] font-semibold">{title}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Best for</p>
      <ul className="mt-1 space-y-0.5 text-[12px] text-fg-muted">
        {best.map((b) => (
          <li key={b}>· {b}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Output</p>
      <p className="mt-1 text-[12px] text-fg-muted">{output}</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-line">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12.5px] font-medium">
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 text-fg-subtle" aria-hidden="true" /> Which framework?
        </span>
        <ChevronDown className={cn('size-3.5 text-fg-subtle transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="grid gap-2 border-t border-line p-3">
          {col('React + Vite', ['Simple static / client-side portfolio'], 'Client-side React application (single HTML entry, bundled JS)')}
          {col('Next.js', ['SEO-focused portfolio', 'Multi-page portfolio', 'Dynamic project routes', 'Static or Next.js hosting'], 'Next.js App Router application (pre-rendered pages)')}
          <p className="text-[11.5px] text-fg-subtle">Both export the same content and design. You own the source either way.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generate + export check                                             */
/* ------------------------------------------------------------------ */

export interface ExportCheckProps {
  format: FrameworkFormat;
  state: FrameworkExportState;
  stale: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  onFix: (issue: ExportIssue) => void;
  onFixAll: (fixes: Fixes) => void;
  onDownload: () => void;
}

export function fixesFor(issues: ExportIssue[]): Fixes {
  return {
    ...(issues.some((i) => i.fix === 'remove-link') ? { dropInvalidLinks: true } : {}),
    ...(issues.some((i) => i.fix === 'remove-image') ? { dropMissingImages: true } : {}),
  };
}

export function ExportCheckPanel({ format, state, stale, disabled, onGenerate, onFix, onFixAll, onDownload }: ExportCheckProps) {
  const label = format === 'next' ? 'Next.js' : 'React';
  const running = state.status === 'running';
  const done = state.status === 'done' ? state : null;
  const report = done?.result.report;
  const errors = report?.issues.filter((i) => i.level === 'error') ?? [];
  const fixable = errors.filter((i) => i.fix === 'remove-link' || i.fix === 'remove-image');
  const omitted = done && (done.fixes.dropInvalidLinks || done.fixes.dropMissingImages);
  let body: ReactNode = null;

  if (state.status === 'error')
    body = (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3">
        <p className="text-[12.5px] font-medium text-danger">Generation failed</p>
        <p className="mt-0.5 break-words text-[12px] text-fg-muted">{state.message}</p>
      </div>
    );
  else if (done && report) {
    const size = projectBytes(done.result.project);
    body = (
      <div className="space-y-3" aria-live="polite">
        <div className="rounded-xl border border-line bg-bg/60">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">{label} export check</p>
            {stale && <Badge tone="warn">Options changed — regenerate</Badge>}
          </div>
          <ul className="space-y-1.5 p-3">
            {report.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12px]">
                {c.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-ok" aria-label="Passed" /> : <XCircle className="mt-px size-3.5 shrink-0 text-danger" aria-label="Failed" />}
                <span>
                  <span className={c.ok ? 'text-fg-muted' : 'text-fg'}>{c.label}</span>
                  {!c.ok && c.detail && <span className="block text-[11.5px] leading-snug text-fg-subtle">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!report.canExport && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.07] p-3">
            <p className="text-[12.5px] font-semibold text-danger">Export cannot continue.</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              {errors.length} issue{errors.length === 1 ? '' : 's'} found:
            </p>
            <ul className="mt-2 space-y-1.5">
              {errors.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-[12px]">
                  <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" aria-hidden="true" />
                  <span className="min-w-0 flex-1 leading-snug">{i.message}</span>
                  {(i.fix || i.sectionId) && (
                    <Button size="xs" variant="secondary" icon={<Wrench className="size-3" />} onClick={() => onFix(i)} aria-label={`Fix: ${i.message}`}>
                      Fix
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {fixable.length > 1 && (
              <Button size="sm" variant="secondary" className="mt-2.5" icon={<Wrench className="size-3.5" />} onClick={() => onFixAll(fixesFor(fixable))}>
                Fix all
              </Button>
            )}
            {fixable.length > 0 && <p className="mt-2 text-[11px] leading-snug text-fg-subtle">Fixing leaves the invalid link or missing image out of this export only — your portfolio is not changed.</p>}
          </div>
        )}

        {omitted && report.canExport && (
          <p className="flex gap-1.5 rounded-lg border border-line bg-bg/60 p-2.5 text-[12px] text-fg-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {[done.fixes.dropInvalidLinks && 'invalid links', done.fixes.dropMissingImages && 'unavailable images'].filter(Boolean).join(' and ')} are omitted from this export. Fix them in the builder to include them.
          </p>
        )}

        {done.result.build.warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warn/25 bg-warn/10 p-2.5">
            {done.result.build.warnings.map((w) => (
              <li key={w} className="flex gap-1.5 text-[12px] leading-snug text-fg-muted">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden="true" /> {w}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <Button variant="primary" className="w-full" icon={<Download className="size-4" />} disabled={!report.canExport || stale} onClick={onDownload}>
            Download {done.result.project.name}.zip
          </Button>
          <p className="text-center text-[11.5px] text-fg-subtle">
            {done.result.project.files.length} files · {formatBytes(size)} uncompressed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant={done && !stale ? 'secondary' : 'primary'} className="w-full" icon={done ? <RefreshCw className="size-4" /> : <Play className="size-4" />} loading={running} disabled={disabled || running} onClick={onGenerate}>
        {done ? `Regenerate ${label} project` : `Generate ${label} Project`}
      </Button>
      {running && (
        <div className="space-y-1.5 rounded-lg border border-line bg-bg/60 p-3" role="status">
          <p className="truncate text-[12px] text-fg-muted">{state.stage}</p>
          <ProgressBar value={45} label="Generating project" />
        </div>
      )}
      {body}
    </div>
  );
}
