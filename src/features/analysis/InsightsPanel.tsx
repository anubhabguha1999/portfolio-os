// CONTRACT (owned by the analysis workstream).
import { useDeferredValue, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, ChevronRight, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import type { Portfolio } from '@/types/portfolio';
import type { AnalysisReport, CheckResult, CheckStatus, PortfolioInsights } from '@/lib/analysis';
import { analyzePortfolio } from '@/lib/analysis';
import { useAssets } from '@/stores/assets';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Spinner } from '@/components/ui/Button';

export interface InsightsPanelProps {
  portfolio: Portfolio;
  /** Jump to a section in the builder. */
  onSelectSection: (sectionId: string) => void;
}

type TabId = 'accessibility' | 'performance' | 'content';
const TABS: Array<{ id: TabId; label: string; short: string }> = [
  { id: 'accessibility', label: 'Accessibility', short: 'A11y' },
  { id: 'performance', label: 'Performance', short: 'Perf' },
  { id: 'content', label: 'Content', short: 'Content' },
];

const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

function tone(score: number): 'ok' | 'warn' | 'danger' {
  return score >= 90 ? 'ok' : score >= 70 ? 'warn' : 'danger';
}

const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' } as const;
const TONE_STROKE = { ok: 'stroke-ok', warn: 'stroke-warn', danger: 'stroke-danger' } as const;

function ScoreRing({ score, label, active, onClick }: { score: number; label: string; active: boolean; onClick: () => void }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const t = tone(score);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${score} out of 100`}
      className={cn('flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors', active ? 'border-line-strong bg-elevated' : 'border-transparent hover:bg-hover')}
    >
      <span className="relative grid size-11 place-items-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-line" />
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" className={cn(TONE_STROKE[t], 'transition-[stroke-dashoffset] duration-500')} strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
        </svg>
        <span className={cn('text-[13px] font-semibold tabular-nums', TONE_TEXT[t])}>{score}</span>
      </span>
      <span className="truncate text-[11.5px] font-medium text-fg-muted">{label}</span>
    </button>
  );
}

function StatusIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const cls = cn('size-4 shrink-0', className);
  switch (status) {
    case 'pass':
      return <CircleCheck className={cn(cls, 'text-ok')} aria-label="Passed" />;
    case 'warn':
      return <TriangleAlert className={cn(cls, 'text-warn')} aria-label="Warning" />;
    case 'fail':
      return <CircleX className={cn(cls, 'text-danger')} aria-label="Failed" />;
    case 'info':
      return <Info className={cn(cls, 'text-fg-subtle')} aria-label="Information" />;
  }
}

function CheckRow({ check, onSelectSection, sectionName }: { check: CheckResult; onSelectSection: (id: string) => void; sectionName: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const items = check.items ?? [];
  const expandable = Boolean(check.detail || items.length);
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <StatusIcon status={check.status} className="mt-0.5" />
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={expandable ? open : undefined} aria-controls={expandable ? id : undefined} onClick={() => expandable && setOpen((o) => !o)}>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-fg">{check.label}</span>
            {items.length > 0 && check.status !== 'pass' && <span className="rounded-full bg-hover px-1.5 text-[10.5px] font-semibold tabular-nums text-fg-muted">{items.length}</span>}
            {expandable && <ChevronRight className={cn('ml-auto size-3.5 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} aria-hidden="true" />}
          </span>
          {!open && check.detail && <span className="mt-0.5 block truncate text-[12px] text-fg-subtle">{check.detail}</span>}
        </button>
        {check.sectionId && (
          <button
            type="button"
            onClick={() => onSelectSection(check.sectionId!)}
            className="mt-px grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg"
            aria-label={`Go to ${sectionName(check.sectionId) || 'section'}`}
            title={`Go to ${sectionName(check.sectionId) || 'section'}`}
          >
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div id={id} className="pb-3 pl-9 pr-3">
          {check.detail && <p className="text-[12px] leading-relaxed text-fg-muted">{check.detail}</p>}
          {items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {items.map((it, i) => (
                <li key={i}>
                  {it.sectionId ? (
                    <button type="button" onClick={() => onSelectSection(it.sectionId!)} className="group flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] leading-snug text-fg-muted hover:bg-hover hover:text-fg">
                      <span className="mt-[5px] size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden="true" />
                      <span className="min-w-0 flex-1 break-words">{it.message}</span>
                      <ArrowUpRight className="mt-0.5 size-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                    </button>
                  ) : (
                    <p className="flex items-start gap-1.5 px-1.5 py-1 text-[12px] leading-snug text-fg-muted">
                      <span className="mt-[5px] size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden="true" />
                      <span className="min-w-0 flex-1 break-words">{it.message}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ReportList({ report, onSelectSection, sectionName }: { report: AnalysisReport; onSelectSection: (id: string) => void; sectionName: (id: string) => string }) {
  const [showPassed, setShowPassed] = useState(false);
  const sorted = [...report.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const issues = sorted.filter((c) => c.status === 'fail' || c.status === 'warn');
  const rest = sorted.filter((c) => c.status === 'pass' || c.status === 'info');
  return (
    <div className="space-y-2">
      {issues.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/10 px-3 py-2.5 text-[12.5px] text-fg">
          <CircleCheck className="size-4 shrink-0 text-ok" aria-hidden="true" />
          No issues — all {report.checks.length} checks passed.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-panel" aria-label={`${report.title} issues`}>
          {issues.map((c) => (
            <CheckRow key={c.id} check={c} onSelectSection={onSelectSection} sectionName={sectionName} />
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <>
          <button type="button" onClick={() => setShowPassed((v) => !v)} aria-expanded={showPassed} className="flex items-center gap-1 px-1 text-[12px] font-medium text-fg-subtle hover:text-fg-muted">
            <ChevronRight className={cn('size-3.5 transition-transform', showPassed && 'rotate-90')} aria-hidden="true" />
            {rest.length} passed {rest.length === 1 ? 'check' : 'checks'}
          </button>
          {showPassed && (
            <ul className="overflow-hidden rounded-xl border border-line bg-panel">
              {rest.map((c) => (
                <CheckRow key={c.id} check={c} onSelectSection={onSelectSection} sectionName={sectionName} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-bg/40 px-2.5 py-2">
      <dt className="truncate text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function compute(p: Portfolio, meta: Parameters<typeof analyzePortfolio>[1]): { ok: true; insights: PortfolioInsights } | { ok: false; error: string } {
  try {
    return { ok: true, insights: analyzePortfolio(p, meta) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Live accessibility / performance / content insights for the portfolio being edited. */
export function InsightsPanel({ portfolio, onSelectSection }: InsightsPanelProps) {
  const meta = useAssets((s) => s.meta);
  // Typing updates the portfolio on every keystroke; analysis runs on a deferred copy so input stays responsive.
  const deferred = useDeferredValue(portfolio);
  const deferredMeta = useDeferredValue(meta);
  const result = useMemo(() => compute(deferred, deferredMeta), [deferred, deferredMeta]);
  const stale = deferred !== portfolio || deferredMeta !== meta;
  const [tab, setTab] = useState<TabId>('accessibility');
  const tabsId = useId();

  const sectionName = (id: string) => portfolio.sections.find((s) => s.id === id)?.name ?? '';

  if (!result.ok) {
    return (
      <div className="p-4 text-[13px]" role="alert">
        <p className="font-medium text-fg">Insights are unavailable</p>
        <p className="mt-1 text-fg-muted">{result.error}</p>
      </div>
    );
  }
  const { insights } = result;
  const a = insights.analytics;
  const reports: Record<TabId, AnalysisReport> = { accessibility: insights.accessibility, performance: insights.performance, content: insights.content };
  const current = reports[tab];

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const t = TABS[next]!;
    setTab(t.id);
    document.getElementById(`${tabsId}-tab-${t.id}`)?.focus();
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 text-[13px]" aria-busy={stale}>
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-fg">Insights</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle" aria-live="polite">
          {stale ? (
            <>
              <Spinner className="size-3" /> Updating
            </>
          ) : (
            'Checked locally · nothing leaves your browser'
          )}
        </span>
      </div>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <ScoreRing key={t.id} score={reports[t.id].score} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-1.5">
        <Stat label="Sections" value={String(a.sections)} />
        <Stat label="Projects" value={String(a.projects)} />
        <Stat label="Experience" value={String(a.experience)} />
        <Stat label="Images" value={String(a.images)} />
        <Stat label="Words" value={a.words.toLocaleString()} />
        <Stat label="HTML size" value={formatBytes(a.estimatedHtmlBytes)} />
      </dl>

      <div role="tablist" aria-label="Reports" className="flex rounded-[10px] border border-line bg-bg p-0.5" onKeyDown={onTabKey}>
        {TABS.map((t) => {
          const issues = reports[t.id].checks.filter((c) => c.status === 'fail' || c.status === 'warn').length;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              id={`${tabsId}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition-colors',
                selected ? 'bg-elevated text-fg shadow-[0_1px_2px_rgba(0,0,0,.25),0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg-muted',
              )}
            >
              <span className="truncate max-[360px]:hidden">{t.label}</span>
              <span className="hidden truncate max-[360px]:inline">{t.short}</span>
              {issues > 0 && <span className={cn('rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums', reports[t.id].checks.some((c) => c.status === 'fail') ? 'bg-danger/15 text-danger' : 'bg-warn/15 text-warn')}>{issues}</span>}
            </button>
          );
        })}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${tab}`} className="min-h-0">
        <ReportList key={tab} report={current} onSelectSection={onSelectSection} sectionName={sectionName} />
      </div>
    </div>
  );
}
