import { describe, expect, it } from 'vitest';
import { generateFrameworkProject } from '@/lib/codegen';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions, type GeneratedProject } from '@/lib/codegen/types';
import { fakeLoader, noFetch, richPortfolio } from './generators-fixture';

const env = { loader: fakeLoader, fetcher: noFetch, convert: async () => null };

async function gen(over: Partial<ExportOptions>) {
  return generateFrameworkProject(richPortfolio(), { ...DEFAULT_EXPORT_OPTIONS, ...over }, env);
}

const file = (p: GeneratedProject, path: string) => {
  const f = p.files.find((x) => x.path === path);
  return typeof f?.content === 'string' ? f.content : '';
};
const has = (p: GeneratedProject, path: string) => p.files.some((f) => f.path === path);
const pkg = (p: GeneratedProject) => JSON.parse(file(p, 'package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string> };

describe('Next.js generator', () => {
  it('generates an App Router project with static export config', async () => {
    const { project, report } = await gen({ framework: 'nextjs', rendering: 'static' });
    for (const f of ['package.json', 'next.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'postcss.config.mjs', 'README.md', '.gitignore', 'src/app/layout.tsx', 'src/app/page.tsx', 'public/robots.txt', 'public/sitemap.xml']) expect(has(project, f), f).toBe(true);
    expect(project.files.some((f) => f.path.startsWith('src/pages/') || f.path.startsWith('pages/'))).toBe(false);
    expect(file(project, 'next.config.ts')).toMatch(/output: 'export'/);
    expect(file(project, 'next.config.ts')).toMatch(/unoptimized: true/);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.canExport).toBe(true);
  });

  it('keeps layout and pages as server components', async () => {
    const { project } = await gen({ framework: 'nextjs', structure: 'multi' });
    for (const f of project.files.filter((x) => /^src\/app\/.*(page|layout)\.tsx$/.test(x.path))) expect(String(f.content)).not.toMatch(/['"]use client['"]/);
    expect(has(project, 'src/app/about/page.tsx')).toBe(true);
    expect(has(project, 'src/app/contact/page.tsx')).toBe(true);
    expect(file(project, 'src/app/about/page.tsx')).toMatch(/export const metadata/);
  });

  it('writes metadata without inventing a domain', async () => {
    const { project } = await gen({ framework: 'nextjs', siteUrl: '' });
    const layout = file(project, 'src/app/layout.tsx');
    expect(layout).toMatch(/export const metadata: Metadata/);
    expect(layout).toMatch(/Alex Morgan — Portfolio/);
    expect(layout).toMatch(/description:/);
    expect(layout).not.toMatch(/metadataBase/);
    expect(file(project, 'public/sitemap.xml')).toMatch(/example\.com/);
    const withUrl = await gen({ framework: 'nextjs', siteUrl: 'https://alex.dev' });
    expect(file(withUrl.project, 'src/app/layout.tsx')).toMatch(/metadataBase: new URL\("https:\/\/alex\.dev"\)/);
  });

  it('generates dynamic project routes with static params', async () => {
    const { project } = await gen({ framework: 'nextjs', rendering: 'static' });
    const page = file(project, 'src/app/projects/[slug]/page.tsx');
    expect(page).toMatch(/export function generateStaticParams/);
    expect(page).toMatch(/dynamicParams = false/);
    expect(page).toMatch(/generateMetadata/);
    expect(page).toMatch(/Promise<\{ slug: string \}>/);
  });

  it('standard mode has start script and metadata routes', async () => {
    const { project, report } = await gen({ framework: 'nextjs', rendering: 'standard', styling: 'css' });
    expect(pkg(project).scripts.start).toBe('next start');
    expect(file(project, 'next.config.ts')).not.toMatch(/output: 'export'/);
    expect(has(project, 'src/app/sitemap.ts')).toBe(true);
    expect(has(project, 'postcss.config.mjs')).toBe(false);
    expect(report.canExport).toBe(true);
  });

  it('adds motion only when animations are enabled', async () => {
    expect(pkg((await gen({ framework: 'nextjs', animations: true })).project).dependencies.motion).toBeDefined();
    expect(pkg((await gen({ framework: 'nextjs', animations: false })).project).dependencies.motion).toBeUndefined();
  });
});

describe('React + Vite generator', () => {
  it('generates a Vite project with SEO in index.html', async () => {
    const { project, report } = await gen({ framework: 'react-vite', structure: 'single' });
    for (const f of ['index.html', 'src/main.tsx', 'src/App.tsx', 'vite.config.ts', 'tsconfig.json']) expect(has(project, f), f).toBe(true);
    const html = file(project, 'index.html');
    expect(html).toMatch(/<title>Alex Morgan — Portfolio<\/title>/);
    expect(html).toMatch(/og:title/);
    expect(html).toMatch(/application\/ld\+json/);
    expect(project.files.some((f) => f.path.startsWith('src/app/'))).toBe(false);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
  });

  it('uses React Router only when routes exist', async () => {
    const routed = await gen({ framework: 'react-vite', structure: 'multi' });
    expect(pkg(routed.project).dependencies['react-router-dom']).toBeDefined();
    expect(file(routed.project, 'src/App.tsx')).toMatch(/path: '\/about'/);
    expect(has(routed.project, 'public/_redirects')).toBe(true);
    const p = richPortfolio();
    for (const s of p.sections) if (s.type === 'projects') s.data.items = s.data.items.map((i) => ({ ...i, caseStudy: '', gallery: [] }));
    const flat = await generateFrameworkProject(p, { ...DEFAULT_EXPORT_OPTIONS, framework: 'react-vite', structure: 'single' }, env);
    expect(pkg(flat.project).dependencies['react-router-dom']).toBeUndefined();
    expect(file(flat.project, 'src/main.tsx')).not.toMatch(/BrowserRouter/);
  });
});
