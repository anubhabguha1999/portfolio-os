import { useCallback, useEffect, useRef, useState } from 'react';
import { AiError, streamMessage, type AiUsage } from '@/lib/ai/client';
import type { PromptPair } from '@/lib/ai/prompts';

export type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'stopped';

export interface RunState {
  status: RunStatus;
  text: string;
  usage: AiUsage | null;
  error: AiError | null;
}

const IDLE: RunState = { status: 'idle', text: '', usage: null, error: null };

/** Runs one streamed request at a time, with Stop and "Try again" (repeats the last prompt). */
export function useAiRun(apiKey: string, model: string) {
  const [state, setState] = useState<RunState>(IDLE);
  const ctrl = useRef<AbortController | null>(null);
  const last = useRef<PromptPair | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const start = useCallback(
    async (pair: PromptPair) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      last.current = pair;
      setState({ status: 'running', text: '', usage: null, error: null });
      try {
        const res = await streamMessage(
          { apiKey, model, system: pair.system, prompt: pair.prompt },
          { signal: c.signal, onText: (_d, full) => ctrl.current === c && setState((s) => ({ ...s, text: full })) },
        );
        if (ctrl.current === c) setState({ status: 'done', text: res.text, usage: res.usage, error: null });
      } catch (err) {
        if (ctrl.current !== c) return;
        const e = err instanceof AiError ? err : new AiError('server', err instanceof Error ? err.message : String(err));
        setState((s) => (e.kind === 'aborted' ? { ...s, status: 'stopped', error: null } : { ...s, status: 'error', error: e }));
      } finally {
        if (ctrl.current === c) ctrl.current = null;
      }
    },
    [apiKey, model],
  );

  const stop = useCallback(() => ctrl.current?.abort(), []);
  const retry = useCallback(() => {
    if (last.current) void start(last.current);
  }, [start]);
  const reset = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    setState(IDLE);
  }, []);

  return { ...state, running: state.status === 'running', canRetry: !!last.current, start, stop, retry, reset };
}

export type AiRun = ReturnType<typeof useAiRun>;
