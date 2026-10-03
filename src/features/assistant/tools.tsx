import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Copy, FilePlus2, RotateCcw, Sparkles, Square, TriangleAlert } from 'lucide-react';
import { Button, Spinner } from '@/components/ui/Button';
import { Badge, SectionLabel } from '@/components/ui/misc';
import { Segmented, Select, Switch, TextArea, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { copyText } from '@/utils/download';
import { cn } from '@/utils/cn';
import { saveDocument } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { newStudioDocument } from '@/studio/templates/document/starters';
import {
  coverLetterPrompt,
  parseBulletLines,
  resumeToText,
  rewriteBulletsPrompt,
  splitBullets,
  splitLetter,
  splitVariants,
  summaryPrompt,
  tailorPrompt,
  TONES,
  type Tone,
} from '@/lib/ai/prompts';
import { useAiRun, type AiRun } from './useAiRun';
import { loadProfileText, loadResolvedResume, useResolvedResume, useResumeList } from './resumeData';

export interface ToolProps {
  apiKey: string;
  model: string;
}

/* ------------------------------ Shared UI ---------------------------- */

function CopyButton({ text, label = 'Copy', size = 'xs' }: { text: string; label?: string; size?: 'xs' | 'sm' }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant="ghost"
      icon={done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      disabled={!text.trim()}
      onClick={async () => {
        if (await copyText(text.trim())) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } else toast({ tone: 'error', title: 'Could not copy to the clipboard' });
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

/** Highlights [placeholders] so they are easy to spot and fill in. */
function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{1,40}\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark key={i} className="rounded bg-warn/15 px-0.5 text-warn">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function RunButton({ run, disabled, onRun, children }: { run: AiRun; disabled?: boolean; onRun: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" icon={<Sparkles className="size-4" />} loading={run.running} disabled={disabled} onClick={onRun}>
        {children}
      </Button>
      {run.running && (
        <Button variant="secondary" icon={<Square className="size-3.5" />} onClick={run.stop}>
          Stop
        </Button>
      )}
    </div>
  );
}

/** Status, errors, token usage and the Copy / Try again actions under each result. */
function ResultBar({ run, copy, children }: { run: AiRun; copy?: string; children?: ReactNode }) {
  if (run.status === 'idle') return null;
  return (
    <div className="space-y-2">
      {run.status === 'error' && run.error && (
        <div className="flex gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[12.5px] leading-relaxed text-danger" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{run.error.message}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {run.running ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-fg-muted">
            <Spinner className="size-3.5" /> {run.text ? 'Writing…' : 'Thinking…'}
          </span>
        ) : run.status === 'stopped' ? (
          <Badge>Stopped</Badge>
        ) : run.status === 'done' && run.usage ? (
          <span className="text-[11.5px] text-fg-subtle" title="Tokens billed to your Anthropic account for this answer (output includes any reasoning).">
            {run.usage.inputTokens.toLocaleString()} in · {run.usage.outputTokens.toLocaleString()} out tokens
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {children}
          {copy !== undefined && !run.running && <CopyButton text={copy} label="Copy all" />}
          {!run.running && run.canRetry && (
            <Button size="xs" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={run.retry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResumeSelect({ value, onChange, optional, label = 'Resume' }: { value: string; onChange: (id: string) => void; optional?: boolean; label?: string }) {
  const list = useResumeList();
  const options = [...(optional || !list?.length ? [{ value: '', label: list === null ? 'Loading…' : list.length ? 'None' : 'No resumes yet' }] : []), ...(list ?? []).map((r) => ({ value: r.id, label: r.name || 'Untitled resume' }))];
  return <Select label={label} value={value} onChange={(e) => onChange(e.target.value)} options={options} disabled={!list?.length} />;
}

function NeedsKey({ apiKey }: { apiKey: string }) {
  if (apiKey.trim()) return null;
  return <p className="text-[12px] text-fg-subtle">Add your API key above to use this tool.</p>;
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-[var(--radius-panel)] border border-line bg-panel p-4 sm:p-5" aria-label={title}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

/* --------------------------- 1. Rewrite bullets ---------------------- */

export function RewriteBullets({ apiKey, model }: ToolProps) {
  const run = useAiRun(apiKey, model);
  const [source, setSource] = useState<'resume' | 'paste'>('resume');
  const [resumeId, setResumeId] = useState('');
  const [entryKey, setEntryKey] = useState('');
  const [pasted, setPasted] = useState('');
  const [tone, setTone] = useState<Tone>('impact');
  const [placeholders, setPlaceholders] = useState(true);
  const [ranWith, setRanWith] = useState<string[]>([]);
  const resolved = useResolvedResume(source === 'resume' ? resumeId : '');

  const entries = useMemo(
    () =>
      (resolved?.sections ?? []).flatMap((s) =>
        s.items.filter((i) => i.bullets.some((b) => b.trim())).map((i) => ({ key: `${s.id}:${i.id}`, label: `${s.title} · ${[i.title, i.subtitle].filter(Boolean).join(' — ') || 'Untitled'}`, item: i })),
      ),
    [resolved],
  );
  const entry = entries.find((e) => e.key === entryKey) ?? entries[0];
  const originals = source === 'resume' ? (entry?.item.bullets ?? []).map((b) => b.trim()).filter(Boolean) : splitBullets(pasted);
  const suggestions = parseBulletLines(run.text);
  // Keep the originals that were sent, so changing the picker doesn't misalign the result.
  const shown = run.status === 'idle' ? originals : ranWith;
  const rows = Math.max(shown.length, suggestions.length);

  const go = () => {
    const ctx = source === 'resume' && entry ? [entry.item.title, entry.item.subtitle, entry.item.date].filter(Boolean).join(' — ') : undefined;
    setRanWith(originals);
    void run.start(rewriteBulletsPrompt({ bullets: originals, tone, placeholders, ...(ctx ? { context: ctx } : {}) }));
  };

  return (
    <Panel title="Rewrite bullets" description="Get clearer, stronger wording for bullets you already have. Suggestions appear next to the original; copy the ones you like into your resume yourself. Nothing is changed automatically.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Segmented
            label="Bullets from"
            value={source}
            onChange={setSource}
            options={[
              { value: 'resume', label: 'A resume entry' },
              { value: 'paste', label: 'Paste text' },
            ]}
          />
          {source === 'resume' ? (
            <>
              <ResumeSelect value={resumeId} onChange={(id) => (setResumeId(id), setEntryKey(''))} optional />
              {resumeId && (
                <Select
                  label="Entry"
                  value={entry?.key ?? ''}
                  onChange={(e) => setEntryKey(e.target.value)}
                  disabled={!entries.length}
                  options={entries.length ? entries.map((e) => ({ value: e.key, label: e.label })) : [{ value: '', label: resolved ? 'No entries with bullets' : 'Loading…' }]}
                />
              )}
            </>
          ) : (
            <TextArea label="Bullets" rows={6} placeholder={'One bullet per line, e.g.\n- Built the checkout page in React\n- Worked with the design team on onboarding'} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          )}
        </div>
        <div className="space-y-3">
          <Segmented label="Tone" value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t.value, label: t.label, title: t.hint }))} />
          <p className="text-[11.5px] text-fg-subtle">{TONES.find((t) => t.value === tone)?.hint}</p>
          <Switch checked={placeholders} onChange={setPlaceholders} label="Add metric placeholders" help="Marks where a number would help, like [X%], instead of inventing one. Fill them in with your real figures." />
        </div>
      </div>
      <RunButton run={run} disabled={!apiKey.trim() || !originals.length} onRun={go}>
        Suggest rewrites
      </RunButton>
      <NeedsKey apiKey={apiKey} />

      {run.status !== 'idle' && (
        <div className="space-y-3">
          <div className="hidden grid-cols-2 gap-3 sm:grid">
            <SectionLabel>Original</SectionLabel>
            <SectionLabel>Suggestion</SectionLabel>
          </div>
          <ol className="space-y-2">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className="grid gap-2 rounded-lg border border-line bg-bg/60 p-3 sm:grid-cols-2 sm:gap-3">
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  <span className="mr-1 font-medium text-fg-subtle sm:hidden">Original:</span>
                  {shown[i] ?? '—'}
                </p>
                <div className="flex items-start gap-2 border-line max-sm:border-t max-sm:pt-2">
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed">{suggestions[i] ? <WithPlaceholders text={suggestions[i]} /> : <span className="text-fg-subtle">{run.running ? '…' : '—'}</span>}</p>
                  {suggestions[i] && !run.running && <CopyButton text={suggestions[i]} />}
                </div>
              </li>
            ))}
          </ol>
          <ResultBar run={run} copy={suggestions.map((s) => `- ${s}`).join('\n')} />
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------- 2. Cover letter ----------------------- */

export function CoverLetter({ apiKey, model }: ToolProps) {
  const navigate = useNavigate();
  const run = useAiRun(apiKey, model);
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [saving, setSaving] = useState(false);

  const go = async () => {
    const [profile, resolved] = await Promise.all([loadProfileText(), resumeId ? loadResolvedResume(resumeId) : Promise.resolve(null)]);
    void run.start(coverLetterPrompt({ jobDescription: jd, profile, resume: resolved ? resumeToText(resolved) : '', company: company.trim(), role: role.trim() }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await ensureWorkspace();
      const { profile, library } = useWorkspace.getState();
      const doc = newStudioDocument('cover-letter', profile, library);
      doc.letter = { ...doc.letter!, ...splitLetter(run.text), company: company.trim(), role: role.trim() };
      doc.name = company.trim() ? `Cover letter — ${company.trim()}` : 'Cover letter';
      const saved = await saveDocument(doc);
      toast({ tone: 'success', title: 'Cover letter created', description: 'Review it and fill in any [placeholders].' });
      navigate(`/document/${saved.id}`);
    } catch (err) {
      toast({ tone: 'error', title: 'Could not create the letter', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Draft a cover letter" description="Paste a job description. The draft uses your profile and the resume you pick, and marks anything it does not know with [placeholders].">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <TextArea label="Job description" rows={10} placeholder="Paste the full job posting" value={jd} onChange={(e) => setJd(e.target.value)} />
        <div className="space-y-3">
          <TextInput label="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
          <TextInput label="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
          <ResumeSelect value={resumeId} onChange={setResumeId} optional />
        </div>
      </div>
      <RunButton run={run} disabled={!apiKey.trim() || !jd.trim()} onRun={() => void go()}>
        Draft letter
      </RunButton>
      <NeedsKey apiKey={apiKey} />
      {run.status !== 'idle' && (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap rounded-lg border border-line bg-bg/60 p-4 text-[13.5px] leading-relaxed">{run.text ? <WithPlaceholders text={run.text} /> : <span className="text-fg-subtle">…</span>}</div>
          <ResultBar run={run} copy={run.text}>
            {run.status === 'done' && run.text.trim() && (
              <Button size="xs" variant="secondary" icon={<FilePlus2 className="size-3.5" />} iconRight={<ArrowRight className="size-3.5" />} loading={saving} onClick={() => void save()}>
                Save as new cover letter
              </Button>
            )}
          </ResultBar>
        </div>
      )}
    </Panel>
  );
}

/* --------------------------- 3. Summary variants --------------------- */

export function SummaryVariants({ apiKey, model }: ToolProps) {
  const run = useAiRun(apiKey, model);
  const [resumeId, setResumeId] = useState('');
  const [target, setTarget] = useState('');
  const variants = splitVariants(run.text);

  const go = async () => {
    const [profile, resolved] = await Promise.all([loadProfileText(), loadResolvedResume(resumeId)]);
    if (!resolved) return toast({ tone: 'error', title: 'That resume could not be loaded' });
    void run.start(summaryPrompt({ resume: resumeToText(resolved), profile, target: target.trim() }));
  };

  return (
    <Panel title="Professional summary" description="Three different summaries written from what is already in your resume. Copy the one you like into the Summary section.">
      <div className="grid gap-4 md:grid-cols-2">
        <ResumeSelect value={resumeId} onChange={setResumeId} optional />
        <TextInput label="Target role (optional)" placeholder="e.g. Senior frontend engineer" value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>
      <RunButton run={run} disabled={!apiKey.trim() || !resumeId} onRun={() => void go()}>
        Suggest summaries
      </RunButton>
      <NeedsKey apiKey={apiKey} />
      {run.status !== 'idle' && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            {(variants.length ? variants : ['']).map((v, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-bg/60 p-3">
                <SectionLabel action={v && !run.running ? <CopyButton text={v} /> : null}>Variant {i + 1}</SectionLabel>
                <p className="flex-1 text-[13px] leading-relaxed">{v ? <WithPlaceholders text={v} /> : <span className="text-fg-subtle">…</span>}</p>
              </div>
            ))}
          </div>
          <ResultBar run={run} />
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------- 4. Tailor tips ------------------------ */

/** Renders the "## heading / - bullet" answer as safe React elements (no HTML). */
function PlainMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {lines.map((raw, i) => {
        const line = raw.trim().replace(/\*\*(.+?)\*\*/g, '$1');
        if (!line) return null;
        const h = /^#{1,4}\s+(.*)$/.exec(line);
        if (h) return <h3 key={i} className={cn('text-[13.5px] font-semibold text-fg', i > 0 && 'pt-3')}>{h[1]}</h3>;
        const b = /^(?:[-*•]|\d{1,2}[.)])\s+(.*)$/.exec(line);
        if (b)
          return (
            <p key={i} className="relative pl-4 text-fg-muted before:absolute before:left-1 before:top-[0.6em] before:size-1 before:rounded-full before:bg-fg-subtle">
              {b[1]}
            </p>
          );
        return (
          <p key={i} className="text-fg-muted">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function TailorTips({ apiKey, model }: ToolProps) {
  const run = useAiRun(apiKey, model);
  const [jd, setJd] = useState('');
  const [resumeId, setResumeId] = useState('');

  const go = async () => {
    const [profile, resolved] = await Promise.all([loadProfileText(), loadResolvedResume(resumeId)]);
    if (!resolved) return toast({ tone: 'error', title: 'That resume could not be loaded' });
    void run.start(tailorPrompt({ jobDescription: jd, resume: resumeToText(resolved), profile }));
  };

  return (
    <Panel title="Tailor for a job" description="See which of your existing experience matches a job, what to emphasise and where the gaps are. Advice only — it never suggests claiming experience you do not have.">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <TextArea label="Job description" rows={10} placeholder="Paste the full job posting" value={jd} onChange={(e) => setJd(e.target.value)} />
        <ResumeSelect value={resumeId} onChange={setResumeId} optional />
      </div>
      <RunButton run={run} disabled={!apiKey.trim() || !jd.trim() || !resumeId} onRun={() => void go()}>
        Get tailoring tips
      </RunButton>
      <NeedsKey apiKey={apiKey} />
      {run.status !== 'idle' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-bg/60 p-4">{run.text ? <PlainMarkdown text={run.text} /> : <span className="text-[13px] text-fg-subtle">…</span>}</div>
          <ResultBar run={run} copy={run.text} />
        </div>
      )}
    </Panel>
  );
}
