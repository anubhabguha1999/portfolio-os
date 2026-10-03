import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunEvent, RunKind, RunnerProject, RunRequest, RunResponse, TestSummary } from './commands';

export type RunStatus = 'running' | 'passed' | 'failed' | 'stopped';

export interface RunState {
  id: string;
  command: string;
  kind: RunKind;
  startedAt: number;
  status: RunStatus;
  exitCode: number | null;
  durationMs: number | null;
  tests: TestSummary | null;
  error: string | null;
}

export interface HistoryEntry {
  id: string;
  command: string;
  kind: RunKind;
  status: Exclude<RunStatus, 'running'>;
  exitCode: number | null;
  durationMs: number;
  endedAt: number;
  tests: TestSummary | null;
}

const HISTORY_KEY = 'local-runner:history';
const HISTORY_MAX = 50;
/** Output kept on screen; older text is dropped from the top. */
const OUTPUT_MAX = 1_500_000;
const HEADERS = { 'Content-Type': 'application/json', 'x-local-runner': '1' };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: history lasts for this session only */
  }
}

/** Talks to the dev-server endpoint (scripts/vite-dev-runner.ts). */
export function useRunner() {
  const [project, setProject] = useState<RunnerProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const runId = useRef<string | null>(null);
  // Command and kind of each run seen, for the history entry written when it ends.
  const started = useRef(new Map<string, { command: string; kind: RunKind }>());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/__runner/project', { cache: 'no-store' });
      if (!res.ok) throw new Error(`The runner endpoint answered ${res.status}.`);
      const body = (await res.json()) as { project: RunnerProject };
      setProject(body.project);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof TypeError ? 'Could not reach the dev server. Is `npm run dev` still running?' : (e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const source = new EventSource('/__runner/events');
    source.onmessage = (msg) => {
      const e = JSON.parse(msg.data as string) as RunEvent;
      if (e.type === 'start') {
        runId.current = e.id;
        started.current.set(e.id, { command: e.command, kind: e.kind });
        setOutput('');
        setRun({ id: e.id, command: e.command, kind: e.kind, startedAt: e.startedAt, status: 'running', exitCode: null, durationMs: null, tests: null, error: null });
      } else if (e.id !== runId.current) {
        return;
      } else if (e.type === 'output') {
        setOutput((o) => {
          const next = o + e.text;
          return next.length > OUTPUT_MAX ? next.slice(next.length - OUTPUT_MAX) : next;
        });
      } else {
        const status: RunStatus = e.stopped ? 'stopped' : e.code === 0 && !e.error ? 'passed' : 'failed';
        setRun((r) => (r && r.id === e.id ? { ...r, status, exitCode: e.code, durationMs: e.durationMs, tests: e.tests, error: e.error } : r));
        setHistory((list) => {
          // The event stream replays the last run after a reload; record each run once.
          if (list.some((h) => h.id === e.id)) return list;
          const meta = started.current.get(e.id) ?? { command: '', kind: 'custom' as const };
          const next = [{ id: e.id, command: meta.command, kind: meta.kind, status, exitCode: e.code, durationMs: e.durationMs, endedAt: Date.now(), tests: e.tests }, ...list].slice(0, HISTORY_MAX);
          saveHistory(next);
          return next;
        });
      }
    };
    return () => source.close();
  }, [refresh]);

  const start = useCallback(async (req: RunRequest): Promise<RunResponse> => {
    const res = await fetch('/__runner/run', { method: 'POST', headers: HEADERS, body: JSON.stringify(req) });
    return (await res.json()) as RunResponse;
  }, []);

  const stop = useCallback(async () => {
    await fetch('/__runner/stop', { method: 'POST', headers: HEADERS });
  }, []);

  const clearOutput = useCallback(() => setOutput(''), []);
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { project, loadError, refresh, run, output, history, start, stop, clearOutput, clearHistory, running: run?.status === 'running' };
}
