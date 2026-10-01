/**
 * React + Vite generator: a client-side React app (src/main.tsx, src/App.tsx),
 * React Router only when the site has more than one route, SEO in index.html.
 */
import type { Portfolio } from '@/types/portfolio';
import { activePalette } from '@/lib/theme/tokens';
import { createContext, text, type GenCtx } from '../context';
import { libraryFiles, GLOBALS_PATH } from '../library';
import type { ExportOptions, GeneratedFile, GeneratedProject, ProjectGenerator, SiteBuild } from '../types';
import type { ToolchainPackage } from '../versions';
import { buildSiteData } from '../site-model';
import { GITIGNORE_COMMON, commandsFor, customizeSection, domainNote, jsonForHtml, packageJson, personJsonLd, robotsTxt, routes, sitemapXml, stackList } from './shared';
import { dedupe } from './next';

const q = (v: unknown) => JSON.stringify(v);

function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function indexHtml(ctx: GenCtx, portfolio: Portfolio, files: GeneratedFile[], themeScript: string): string {
  const { seo } = ctx.data;
  const has = (p: string) => files.some((f) => f.path === p);
  const abs = (src: string | undefined) => (!src ? null : /^https?:\/\//.test(src) ? src : seo.siteUrl ? seo.siteUrl + src : null);
  const og = abs(seo.ogImage?.src);
  const head: string[] = [
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `<title>${attr(seo.title)}</title>`,
    `<meta name="description" content="${attr(seo.description)}" />`,
  ];
  if (seo.keywords.length) head.push(`<meta name="keywords" content="${attr(seo.keywords.join(', '))}" />`);
  if (seo.author) head.push(`<meta name="author" content="${attr(seo.author)}" />`);
  head.push(`<meta name="theme-color" content="${attr(activePalette(portfolio).background)}" />`);
  if (seo.siteUrl) head.push(`<link rel="canonical" href="${attr(seo.siteUrl)}/" />`);
  if (has('public/favicon.ico')) head.push(`<link rel="icon" href="/favicon.ico" sizes="any" />`);
  if (has('public/favicon.svg')) head.push(`<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`);
  head.push(
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${attr(seo.title)}" />`,
    `<meta property="og:description" content="${attr(seo.description)}" />`,
    `<meta property="og:site_name" content="${attr(seo.title)}" />`,
  );
  if (seo.siteUrl) head.push(`<meta property="og:url" content="${attr(seo.siteUrl)}/" />`);
  if (og) head.push(`<meta property="og:image" content="${attr(og)}" />`);
  head.push(`<meta name="twitter:card" content="${og ? 'summary_large_image' : 'summary'}" />`, `<meta name="twitter:title" content="${attr(seo.title)}" />`, `<meta name="twitter:description" content="${attr(seo.description)}" />`);
  if (seo.twitterHandle) head.push(`<meta name="twitter:creator" content="${attr(seo.twitterHandle)}" />`);
  if (og) head.push(`<meta name="twitter:image" content="${attr(og)}" />`);
  if (ctx.fonts.googleHref) head.push(`<link rel="preconnect" href="https://fonts.googleapis.com" />`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`, `<link rel="stylesheet" href="${attr(ctx.fonts.googleHref)}" />`);
  head.push(`<!-- Applies the saved light/dark preference before first paint. -->`, `<script>${themeScript}</script>`);
  const ld = personJsonLd(ctx.data);
  if (ld) head.push(`<script type="application/ld+json">${jsonForHtml(ld)}</script>`);
  return `<!doctype html>
<html lang="${attr(seo.lang || 'en')}">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function mainTsx(ctx: GenCtx): string {
  const css = `./${GLOBALS_PATH['react-vite'].replace(/^src\//, '')}`;
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
${ctx.router ? `import { BrowserRouter } from 'react-router-dom';\n` : ''}import '${css}';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    ${ctx.router ? '<BrowserRouter>\n      <App />\n    </BrowserRouter>' : '<App />'}
  </StrictMode>,
);
`;
}

function appTsx(ctx: GenCtx): string {
  const shell = (inner: string) => `    <>
      <SkipLink />
      <Navbar />
      <main id="main">
${inner}
      </main>
      <Footer />
    </>`;
  const common = `import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { SectionRenderer } from '@/components/SectionRenderer';
import { pageSections } from '@/lib/content';`;
  if (!ctx.router) {
    return `${common}

export default function App() {
  return (
${shell(`        <SectionRenderer sections={pageSections('/')} />`)}
  );
}
`;
  }
  const site = ctx.data.seo;
  const routeLines = ctx.data.pages.map((p) => `  { path: '${p.path}', title: ${q(p.path === '/' ? site.title : `${p.title} | ${site.title}`)}, description: ${q(p.description || site.description)} },`);
  return `import { useEffect } from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
${common}
${ctx.hasProjectPages ? `import { ProjectDetail } from '@/components/ProjectDetail';\nimport { getProject } from '@/lib/content';\n` : ''}
const SITE_TITLE = ${q(site.title)};

/** Every page of the site. Add an entry here to add a route. */
const routes = [
${routeLines.join('\n')}
];

/** Keeps <title> and the meta description in sync with the current route. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

/** Scroll to the top (or to #anchor) on navigation. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Page({ path, title, description }: { path: string; title: string; description: string }) {
  usePageMeta(title, description);
  return <SectionRenderer sections={pageSections(path)} />;
}
${
  ctx.hasProjectPages
    ? `
function ProjectRoute() {
  const { slug = '' } = useParams();
  const project = getProject(slug);
  usePageMeta(project ? \`\${project.title} | \${SITE_TITLE}\` : \`Not found | \${SITE_TITLE}\`, project?.description ?? '');
  if (!project || !project.hasPage) return <NotFound />;
  return <ProjectDetail project={project} />;
}
`
    : ''
}
function NotFound() {
  usePageMeta(\`Page not found | \${SITE_TITLE}\`, '');
  return (
    <section style={{ padding: '8rem 1.5rem', textAlign: 'center' }} aria-labelledby="nf-title">
      <h1 id="nf-title">Page not found</h1>
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </section>
  );
}

export default function App() {
  return (
${shell(`        <ScrollManager />
        <Routes>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={<Page {...r} />} />
          ))}${ctx.hasProjectPages ? `\n          <Route path="/projects/:slug" element={<ProjectRoute />} />` : ''}
          <Route path="*" element={<NotFound />} />
        </Routes>`)}
  );
}
`;
}

function viteConfig(ctx: GenCtx): string {
  const tw = ctx.styling === 'tailwind';
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
${tw ? `import tailwindcss from '@tailwindcss/vite';\n` : ''}import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()${tw ? ', tailwindcss()' : ''}],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
`;
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
`;

function readme(ctx: GenCtx): string {
  const title = ctx.data.seo.title || 'My Portfolio';
  const spa = ctx.router
    ? `
The site uses client-side routing, so the host must serve \`index.html\` for unknown paths. This project already includes:

- \`public/_redirects\` — Netlify / Cloudflare Pages
- \`vercel.json\` — Vercel

For GitHub Pages, copy \`dist/index.html\` to \`dist/404.html\` after building. For other servers, configure a fallback to \`index.html\`.
`
    : '\nThe site is a single page, so no server configuration is needed.\n';
  return `# ${title}

Generated with Portfolio OS — the code is yours; it has no dependency on the builder.

## Stack

${stackList(ctx)
  .map((s) => `- ${s}`)
  .join('\n')}

## Development

\`\`\`bash
npm install
npm run dev        # starts the local dev server
\`\`\`

## Production

\`\`\`bash
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves dist/ locally
\`\`\`

Upload \`dist/\` to any static host (Netlify, Cloudflare Pages, GitHub Pages, S3, any web server).
${spa}${domainNote(ctx.data)}
${customizeSection(ctx)}`;
}

export class ReactViteGenerator implements ProjectGenerator {
  readonly framework = 'react-vite' as const;

  async generateProject(portfolio: Portfolio, options: ExportOptions, build?: SiteBuild): Promise<GeneratedProject> {
    const b = build ?? (await buildSiteData(portfolio, { structure: options.structure, siteUrl: options.siteUrl }));
    const ctx = createContext(portfolio, { ...options, framework: 'react-vite', images: 'img', rendering: 'static' }, b);
    const files: GeneratedFile[] = [...libraryFiles(ctx)];
    const tailwind = ctx.styling === 'tailwind';
    const deps: ToolchainPackage[] = ['react', 'react-dom', ...(ctx.router ? (['react-router-dom'] as const) : []), ...(ctx.animations ? (['motion'] as const) : [])];
    const dev: ToolchainPackage[] = ['vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom', '@types/node', ...(tailwind ? (['tailwindcss', '@tailwindcss/vite'] as const) : [])];
    files.push(text('package.json', packageJson(options.projectName, { dev: 'vite', build: 'tsc --noEmit && vite build', preview: 'vite preview' }, deps, dev, { type: 'module' })));
    files.push(text('vite.config.ts', viteConfig(ctx)));
    files.push(text('tsconfig.json', TSCONFIG));
    files.push(text('.gitignore', `${GITIGNORE_COMMON}\n# vite\ndist/\n`));
    const themeScript = themeScriptOf(files);
    files.push(text('index.html', indexHtml(ctx, portfolio, files, themeScript)));
    files.push(text('src/main.tsx', mainTsx(ctx)));
    files.push(text('src/App.tsx', appTsx(ctx)));
    files.push(text('public/robots.txt', robotsTxt(ctx)));
    files.push(text('public/sitemap.xml', sitemapXml(ctx, false)));
    if (ctx.router) {
      files.push(text('public/_redirects', '/*    /index.html   200\n'));
      files.push(text('vercel.json', `${JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2)}\n`));
    }
    files.push(text('README.md', readme(ctx)));
    void routes;
    return { framework: 'react-vite', name: options.projectName, files: dedupe(files), warnings: [...b.warnings], commands: commandsFor('react-vite', options) };
  }
}

/** The library's theme init script (inlined into index.html). */
function themeScriptOf(files: GeneratedFile[]): string {
  const f = files.find((x) => x.path === 'src/lib/theme.ts');
  const src = typeof f?.content === 'string' ? f.content : '';
  const m = /THEME_INIT_SCRIPT\s*=\s*(`[\s\S]*?`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/.exec(src);
  if (!m) return '';
  const lit = m[1]!;
  try {
    // eslint-disable-next-line no-new-func
    return lit.startsWith('`') ? lit.slice(1, -1) : (JSON.parse(lit.startsWith("'") ? `"${lit.slice(1, -1).replace(/"/g, '\\"')}"` : lit) as string);
  } catch {
    return '';
  }
}
