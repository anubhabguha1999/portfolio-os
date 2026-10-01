import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createPortfolio } from '@/lib/portfolio-factory';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '@/lib/codegen/types';
import { generateFrameworkProject } from '@/lib/codegen';
import { ExportCheckPanel } from '@/features/export/code/FrameworkPanel';
import { SourcePreview } from '@/features/export/code/SourcePreview';
import { KEY_FILES } from '@/features/export/code/model';

const noAssets = { loader: async () => null, fetcher: async () => null, convert: async () => null };

describe('Export Studio with the real engine', () => {
  afterEach(cleanup);

  for (const framework of ['nextjs', 'react-vite'] as const) {
    it(`shows the export check and source for ${framework}`, async () => {
      const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, framework, images: framework === 'nextjs' ? 'optimized' : 'img' };
      const result = await generateFrameworkProject(createPortfolio({ title: 'Test Site' }), options, noAssets);
      render(<ExportCheckPanel format={framework === 'nextjs' ? 'next' : 'react'} state={{ status: 'done', result, signature: '', portfolio: createPortfolio(), fixes: {} }} stale={false} onGenerate={() => undefined} onFix={() => undefined} onFixAll={() => undefined} onDownload={() => undefined} />);
      expect(screen.getByText(/export check/i)).toBeTruthy();
      for (const c of result.report.checks) expect(screen.getByText(c.label)).toBeTruthy();
      cleanup();
      render(<SourcePreview project={result.project} keyFiles={KEY_FILES[framework]} />);
      expect(screen.getAllByRole('tab').length).toBeGreaterThan(2);
      expect(screen.getAllByText('package.json').length).toBeGreaterThan(0);
      expect(result.project.files.length).toBeGreaterThan(10);
    });
  }
});
