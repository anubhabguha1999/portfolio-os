// CONTRACT (owned by the import workstream).
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, FileCode2, FileJson2, FileText, FileUp, Sparkles } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/misc';
import { importProjectJson } from '@/lib/storage/projects';
import { PortfolioValidationError } from '@/schemas/portfolio';
import { createImportedProject, createProjectFromHtml, importHtmlDocument, parseResumeText } from '@/lib/import';
import { toast } from '@/stores/ui';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import { BRAND } from '@/config/brand';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'json' | 'html' | 'resume';
}

type Tab = NonNullable<ImportDialogProps['initialTab']>;
const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'json', label: 'Project JSON', icon: <FileJson2 className="size-3.5" aria-hidden="true" /> },
  { id: 'html', label: 'HTML', icon: <FileCode2 className="size-3.5" aria-hidden="true" /> },
  { id: 'resume', label: 'Resume text', icon: <FileText className="size-3.5" aria-hidden="true" /> },
];

interface ImportError {
  title: string;
  message: string;
  issues: string[];
}

function toImportError(err: unknown, title: string): ImportError {
  if (err instanceof PortfolioValidationError) return { title, message: err.message, issues: err.issues };
  if (err instanceof SyntaxError) return { title, message: 'The file is not valid JSON — it may be truncated or corrupted.', issues: [err.message] };
  return { title, message: err instanceof Error ? err.message : String(err), issues: [] };
}

const MAX_FILE = 80 * 1024 * 1024;

function DropZone({ accept, hint, busy, onFile, label }: { accept: string; hint: string; busy: boolean; onFile: (f: File) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f && !busy) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-bg/40')}
    >
      <div className="mb-3 grid size-10 place-items-center rounded-xl border border-line bg-elevated text-fg-muted">
        <FileUp className="size-4" aria-hidden="true" />
      </div>
      <p className="text-[13px] font-medium text-fg">Drop a file here</p>
      <p className="mt-1 text-[12px] text-fg-subtle">{hint}</p>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button className="mt-4" size="sm" loading={busy} onClick={() => input.current?.click()}>
        Choose file…
      </Button>
    </div>
  );
}

function ErrorBox({ error }: { error: ImportError }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3" role="alert">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
        {error.title}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{error.message}</p>
      {error.issues.length > 0 && (
        <ul className="mt-2 max-h-36 space-y-0.5 overflow-auto rounded-lg border border-line bg-bg p-2 font-mono text-[11px] text-fg-muted">
          {error.issues.slice(0, 30).map((i, n) => (
            <li key={n}>{i}</li>
          ))}
          {error.issues.length > 30 && <li>…and {error.issues.length - 30} more</li>}
        </ul>
      )}
    </div>
  );
}

const RESUME_PLACEHOLDER = `Jane Doe
Senior Frontend Engineer
jane@example.com | +1 415 555 0142 | San Francisco, CA
linkedin.com/in/janedoe · github.com/janedoe

SUMMARY
…

EXPERIENCE
Senior Engineer at Stripe
Jan 2021 – Present
• Led the dashboard migration…`;

/** Imports always create a NEW project, then navigate to /builder/:id. */
export function ImportDialog({ open, onClose, initialTab = 'json' }: ImportDialogProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  const [resume, setResume] = useState('');
  const deferredResume = useDeferredValue(resume);
  const tabsId = useId();
  const resumeFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setBusy(false);
    }
  }, [open, initialTab]);

  const parsed = useMemo(() => {
    if (!deferredResume.trim()) return null;
    try {
      return { ok: true as const, ...parseResumeText(deferredResume) };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
    }
  }, [deferredResume]);

  const finish = (projectId: string, title: string, warnings: string[], description?: string) => {
    onClose();
    navigate(`/builder/${projectId}`);
    toast({ title, description: description ?? (warnings.length ? undefined : 'Opened in the builder as a new project.'), tone: 'success' });
    if (warnings.length) toast({ title: `${warnings.length} note${warnings.length === 1 ? '' : 's'} from the import`, description: warnings.slice(0, 4).join(' '), tone: 'warning' });
  };

  const guardSize = (f: File): boolean => {
    if (f.size > MAX_FILE) {
      setError({ title: 'File too large', message: `${f.name} is ${formatBytes(f.size)}. The limit is ${formatBytes(MAX_FILE)}.`, issues: [] });
      return false;
    }
    return true;
  };

  const importJson = async (f: File) => {
    if (!guardSize(f)) return;
    setBusy(true);
    setError(null);
    try {
      const json: unknown = JSON.parse(await f.text());
      const res = await importProjectJson(json);
      finish(res.project.id, `Imported “${res.project.name}”`, res.warnings, res.migratedFrom ? `This project was created with schema v${res.migratedFrom} and has been upgraded to the current format. The original file is unchanged.` : undefined);
    } catch (err) {
      setError(toImportError(err, `Could not import ${f.name}`));
      setBusy(false);
    }
  };

  const importHtml = async (f: File) => {
    if (!guardSize(f)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importHtmlDocument(await f.text());
      const { project, warnings } = await createProjectFromHtml(result);
      finish(project.id, result.exact ? `Restored “${project.name}” exactly` : `Imported “${project.name}” from HTML`, warnings, result.exact ? `The file was a ${BRAND.name} export, so every section, setting and embedded image was restored.` : undefined);
    } catch (err) {
      setError(toImportError(err, `Could not import ${f.name}`));
      setBusy(false);
    }
  };

  const importResume = async () => {
    if (!parsed || !parsed.ok) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = parseResumeText(resume);
      const { project } = await createImportedProject(fresh.portfolio, [], 'Imported from resume text');
      finish(project.id, `Created “${project.name}” from your resume`, [], 'Review each section — automatic parsing is never perfect.');
    } catch (err) {
      setError(toImportError(err, 'Could not create the project'));
      setBusy(false);
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else return;
    e.preventDefault();
    const t = TABS[next]!;
    setTab(t.id);
    setError(null);
    document.getElementById(`${tabsId}-${t.id}`)?.focus();
  };

  const summary = parsed && parsed.ok ? parsed.summary : [];
  const counts = summary.filter((s) => /^\d/.test(s));
  const details = summary.filter((s) => !/^\d/.test(s));

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Import"
      description="Everything is processed in your browser. Each import creates a new project."
      size="md"
      footer={
        tab === 'resume' ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={importResume} loading={busy} disabled={!parsed || !parsed.ok || summary.length === 0} icon={<Sparkles className="size-4" aria-hidden="true" />}>
              Create project
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div role="tablist" aria-label="Import source" className="flex rounded-[10px] border border-line bg-bg p-0.5" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`${tabsId}-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              disabled={busy}
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={cn(
                'flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition-colors',
                tab === t.id ? 'bg-elevated text-fg shadow-[0_1px_2px_rgba(0,0,0,.25),0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg-muted',
              )}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="space-y-3 text-[13px]">
          {tab === 'json' && (
            <>
              <p className="leading-relaxed text-fg-muted">
                Restore a <code className="font-mono text-[12px] text-fg">{BRAND.fileExtension}</code> backup (with images) or a bare portfolio JSON. Files from older versions are migrated automatically.
              </p>
              <DropZone accept=".json,.portfolio.json,application/json" hint=".portfolio.json or .json" busy={busy} onFile={importJson} label="Choose a project JSON file" />
            </>
          )}
          {tab === 'html' && (
            <>
              <p className="leading-relaxed text-fg-muted">
                A single-file HTML export from {BRAND.name} is restored exactly. Any other portfolio page is sanitised — scripts never run — and mapped into sections by its headings.
              </p>
              <DropZone accept=".html,.htm,text/html" hint=".html or .htm" busy={busy} onFile={importHtml} label="Choose an HTML file" />
            </>
          )}
          {tab === 'resume' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="leading-relaxed text-fg-muted">Paste the text of your resume (copy it from the PDF or document).</p>
                <input
                  ref={resumeFile}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Load resume from a text file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f && guardSize(f)) setResume(await f.text());
                  }}
                />
                <Button size="xs" variant="ghost" onClick={() => resumeFile.current?.click()}>
                  Load .txt
                </Button>
              </div>
              <TextArea label="Resume text" value={resume} onChange={(e) => setResume(e.target.value)} rows={11} mono placeholder={RESUME_PLACEHOLDER} spellCheck={false} />
              <div className="rounded-xl border border-line bg-bg/40 px-3 py-2.5" aria-live="polite">
                {!parsed ? (
                  <p className="text-[12px] text-fg-subtle">A live summary of what was detected appears here.</p>
                ) : !parsed.ok ? (
                  <p className="text-[12px] text-danger">{parsed.message}</p>
                ) : summary.length === 0 ? (
                  <p className="text-[12px] text-fg-subtle">Nothing recognisable yet. Start with your name on the first line and use headings like EXPERIENCE, EDUCATION and SKILLS.</p>
                ) : (
                  <>
                    <p className="text-[12.5px] text-fg">
                      <span className="font-semibold">Found:</span> {counts.length ? counts.join(', ') : 'no sections yet'}
                    </p>
                    {details.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {details.map((d) => (
                          <Badge key={d}>{d}</Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {error && <ErrorBox error={error} />}
        </div>
      </div>
    </Dialog>
  );
}
