/**
 * Pre-download validation of a generated project. Every check inspects the real
 * files that will be zipped, so a pass means the archive is self-contained.
 */
import type { CheckItem, ExportIssue, ExportOptions, GeneratedFile, GeneratedProject, SiteBuild, ValidationReport } from './types';

const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;
const NODE_BUILTINS = new Set(['fs', 'path', 'url', 'node:fs', 'node:path', 'node:url', 'node:process']);

function textOf(f: GeneratedFile): string {
  return typeof f.content === 'string' ? f.content : '';
}

/** Package name from a bare specifier: "next/image" → "next", "@a/b/c" → "@a/b". */
export function packageOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
}

export function importsOf(src: string): string[] {
  const out = new Set<string>();
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|@import\s+['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) out.add((m[1] ?? m[2] ?? m[3])!);
  return [...out];
}

function resolveLocal(spec: string, from: string, paths: Set<string>): boolean {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else {
    const dir = from.split('/').slice(0, -1);
    for (const part of spec.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') dir.pop();
      else dir.push(part);
    }
    base = dir.join('/');
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.some((c) => paths.has(c));
}

export function validateProject(project: GeneratedProject, options: ExportOptions, build: SiteBuild): ValidationReport {
  const files = project.files;
  const paths = new Set(files.map((f) => f.path));
  const code = files.filter((f) => CODE.test(f.path));
  const texts = files.filter((f) => f.type === 'text');
  const all = texts.map(textOf).join('\n');
  const checks: CheckItem[] = [];
  const add = (id: string, label: string, ok: boolean, detail?: string) => checks.push({ id, label, ok, ...(detail && !ok ? { detail } : {}) });
  const next = project.framework === 'nextjs';

  // package.json
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null = null;
  try {
    const f = files.find((x) => x.path === 'package.json');
    pkg = f ? JSON.parse(textOf(f)) : null;
  } catch {
    pkg = null;
  }
  const deps = new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})]);
  add('package', 'package.json', !!pkg && !!pkg.scripts?.build && deps.has('react'), 'package.json is missing or incomplete.');

  if (next) {
    add('app-router', 'App Router', paths.has('src/app/layout.tsx') && paths.has('src/app/page.tsx') && ![...paths].some((p) => p.startsWith('src/pages/') || p.startsWith('pages/')), 'src/app/layout.tsx and src/app/page.tsx are required; no pages/ directory.');
    add('config', 'next.config', paths.has('next.config.ts') && deps.has('next'), 'next.config.ts or the next dependency is missing.');
  } else {
    add('entry', 'Vite entry (index.html, src/main.tsx, src/App.tsx)', paths.has('index.html') && paths.has('src/main.tsx') && paths.has('src/App.tsx'), 'Vite entry files are missing.');
    add('config', 'vite.config', paths.has('vite.config.ts') && deps.has('vite'), 'vite.config.ts or the vite dependency is missing.');
  }
  add('typescript', 'TypeScript', paths.has('tsconfig.json') && code.some((f) => f.path.endsWith('.tsx')) && deps.has('typescript'), 'tsconfig.json or TypeScript sources are missing.');

  // Images referenced → present
  const refs = new Set<string>();
  for (const m of all.matchAll(/["'(](\/(?:images|fonts|icons)\/[^"')\s]+)["')]/g)) refs.add(m[1]!);
  const missing = [...refs].filter((r) => !paths.has(`public${r}`));
  add('images', `Images copied (${build.images.length})`, missing.length === 0, `Missing: ${missing.slice(0, 4).join(', ')}`);

  // Imports resolve
  const unresolved: string[] = [];
  for (const f of [...code, ...files.filter((x) => x.path.endsWith('.css'))]) {
    for (const spec of importsOf(textOf(f))) {
      if (spec.startsWith('.') || spec.startsWith('@/')) {
        if (!resolveLocal(spec, f.path, paths)) unresolved.push(`${f.path} → ${spec}`);
      } else if (!NODE_BUILTINS.has(spec) && !spec.startsWith('http') && !deps.has(packageOf(spec)) && spec !== 'tailwindcss') {
        unresolved.push(`${f.path} → ${spec} (not in package.json)`);
      }
    }
  }
  add('imports', 'Imports resolved', unresolved.length === 0, unresolved.slice(0, 4).join('; '));

  // Metadata
  if (next) {
    const layout = textOf(files.find((f) => f.path === 'src/app/layout.tsx') ?? { path: '', content: '', type: 'text' });
    add('metadata', 'Metadata generated', /export const metadata/.test(layout) && /title/.test(layout), 'layout.tsx must export metadata.');
  } else {
    const html = textOf(files.find((f) => f.path === 'index.html') ?? { path: '', content: '', type: 'text' });
    add('metadata', 'Metadata generated', /<title>[^<]+<\/title>/.test(html) && /name="description"/.test(html), 'index.html needs a title and description.');
  }

  // Routes
  const routeMissing = build.data.pages
    .map((p) => p.path)
    .filter((path) => {
      if (!next) return !all.includes(path === '/' ? "path: '/'" : `path: '${path}'`) && !(path === '/' && build.data.pages.length === 1);
      return !paths.has(path === '/' ? 'src/app/page.tsx' : `src/app${path}/page.tsx`);
    });
  const needsDetail = build.data.projects.some((p) => p.hasPage);
  const detailOk = !needsDetail || (next ? paths.has('src/app/projects/[slug]/page.tsx') : all.includes('/projects/:slug'));
  add('routes', `Routes generated (${build.data.pages.length} page${build.data.pages.length === 1 ? '' : 's'}${needsDetail ? ' + project pages' : ''})`, routeMissing.length === 0 && detailOk, `Missing routes: ${[...routeMissing, ...(detailOk ? [] : ['/projects/[slug]'])].join(', ')}`);

  add('blob', 'No blob URLs', !/\bblob:/.test(all), 'A blob: URL would break outside this browser.');
  add('storage', 'No IndexedDB dependencies', !/indexedDB|\bidb\b|localforage/.test(all.replace(/localStorage/g, '')), 'The project must not read from IndexedDB.');
  add('independent', 'No Portfolio OS dependencies', !/asset:[a-z0-9_]/i.test(all) && !/from ['"](portfolio-os|@\/studio|@\/lib\/codegen)/.test(all) && !/localhost:\d/.test(all), 'The project references Portfolio OS internals.');

  if (next && options.rendering === 'static') {
    const cfg = textOf(files.find((f) => f.path === 'next.config.ts') ?? { path: '', content: '', type: 'text' });
    const server = /['"]use server['"]|next\/headers|force-dynamic|export const revalidate/.test(all) || [...paths].some((p) => p.startsWith('src/app/api/'));
    add('static', 'No server dependency in static mode', /output:\s*['"]export['"]/.test(cfg) && !server, 'Static export needs output: "export" and no server-only features.');
  }

  const responsive = /@media|\b(sm|md|lg|xl):[\w-]/.test(all);
  add('responsive', 'Responsive styles', responsive, 'No responsive rules found.');

  const imgs = [...all.matchAll(/<(img|Image)\b[^>]*>/g)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt=/.test(t));
  const a11y = noAlt.length === 0 && /lang=/.test(all) && /prefers-reduced-motion|useReducedMotion|motion-reduce/.test(all) && /:focus-visible|focus-visible:/.test(all);
  add('a11y', 'Accessibility checks', a11y, [noAlt.length ? `${noAlt.length} image(s) without alt` : '', /lang=/.test(all) ? '' : 'missing lang', /focus-visible/.test(all) ? '' : 'no focus styles'].filter(Boolean).join(', '));

  const issues: ExportIssue[] = [...build.problems, ...checks.filter((c) => !c.ok).map((c) => ({ id: `check-${c.id}`, level: 'error' as const, message: `${c.label}: ${c.detail ?? 'failed'}` }))];
  return { checks, issues, canExport: !issues.some((i) => i.level === 'error') };
}
