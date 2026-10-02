/**
 * Shared component library for generated projects (React + Vite and Next.js).
 *
 * libraryFiles(ctx) returns every file both frameworks share: types, data, lib
 * helpers, components, sections, styles and public assets. Generators add only
 * framework files (package.json, configs, layout/pages or main/App, README, SEO).
 */
import siteTypesSource from '../site-types.ts?raw';
import type { GenCtx } from '../context';
import { binary, text, tsLiteral } from '../context';
import type { GeneratedFile } from '../types';
import { TAILWIND_THEME, tokensCss } from '../tokens';
import { LibOut } from './emit';
import { emitChrome, emitIcon, emitIslands, emitLib, emitPrimitives, emitProjectComponents } from './components';
import { emitSections, COMPONENT_NAME } from './sections';

export const GLOBALS_PATH: Record<'nextjs' | 'react-vite', string> = { nextjs: 'src/app/globals.css', 'react-vite': 'src/styles/globals.css' };

export { COMPONENT_NAME };

/** Shared base styles. In Tailwind mode the colliding tokens are prefixed with --pos-. */
export function baseCss(tailwind: boolean, chrome: { smoothScroll: boolean; grain: boolean } = { smoothScroll: true, grain: false }): string {
  const v = (name: string) => `var(--${tailwind ? 'pos-' : ''}${name})`;
  const smooth = chrome.smoothScroll ? `\n\n@media (prefers-reduced-motion: no-preference) {\n  html {\n    scroll-behavior: smooth;\n  }\n}` : '';
  // Film grain: the same SVG noise overlay as the HTML export.
  const grain = chrome.grain
    ? `\n\nbody::after {\n  content: "";\n  position: fixed;\n  inset: 0;\n  z-index: 90;\n  pointer-events: none;\n  opacity: 0.06;\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");\n}`
    : '';
  return `*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}${smooth}${grain}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: ${v('font-body')};
  font-size: var(--fs-base);
  font-weight: var(--fw-body);
  line-height: var(--lh-body);
  letter-spacing: var(--ls-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3,
h4 {
  font-family: ${v('font-heading')};
}

img,
svg,
video {
  max-width: 100%;
}

img {
  height: auto;
}

a {
  color: inherit;
}

code,
pre {
  font-family: ${v('font-mono')};
}

:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

main:focus {
  outline: none;
}

::selection {
  background: var(--c-primary);
  color: var(--c-primary-contrast);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: 1rem;
  top: -4rem;
  z-index: 100;
  border-radius: ${v('radius-btn')};
  background: var(--c-primary);
  color: var(--c-primary-contrast);
  padding: 0.75rem 1rem;
  font-weight: 600;
  text-decoration: none;
}

.skip-link:focus {
  top: 1rem;
}

.icon {
  flex-shrink: 0;
  vertical-align: -0.15em;
}

.typing-caret {
  margin-left: 1px;
  animation: caret-blink 1s steps(2, start) infinite;
}

@keyframes caret-blink {
  to {
    visibility: hidden;
  }
}

/* Long-form content rendered from Markdown (about, case studies, custom sections). */
.prose {
  max-width: 70ch;
  color: var(--c-text);
  line-height: 1.75;
}

.prose > * + * {
  margin-top: 1em;
}

.prose :where(h1, h2, h3, h4) {
  margin: 1.6em 0 0.5em;
  line-height: var(--lh-heading);
}

.prose h2 {
  font-size: var(--fs-2xl);
}

.prose h3 {
  font-size: var(--fs-xl);
}

.prose p,
.prose ul,
.prose ol {
  margin: 0;
}

.prose * + p,
.prose * + ul,
.prose * + ol {
  margin-top: 1em;
}

.prose ul,
.prose ol {
  padding-left: 1.4em;
}

.prose li + li {
  margin-top: 0.35em;
}

.prose a {
  color: var(--c-primary);
  text-underline-offset: 3px;
}

.prose blockquote {
  margin: 1.2em 0;
  border-left: 3px solid var(--c-primary);
  padding-left: 1em;
  color: var(--c-muted);
  font-style: italic;
}

.prose img {
  display: block;
  border-radius: ${v('radius-card')};
}

.prose code {
  border-radius: 4px;
  background: var(--c-surface-2);
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}

.prose pre {
  overflow-x: auto;
  border-radius: ${v('radius-card')};
  background: var(--c-surface-2);
  padding: 1rem;
}

.prose pre code {
  background: none;
  padding: 0;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
}

.prose th,
.prose td {
  border-bottom: 1px solid var(--c-border);
  padding: 0.5em;
  text-align: left;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
}

function indent(css: string, n = 2): string {
  const pad = ' '.repeat(n);
  return css
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

function styleFiles(ctx: GenCtx, out: LibOut): GeneratedFile[] {
  const files: GeneratedFile[] = [text('src/styles/tokens.css', tokensCss(ctx.portfolio, ctx.fonts, ctx.framework, ctx.styling))];
  const globals = GLOBALS_PATH[ctx.framework];
  const toStyles = ctx.framework === 'nextjs' ? '../styles/' : './';
  const custom = ctx.build.customCss.trim() ? `\n/* Custom section styles (scoped to their section). */\n${ctx.build.customCss.trim()}\n` : '';
  if (ctx.styling === 'tailwind') {
    files.push(
      text(
        globals,
        `@import "tailwindcss";
@import "${toStyles}tokens.css";

/* Design tokens → Tailwind utilities (bg-primary, text-muted, rounded-card, font-heading…). */
${TAILWIND_THEME}

@layer base {
${indent(baseCss(true, ctx.data.chrome))}
}
${custom}`,
      ),
    );
  } else {
    files.push(text('src/styles/base.css', baseCss(false, ctx.data.chrome)));
    const imports = [`@import "${toStyles}tokens.css";`, `@import "${toStyles}base.css";`];
    if (ctx.styling === 'css') {
      files.push(text('src/styles/components.css', `/* Component styles. Values come from tokens.css. */\n\n${out.collector.output()}`));
      imports.push(`@import "${toStyles}components.css";`);
    }
    files.push(text(globals, `${imports.join('\n')}\n${custom}`));
  }
  return files;
}

function faviconSvg(ctx: GenCtx): string {
  const pal = ctx.portfolio.theme.palettes[ctx.portfolio.theme.defaultScheme];
  const label = ctx.build.faviconText || (ctx.data.person.name || 'P').charAt(0).toUpperCase();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const emoji = /\p{Extended_Pictographic}/u.test(label);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${pal.primary}"/>
  <text x="32" y="${emoji ? 44 : 43}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${emoji ? 36 : 34}" font-weight="700" text-anchor="middle" fill="${pal.primaryContrast}">${esc(label)}</text>
</svg>
`;
}

/** ICO container holding one PNG image (supported by every browser). */
export function pngToIco(png: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(22 + png.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, 1, true);
  out[6] = width >= 256 ? 0 : width;
  out[7] = height >= 256 ? 0 : height;
  out[8] = 0;
  out[9] = 0;
  dv.setUint16(10, 1, true);
  dv.setUint16(12, 32, true);
  dv.setUint32(14, png.length, true);
  dv.setUint32(18, 22, true);
  out.set(png, 22);
  return out;
}

function publicFiles(ctx: GenCtx): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  for (const img of ctx.build.images) files.push(binary(`public/${img.path}`, img.bytes));
  for (const f of ctx.build.fontFiles) files.push(binary(`public/${f.path}`, f.bytes));
  files.push(text('public/favicon.svg', faviconSvg(ctx)));
  const fav = ctx.build.faviconImage;
  if (fav && fav.mime === 'image/png') files.push(binary('public/favicon.ico', pngToIco(fav.bytes, fav.width, fav.height)));
  return files;
}

export function libraryFiles(ctx: GenCtx): GeneratedFile[] {
  const out = new LibOut(ctx);
  out.files.push(text('src/types/portfolio.ts', siteTypesSource));
  out.files.push(
    text(
      'src/data/portfolio.ts',
      `import type { PortfolioData } from '@/types/portfolio';

/**
 * All of your site's content lives here: text, links, projects, page structure and
 * SEO. Edit it and the site updates. Images are in public/images/.
 */
export const portfolio: PortfolioData = ${tsLiteral(ctx.data)};
`,
    ),
  );
  emitLib(out);
  emitPrimitives(out);
  emitChrome(out);
  emitProjectComponents(out);
  emitIslands(out);
  emitSections(out);
  emitIcon(out);
  return [...out.files, ...styleFiles(ctx, out), ...publicFiles(ctx)];
}
