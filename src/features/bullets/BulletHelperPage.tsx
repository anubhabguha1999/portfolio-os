import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FileText, ListChecks, PencilLine, Plus, Target } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Spinner } from '@/components/ui/Button';
import { Badge, Card, EmptyState, ProgressBar, SectionLabel } from '@/components/ui/misc';
import { Segmented, Select, Switch, TextArea } from '@/components/ui/Field';
import { cn } from '@/utils/cn';
import { analyzeBullets, MAX_WORDS, resumeBullets, RULE_LABEL, type BulletReport, type BulletRule, type BulletSummary, type ResumeBullet } from '@/lib/writing/bullets';
import { splitBullets } from '@/lib/writing/text';
import { useResumeChoice } from '@/features/match/useResumeChoice';

type Mode = 'resume' | 'text';
type Filter = 'all' | 'issues';

const TEXT_KEY = 'portfolio-os:bullet-helper:text';

function readDraft(): string {
  try {
    return localStorage.getItem(TEXT_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(v: string) {
  try {
    localStorage.setItem(TEXT_KEY, v);
  } catch {
    /* storage unavailable — draft just isn't remembered */
  }
}

export default function BulletHelperPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'text' ? 'text' : 'resume';
  const setMode = (m: Mode) =>
    setParams(
      (p) => {
        if (m === 'text') p.set('mode', 'text');
        else p.delete('mode');
        return p;
      },
      { replace: true },
    );
  const choice = useResumeChoice(mode === 'resume');
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState(readDraft);
  const [current, setCurrent] = useState(false);

  useEffect(() => writeDraft(text), [text]);

  const fromResume = useMemo(() => (choice.resolved ? resumeBullets(choice.resolved) : []), [choice.resolved]);
  const resumeSummary = useMemo(() => analyzeBullets(fromResume), [fromResume]);
  const deferredText = useDeferredValue(text);
  const textSummary = useMemo(() => analyzeBullets(splitBullets(deferredText).map((t, i) => ({ id: `t${i}`, text: t, groupId: 'pasted', ...(current ? { current: true } : {}) }))), [deferredText, current]);

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Resume Studio</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Bullet <span className="font-display font-normal italic">helper</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Checks every bullet as it prints for weak openers, missing numbers, length, repeated verbs, tense, pronouns, filler and passive voice. These are rule-based checks that run on this device.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={choice.resumeId && mode === 'resume' ? `/match?resume=${choice.resumeId}` : '/match'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <Target className="size-4" /> Match to a job
            </Link>
            <Link to="/resumes" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <FileText className="size-4" /> All resumes
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card className="h-fit space-y-4 p-4 sm:p-5 lg:sticky lg:top-20">
            <Segmented<Mode>
              label="Check"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'resume', label: 'A resume' },
                { value: 'text', label: 'Pasted text' },
              ]}
            />
            {mode === 'resume' ? (
              choice.list === null ? (
                <div className="grid place-items-center py-6 text-fg-subtle" role="status" aria-label="Loading resumes">
                  <Spinner />
                </div>
              ) : choice.list.length === 0 ? (
                <p className="text-[12.5px] text-fg-muted">
                  No resumes yet.{' '}
                  <Link to="/resumes/new" className="text-accent hover:underline">
                    Create one
                  </Link>{' '}
                  or paste bullets instead.
                </p>
              ) : (
                <Select label="Resume" value={choice.resumeId ?? ''} onChange={(e) => choice.select(e.target.value)} options={choice.list.map((r) => ({ value: r.id, label: r.name }))} />
              )
            ) : (
              <>
                <TextArea label="Bullets" rows={12} placeholder={'One bullet per line, e.g.\n• Responsible for the checkout page\n• Cut page load time by 40% by lazy-loading images'} value={text} onChange={(e) => setText(e.target.value)} help="List markers (•, -, *, 1.) are removed. Your text stays in this browser." />
                <Switch checked={current} onChange={setCurrent} label="These are from my current role" help="Present tense is fine for a current role. Otherwise the checks only look for mixed tenses." />
              </>
            )}
            {mode === 'resume' ? <Overview summary={resumeSummary} /> : textSummary.bullets.length > 0 && <Overview summary={textSummary} />}
          </Card>

          <div className="min-w-0 space-y-4">
            {mode === 'resume' && (choice.list?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented<Filter>
                  className="w-56"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'All bullets' },
                    { value: 'issues', label: 'Needs work' },
                  ]}
                />
                {choice.resumeId && (
                  <Link to={`/resume/${choice.resumeId}`} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                    <PencilLine className="size-3.5" /> Open in Resume Studio
                  </Link>
                )}
              </div>
            )}
            {mode === 'resume' ? (
              choice.list && choice.list.length === 0 ? (
                <EmptyState
                  className="rounded-3xl border border-dashed border-line py-16"
                  icon={<ListChecks className="size-5" />}
                  title="No resumes yet"
                  description="Create a resume, or switch to “Pasted text” to check bullets from anywhere."
                  action={
                    <Link to="/resumes/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
                      <Plus className="size-4" /> New resume
                    </Link>
                  }
                />
              ) : choice.loading ? (
                <div className="grid place-items-center py-16 text-fg-subtle" role="status" aria-label="Loading resume">
                  <Spinner className="size-5" />
                </div>
              ) : fromResume.length === 0 ? (
                <EmptyState className="rounded-3xl border border-dashed border-line py-16" icon={<ListChecks className="size-5" />} title="This resume has no bullets" description="Add achievements to your experience or bullets to your projects in Resume Studio." />
              ) : (
                <ResumeList bullets={fromResume} summary={resumeSummary} resumeId={choice.resumeId!} filter={filter} />
              )
            ) : textSummary.bullets.length === 0 ? (
              <EmptyState className="rounded-3xl border border-dashed border-line py-16" icon={<ListChecks className="size-5" />} title="Paste some bullets" description="Each line is checked on its own and against the others (repeated verbs, mixed tenses)." />
            ) : (
              <ul className="space-y-3">
                {textSummary.bullets.map((b) => (
                  <BulletCard key={b.id} report={b} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function scoreTone(score: number) {
  return score >= 80 ? 'ok' : score >= 55 ? 'warn' : 'danger';
}

function Overview({ summary }: { summary: BulletSummary }) {
  const rules = Object.entries(summary.counts).sort((a, b) => b[1] - a[1]) as Array<[BulletRule, number]>;
  const clean = summary.bullets.filter((b) => b.findings.length === 0).length;
  if (!summary.bullets.length) return null;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionLabel>Overall</SectionLabel>
          <p className={cn('mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums', { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' }[scoreTone(summary.score)])}>
            {summary.score}
            <span className="text-[16px] text-fg-subtle">/100</span>
          </p>
        </div>
        <p className="text-right text-[12px] text-fg-muted">
          {summary.bullets.length} bullet{summary.bullets.length === 1 ? '' : 's'} · {clean} with no issues
        </p>
      </div>
      <ProgressBar value={summary.score} label="Overall bullet score" />
      {rules.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {rules.map(([rule, n]) => (
            <li key={rule}>
              <Badge tone={rule === 'weak-opener' || rule === 'passive' || rule === 'too-long' ? 'warn' : 'neutral'}>
                {RULE_LABEL[rule]} · {n}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {summary.repeatedVerbs.length > 0 && (
        <p className="text-[12px] text-fg-muted">
          Most-used openers: {summary.repeatedVerbs.map((v) => `${v.verb} (${v.count}×)`).join(', ')}
        </p>
      )}
      <p className="text-[11.5px] leading-snug text-fg-subtle">Each bullet starts at 100 and loses points per issue (weak opener 25, passive or too long 15, no metric 15, others 5–10). The overall score is the average. Aim for under {MAX_WORDS} words and a number in most bullets.</p>
    </div>
  );
}

function ResumeList({ bullets, summary, resumeId, filter }: { bullets: ResumeBullet[]; summary: BulletSummary; resumeId: string; filter: Filter }) {
  const byId = new Map(summary.bullets.map((b) => [b.id, b]));
  const groups: Array<{ key: string; label: string; section: string; items: Array<{ b: ResumeBullet; r: BulletReport }> }> = [];
  for (const b of bullets) {
    const r = byId.get(b.id)!;
    if (filter === 'issues' && r.score >= 80) continue;
    let g = groups.find((x) => x.key === b.itemId);
    if (!g) groups.push((g = { key: b.itemId, label: b.itemLabel, section: b.sectionTitle, items: [] }));
    g.items.push({ b, r });
  }
  if (!groups.length) return <EmptyState className="rounded-3xl border border-dashed border-line py-12" icon={<ListChecks className="size-5" />} title="Nothing needs work" description="Every bullet scores 80 or more." />;
  const edit = `/resume/${resumeId}`;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="min-w-0 text-[14px] font-semibold">
              <span className="text-fg-subtle">{g.section} · </span>
              {g.label}
            </h2>
            <Link to={edit} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
              Edit <ArrowRight className="size-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {g.items.map(({ b, r }) => (
              <BulletCard key={b.id} report={r} editTo={edit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BulletCard({ report, editTo }: { report: BulletReport; editTo?: string }) {
  const tone = scoreTone(report.score);
  return (
    <li className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-full border px-1.5 text-[11.5px] font-semibold tabular-nums', tone === 'ok' ? 'border-ok/25 bg-ok/10 text-ok' : tone === 'warn' ? 'border-warn/25 bg-warn/10 text-warn' : 'border-danger/25 bg-danger/10 text-danger')} aria-label={`Score ${report.score} of 100`}>
          {report.score}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13.5px] leading-relaxed">{report.text}</p>
          <p className="mt-0.5 text-[11px] text-fg-subtle">{report.words} words</p>
        </div>
      </div>
      {report.findings.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {report.findings.map((f, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Badge tone={f.level === 'warn' ? 'warn' : 'neutral'}>{RULE_LABEL[f.rule]}</Badge>
                <span className="min-w-0 flex-1 basis-60 text-fg-muted">{f.message}</span>
                {editTo && (
                  <Link to={editTo} className="shrink-0 text-[12px] font-medium text-accent hover:underline">
                    Jump to edit
                  </Link>
                )}
              </div>
              {f.suggestions && f.suggestions.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-fg-subtle">
                  Try:
                  {f.suggestions.map((s) => (
                    <span key={s} className="rounded-md border border-line bg-bg px-1.5 py-0.5 text-fg">
                      {s}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
