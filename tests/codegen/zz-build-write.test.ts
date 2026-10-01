/**
 * Writes generated projects to disk for real `npm install && npm run build` checks.
 * Runs only when CODEGEN_OUT is set:  CODEGEN_OUT=/tmp/out npx vitest run tests/codegen/zz-build-write.test.ts
 */
import { it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateFrameworkProject } from '@/lib/codegen';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '@/lib/codegen/types';
import { fakeLoader, noFetch, richPortfolio } from './generators-fixture';

const OUT = process.env.CODEGEN_OUT;

export const VARIANTS: Record<string, Partial<ExportOptions>> = {
  'next-static-tailwind': { framework: 'nextjs', rendering: 'static', styling: 'tailwind', images: 'optimized', structure: 'single' },
  'next-static-modules': { framework: 'nextjs', rendering: 'static', styling: 'css-modules', images: 'optimized', structure: 'single' },
  'next-standard-css': { framework: 'nextjs', rendering: 'standard', styling: 'css', images: 'optimized', structure: 'single', siteUrl: 'https://alex.dev' },
  'next-static-tailwind-multi': { framework: 'nextjs', rendering: 'static', styling: 'tailwind', images: 'img', structure: 'multi' },
  'vite-tailwind-single': { framework: 'react-vite', styling: 'tailwind', structure: 'single' },
  'vite-css-multi': { framework: 'react-vite', styling: 'css', structure: 'multi' },
  'vite-modules-animations-off': { framework: 'react-vite', styling: 'css-modules', structure: 'single', animations: false },
};

it.skipIf(!OUT)('writes generated projects', async () => {
  for (const [name, over] of Object.entries(VARIANTS)) {
    const { project, report } = await generateFrameworkProject(richPortfolio(), { ...DEFAULT_EXPORT_OPTIONS, ...over, projectName: name }, { loader: fakeLoader, fetcher: noFetch, convert: async () => null });
    expect(report.issues, name).toEqual([]);
    const dir = join(OUT!, name);
    // Keep node_modules between runs; replace everything else.
    for (const f of ['src', 'public', 'package.json']) rmSync(join(dir, f), { recursive: true, force: true });
    for (const f of project.files) {
      const path = join(dir, f.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, f.content);
    }
  }
}, 60_000);
