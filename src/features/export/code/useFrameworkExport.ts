import { useCallback, useRef, useState } from 'react';
import type { Portfolio } from '@/types/portfolio';
import type { ExportOptions, GeneratedProject, SiteBuild, ValidationReport } from '@/lib/codegen/types';
import { optionsSignature } from './model';

export interface Fixes {
  dropInvalidLinks?: boolean;
  dropMissingImages?: boolean;
}

export interface FrameworkResult {
  project: GeneratedProject;
  build: SiteBuild;
  report: ValidationReport;
}

export type FrameworkExportState =
  | { status: 'idle' }
  | { status: 'running'; stage: string }
  | { status: 'done'; result: FrameworkResult; signature: string; portfolio: Portfolio; fixes: Fixes }
  | { status: 'error'; message: string };

export type GenerateFn = (portfolio: Portfolio, options: ExportOptions, env: { fixes?: Fixes }) => Promise<FrameworkResult>;

/** Default generator: the codegen engine is loaded on demand (it is only needed here). */
export const loadAndGenerate: GenerateFn = async (portfolio, options, env) => {
  const engine = await import('@/lib/codegen');
  return engine.generateFrameworkProject(portfolio, options, env);
};

export function useFrameworkExport(generate: GenerateFn = loadAndGenerate) {
  const [state, setState] = useState<FrameworkExportState>({ status: 'idle' });
  const seq = useRef(0);

  const run = useCallback(
    async (portfolio: Portfolio, options: ExportOptions, fixes: Fixes = {}) => {
      const id = ++seq.current;
      setState({ status: 'running', stage: 'Collecting content and images…' });
      try {
        // Let the spinner paint before the (partly synchronous) generation starts.
        await new Promise((r) => setTimeout(r, 0));
        const result = await generate(portfolio, options, { fixes });
        if (id !== seq.current) return;
        setState({ status: 'done', result, signature: optionsSignature(options), portfolio, fixes });
      } catch (err) {
        if (id !== seq.current) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    },
    [generate],
  );

  const reset = useCallback(() => {
    seq.current++;
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}

export function projectBytes(project: GeneratedProject): number {
  const enc = new TextEncoder();
  return project.files.reduce((a, f) => a + (typeof f.content === 'string' ? enc.encode(f.content).byteLength : f.content.byteLength), 0);
}
