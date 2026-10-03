import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, CircleHelp, Copy, FileText, Lightbulb, ListChecks, Plus, Target, X } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, Spinner } from '@/components/ui/Button';
import { Badge, Card, EmptyState, ProgressBar, SectionLabel } from '@/components/ui/misc';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { duplicateResume } from '@/studio/storage/repo';
import { useWorkspace } from '@/studio/store/workspace';
import { analyzeJobMatch, guessJobTitle, KIND_LABEL, type JobMatchResult, type KeywordResult } from '@/lib/writing/match';
import { KIND_WEIGHT, ZONE_WEIGHT } from '@/lib/writing/keywords';
import type { KeywordKind } from '@/lib/writing/dictionary';
import { readJobMatch, saveJobMatch, useResumeChoice } from './useResumeChoice';

const KINDS: KeywordKind[] = ['hard', 'tool', 'soft', 'other'];
const ZONE_LABEL = { required: 'Required', general: 'Mentioned', preferred: 'Nice to have' } as const;

export default function JobMatchPage() {
  const navigate = useNavigate();
  const choice = useResumeChoice();
  const { list, resume, resolved, resumeId } = choice;
  const library = useWorkspace((s) => s.library);
  const profile = useWorkspace((s) => s.profile);

  const [jd, setJd] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [copying, setCopying] = useState(false);
  const loadedFor = useRef<string | null>(null);


  // Restore the posting saved with this resume (keep the current text when there is none).
  useEffect(() => {
    if (!resume || loadedFor.current === resume.id) return;
    loadedFor.current = resume.id;
    const saved = readJobMatch(resume);
    if (saved) {
      setJd(saved.jd);
      setTitle(saved.title);
      setCompany(saved.company);
    }
  }, [resume]);

  // Persist (debounced) per resume.
  useEffect(() => {
    if (!resume || loadedFor.current !== resume.id) return;
    const saved = readJobMatch(resume);
    if ((saved?.jd ?? '') === jd && (saved?.title ?? '') === title && (saved?.company ?? '') === company) return;
    if (!saved && !jd.trim()) return;
    const id = resume.id;
    const t = setTimeout(() => void saveJobMatch(id, { jd, title, company }).catch(() => toast({ tone: 'error', title: 'Could not save the job description' })), 800);
    return () => clearTimeout(t);
  }, [jd, title, company, resume]);

  const deferredJd = useDeferredValue(jd);
  const result = useMemo<JobMatchResult | null>(() => (resolved && deferredJd.trim() ? analyzeJobMatch({ jd: deferredJd, title, company, resolved, library, profile }) : null), [resolved, deferredJd, title, company, library, profile]);
  const guessedTitle = useMemo(() => (title.trim() ? '' : guessJobTitle(jd)), [title, jd]);

  const createCopy = async () => {
    if (!resume) return;
    setCopying(true);
    try {
      const suffix = company.trim() || title.trim() || guessedTitle || 'tailored';
      const copy = await duplicateResume(resume.id, `${resume.name} – ${suffix}`);
      toast({ tone: 'success', title: 'Tailored copy created', description: `${copy.name}. The original is unchanged.` });
      navigate(`/resume/${copy.id}`);
    } catch (err) {
      toast({ tone: 'error', title: 'Could not copy the resume', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Resume Studio</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Job <span className="font-display font-normal italic">match</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Paste a job description to see which of its skills and keywords your resume covers, what's missing, and which of those you already have in your profile. Everything runs on this device.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={resumeId ? `/bullets?resume=${resumeId}` : '/bullets'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <ListChecks className="size-4" /> Check bullets
            </Link>
            <Link to="/resumes" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <FileText className="size-4" /> All resumes
            </Link>
          </div>
        </header>

        {list === null ? (
          <div className="mt-16 grid place-items-center text-fg-subtle" role="status" aria-label="Loading resumes">
            <Spinner className="size-5" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-3xl border border-dashed border-line py-16"
            icon={<Target className="size-5" />}
            title="Create a resume first"
            description="Job match compares a posting with one of your resumes."
            action={
              <Link to="/resumes/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
                <Plus className="size-4" /> New resume
              </Link>
            }
          />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="h-fit space-y-4 p-4 sm:p-5 lg:sticky lg:top-20">
              <Select label="Resume" value={resumeId ?? ''} onChange={(e) => choice.select(e.target.value)} options={list.map((r) => ({ value: r.id, label: r.name }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Job title" placeholder={guessedTitle || 'e.g. Senior Frontend Engineer'} value={title} onChange={(e) => setTitle(e.target.value)} help={guessedTitle && !title ? `Detected: ${guessedTitle}` : undefined} />
                <TextInput label="Company" placeholder="Optional" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <TextArea label="Job description" placeholder="Paste the full posting: responsibilities, requirements, nice-to-haves…" rows={14} value={jd} onChange={(e) => setJd(e.target.value)} help="Saved with this resume on this device, so it's still here when you come back." />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" icon={<Copy className="size-4" />} onClick={() => void createCopy()} loading={copying} disabled={!resume}>
                  Create tailored copy
                </Button>
                {resume && (
                  <Link to={`/resume/${resume.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-fg-muted hover:bg-hover hover:text-fg">
                    Open resume <ArrowRight className="size-3.5" />
                  </Link>
                )}
                {jd && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setJd('')}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[11.5px] leading-snug text-fg-subtle">A tailored copy duplicates this resume so you can edit it for this job. Nothing is added to it automatically.</p>
            </Card>

            <div className="min-w-0 space-y-5">
              {choice.loading && !resolved ? (
                <div className="grid place-items-center py-16 text-fg-subtle" role="status" aria-label="Loading resume">
                  <Spinner className="size-5" />
                </div>
              ) : !result ? (
                <EmptyState className="rounded-3xl border border-dashed border-line py-16" icon={<Target className="size-5" />} title="Paste a job description" description="You'll get a match score, matched and missing keywords grouped by type, title and seniority hints, and suggestions." />
              ) : (
                <Results result={result} resumeId={resume!.id} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function scoreTone(score: number): string {
  return score >= 75 ? 'text-ok' : score >= 50 ? 'text-warn' : 'text-danger';
}

function Results({ result, resumeId }: { result: JobMatchResult; resumeId: string }) {
  const [how, setHow] = useState(false);
  const missing = result.keywords.filter((k) => !k.matched);
  const matched = result.keywords.filter((k) => k.matched);
  const fromLibrary = missing.filter((k) => k.inLibrary.length);

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <SectionLabel>Match score</SectionLabel>
            <p className={cn('mt-1 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums', scoreTone(result.score))}>
              {result.score}
              <span className="text-[20px] text-fg-subtle">%</span>
            </p>
          </div>
          <div className="min-w-0 flex-1 basis-56">
            <ProgressBar value={result.score} label="Match score" className="mt-6" />
            <p className="mt-2 text-[12px] leading-relaxed text-fg-muted">{result.explanation.split(' → ')[0]}.</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {result.groups
            .filter((g) => g.total)
            .map((g) => (
              <li key={g.kind} className="rounded-xl border border-line bg-bg px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-medium">{KIND_LABEL[g.kind]}</span>
                  <span className="tabular-nums text-fg-muted">
                    {g.matched}/{g.total}
                  </span>
                </div>
                <ProgressBar value={g.weightTotal ? (g.weightMatched / g.weightTotal) * 100 : 0} className="mt-1.5 h-1" label={`${KIND_LABEL[g.kind]} coverage`} />
              </li>
            ))}
        </ul>
        <button type="button" onClick={() => setHow((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline" aria-expanded={how}>
          <CircleHelp className="size-3.5" /> How is this calculated?
        </button>
        {how && (
          <div className="mt-2 space-y-1.5 rounded-xl bg-hover/60 p-3 text-[12px] leading-relaxed text-fg-muted">
            <p>
              The score is <strong className="text-fg">weighted keyword coverage</strong>: the weight of keywords found in what this resume prints (headline, summary, entries, bullets, tags, skills), divided by the weight of all keywords in the posting.
            </p>
            <p>
              Each keyword's weight is its type ({KINDS.map((k) => `${KIND_LABEL[k].toLowerCase()} ${KIND_WEIGHT[k]}`).join(', ')}) × where it appears (requirements {ZONE_WEIGHT.required}, elsewhere {ZONE_WEIGHT.general}, nice-to-have {ZONE_WEIGHT.preferred}) × repetition (+20% per extra mention, up to +60%) × 1.3 if it's in the job title. Benefits and "about us" sections are ignored.
            </p>
            <p>Synonyms count as the same skill (JS = JavaScript, k8s = Kubernetes, Postgres = PostgreSQL), and plurals or -ing forms match. It's a guide to coverage, not a prediction of any employer's ATS.</p>
            <p className="text-fg">{result.explanation.split(' → ')[0]} → {result.score}%.</p>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionLabel>Suggestions</SectionLabel>
        <ul className="mt-3 space-y-2.5">
          {result.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
              <Lightbulb className={cn('mt-0.5 size-4 shrink-0', s.level === 'high' ? 'text-danger' : s.level === 'medium' ? 'text-warn' : 'text-fg-subtle')} aria-hidden="true" />
              <span className="min-w-0">{s.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <Link to={`/resume/${resumeId}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Edit this resume <ArrowRight className="size-3.5" />
          </Link>
          <span className="text-fg-subtle">·</span>
          <Link to={`/bullets?resume=${resumeId}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Check its bullets <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </Card>

      {fromLibrary.length > 0 && (
        <Card className="p-4 sm:p-5">
          <SectionLabel>Already in your profile, not in this resume</SectionLabel>
          <p className="mt-1 text-[12px] text-fg-muted">You can add these and stay accurate. Include the entry, bullet or skill in Resume Studio.</p>
          <ul className="mt-3 space-y-2">
            {fromLibrary.map((k) => (
              <li key={k.key} className="rounded-xl border border-line bg-bg px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">{k.label}</span>
                  <Badge tone={k.zone === 'required' ? 'warn' : 'neutral'}>{ZONE_LABEL[k.zone]}</Badge>
                  <Badge>{KIND_LABEL[k.kind]}</Badge>
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-[12px] text-fg-muted">
                  <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{k.inLibrary.slice(0, 3).join(' · ')}{k.inLibrary.length > 3 ? ` +${k.inLibrary.length - 3} more` : ''}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <SectionLabel>Missing keywords ({missing.length})</SectionLabel>
        {missing.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-muted">Every keyword we found is covered.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {KINDS.map((kind) => {
              const ks = missing.filter((k) => k.kind === kind);
              return ks.length ? <KeywordGroup key={kind} title={KIND_LABEL[kind]} items={ks} tone="missing" /> : null;
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionLabel>Matched keywords ({matched.length})</SectionLabel>
        {matched.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-muted">None yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {KINDS.map((kind) => {
              const ks = matched.filter((k) => k.kind === kind);
              return ks.length ? <KeywordGroup key={kind} title={KIND_LABEL[kind]} items={ks} tone="matched" /> : null;
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionLabel>Title, seniority &amp; experience</SectionLabel>
        <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
          <Fact label="Job title">{result.title?.jobTitle || <span className="text-fg-subtle">Not detected. Enter it on the left.</span>}</Fact>
          <Fact label="Title alignment">
            {result.title ? (
              <>
                <span className={cn('font-semibold tabular-nums', scoreTone(result.title.score))}>{result.title.score}%</span>
                {result.title.best && <span className="text-fg-muted"> vs “{result.title.best.text}” ({result.title.best.source.split(' · ')[0]})</span>}
                {result.title.missing.length > 0 && <span className="block text-[12px] text-fg-subtle">Missing words: {result.title.missing.join(', ')}</span>}
              </>
            ) : (
              <span className="text-fg-subtle">—</span>
            )}
          </Fact>
          <Fact label="Seniority">
            {result.title?.jobSeniority?.label ?? <span className="text-fg-subtle">Not stated in title</span>}
            {result.title?.resumeSeniority && <span className="text-fg-muted"> · yours: {result.title.resumeSeniority.label}</span>}
          </Fact>
          <Fact label="Years of experience">
            {result.years.required ? <>Asks for “{result.years.required.text}”</> : <span className="text-fg-subtle">No requirement found</span>}
            <span className="block text-[12px] text-fg-muted">
              Your dated experience: ~{(result.years.resumeMonths / 12).toFixed(1)} years{result.years.undated ? ` (${result.years.undated} undated role${result.years.undated === 1 ? '' : 's'})` : ''}
            </span>
          </Fact>
          {result.degree.required.length > 0 && (
            <Fact label="Education">
              Mentions {result.degree.required.join(' / ')}
              <span className="block text-[12px] text-fg-muted">{result.degree.resume.length ? `Your resume lists ${result.degree.resume.join(', ')}` : 'No matching degree found in this resume'}</span>
            </Fact>
          )}
        </dl>
      </Card>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-bg px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function KeywordGroup({ title, items, tone }: { title: string; items: KeywordResult[]; tone: 'missing' | 'matched' }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-fg-muted">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((k) => (
          <li
            key={k.key}
            title={`${ZONE_LABEL[k.zone]} · mentioned ${k.count}× · weight ${k.weight}${k.inLibrary.length ? ` · in your library: ${k.inLibrary.join(', ')}` : ''}`}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[12px]',
              tone === 'matched' ? 'border-ok/25 bg-ok/10 text-ok' : k.zone === 'required' ? 'border-danger/25 bg-danger/10 text-danger' : 'border-line bg-hover text-fg-muted',
            )}
          >
            {tone === 'matched' ? <Check className="size-3 shrink-0" aria-hidden="true" /> : <X className="size-3 shrink-0" aria-hidden="true" />}
            <span className="truncate">{k.label}</span>
            {k.zone === 'required' && tone === 'missing' && <span className="sr-only">(required)</span>}
            {k.inLibrary.length > 0 && <BookOpen className="size-3 shrink-0" aria-label="In your library" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
