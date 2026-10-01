import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ExportOptions, GeneratedProject, SiteBuild, ValidationReport } from '@/lib/codegen/types';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/codegen/types';
import { createPortfolio } from '@/lib/portfolio-factory';
import { ExportCheckPanel, FrameworkCards, FrameworkComparison, FrameworkOptionsPanel, fixesFor } from '@/features/export/code/FrameworkPanel';
import { GeneratedFileTree, SourcePreview, buildFileTree, highlightTs } from '@/features/export/code/SourcePreview';
import { checkSiteUrl, optionsSignature, previewProjectName, KEY_FILES } from '@/features/export/code/model';
import { useFrameworkExport, type FrameworkExportState, type FrameworkResult } from '@/features/export/code/useFrameworkExport';
import { isFormatId } from '@/features/export/model';

const project: GeneratedProject = {
  framework: 'nextjs',
  name: 'my-portfolio',
  files: [
    { path: 'package.json', content: '{ "name": "my-portfolio" }', type: 'text' },
    { path: 'src/app/page.tsx', content: "import { Hero } from '@/sections/Hero';\nexport default function Page() {\n  return <Hero />;\n}\n", type: 'text' },
    { path: 'src/app/layout.tsx', content: 'export const metadata = { title: "A" };', type: 'text' },
    { path: 'public/images/profile.webp', content: new Uint8Array([1, 2, 3, 4]), type: 'binary' },
  ],
  warnings: [],
  commands: { install: 'npm install', dev: 'npm run dev', build: 'npm run build' },
};

const build = { data: { pages: [], projects: [] }, images: [], customCss: '', fontFiles: [], faviconImage: null, faviconText: 'A', warnings: ['A remote image is referenced by URL.'], problems: [] } as unknown as SiteBuild;

const failing: ValidationReport = {
  checks: [
    { id: 'app-router', label: 'App Router', ok: true },
    { id: 'images', label: 'Images copied (1)', ok: false, detail: 'Missing: /images/x.webp' },
  ],
  issues: [
    { id: 'img-1', level: 'error', message: 'Project image “DHMS” is unavailable.', fix: 'remove-image', sectionId: 's1' },
    { id: 'url-1', level: 'error', message: 'Invalid URL for “DHMS” live link.', fix: 'remove-link', sectionId: 's1' },
  ],
  canExport: false,
};

const done = (report: ValidationReport): FrameworkExportState => ({ status: 'done', result: { project, build, report }, signature: 'x', portfolio: createPortfolio(), fixes: {} });

describe('framework export UI', () => {
  afterEach(cleanup);

  it('keeps old deep links and accepts the new formats', () => {
    for (const f of ['html', 'zip', 'pdf', 'docx', 'json', 'resume', 'react', 'next']) expect(isFormatId(f)).toBe(true);
  });

  it('switches frameworks with the cards', () => {
    const onChange = vi.fn();
    render(<FrameworkCards value="react" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: /react \+ vite/i }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /next\.js/i }));
    expect(onChange).toHaveBeenCalledWith('next');
  });

  it('updates Next.js options (rendering, styling, images, structure)', () => {
    let latest: ExportOptions = DEFAULT_EXPORT_OPTIONS;
    function Harness() {
      const [o, setO] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
      latest = o;
      return <FrameworkOptionsPanel format="next" value={o} onChange={setO} />;
    }
    render(<Harness />);
    expect(screen.getByText('App Router')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Standard Next.js' }));
    fireEvent.click(screen.getByRole('radio', { name: 'CSS Modules' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Standard <img>' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Multiple pages' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Disabled' }));
    expect(latest).toMatchObject({ rendering: 'standard', styling: 'css-modules', images: 'img', structure: 'multi', animations: false });
    fireEvent.change(screen.getByLabelText(/site url/i), { target: { value: 'not a url' } });
    expect(screen.getByRole('alert').textContent).toMatch(/https/);
  });

  it('shows no Next-only controls for React + Vite', () => {
    render(<FrameworkOptionsPanel format="react" value={{ ...DEFAULT_EXPORT_OPTIONS, framework: 'react-vite' }} onChange={() => undefined} />);
    expect(screen.queryByRole('radio', { name: 'Static Export' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Next/Image' })).toBeNull();
    expect(screen.getByText('Vite')).toBeTruthy();
  });

  it('renders a neutral, collapsible comparison', () => {
    render(<FrameworkComparison />);
    fireEvent.click(screen.getByRole('button', { name: /which framework/i }));
    expect(screen.getByText(/SEO-focused portfolio/)).toBeTruthy();
    expect(screen.getByText(/Simple static \/ client-side portfolio/)).toBeTruthy();
  });

  it('blocks download and offers fixes when the check fails', () => {
    const onFix = vi.fn();
    const onFixAll = vi.fn();
    const onDownload = vi.fn();
    render(<ExportCheckPanel format="next" state={done(failing)} stale={false} onGenerate={() => undefined} onFix={onFix} onFixAll={onFixAll} onDownload={onDownload} />);
    expect(screen.getByText('Export cannot continue.')).toBeTruthy();
    expect(screen.getByText(/2 issues found/)).toBeTruthy();
    const download = screen.getByRole('button', { name: /download my-portfolio\.zip/i }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /^fix:/i })[0]!);
    expect(onFix).toHaveBeenCalledWith(expect.objectContaining({ fix: 'remove-image' }));
    fireEvent.click(screen.getByRole('button', { name: /fix all/i }));
    expect(onFixAll).toHaveBeenCalledWith({ dropInvalidLinks: true, dropMissingImages: true });
    expect(screen.getByText(/remote image is referenced/)).toBeTruthy();
  });

  it('enables download when the check passes', () => {
    const onDownload = vi.fn();
    render(<ExportCheckPanel format="react" state={done({ checks: [{ id: 'a', label: 'App', ok: true }], issues: [], canExport: true })} stale={false} onGenerate={() => undefined} onFix={() => undefined} onFixAll={() => undefined} onDownload={onDownload} />);
    const btn = screen.getByRole('button', { name: /download my-portfolio\.zip/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onDownload).toHaveBeenCalled();
    expect(screen.getByText(/4 files/)).toBeTruthy();
  });

  it('marks stale results and disables download until regenerated', () => {
    render(<ExportCheckPanel format="next" state={done({ checks: [], issues: [], canExport: true })} stale onGenerate={() => undefined} onFix={() => undefined} onFixAll={() => undefined} onDownload={() => undefined} />);
    expect(screen.getByText(/options changed/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /download/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders the generated file tree and switches files', () => {
    const onSelect = vi.fn();
    render(<GeneratedFileTree files={project.files} selected="package.json" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /^src/ }));
    expect(screen.queryByText('page.tsx')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^src/ }));
    fireEvent.click(screen.getByText('page.tsx'));
    expect(onSelect).toHaveBeenCalledWith('src/app/page.tsx');
    expect(buildFileTree(project.files).children!.map((c) => c.name)).toEqual(['public', 'src', 'package.json']);
  });

  it('pins key files and shows source with binary placeholders', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<SourcePreview project={project} keyFiles={KEY_FILES.nextjs} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('title'))).toEqual(['src/app/page.tsx', 'src/app/layout.tsx', 'package.json']);
    expect(screen.getByLabelText('Source of src/app/page.tsx').textContent).toContain('export default function Page');
    fireEvent.click(screen.getByRole('button', { name: /^images/ }));
    fireEvent.click(screen.getByText('profile.webp'));
    expect(screen.getByText(/Binary file/)).toBeTruthy();
    expect(screen.getByAltText('Preview of public/images/profile.webp')).toBeTruthy();
  });

  it('highlights TSX', () => {
    const kinds = highlightTs("import x from 'y'; <Hero data={a} />").map((t) => t.kind);
    expect(kinds).toContain('keyword');
    expect(kinds).toContain('string');
    expect(kinds).toContain('tag');
  });

  it('validates site URLs and folder names', () => {
    expect(checkSiteUrl('').ok).toBe(true);
    expect(checkSiteUrl('https://example.com/path')).toEqual({ ok: true, origin: 'https://example.com' });
    expect(checkSiteUrl('ftp://x.com').ok).toBe(false);
    expect(previewProjectName('  Alex Morgan — Portfolio! ')).toBe('alex-morgan-portfolio');
    expect(optionsSignature({ ...DEFAULT_EXPORT_OPTIONS, projectName: 'A B' })).toBe(optionsSignature({ ...DEFAULT_EXPORT_OPTIONS, projectName: 'a-b' }));
    expect(fixesFor([])).toEqual({});
  });

  it('runs a generator and exposes its result', async () => {
    const result: FrameworkResult = { project, build, report: { checks: [], issues: [], canExport: true } };
    const gen = vi.fn(async () => result);
    const { result: hook } = renderHook(() => useFrameworkExport(gen));
    await act(async () => {
      await hook.current.run(createPortfolio(), DEFAULT_EXPORT_OPTIONS, { dropInvalidLinks: true });
    });
    await waitFor(() => expect(hook.current.state.status).toBe('done'));
    expect(gen).toHaveBeenCalledWith(expect.anything(), DEFAULT_EXPORT_OPTIONS, { fixes: { dropInvalidLinks: true } });
  });
});
