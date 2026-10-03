import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Atom, Braces, Check, Download, Eye, FileCode2, FileJson, FileText, FileType, Package, Printer, RefreshCw, Rocket, Sparkles, Triangle, TriangleAlert } from 'lucide-react';
import type { Portfolio } from '@/types/portfolio';
import { LogoMark } from '@/components/Logo';
import { Button, Spinner } from '@/components/ui/Button';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/misc';
import { useEditor } from '@/stores/editor';
import { useAssets } from '@/stores/assets';
import { toast } from '@/stores/ui';
import { getProject } from '@/lib/storage/projects';
import { runHealthCheck } from '@/lib/analysis/health';
import type { CheckResult } from '@/lib/analysis/types';
import { exportDocx, exportHtml, exportPdf, exportProjectJson, exportZip, buildExportDocument, buildStandaloneHtml, printPortfolio, ZIP_ROOT, type ExportResult, type ProgressFn } from '@/lib/export';
import { externalImageUrls } from '@/lib/html/build';
import { BRAND } from '@/config/brand';
import { downloadBlob } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import { defaultOptions, isFormatId, isFrameworkFormat, resumeDocxOptions, resumePdfOptions, TARGET_LABEL, type ExportTarget, type FormatId, type StudioOptions } from './model';
import type { ExportIssue, ExportOptions, Framework } from '@/lib/codegen/types';
import { frameworkOf, KEY_FILES, loadFrameworkOptions, optionsSignature, saveFrameworkOptions, type FrameworkFormat } from './code/model';
import { useFrameworkExport, type Fixes } from './code/useFrameworkExport';
import { ExportCheckPanel, FrameworkCards, FrameworkComparison, FrameworkOptionsPanel } from './code/FrameworkPanel';
import { SourcePreview } from './code/SourcePreview';
import { HealthDialog } from './HealthDialog';
import { DocxOptionsPanel, HtmlOptionsPanel, PdfOptionsPanel, ResumeOptionsPanel, ZipOptionsPanel, Group } from './OptionPanels';
import { DocOutline, FileTree, HtmlFrame, PdfFrame } from './Previews';

/* ------------------------------------------------------------------ */
/* Project loading                                                     */
/* ------------------------------------------------------------------ */

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; name: string; stored: Portfolio | null };

function useStudioProject(id: string) {
  const live = useEditor((s) => (s.projectId === id ? s.portfolio : null));
  const liveName = useEditor((s) => (s.projectId === id ? s.projectName : ''));
  const assetsReady = useAssets((s) => s.projectId === id && s.loaded);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [assetsError, setAssetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const ed = useEditor.getState();
      if (ed.projectId === id && ed.portfolio) setState({ status: 'ready', name: ed.projectName, stored: null });
      else {
        try {
          const rec = await getProject(id);
          if (cancelled) return;
          if (!rec) {
            setState({ status: 'missing' });
            return;
          }
          setState({ status: 'ready', name: rec.name, stored: rec.portfolio });
        } catch (err) {
          if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : 'The project data could not be read.' });
          return;
        }
      }
      const a = useAssets.getState();
      if (a.projectId !== id || !a.loaded) {
        try {
          await a.loadProject(id);
        } catch (err) {
          if (!cancelled) setAssetsError(err instanceof Error ? err.message : 'Images could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const portfolio = live ?? (state.status === 'ready' ? state.stored : null);
  const name = live ? liveName : state.status === 'ready' ? state.name : '';
  return { state, portfolio, name, assetsReady: assetsReady || !!assetsError, assetsError };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function useDebouncedAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], delay: number, enabled: boolean) {
  const [state, setState] = useState<{ value: T | null; loading: boolean; error: string | null }>({ value: null, loading: enabled, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const t = window.setTimeout(() => {
      fnRef
        .current()
        .then((value) => {
          if (!cancelled) setState({ value, loading: false, error: null });
        })
        .catch((err: unknown) => {
          if (!cancelled) setState((s) => ({ value: s.value, loading: false, error: err instanceof Error ? err.message : String(err) }));
        });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, delay]);
  return state;
}

interface FormatEntry {
  /** Unique key (two Next.js entries share the "next" format). */
  key: string;
  id: FormatId;
  label: string;
  description: string;
  icon: typeof FileText;
  /** Next.js entries preselect a rendering mode. */
  rendering?: 'static' | 'standard';
}

const FORMAT_GROUPS: Array<{ title: string; items: FormatEntry[] }> = [
  {
    title: 'Website',
    items: [
      { key: 'html', id: 'html', label: 'Standalone HTML', description: 'One self-contained file', icon: FileCode2 },
      { key: 'zip', id: 'zip', label: 'Static Website ZIP', description: 'Deploy-ready static site', icon: Package },
    ],
  },
  { title: 'React', items: [{ key: 'react', id: 'react', label: 'React + Vite Project', description: 'TypeScript source code', icon: Atom }] },
  {
    title: 'Next.js',
    items: [
      { key: 'next-static', id: 'next', rendering: 'static', label: 'Next.js Static Export', description: 'App Router · any static host', icon: Triangle },
      { key: 'next-standard', id: 'next', rendering: 'standard', label: 'Next.js Standard Project', description: 'App Router · Next.js hosting', icon: Braces },
    ],
  },
  {
    title: 'Documents',
    items: [
      { key: 'pdf', id: 'pdf', label: 'PDF', description: 'Portfolio or resume, vector text', icon: FileText },
      { key: 'docx', id: 'docx', label: 'DOCX', description: 'Editable Word document', icon: FileType },
      { key: 'resume', id: 'resume', label: 'Resume', description: 'PDF + DOCX from your content', icon: Sparkles },
    ],
  },
  { title: 'Backup', items: [{ key: 'json', id: 'json', label: 'Portfolio JSON', description: 'Re-importable project file', icon: FileJson }] },
];

const ZIP_DIRS = ['assets', 'assets/images', 'assets/fonts', 'assets/icons', 'css', 'js'].map((d) => `${ZIP_ROOT}/${d}`);

interface JobState {
  target: ExportTarget;
  status: 'running' | 'done' | 'error';
  stage: string;
  progress: number;
  error?: string;
  warnings: string[];
  filename?: string;
  size?: number;
}

interface PdfPreview {
  target: 'pdf' | 'resume-pdf';
  key: string;
  portfolio: Portfolio;
  result: ExportResult;
  url: string;
}

function optionsKey(target: ExportTarget, o: StudioOptions): string {
  switch (target) {
    case 'pdf':
      return JSON.stringify(o.pdf);
    case 'resume-pdf':
    case 'resume-docx':
      return JSON.stringify(o.resume);
    case 'docx':
      return JSON.stringify(o.docx);
    case 'html':
      return JSON.stringify(o.html);
    case 'zip':
      return JSON.stringify(o.zip);
    default:
      return 'json';
  }
}

function PanelShell({ title, meta, actions, children }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line bg-panel/60 px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12.5px]">
          <span className="font-medium">{title}</span>
          {meta}
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/90 px-2.5 py-1 text-[11.5px] text-fg-muted shadow-float backdrop-blur" role="status">
      <Spinner className="size-3" /> {label}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid size-full min-h-40 place-items-center text-fg-subtle">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ExportStudioPage() {
  const { projectId = '' } = useParams();
  const { state, portfolio, name, assetsReady, assetsError } = useStudioProject(projectId);

  useEffect(() => {
    document.title = `Export${name ? ` · ${name}` : ''} — ${BRAND.name}`;
  }, [name]);

  if (state.status === 'loading' || (state.status === 'ready' && !portfolio)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg-subtle" role="status" aria-label="Loading project">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (state.status === 'missing' || state.status === 'error' || !portfolio) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
        <EmptyState
          icon={<TriangleAlert className="size-5" />}
          title={state.status === 'error' ? 'This project could not be opened' : 'Project not found'}
          description={
            state.status === 'error'
              ? `The saved data looks damaged (${state.message}). Restore a version from the builder's history or import a backup.`
              : 'It may have been deleted, or it was created in another browser.'
          }
          action={
            <Link to="/projects" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
              <ArrowLeft className="size-4" /> Back to projects
            </Link>
          }
        />
      </div>
    );
  }
  return <Studio key={projectId} projectId={projectId} portfolio={portfolio} projectName={name || portfolio.metadata.title} assetsReady={assetsReady} assetsError={assetsError} />;
}

interface StudioProps {
  projectId: string;
  portfolio: Portfolio;
  projectName: string;
  assetsReady: boolean;
  assetsError: string | null;
}

function Studio({ projectId, portfolio, projectName, assetsReady, assetsError }: StudioProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const paramFormat = params.get('format');
  const [format, setFormatState] = useState<FormatId>(isFormatId(paramFormat) ? paramFormat : 'html');
  const [opts, setOpts] = useState<StudioOptions>(() => defaultOptions(portfolio));
  const [job, setJob] = useState<JobState | null>(null);
  const [pdf, setPdf] = useState<PdfPreview | null>(null);
  const [health, setHealth] = useState<{ issues: CheckResult[]; target: ExportTarget } | null>(null);
  const [healthPassed, setHealthPassed] = useState<ExportTarget | null>(null);
  const [printing, setPrinting] = useState(false);
  const running = useRef(false);
  const [fwOpts, setFwOpts] = useState<Record<Framework, ExportOptions>>(() => ({
    nextjs: loadFrameworkOptions(projectId, portfolio, 'nextjs'),
    'react-vite': loadFrameworkOptions(projectId, portfolio, 'react-vite'),
  }));
  const fw = useFrameworkExport();

  // Deep links from the command palette (?format=pdf) preselect a format.
  useEffect(() => {
    if (isFormatId(paramFormat)) setFormatState(paramFormat);
  }, [paramFormat]);

  const setFormat = (f: FormatId) => {
    setFormatState(f);
    const next = new URLSearchParams(params);
    next.set('format', f);
    setParams(next, { replace: true });
  };

  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );

  const update = <K extends keyof StudioOptions>(k: K, v: StudioOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  /* --------------------------- framework export ---------------------- */

  const fwFormat: FrameworkFormat | null = isFrameworkFormat(format) ? format : null;
  const framework: Framework = fwFormat === 'react' ? 'react-vite' : 'nextjs';
  const currentFw = fwOpts[framework];
  const setCurrentFw = (o: ExportOptions) => {
    setFwOpts((all) => ({ ...all, [o.framework]: o }));
    saveFrameworkOptions(projectId, o);
  };
  const fwDone = fw.state.status === 'done' && fw.state.result.project.framework === framework ? fw.state : null;
  const fwStale = !!fwDone && (fwDone.signature !== optionsSignature(currentFw) || fwDone.portfolio !== portfolio);
  const generateFramework = (fixes: Fixes = {}) => void fw.run(portfolio, currentFw, fixes);
  const fixIssue = (issue: ExportIssue) => {
    if (issue.fix === 'remove-link' || issue.fix === 'remove-image') {
      const prev = fwDone?.fixes ?? {};
      generateFramework({ ...prev, ...(issue.fix === 'remove-link' ? { dropInvalidLinks: true } : { dropMissingImages: true }) });
      return;
    }
    navigate(issue.sectionId ? `/builder/${projectId}?section=${encodeURIComponent(issue.sectionId)}` : `/builder/${projectId}`);
  };
  const downloadFramework = async () => {
    if (!fwDone) return;
    const { projectZip } = await import('@/lib/codegen');
    const blob = projectZip(fwDone.result.project);
    downloadBlob(blob, `${fwDone.result.project.name}.zip`);
    toast({ tone: 'success', title: `${framework === 'nextjs' ? 'Next.js' : 'React + Vite'} project downloaded`, description: `${fwDone.result.project.name}.zip · ${formatBytes(blob.size)} · run ${fwDone.result.project.commands.install} then ${fwDone.result.project.commands.dev}` });
  };

  /* ------------------------------ export ----------------------------- */

  const run = useCallback(
    async (target: ExportTarget) => {
      if (running.current) return;
      running.current = true;
      setJob({ target, status: 'running', stage: 'Starting…', progress: 0, warnings: [] });
      const onProgress: ProgressFn = (pr) => setJob((j) => (j && j.target === target && j.status === 'running' ? { ...j, stage: pr.stage, progress: pr.progress } : j));
      try {
        let res: ExportResult;
        switch (target) {
          case 'html':
            res = await exportHtml(portfolio, opts.html, onProgress);
            break;
          case 'zip':
            res = await exportZip(portfolio, opts.zip, onProgress);
            break;
          case 'json':
            onProgress({ stage: 'Collecting project and images…', progress: 0.3 });
            res = await exportProjectJson(portfolio, projectName);
            onProgress({ stage: 'Done', progress: 1 });
            break;
          case 'pdf':
            res = await exportPdf(portfolio, opts.pdf, onProgress);
            break;
          case 'resume-pdf':
            res = await exportPdf(portfolio, resumePdfOptions(opts.resume), onProgress);
            break;
          case 'docx':
            res = await exportDocx(portfolio, opts.docx, onProgress);
            break;
          case 'resume-docx':
            res = await exportDocx(portfolio, resumeDocxOptions(opts.resume), onProgress);
            break;
        }
        if (target === 'pdf' || target === 'resume-pdf') {
          setPdf({ target, key: optionsKey(target, opts), portfolio, result: res, url: URL.createObjectURL(res.blob) });
        } else {
          downloadBlob(res.blob, res.filename);
          toast({ tone: 'success', title: `${TARGET_LABEL[target]} downloaded`, description: `${res.filename} · ${formatBytes(res.blob.size)}` });
        }
        setJob({ target, status: 'done', stage: 'Done', progress: 1, warnings: res.warnings, filename: res.filename, size: res.blob.size });
      } catch (err) {
        setJob({ target, status: 'error', stage: 'Failed', progress: 0, warnings: [], error: err instanceof Error ? err.message : String(err) });
      } finally {
        running.current = false;
      }
    },
    [portfolio, opts, projectName],
  );

  const requestExport = (target: ExportTarget) => {
    if (running.current) return;
    let issues: CheckResult[] = [];
    try {
      issues = runHealthCheck(portfolio, useAssets.getState().meta).checks.filter((c) => c.status === 'fail' || c.status === 'warn');
    } catch (err) {
      console.error('Health check failed to run', err);
    }
    if (issues.length) {
      setHealthPassed(null);
      setHealth({ issues, target });
      return;
    }
    setHealthPassed(target);
    void run(target);
  };

  const print = async () => {
    setPrinting(true);
    try {
      const { warnings } = await printPortfolio(portfolio);
      if (warnings.length) toast({ tone: 'warning', title: 'Print version', description: warnings.join(' ') });
    } catch (err) {
      toast({ tone: 'error', title: 'Could not open the print dialog', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setPrinting(false);
    }
  };

  const busy = job?.status === 'running';

  /* ------------------------------ previews --------------------------- */

  const wantsSite = format === 'html' || format === 'zip';
  const siteFonts = format === 'zip' ? opts.zip.fontDelivery : opts.html.fontDelivery;
  const siteEmbed = format === 'zip' ? opts.zip.embedData : opts.html.embedData;
  const htmlPreview = useDebouncedAsync(
    () => buildStandaloneHtml(portfolio, { fontDelivery: siteFonts, embedData: siteEmbed }, { inlineExternal: false }),
    [portfolio, siteFonts, siteEmbed, assetsReady],
    350,
    wantsSite && assetsReady,
  );
  const zipPreview = useDebouncedAsync(() => exportZip(portfolio, opts.zip, undefined, { inlineExternal: false }), [portfolio, opts.zip, assetsReady], 600, format === 'zip' && assetsReady);
  const remoteImages = useMemo(() => (wantsSite ? externalImageUrls(portfolio).length : 0), [portfolio, wantsSite]);

  const docSpec = useMemo(() => {
    if (format === 'pdf') return opts.pdf;
    if (format === 'docx') return opts.docx;
    if (format === 'resume') return resumePdfOptions(opts.resume);
    return null;
  }, [format, opts.pdf, opts.docx, opts.resume]);
  const docModel = useMemo(() => {
    if (!docSpec) return null;
    try {
      return buildExportDocument(portfolio, docSpec);
    } catch {
      return null;
    }
  }, [portfolio, docSpec]);

  const pdfTarget: 'pdf' | 'resume-pdf' | null = format === 'pdf' ? 'pdf' : format === 'resume' ? 'resume-pdf' : null;
  const currentPdf = pdf && pdfTarget && pdf.target === pdfTarget ? pdf : null;
  const pdfStale = !!currentPdf && (currentPdf.key !== optionsKey(currentPdf.target, opts) || currentPdf.portfolio !== portfolio);

  const assetCount = useAssets((s) => Object.keys(s.meta).length);
  const assetBytes = useAssets((s) => Object.values(s.meta).reduce((a, m) => a + m.size, 0));

  /* ------------------------------ sidebar ---------------------------- */

  const statusBlock = (targets: ExportTarget[]) => {
    const j = job && targets.includes(job.target) ? job : null;
    const passed = !!healthPassed && targets.includes(healthPassed);
    return (
      <div className="space-y-2.5" aria-live="polite">
        {passed && j?.status !== 'error' && (
          <p className="flex items-center gap-1.5 text-[12px] text-ok">
            <Check className="size-3.5" aria-hidden="true" /> Health check passed
          </p>
        )}
        {j?.status === 'running' && (
          <div className="space-y-1.5 rounded-lg border border-line bg-bg/60 p-3">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate text-fg-muted">{j.stage}</span>
              <span className="shrink-0 font-mono tabular-nums text-fg-subtle">{Math.round(j.progress * 100)}%</span>
            </div>
            <ProgressBar value={j.progress * 100} label={`Exporting ${TARGET_LABEL[j.target]}`} />
          </div>
        )}
        {j?.status === 'error' && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3">
            <p className="text-[12.5px] font-medium text-danger">{TARGET_LABEL[j.target]} export failed</p>
            <p className="mt-0.5 break-words text-[12px] text-fg-muted">{j.error}</p>
            <Button size="xs" variant="secondary" className="mt-2" icon={<RefreshCw className="size-3" />} onClick={() => void run(j.target)}>
              Retry
            </Button>
          </div>
        )}
        {j?.status === 'done' && (
          <p className="truncate text-[12px] text-fg-muted" title={j.filename}>
            <span className="text-fg">{j.filename}</span> · {formatBytes(j.size ?? 0)}
          </p>
        )}
        {j?.status === 'done' && j.warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warn/25 bg-warn/10 p-2.5">
            {j.warnings.map((w) => (
              <li key={w} className="flex gap-1.5 text-[12px] leading-snug text-fg-muted">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden="true" /> {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const primary = (target: ExportTarget, label: string, icon: ReactNode = <Download className="size-4" />) => (
    <Button variant="primary" className="w-full" icon={icon} loading={busy && job?.target === target} disabled={busy} onClick={() => requestExport(target)}>
      {label}
    </Button>
  );

  const actions = (target: ExportTarget, label: string, icon?: ReactNode) => (
    <div className="space-y-2.5">
      {primary(target, label, icon)}
      {statusBlock([target])}
    </div>
  );

  let optionsPanel: ReactNode;
  switch (format) {
    case 'html':
      optionsPanel = (
        <>
          <HtmlOptionsPanel value={opts.html} onChange={(v) => update('html', v)} />
          {actions('html', 'Download HTML')}
        </>
      );
      break;
    case 'zip':
      optionsPanel = (
        <>
          <ZipOptionsPanel value={opts.zip} onChange={(v) => update('zip', v)} />
          {actions('zip', 'Download website ZIP')}
        </>
      );
      break;
    case 'react':
    case 'next':
      optionsPanel = (
        <>
          <FrameworkCards value={format} onChange={(v) => setFormat(v)} />
          <FrameworkOptionsPanel format={format} value={{ ...currentFw, framework: frameworkOf(format) }} onChange={setCurrentFw} />
          <FrameworkComparison />
          <ExportCheckPanel
            format={format}
            state={fw.state.status === 'done' && !fwDone ? { status: 'idle' } : fw.state}
            stale={fwStale}
            disabled={!assetsReady}
            onGenerate={() => generateFramework()}
            onFix={fixIssue}
            onFixAll={(fixes) => generateFramework({ ...(fwDone?.fixes ?? {}), ...fixes })}
            onDownload={() => void downloadFramework()}
          />
        </>
      );
      break;
    case 'pdf':
      optionsPanel = (
        <>
          <PdfOptionsPanel value={opts.pdf} onChange={(v) => update('pdf', v)} />
          {actions('pdf', currentPdf ? 'Regenerate PDF' : 'Generate PDF', <FileText className="size-4" />)}
        </>
      );
      break;
    case 'docx':
      optionsPanel = (
        <>
          <DocxOptionsPanel value={opts.docx} onChange={(v) => update('docx', v)} />
          {actions('docx', opts.docx.mode === 'resume' ? 'Download Resume DOCX' : 'Download Portfolio DOCX')}
        </>
      );
      break;
    case 'json':
      optionsPanel = (
        <>
          <Group title="Project backup">
            <p className="text-[12.5px] leading-relaxed text-fg-muted">
              A complete copy of this project — every section, theme setting and image — in one file. Import it from the Projects page to restore it in any browser.
            </p>
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-line bg-bg/60 p-2.5">
                <dt className="text-fg-subtle">Sections</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{portfolio.sections.length}</dd>
              </div>
              <div className="rounded-lg border border-line bg-bg/60 p-2.5">
                <dt className="text-fg-subtle">Images & fonts</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {assetCount} · {formatBytes(assetBytes)}
                </dd>
              </div>
            </dl>
          </Group>
          {actions('json', 'Download backup')}
        </>
      );
      break;
    case 'resume':
      optionsPanel = (
        <>
          <ResumeOptionsPanel value={opts.resume} onChange={(v) => update('resume', v)} />
          <div className="space-y-2">
            {primary('resume-pdf', currentPdf ? 'Regenerate Resume PDF' : 'Generate Resume PDF', <FileText className="size-4" />)}
            <Button variant="secondary" className="w-full" icon={<Download className="size-4" />} loading={busy && job?.target === 'resume-docx'} disabled={busy} onClick={() => requestExport('resume-docx')}>
              Download Resume DOCX
            </Button>
            {statusBlock(['resume-pdf', 'resume-docx'])}
          </div>
        </>
      );
      break;
  }

  /* ------------------------------ preview ---------------------------- */

  const sitePreview = (
    <>
      {htmlPreview.value ? (
        <HtmlFrame html={htmlPreview.value.html} title="Exported site preview" />
      ) : (
        !htmlPreview.error && (
          <Centered>
            <Spinner className="size-5" />
          </Centered>
        )
      )}
      {htmlPreview.loading && htmlPreview.value && <Busy label="Updating…" />}
      {htmlPreview.error && (
        <div role="alert" className="absolute inset-x-3 top-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[12.5px] text-danger">
          Preview failed: {htmlPreview.error}
        </div>
      )}
    </>
  );

  const docPreview = (label: string) =>
    docModel ? (
      <div className="absolute inset-0 overflow-auto px-3 py-6 sm:px-8">
        <p className="mx-auto mb-3 max-w-[680px] text-[11.5px] text-fg-subtle">{label}</p>
        <DocOutline model={docModel} accent={docModel.theme.primary} />
      </div>
    ) : (
      <EmptyState icon={<FileText className="size-5" />} title="Nothing to preview" description="This document could not be built from the current content." />
    );

  let preview: ReactNode;
  switch (format) {
    case 'html': {
      const bytes = htmlPreview.value ? new Blob([htmlPreview.value.html]).size : null;
      preview = (
        <PanelShell
          title="Live preview"
          meta={
            <>
              {bytes !== null && <Badge>{formatBytes(bytes)}</Badge>}
              <Badge tone={opts.html.fontDelivery === 'system' ? 'ok' : 'neutral'}>{opts.html.fontDelivery === 'system' ? 'Works offline' : 'Fonts via CDN'}</Badge>
              {remoteImages > 0 && (
                <Badge tone="warn">
                  {remoteImages} remote image{remoteImages === 1 ? '' : 's'} embedded at export
                </Badge>
              )}
            </>
          }
        >
          {sitePreview}
        </PanelShell>
      );
      break;
    }
    case 'zip': {
      const z = zipPreview.value;
      preview = (
        <PanelShell title="Package" meta={z ? <Badge>{formatBytes(z.blob.size)} ZIP</Badge> : null}>
          <div className="flex h-full min-h-0 flex-col md:flex-row">
            <div className="relative h-72 shrink-0 border-b border-line bg-panel md:h-auto md:w-80 md:border-b-0 md:border-r">
              {z?.files ? (
                <FileTree files={z.files} emptyDirs={ZIP_DIRS} zipSize={z.blob.size} />
              ) : zipPreview.error ? (
                <p role="alert" className="p-3 text-[12.5px] text-danger">
                  {zipPreview.error}
                </p>
              ) : (
                <Centered>
                  <Spinner className="size-5" />
                </Centered>
              )}
              {zipPreview.loading && z && <Busy label="Rebuilding…" />}
            </div>
            <div className="relative min-h-[420px] flex-1">{sitePreview}</div>
          </div>
        </PanelShell>
      );
      break;
    }
    case 'react':
    case 'next': {
      const label = format === 'next' ? `Next.js${currentFw.rendering === 'static' ? ' static export' : ''}` : 'React + Vite';
      preview = (
        <PanelShell
          title="Generated source"
          meta={
            fwDone ? (
              <>
                <Badge>{fwDone.result.project.files.length} files</Badge>
                <Badge tone={fwDone.result.report.canExport ? 'ok' : 'danger'}>{fwDone.result.report.canExport ? 'Checks passed' : 'Needs fixes'}</Badge>
                {fwStale && <Badge tone="warn">Out of date — regenerate</Badge>}
              </>
            ) : (
              <Badge>{label}</Badge>
            )
          }
        >
          {fwDone ? (
            <SourcePreview project={fwDone.result.project} keyFiles={KEY_FILES[framework]} />
          ) : fw.state.status === 'running' ? (
            <Centered>
              <Spinner className="size-5" />
            </Centered>
          ) : (
            <EmptyState
              icon={format === 'next' ? <Triangle className="size-5" /> : <Atom className="size-5" />}
              title={`Generate a ${label} project`}
              description="Your portfolio becomes real, editable source code: typed data in src/data/portfolio.ts, components, design tokens and images in public/. Inspect every file here before downloading. Nothing leaves your browser."
            />
          )}
        </PanelShell>
      );
      break;
    }
    case 'pdf':
    case 'resume': {
      if (currentPdf) {
        const r = currentPdf.result;
        preview = (
          <PanelShell
            title={currentPdf.target === 'pdf' && opts.pdf.mode === 'portfolio' ? 'Portfolio PDF' : 'Resume PDF'}
            meta={
              <>
                <Badge>
                  {r.pageCount} page{r.pageCount === 1 ? '' : 's'}
                </Badge>
                <Badge>{formatBytes(r.blob.size)}</Badge>
                {r.scale !== undefined && r.scale < 1 && <Badge tone="accent">Fitted at {Math.round(r.scale * 100)}%</Badge>}
                {pdfStale && <Badge tone="warn">Out of date — regenerate</Badge>}
              </>
            }
            actions={
              <Button size="sm" variant="primary" icon={<Download className="size-3.5" />} onClick={() => downloadBlob(r.blob, r.filename)}>
                Download PDF
              </Button>
            }
          >
            <PdfFrame url={currentPdf.url} title="Generated PDF" />
          </PanelShell>
        );
      } else {
        preview = (
          <PanelShell title={format === 'resume' ? 'Resume outline' : 'Document outline'} meta={<Badge>Generate to see the exact pages</Badge>}>
            {docPreview('Structure of the document that will be generated. The real PDF appears here after generation.')}
          </PanelShell>
        );
      }
      break;
    }
    case 'docx':
      preview = (
        <PanelShell title="Document outline" meta={<Badge>{opts.docx.mode === 'resume' ? 'Resume' : 'Full portfolio'}</Badge>}>
          {docPreview('Browsers cannot display Word files, so this is the document structure: headings, entries and content in order.')}
        </PanelShell>
      );
      break;
    case 'json':
      preview = (
        <PanelShell title="portfolio.json" meta={<Badge>Format v1</Badge>}>
          <pre className="absolute inset-0 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-fg-muted">
            {JSON.stringify(
              {
                format: 'portfolio-os-project',
                formatVersion: 1,
                generator: BRAND.generator,
                portfolio: { ...portfolio, sections: portfolio.sections.map((s) => ({ id: s.id, type: s.type, name: s.name, enabled: s.enabled, data: '…' })) },
                assets: `${assetCount} embedded file${assetCount === 1 ? '' : 's'} (data URLs)`,
              },
              null,
              2,
            )}
          </pre>
        </PanelShell>
      );
      break;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
        <Link to="/projects" className="rounded-md p-1 hover:bg-hover" aria-label="All projects">
          <LogoMark className="size-6" />
        </Link>
        <span className="text-fg-subtle" aria-hidden="true">
          /
        </span>
        <p className="min-w-0 truncate text-[13px] font-medium" title={projectName}>
          {projectName}
        </p>
        <Badge tone="accent" className="max-sm:hidden!">
          Export Studio
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} loading={printing} onClick={() => void print()} title="Print-optimized version" aria-label="Print version">
            <span className="hidden md:inline">Print version</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<Rocket className="size-4" />} onClick={() => navigate(`/deploy/${projectId}`)} title="Publish to Netlify, Vercel or GitHub Pages" aria-label="Deploy">
            <span className="hidden md:inline">Deploy</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} onClick={() => navigate(`/preview/${projectId}`)} aria-label="Preview">
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button size="sm" variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(`/builder/${projectId}`)} aria-label="Back to builder">
            <span className="hidden sm:inline">Back to builder</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-line bg-panel lg:w-[360px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <nav aria-label="Export formats" className="space-y-2.5 p-2">
            {FORMAT_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.title}</p>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                  {g.items.map((f) => {
                    const Icon = f.icon;
                    const active = f.id === format && (!f.rendering || f.rendering === fwOpts.nextjs.rendering);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          if (f.rendering && fwOpts.nextjs.rendering !== f.rendering) setCurrentFw({ ...fwOpts.nextjs, rendering: f.rendering });
                          setFormat(f.id);
                        }}
                        className={cn('group flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors', active ? 'border-line-strong bg-elevated' : 'border-transparent hover:bg-hover')}
                      >
                        <span className={cn('grid size-7 shrink-0 place-items-center rounded-md border', active ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted group-hover:text-fg')}>
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className={cn('block truncate text-[13px] font-medium', active ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>{f.label}</span>
                          <span className="hidden truncate text-[11.5px] text-fg-subtle sm:block">{f.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="space-y-6 border-t border-line p-4">
            {assetsError && (
              <p role="alert" className="rounded-lg border border-warn/25 bg-warn/10 p-2.5 text-[12px] text-fg-muted">
                Images could not be loaded ({assetsError}). Exports will skip them.
              </p>
            )}
            {optionsPanel}
          </div>
        </aside>
        <main className="relative flex min-h-[70vh] min-w-0 flex-1 flex-col bg-canvas lg:min-h-0" aria-label="Export preview">
          {preview}
        </main>
      </div>

      <HealthDialog
        open={!!health}
        issues={health?.issues ?? []}
        targetLabel={health ? TARGET_LABEL[health.target] : ''}
        onClose={() => setHealth(null)}
        onFix={(sectionId) => {
          setHealth(null);
          navigate(sectionId ? `/builder/${projectId}?section=${encodeURIComponent(sectionId)}` : `/builder/${projectId}`);
        }}
        onExportAnyway={() => {
          const target = health?.target;
          setHealth(null);
          if (target) void run(target);
        }}
      />
    </div>
  );
}
