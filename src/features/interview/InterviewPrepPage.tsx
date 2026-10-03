import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ChevronDown, Eye, EyeOff, Layers, ListChecks, MessagesSquare, Search, Shuffle } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, Spinner } from '@/components/ui/Button';
import { Badge, Card, EmptyState, ProgressBar } from '@/components/ui/misc';
import { Segmented, Select, TextArea } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { listApplications, type Application } from '@/lib/applications';
import {
  CATEGORY_LABELS,
  TARGET_SECONDS,
  answerWords,
  emptyAnswer,
  formatDuration,
  generateQuestions,
  hasAnswer,
  shuffle,
  speakingSeconds,
  type AnswerMap,
  type InterviewQuestion,
  type QuestionCategory,
  type StarAnswer,
} from '@/lib/interview/questions';
import { loadAnswers, saveAnswers } from '@/lib/interview/answers';
import { resolveResume } from '@/studio/model/resolve';
import { createResume } from '@/studio/model/defaults';
import type { ResumeDoc } from '@/studio/model/types';
import { getResume } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { useStudioDocs } from '@/features/applications/shared';

type Mode = 'practice' | 'flashcards';
type CategoryFilter = 'all' | QuestionCategory;
type StateFilter = 'all' | 'unanswered' | 'shaky' | 'confident';

const STAR_FIELDS: Array<{ key: 'situation' | 'task' | 'action' | 'result'; label: string; placeholder: string }> = [
  { key: 'situation', label: 'Situation', placeholder: 'Context: where, when, what was going on?' },
  { key: 'task', label: 'Task', placeholder: 'Your responsibility or the goal.' },
  { key: 'action', label: 'Action', placeholder: 'What you did — specific steps, decisions, “I” not “we”.' },
  { key: 'result', label: 'Result', placeholder: 'Outcome with numbers, and what you learned.' },
];

const CONFIDENCE = [
  { value: 1, label: 'Shaky' },
  { value: 2, label: 'Okay' },
  { value: 3, label: 'Confident' },
] as const;

export default function InterviewPrepPage() {
  const [params, setParams] = useSearchParams();
  const applicationId = params.get('application') ?? '';
  const resumeParam = params.get('resume') ?? '';
  const mode: Mode = params.get('mode') === 'flashcards' ? 'flashcards' : 'practice';
  const setParam = useCallback(
    (key: string, value: string) =>
      setParams(
        (p) => {
          if (value) p.set(key, value);
          else p.delete(key);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [wsReady, setWsReady] = useState(false);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [resumeDoc, setResumeDoc] = useState<ResumeDoc | null>(null);
  const [answers, setAnswers] = useState<AnswerMap | null>(null);
  const docs = useStudioDocs();

  useEffect(() => {
    void ensureWorkspace().then(() => setWsReady(true));
    void listApplications()
      .then(setApps)
      .catch(() => setApps([]));
    void loadAnswers()
      .then(setAnswers)
      .catch(() => setAnswers({}));
  }, []);

  const application = apps?.find((a) => a.id === applicationId) ?? null;
  // An explicit ?resume wins; otherwise the resume linked to the application; otherwise the whole profile.
  const resumeId = resumeParam || application?.resumeId || '';

  useEffect(() => {
    let alive = true;
    if (!resumeId) {
      setResumeDoc(null);
      return;
    }
    void getResume(resumeId).then((r) => alive && setResumeDoc(r));
    return () => {
      alive = false;
    };
  }, [resumeId]);

  const profileResume = useMemo(() => createResume('Profile'), []);
  const questions = useMemo(() => {
    if (!wsReady) return null;
    const resolved = resolveResume(resumeDoc ?? profileResume, library, profile);
    return generateQuestions(resolved, application ? { company: application.company, role: application.role, jobDescription: application.jobDescription } : {});
  }, [wsReady, resumeDoc, profileResume, library, profile, application]);

  /* answers: debounced save */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AnswerMap>({});
  const flush = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    void saveAnswers(latest.current).catch((err) => toast({ tone: 'error', title: 'Could not save answers', description: err instanceof Error ? err.message : String(err) }));
  }, []);
  useEffect(() => () => flush(), [flush]);
  const updateAnswer = useCallback(
    (id: string, patch: Partial<StarAnswer>) => {
      setAnswers((prev) => {
        const map = prev ?? {};
        const next: AnswerMap = { ...map, [id]: { ...(map[id] ?? emptyAnswer()), ...patch, updatedAt: new Date().toISOString() } };
        latest.current = next;
        return next;
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void saveAnswers(latest.current);
      }, 500);
    },
    [],
  );

  /* filters */
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!questions || !answers) return [];
    const q = query.trim().toLowerCase();
    return questions.filter((x) => {
      if (category !== 'all' && x.category !== category) return false;
      const a = answers[x.id];
      if (stateFilter === 'unanswered' && hasAnswer(a)) return false;
      if (stateFilter === 'shaky' && (a?.confidence ?? 0) >= 2) return false;
      if (stateFilter === 'confident' && a?.confidence !== 3) return false;
      return !q || `${x.text} ${x.source} ${x.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [questions, answers, category, stateFilter, query]);

  const counts = useMemo(() => {
    const c: Record<CategoryFilter, number> = { all: 0, experience: 0, project: 0, skill: 0, general: 0, company: 0 };
    for (const x of questions ?? []) {
      c.all++;
      c[x.category]++;
    }
    return c;
  }, [questions]);
  const answered = questions && answers ? questions.filter((x) => hasAnswer(answers[x.id])).length : 0;
  const confident = questions && answers ? questions.filter((x) => answers[x.id]?.confidence === 3).length : 0;

  const loading = !questions || !answers || apps === null;

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Job search</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Interview <span className="font-display font-normal italic">prep</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Likely questions built from your own experience, projects and skills — and the job you’re applying for. Draft STAR answers, rate your confidence and drill with flashcards. Nothing leaves this browser.</p>
          </div>
          <Link to="/applications" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
            <BriefcaseBusiness className="size-4" /> Applications
          </Link>
        </header>

        <Card className="mt-6 grid gap-3 p-4 sm:grid-cols-2">
          <Select
            label="Preparing for"
            value={applicationId}
            onChange={(e) => setParam('application', e.target.value)}
            options={[{ value: '', label: 'No specific application' }, ...(apps ?? []).map((a) => ({ value: a.id, label: [a.company || 'Untitled', a.role].filter(Boolean).join(' — ') }))]}
            help={application ? <Link to={`/applications/${application.id}`} className="text-accent hover:underline">Open application →</Link> : 'Adds “why this company” and job-description questions.'}
          />
          <Select
            label="Questions from"
            value={resumeParam || (application?.resumeId && docs.resumes.some((r) => r.id === application.resumeId) ? application.resumeId : '')}
            onChange={(e) => setParam('resume', e.target.value)}
            options={[{ value: '', label: application?.resumeId ? 'Resume linked to the application' : 'Whole profile & library' }, ...docs.resumes.map((r) => ({ value: r.id, label: r.name }))]}
            help={resumeId && resumeDoc ? <Link to={`/resume/${resumeDoc.id}`} className="text-accent hover:underline">Open resume →</Link> : 'Uses every role, project and skill in your library.'}
          />
        </Card>

        {loading ? (
          <div className="grid place-items-center py-24 text-fg-subtle" role="status" aria-label="Loading questions">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-[220px] flex-1">
                <div className="flex justify-between text-[12px] text-fg-muted">
                  <span>
                    {answered} of {questions.length} answered
                  </span>
                  <span>{confident} confident</span>
                </div>
                <ProgressBar className="mt-1.5" value={questions.length ? (answered / questions.length) * 100 : 0} label="Questions answered" />
              </div>
              <Segmented
                className="w-[240px]"
                value={mode}
                onChange={(m) => setParam('mode', m === 'practice' ? '' : m)}
                options={[
                  { value: 'practice', label: <><ListChecks className="size-3.5" /> Write</> },
                  { value: 'flashcards', label: <><Layers className="size-3.5" /> Flashcards</> },
                ]}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Category">
              {(['all', 'company', 'experience', 'project', 'skill', 'general'] as CategoryFilter[])
                .filter((c) => c === 'all' || counts[c] > 0)
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors', category === c ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-panel text-fg-muted hover:text-fg')}
                  >
                    {c === 'all' ? 'All' : CATEGORY_LABELS[c]} <span className="tabular-nums opacity-70">{counts[c]}</span>
                  </button>
                ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Search questions</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                <input className="app-input pl-8" type="search" placeholder="Search questions…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <Select
                className="w-[190px]"
                aria-label="Filter by progress"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as StateFilter)}
                options={[
                  { value: 'all', label: 'All questions' },
                  { value: 'unanswered', label: 'Not answered yet' },
                  { value: 'shaky', label: 'Needs practice' },
                  { value: 'confident', label: 'Confident' },
                ]}
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState className="mt-8 rounded-3xl border border-dashed border-line py-14" icon={<MessagesSquare className="size-5" />} title="No questions match" description="Try another category or filter. Add experience, projects and skills to your profile for more tailored questions." action={<Link to="/profile" className="text-[13px] text-accent hover:underline">Edit profile →</Link>} />
            ) : mode === 'practice' ? (
              <ul className="mt-5 space-y-2.5">
                {filtered.map((q) => (
                  <QuestionItem key={q.id} q={q} answer={answers[q.id]} onChange={(p) => updateAnswer(q.id, p)} />
                ))}
              </ul>
            ) : (
              <Flashcards key={`${category}-${stateFilter}-${query}`} questions={filtered} answers={answers} onRate={(id, c) => updateAnswer(id, { confidence: c })} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------------------ practice ------------------------------ */

function Confidence({ value, onChange, size = 'sm' }: { value: StarAnswer['confidence']; onChange: (v: StarAnswer['confidence']) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label="Confidence" className="inline-flex gap-1">
      {CONFIDENCE.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          onClick={() => onChange(value === c.value ? 0 : c.value)}
          className={cn(
            'rounded-md border font-medium transition-colors',
            size === 'md' ? 'h-9 px-3.5 text-[13px]' : 'h-7 px-2.5 text-[12px]',
            value === c.value ? (c.value === 3 ? 'border-ok/40 bg-ok/10 text-ok' : c.value === 2 ? 'border-accent/40 bg-accent-soft text-accent' : 'border-warn/40 bg-warn/10 text-warn') : 'border-line bg-panel text-fg-muted hover:text-fg',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function confidenceBadge(c: number | undefined) {
  if (c === 3) return <Badge tone="ok">Confident</Badge>;
  if (c === 2) return <Badge tone="accent">Okay</Badge>;
  if (c === 1) return <Badge tone="warn">Shaky</Badge>;
  return null;
}

function SpeakingTime({ words }: { words: number }) {
  const secs = speakingSeconds(words);
  const over = secs > TARGET_SECONDS * 1.25;
  return (
    <div className="min-w-[180px] flex-1">
      <div className="flex justify-between text-[11.5px] text-fg-subtle">
        <span>
          {words} words · ~{formatDuration(secs)} spoken
        </span>
        <span className={cn(over && 'text-warn')}>{over ? 'Too long — trim it' : `target ${formatDuration(TARGET_SECONDS)}`}</span>
      </div>
      <ProgressBar className="mt-1" value={(secs / TARGET_SECONDS) * 100} label="Speaking time against a two-minute target" />
    </div>
  );
}

function QuestionItem({ q, answer, onChange }: { q: InterviewQuestion; answer: StarAnswer | undefined; onChange: (p: Partial<StarAnswer>) => void }) {
  const [open, setOpen] = useState(false);
  const a = answer ?? emptyAnswer();
  const words = answerWords(a);
  return (
    <li className="rounded-2xl border border-line bg-panel">
      <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-snug">{q.text}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-subtle">
            <span>{CATEGORY_LABELS[q.category]}</span>
            <span>·</span>
            <span className="truncate">{q.source}</span>
            {words > 0 && (
              <>
                <span>·</span>
                <span>
                  {words} words · ~{formatDuration(speakingSeconds(words))}
                </span>
              </>
            )}
            {confidenceBadge(a.confidence)}
          </p>
        </div>
        <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <p className="rounded-lg bg-hover px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
            <strong className="text-fg">Tip:</strong> {q.hint}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {STAR_FIELDS.map((f) => (
              <TextArea key={f.key} label={f.label} rows={3} value={a[f.key]} placeholder={f.placeholder} onChange={(e) => onChange({ [f.key]: e.target.value })} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <SpeakingTime words={words} />
            <Confidence value={a.confidence} onChange={(c) => onChange({ confidence: c })} />
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------ flashcards ------------------------------ */

function Flashcards({ questions, answers, onRate }: { questions: InterviewQuestion[]; answers: AnswerMap; onRate: (id: string, c: StarAnswer['confidence']) => void }) {
  const [seed, setSeed] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const deck = useMemo(() => (seed === null ? questions : shuffle(questions, seed)), [questions, seed]);
  const i = Math.min(index, deck.length - 1);
  const q = deck[i]!;
  const a = answers[q.id];

  const go = useCallback(
    (d: number) => {
      setIndex((x) => (Math.min(x, deck.length - 1) + d + deck.length) % deck.length);
      setRevealed(false);
    },
    [deck.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' && t?.tagName !== 'BUTTON') {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <section className="mt-6" aria-label="Flashcards">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-fg-muted">
        <span className="tabular-nums" aria-live="polite">
          Card {i + 1} of {deck.length}
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={<Shuffle className="size-3.5" />}
          onClick={() => {
            setSeed(Math.floor(Math.random() * 2 ** 31));
            setIndex(0);
            setRevealed(false);
          }}
        >
          Shuffle
        </Button>
      </div>
      <Card className="mt-2 flex min-h-[320px] flex-col p-5 sm:p-8">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-accent">
          {CATEGORY_LABELS[q.category]} <span className="normal-case tracking-normal text-fg-subtle">· {q.source}</span>
        </p>
        <h2 className="mt-3 text-[clamp(1.15rem,2.6vw,1.5rem)] font-semibold leading-snug tracking-[-0.01em]">{q.text}</h2>
        {revealed ? (
          <div className="mt-5 flex-1 space-y-3 text-[13.5px] leading-relaxed">
            {hasAnswer(a) ? (
              STAR_FIELDS.filter((f) => a![f.key].trim()).map((f) => (
                <p key={f.key}>
                  <strong className="mr-1.5 text-[11.5px] uppercase tracking-[0.1em] text-fg-subtle">{f.label}</strong>
                  <span className="whitespace-pre-wrap">{a![f.key]}</span>
                </p>
              ))
            ) : (
              <p className="text-fg-muted">
                No answer written yet. <span className="text-fg-subtle">Tip: {q.hint}</span>
              </p>
            )}
            {hasAnswer(a) && <p className="text-[12px] text-fg-subtle">~{formatDuration(speakingSeconds(answerWords(a!)))} spoken</p>}
          </div>
        ) : (
          <p className="mt-5 flex-1 text-[13px] text-fg-subtle">Answer out loud, then reveal your notes. Aim for about two minutes.</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant={revealed ? 'secondary' : 'primary'} icon={revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />} onClick={() => setRevealed((r) => !r)}>
            {revealed ? 'Hide answer' : 'Reveal answer'}
          </Button>
          {revealed && <Confidence size="md" value={a?.confidence ?? 0} onChange={(c) => onRate(q.id, c)} />}
        </div>
      </Card>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button icon={<ArrowLeft className="size-4" />} onClick={() => go(-1)} disabled={deck.length < 2}>
          Previous
        </Button>
        <span className="hidden text-[11.5px] text-fg-subtle sm:inline">← → to move · Space to reveal</span>
        <Button iconRight={<ArrowRight className="size-4" />} onClick={() => go(1)} disabled={deck.length < 2}>
          Next
        </Button>
      </div>
    </section>
  );
}
