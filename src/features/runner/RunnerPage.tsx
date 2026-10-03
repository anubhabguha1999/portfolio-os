import { useEffect, useMemo, useState } from 'react';
import { Hammer, FlaskConical, Play, RotateCw, ScanSearch, TerminalSquare, Trash2 } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useHotkeys } from '@/hooks/useHotkeys';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';
import { testFilterCommand, type RunKind, type RunRequest, type TestSummary } from './commands';
import { OutputPanel } from './OutputPanel';
import { useRunner, type RunState } from './useRunner';

const SHELL = typeof navigator !== 'undefined' && /win/i.test(navigator.platform) ? 'win32' : 'posix';
const QUICK: Array<{ script: string; kind: RunKind; label: string; icon: typeof Hammer }> = [
  { script: 'build', kind: 'build', label: 'Build', icon: Hammer },
  { script: 'test', kind: 'test', label: 'Test', icon: FlaskConical },
  { script: 'lint', kind: 'lint', label: 'Lint', icon: ScanSearch },
];
const KIND_OF: Record<string, RunKind> = { build: 'build', test: 'test', lint: 'lint' };

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

function StatusPill({ run }: { run: RunState }) {
  const s = run.status;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
        s === 'running' && 'border-warn/30 bg-warn/10 text-warn',
        s === 'passed' && 'border-ok/30 bg-ok/10 text-ok',
        s === 'failed' && 'border-danger/30 bg-danger/10 text-danger',
        s === 'stopped' && 'border-line bg-hover text-fg-muted',
      )}
      role="status"
    >
      {s === 'running' ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : <span aria-hidden="true">{s === 'passed' ? '✓' : s === 'failed' ? '✕' : '■'}</span>}
      {s === 'running' ? 'Running…' : s === 'passed' ? 'Passed' : s === 'failed' ? 'Failed' : 'Stopped'}
    </span>
  );
}

function TestCounts({ tests }: { tests: TestSummary }) {
  return (
    <span className="inline-flex items-center gap-3 text-[12.5px] tabular-nums">
      <span className="text-ok">✓ {tests.passed} passed</span>
      <span className={tests.failed ? 'text-danger' : 'text-fg-subtle'}>✕ {tests.failed} failed</span>
      <span className="text-fg-subtle">○ {tests.skipped} skipped</span>
    </span>
  );
}

/** Result line above the output: state, exit code, duration, and the test or build verdict. */
function RunSummary({ run }: { run: RunState }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [run.status]);
  const duration = run.durationMs ?? now - run.startedAt;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-panel px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{run.kind === 'custom' || run.kind === 'script' ? 'Run' : run.kind}</span>
      <StatusPill run={run} />
      {run.kind === 'build' && run.status !== 'running' && <span className={cn('text-[13px] font-medium', run.status === 'passed' ? 'text-ok' : run.status === 'failed' ? 'text-danger' : 'text-fg-muted')}>{run.status === 'passed' ? 'Build successful' : run.status === 'failed' ? 'Build failed' : 'Build stopped'}</span>}
      {run.tests && <TestCounts tests={run.tests} />}
      <span className="ml-auto flex items-center gap-4 text-[12.5px] tabular-nums text-fg-muted">
        {run.exitCode !== null && <span>Exit code: {run.exitCode}</span>}
        <span>Duration: {seconds(duration)}</span>
      </span>
      {run.error && <p className="w-full text-[12.5px] text-danger">Could not start: {run.error}</p>}
    </div>
  );
}

export default function RunnerPage() {
  const r = useRunner();
  const { project } = r;
  const [filter, setFilter] = useState('');
  const [testCmd, setTestCmd] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [last, setLast] = useState<RunRequest | null>(null);
  const [confirm, setConfirm] = useState<{ req: RunRequest; command: string; warning: string } | null>(null);

  useEffect(() => {
    document.title = 'Local Runner — Portfolio OS';
  }, []);

  const generated = useMemo(() => (project ? testFilterCommand(project, filter, SHELL) : null), [project, filter]);
  const filterCommand = testCmd ?? generated ?? '';
  const otherScripts = project ? Object.keys(project.scripts).filter((s) => !QUICK.some((q) => q.script === s)) : [];

  const execute = async (req: RunRequest) => {
    if (r.running) return;
    setLast(req);
    try {
      const res = await r.start(req);
      if (res.ok) return;
      if (res.reason === 'confirm') setConfirm({ req, command: res.command, warning: res.warning });
      else if (res.reason === 'busy') toast({ tone: 'warning', title: 'A command is already running', description: 'Stop it first.' });
      else if (res.reason === 'unknown-script') {
        toast({ tone: 'error', title: 'That script is no longer in package.json' });
        void r.refresh();
      } else toast({ tone: 'warning', title: 'Enter a command first' });
    } catch {
      toast({ tone: 'error', title: 'Could not reach the dev server', description: 'Is `npm run dev` still running?' });
    }
  };

  const runScript = (script: string) => void execute({ kind: KIND_OF[script] ?? 'script', script });

  useHotkeys([
    { combo: 'mod+enter', handler: (e) => (e.preventDefault(), last && void execute(last)) },
    { combo: 'mod+k', handler: (e) => (e.preventDefault(), r.clearOutput()) },
    { combo: 'escape', enabled: r.running, allowInInputs: true, handler: () => void r.stop() },
  ]);

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-accent">
              <TerminalSquare className="size-3.5" /> Local runner · dev only
            </p>
            <h1 className="mt-1 truncate text-[clamp(1.6rem,3.6vw,2.2rem)] font-semibold tracking-[-0.03em]">{project?.name ?? 'Loading…'}</h1>
            {project && (
              <p className="mt-1 truncate text-[12.5px] text-fg-muted" title={project.root}>
                {project.packageManager}
                {project.lockfile ? ` (${project.lockfile})` : ' (no lockfile, using npm)'}
                {project.testFramework && ` · ${project.testFramework === 'vitest' ? 'Vitest' : 'Jest'}`} · <span className="font-mono">{project.root}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {project &&
              QUICK.filter((q) => project.scripts[q.script]).map((q) => (
                <Button key={q.script} variant={q.script === 'build' ? 'primary' : 'secondary'} icon={<q.icon className="size-4" />} disabled={r.running} onClick={() => runScript(q.script)} title={project.scripts[q.script]}>
                  {q.label}
                </Button>
              ))}
            {last && (
              <Button variant="ghost" icon={<RotateCw className="size-4" />} disabled={r.running} onClick={() => void execute(last)} title="Re-run (⌘↵)">
                Re-run
              </Button>
            )}
          </div>
        </header>

        {r.loadError && <p className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">{r.loadError}</p>}

        <div className="mt-6 grid flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section aria-labelledby="scripts-h" className="rounded-2xl border border-line bg-panel p-4">
              <h2 id="scripts-h" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Scripts
              </h2>
              {project && !Object.keys(project.scripts).length && <p className="mt-2 text-[12.5px] text-fg-muted">No scripts in package.json.</p>}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {project &&
                  [...QUICK.filter((q) => project.scripts[q.script]).map((q) => q.script), ...otherScripts].map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={r.running}
                        onClick={() => runScript(s)}
                        title={`${project.scripts[s]}`}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-elevated px-2 font-mono text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
                      >
                        <Play className="size-3 fill-current text-ok" /> {s}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>

            {project?.scripts.test && (
              <section aria-labelledby="filter-h" className="rounded-2xl border border-line bg-panel p-4">
                <h2 id="filter-h" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                  Test filter
                </h2>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void execute({ kind: 'test', command: filterCommand });
                  }}
                >
                  <input
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setTestCmd(null);
                    }}
                    placeholder="e.g. Button"
                    aria-label="Test filter"
                    className="app-input h-9 w-full"
                  />
                  <label className="block">
                    <span className="text-[11px] text-fg-subtle">Command (editable)</span>
                    <input value={filterCommand} onChange={(e) => setTestCmd(e.target.value)} aria-label="Test command" className="app-input mt-1 h-9 w-full font-mono text-[12px]" spellCheck={false} />
                  </label>
                  <Button type="submit" size="sm" variant="secondary" icon={<FlaskConical className="size-3.5" />} disabled={r.running || !filterCommand.trim()} className="w-full">
                    Run tests
                  </Button>
                </form>
              </section>
            )}

            <section aria-labelledby="custom-h" className="rounded-2xl border border-line bg-panel p-4">
              <h2 id="custom-h" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Custom command
              </h2>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void execute({ kind: 'custom', command: custom });
                }}
              >
                <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="npm run generate" aria-label="Custom command" className="app-input h-9 min-w-0 flex-1 font-mono text-[12px]" spellCheck={false} />
                <Button type="submit" size="md" disabled={r.running || !custom.trim()}>
                  Run
                </Button>
              </form>
              <p className="mt-2 text-[11.5px] leading-snug text-fg-subtle">Runs in the project folder through your shell, exactly as typed.</p>
            </section>

            <section aria-labelledby="history-h" className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <h2 id="history-h" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                  Recent runs
                </h2>
                {r.history.length > 0 && (
                  <button type="button" onClick={r.clearHistory} className="inline-flex items-center gap-1 text-[11.5px] text-fg-subtle hover:text-fg">
                    <Trash2 className="size-3" /> Clear history
                  </button>
                )}
              </div>
              {r.history.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-fg-muted">No runs yet.</p>
              ) : (
                <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
                  {r.history.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-hover" title={`${h.command} · ${timeAgo(new Date(h.endedAt).toISOString())}`}>
                      <span className={cn('w-3 shrink-0 text-center', h.status === 'passed' ? 'text-ok' : h.status === 'failed' ? 'text-danger' : 'text-fg-subtle')} aria-label={h.status}>
                        {h.status === 'passed' ? '✓' : h.status === 'failed' ? '✕' : '■'}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-fg-muted">{h.command}</span>
                      {h.tests && <span className="shrink-0 tabular-nums text-fg-subtle">{h.tests.failed ? `${h.tests.failed} failed` : `${h.tests.passed} passed`}</span>}
                      <span className="w-12 shrink-0 text-right tabular-nums text-fg-subtle">{seconds(h.durationMs)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            {r.run && <RunSummary run={r.run} />}
            <OutputPanel run={r.run} output={r.output} onClear={r.clearOutput} onStop={() => void r.stop()} />
            <p className="text-[11.5px] text-fg-subtle">
              <kbd className="app-kbd">⌘↵</kbd> re-run · <kbd className="app-kbd">Esc</kbd> stop · <kbd className="app-kbd">⌘K</kbd> clear output
            </p>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void execute({ ...confirm.req, confirmed: true })}
        title="Run this command?"
        description={
          <>
            {confirm?.warning} Check it before running:
            <code className="mt-2 block break-all rounded-lg bg-canvas px-3 py-2 font-mono text-[12px] text-fg">{confirm?.command}</code>
          </>
        }
        confirmLabel="Run anyway"
      />
    </div>
  );
}
