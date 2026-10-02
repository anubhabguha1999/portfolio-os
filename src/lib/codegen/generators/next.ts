/**
 * Next.js generator: App Router, TypeScript, Server Components by default, metadata
 * API, next/image, next/font, static export or standard deployment.
 */
import type { Portfolio } from '@/types/portfolio';
import { activePalette } from '@/lib/theme/tokens';
import { createContext, text, type GenCtx } from '../context';
import { libraryFiles } from '../library';
import type { ExportOptions, GeneratedFile, GeneratedProject, ProjectGenerator, SiteBuild } from '../types';
import type { ToolchainPackage } from '../versions';
import { buildSiteData } from '../site-model';
import { GITIGNORE_COMMON, commandsFor, customizeSection, domainNote, jsonForHtml, packageJson, personJsonLd, remoteHosts, robotsTxt, sitemapXml, stackList, PLACEHOLDER_ORIGIN, origin, routes } from './shared';

const q = (v: unknown) => JSON.stringify(v);

function nextConfig(ctx: GenCtx): string {
  const lines: string[] = [];
  if (ctx.staticExport) {
    lines.push(`  // Static HTML export: \`npm run build\` writes a deployable site to out/.`, `  output: 'export',`, `  trailingSlash: true,`, `  // The default image optimiser needs a server; exported sites serve images as-is.`, `  images: { unoptimized: true },`);
  } else {
    const hosts = remoteHosts(ctx.data);
    if (hosts.length) lines.push(`  images: {`, `    remotePatterns: [${hosts.map((h) => `{ protocol: 'https', hostname: ${q(h)} }`).join(', ')}],`, `  },`);
  }
  lines.push(`  reactStrictMode: true,`);
  return `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
${lines.join('\n')}
};

export default nextConfig;
`;
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

const ESLINT = `import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
`;

const POSTCSS = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`;

/** Only absolute image URLs can be used in metadata without a metadataBase. */
function metaImage(ctx: GenCtx, src: string | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//.test(src)) return src;
  return ctx.data.seo.siteUrl ? src : null;
}

function layout(ctx: GenCtx, portfolio: Portfolio, files: GeneratedFile[]): string {
  const { seo, person } = ctx.data;
  const has = (p: string) => files.some((f) => f.path === p);
  const fonts = ctx.fonts.nextGoogle;
  const fontImports = fonts.length ? `import { ${fonts.map((f) => f.exportName).join(', ')} } from 'next/font/google';\n` : '';
  const fontDecls = fonts
    .map((f, i) => `const font${i} = ${f.exportName}({ subsets: ['latin'], variable: ${q(f.variable)}, display: 'swap'${f.weights.length ? `, weight: ${q(f.weights)}` : ''} });`)
    .join('\n');
  const og = metaImage(ctx, seo.ogImage?.src);
  const icons: Array<Record<string, string>> = [];
  if (has('public/favicon.ico')) icons.push({ url: '/favicon.ico', sizes: 'any' });
  if (has('public/favicon.svg')) icons.push({ url: '/favicon.svg', type: 'image/svg+xml' });
  const md: string[] = [];
  if (seo.siteUrl) md.push(`  metadataBase: new URL(${q(seo.siteUrl)}),`);
  md.push(`  title: {`, `    default: ${q(seo.title)},`, `    template: ${q(`%s | ${seo.title}`)},`, `  },`);
  md.push(`  description: ${q(seo.description)},`);
  if (seo.keywords.length) md.push(`  keywords: ${q(seo.keywords)},`);
  if (seo.author) md.push(`  authors: [{ name: ${q(seo.author)}${seo.siteUrl ? `, url: ${q(seo.siteUrl)}` : ''} }],`, `  creator: ${q(seo.author)},`);
  if (seo.siteUrl) md.push(`  alternates: { canonical: '/' },`);
  md.push(
    `  openGraph: {`,
    `    type: 'website',`,
    `    title: ${q(seo.title)},`,
    `    description: ${q(seo.description)},`,
    `    siteName: ${q(seo.title)},`,
    `    locale: ${q(seo.lang.replace('-', '_'))},`,
    ...(seo.siteUrl ? [`    url: '/',`] : []),
    ...(og ? [`    images: [{ url: ${q(og)}${seo.ogImage ? `, width: ${seo.ogImage.width}, height: ${seo.ogImage.height}, alt: ${q(seo.ogImage.alt || seo.title)}` : ''} }],`] : []),
    `  },`,
    `  twitter: {`,
    `    card: ${q(og ? 'summary_large_image' : 'summary')},`,
    `    title: ${q(seo.title)},`,
    `    description: ${q(seo.description)},`,
    ...(seo.twitterHandle ? [`    creator: ${q(seo.twitterHandle)},`] : []),
    ...(og ? [`    images: [${q(og)}],`] : []),
    `  },`,
  );
  if (icons.length) md.push(`  icons: { icon: ${q(icons)} },`);
  const jsonLd = personJsonLd(ctx.data);
  const theme = activePalette(portfolio).background;
  const htmlClass = fonts.length ? ` className={[${fonts.map((_, i) => `font${i}.variable`).join(', ')}].join(' ')}` : '';
  void person;
  return `import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
${fontImports}import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
${fontDecls ? `\n${fontDecls}\n` : ''}
export const metadata: Metadata = {
${md.join('\n')}
};

export const viewport: Viewport = {
  themeColor: ${q(theme)},
};
${jsonLd ? `\n/** Structured data (schema.org) built only from information in the portfolio. */\nconst jsonLd = ${JSON.stringify(jsonLd, null, 2)};\n` : ''}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang=${q(seo.lang || 'en')}${htmlClass} suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark preference before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />${jsonLd ? `\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\\\u003c') }} />` : ''}
      </head>
      <body>
        <SkipLink />
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
`;
}

function pageFile(ctx: GenCtx, path: string): string {
  const page = ctx.data.pages.find((p) => p.path === path)!;
  const name = path === '/' ? 'HomePage' : `${path.slice(1)[0]!.toUpperCase()}${path.slice(2)}Page`;
  const meta =
    path === '/'
      ? ''
      : `
export const metadata: Metadata = {
  title: ${q(page.title)},
  description: ${q(page.description || ctx.data.seo.description)},${ctx.data.seo.siteUrl ? `\n  alternates: { canonical: ${q(path)} },` : ''}
};
`;
  return `${path === '/' ? '' : `import type { Metadata } from 'next';\n`}import { SectionRenderer } from '@/components/SectionRenderer';
import { pageSections } from '@/lib/content';
${meta}
export default function ${name}() {
  return <SectionRenderer sections={pageSections(${q(path)})} />;
}
`;
}

function projectPage(ctx: GenCtx): string {
  const base = ctx.data.seo.siteUrl;
  return `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProjectDetail } from '@/components/ProjectDetail';
import { getProject, projectPages } from '@/lib/content';
import { portfolio } from '@/data/portfolio';
import type { Project } from '@/types/portfolio';

type Props = { params: Promise<{ slug: string }> };
${ctx.staticExport ? `\n// Static export: only the project pages listed below exist.\nexport const dynamicParams = false;\n` : ''}
export function generateStaticParams() {
  return projectPages().map((project) => ({ slug: project.slug }));
}

/** Metadata images must be absolute unless the site has a metadataBase. */
function shareImage(project: Project): string | undefined {
  const src = project.image?.src;
  if (!src) return undefined;
  return ${base ? 'src' : `/^https?:\\/\\//.test(src) ? src : undefined`};
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  const image = shareImage(project);
  return {
    title: project.title,
    description: project.description,${base ? `\n    alternates: { canonical: \`/projects/\${project.slug}\` },` : ''}
    openGraph: {
      type: 'article',
      title: project.title,
      description: project.description,
      ...(image ? { images: [{ url: image, alt: project.image?.alt || project.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: project.title,
      description: project.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** schema.org CreativeWork using only the project's own data. */
function projectJsonLd(project: Project) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    ...(project.description ? { description: project.description } : {}),
    ...(portfolio.person.name ? { author: { '@type': 'Person', name: portfolio.person.name } } : {}),
    ...(project.technologies.length ? { keywords: project.technologies.join(', ') } : {}),
    ...(shareImage(project) ? { image: shareImage(project) } : {}),
    ...(project.live ? { url: project.live } : {}),
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project || !project.hasPage) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd(project)).replace(/</g, '\\\\u003c') }} />
      <ProjectDetail project={project} />
    </>
  );
}
`;
}

function sitemapTs(ctx: GenCtx): string {
  const o = origin(ctx.data);
  return `import type { MetadataRoute } from 'next';
${ctx.data.seo.siteUrl ? '' : `\n// TODO: replace ${PLACEHOLDER_ORIGIN} with your domain.\n`}const BASE = ${q(o)};

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ${q(routes(ctx))};
  return paths.map((path) => ({ url: \`\${BASE}\${path === '/' ? '' : path}\`, lastModified: new Date() }));
}
`;
}

function robotsTs(ctx: GenCtx): string {
  return `import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: ${q(`${origin(ctx.data)}/sitemap.xml`)},
  };
}
`;
}

function readme(ctx: GenCtx): string {
  const title = ctx.data.seo.title || 'My Portfolio';
  const deploy = ctx.staticExport
    ? `## Production (static export)

\`\`\`bash
npm run build      # writes the complete static site to out/
npx serve out      # optional: preview the exported files locally
\`\`\`

Upload the contents of \`out/\` to any static host:

- **GitHub Pages** — push \`out/\` to a \`gh-pages\` branch (or use a Pages workflow). For a project site served from \`/<repo>/\`, add \`basePath: '/<repo>'\` to \`next.config.ts\`.
- **Netlify / Cloudflare Pages** — build command \`npm run build\`, publish directory \`out\`.
- **Amazon S3 / any static server** — copy \`out/\` to the bucket or web root; each route is an \`index.html\` in its own folder (\`trailingSlash: true\`).

This project has no server code, so it runs anywhere HTML can be served.
`
    : `## Production

\`\`\`bash
npm run build
npm run start      # serves the optimised production build
\`\`\`

Deploy to any Next.js-compatible platform (Vercel, Netlify, a Node.js server, Docker…). This is a standard Next.js app, so you can later add API routes, server actions or dynamic rendering.
`;
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

${deploy}${domainNote(ctx.data)}
${customizeSection(ctx)}
## Routes

${routes(ctx)
  .map((r) => `- \`${r}\``)
  .join('\n')}
`;
}

export class NextJsGenerator implements ProjectGenerator {
  readonly framework = 'nextjs' as const;

  async generateProject(portfolio: Portfolio, options: ExportOptions, build?: SiteBuild): Promise<GeneratedProject> {
    const b = build ?? (await buildSiteData(portfolio, { structure: options.structure, siteUrl: options.siteUrl, animations: options.animations }));
    const ctx = createContext(portfolio, { ...options, framework: 'nextjs' }, b);
    const files: GeneratedFile[] = [...libraryFiles(ctx)];
    const tailwind = ctx.styling === 'tailwind';
    const deps: ToolchainPackage[] = ['next', 'react', 'react-dom', ...(ctx.animations ? (['motion'] as const) : [])];
    const dev: ToolchainPackage[] = ['typescript', '@types/react', '@types/react-dom', '@types/node', 'eslint', 'eslint-config-next', ...(tailwind ? (['tailwindcss', '@tailwindcss/postcss'] as const) : [])];
    const scripts: Record<string, string> = { dev: 'next dev', build: 'next build', ...(ctx.staticExport ? {} : { start: 'next start' }), lint: 'eslint' };
    files.push(text('package.json', packageJson(options.projectName, scripts, deps, dev)));
    files.push(text('next.config.ts', nextConfig(ctx)));
    files.push(text('tsconfig.json', TSCONFIG));
    files.push(text('eslint.config.mjs', ESLINT));
    if (tailwind) files.push(text('postcss.config.mjs', POSTCSS));
    files.push(text('.gitignore', `${GITIGNORE_COMMON}\n# next.js\n.next/\nout/\nbuild/\nnext-env.d.ts\n`));
    files.push(text('src/app/layout.tsx', layout(ctx, portfolio, files)));
    for (const page of ctx.data.pages) files.push(text(page.path === '/' ? 'src/app/page.tsx' : `src/app${page.path}/page.tsx`, pageFile(ctx, page.path)));
    if (ctx.hasProjectPages) files.push(text('src/app/projects/[slug]/page.tsx', projectPage(ctx)));
    if (ctx.staticExport) {
      files.push(text('public/robots.txt', robotsTxt(ctx)));
      files.push(text('public/sitemap.xml', sitemapXml(ctx, true)));
    } else {
      files.push(text('src/app/sitemap.ts', sitemapTs(ctx)));
      files.push(text('src/app/robots.ts', robotsTs(ctx)));
    }
    files.push(text('README.md', readme(ctx)));
    void jsonForHtml;
    return { framework: 'nextjs', name: options.projectName, files: dedupe(files), warnings: [...b.warnings], commands: commandsFor('nextjs', options) };
  }
}

/** Later files win (generators may override library defaults). */
export function dedupe(files: GeneratedFile[]): GeneratedFile[] {
  const map = new Map<string, GeneratedFile>();
  for (const f of files) map.set(f.path, f);
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}
