/**
 * Helpers shared by the framework generators: package manifests, SEO files,
 * structured data and README sections.
 */
import type { GenCtx } from '../context';
import type { ExportOptions } from '../types';
import type { PortfolioData, Project } from '../site-types';
import { NODE_ENGINE, pick, type ToolchainPackage } from '../versions';

export const PLACEHOLDER_ORIGIN = 'https://example.com';

export function origin(data: PortfolioData): string {
  return data.seo.siteUrl ?? PLACEHOLDER_ORIGIN;
}

export function packageJson(name: string, scripts: Record<string, string>, deps: ToolchainPackage[], devDeps: ToolchainPackage[], extra: Record<string, unknown> = {}): string {
  return (
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        private: true,
        ...extra,
        scripts,
        dependencies: pick(deps),
        devDependencies: pick(devDeps),
        engines: { node: NODE_ENGINE },
      },
      null,
      2,
    ) + '\n'
  );
}

export const GITIGNORE_COMMON = `# dependencies
node_modules/

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# env
.env*.local
.env

# editor / OS
.DS_Store
.vscode/*
!.vscode/extensions.json
.idea
*.tsbuildinfo
`;

/** Every route the site exposes (for sitemap). */
export function routes(ctx: GenCtx): string[] {
  const out = ctx.data.pages.map((p) => p.path);
  if (ctx.hasProjectPages) for (const p of ctx.data.projects.filter((x) => x.hasPage)) out.push(`/projects/${p.slug}`);
  return out;
}

export function robotsTxt(ctx: GenCtx): string {
  const o = origin(ctx.data);
  const note = ctx.data.seo.siteUrl ? '' : `# Replace ${PLACEHOLDER_ORIGIN} with your domain before deploying.\n`;
  return `${note}User-agent: *\nAllow: /\n\nSitemap: ${o}/sitemap.xml\n`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sitemapXml(ctx: GenCtx, trailingSlash: boolean): string {
  const o = origin(ctx.data);
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes(ctx)
    .map((r) => {
      const path = r === '/' ? '/' : trailingSlash ? `${r}/` : r;
      return `  <url>\n    <loc>${xmlEscape(o + path)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join('\n');
  const note = ctx.data.seo.siteUrl ? '' : `<!-- Replace ${PLACEHOLDER_ORIGIN} with your domain before deploying. -->\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${note}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const abs = (data: PortfolioData, src: string) => (/^https?:/.test(src) ? src : data.seo.siteUrl ? data.seo.siteUrl + src : null);

/** Person / ProfilePage structured data using only supplied information. */
export function personJsonLd(data: PortfolioData): Record<string, unknown> | null {
  const p = data.person;
  if (!p.name) return null;
  const person: Record<string, unknown> = { '@type': 'Person', name: p.name };
  if (p.headline) person.jobTitle = p.headline;
  if (p.email) person.email = `mailto:${p.email}`;
  if (data.seo.siteUrl) person.url = data.seo.siteUrl;
  const img = p.image ? abs(data, p.image.src) : null;
  if (img) person.image = img;
  const sameAs = data.social.map((s) => s.href).filter((h) => /^https?:/.test(h));
  if (sameAs.length) person.sameAs = sameAs;
  if (p.location) person.address = { '@type': 'PostalAddress', addressLocality: p.location };
  return { '@context': 'https://schema.org', '@type': 'ProfilePage', ...(data.seo.title ? { name: data.seo.title } : {}), mainEntity: person };
}

export function projectJsonLd(data: PortfolioData, project: Project): Record<string, unknown> {
  const out: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'CreativeWork', name: project.title };
  if (project.description) out.description = project.description;
  if (data.person.name) out.author = { '@type': 'Person', name: data.person.name };
  if (project.technologies.length) out.keywords = project.technologies.join(', ');
  const img = project.image ? abs(data, project.image.src) : null;
  if (img) out.image = img;
  if (project.live) out.url = project.live;
  else if (data.seo.siteUrl) out.url = `${data.seo.siteUrl}/projects/${project.slug}`;
  return out;
}

/** JSON for embedding inside a <script> (neutralises </script>). */
export function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Dark background colour for `themeColor`, read from the data scheme. */
export function stackList(ctx: GenCtx): string[] {
  const out = [ctx.framework === 'nextjs' ? 'Next.js (App Router)' : 'Vite', 'React', 'TypeScript'];
  out.push(ctx.styling === 'tailwind' ? 'Tailwind CSS' : ctx.styling === 'css-modules' ? 'CSS Modules' : 'Plain CSS');
  if (ctx.animations) out.push('Motion (animations)');
  if (ctx.framework === 'react-vite' && ctx.router) out.push('React Router');
  return out;
}

export function customizeSection(ctx: GenCtx): string {
  const appDir = ctx.framework === 'nextjs' ? '- `src/app/` — routes. Each folder with a `page.tsx` is a URL; `layout.tsx` holds the shared shell and site metadata.' : '- `src/App.tsx` — routes and page titles. `src/main.tsx` mounts the app.';
  return `## Customising

- \`src/data/portfolio.ts\` — all of your content (text, links, projects, sections). Edit this file to change what the site says.
- \`public/images/\` — images used by the site. Replace a file with one of the same name to swap it.
${appDir}
- \`src/sections/\` — one component per section type; \`src/components/\` — shared UI (navigation, footer, cards).
- \`src/styles/tokens.css\` — the design system: colours (light and dark), typography, spacing, radii, shadows and motion. Change a token here and the whole site follows.
`;
}

export function domainNote(data: PortfolioData): string {
  return data.seo.siteUrl ? '' : `\n> **Domain:** no site URL was provided, so \`robots.txt\`/\`sitemap.xml\` use the placeholder \`${PLACEHOLDER_ORIGIN}\`. Replace it with your real domain before deploying.\n`;
}

export function remoteHosts(data: PortfolioData): string[] {
  const hosts = new Set<string>();
  const visit = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    if (typeof o.src === 'string' && typeof o.width === 'number' && /^https:\/\//.test(o.src)) {
      try {
        hosts.add(new URL(o.src).hostname);
      } catch {
        /* ignore */
      }
    }
    Object.values(o).forEach(visit);
  };
  visit(data);
  return [...hosts];
}

export function commandsFor(framework: 'nextjs' | 'react-vite', options: ExportOptions): { install: string; dev: string; build: string; start?: string } {
  if (framework === 'nextjs') return { install: 'npm install', dev: 'npm run dev', build: 'npm run build', start: options.rendering === 'static' ? 'npx serve out' : 'npm run start' };
  return { install: 'npm install', dev: 'npm run dev', build: 'npm run build', start: 'npm run preview' };
}

/** Theme colour for the browser UI (the background of the starting scheme). */
export function themeColor(css: string): string | null {
  return /--c-bg:\s*([^;]+);/.exec(css)?.[1]?.trim() ?? null;
}
