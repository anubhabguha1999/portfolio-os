/**
 * HTML packaging on top of the Portfolio Engine: resolves every asset reference into
 * either inline data URLs (standalone file) or relative file paths (website ZIP).
 */
import type { Portfolio } from '@/types/portfolio';
import { renderPortfolio, type RenderResult } from '@/lib/engine/render';
import { collectAssetIds, collectImages } from '@/lib/engine/collect';
import { jsonForScript } from '@/utils/escape';
import {
  loadAssets,
  blobToBytes,
  bytesToDataUrl,
  extensionFor,
  isExternalImage,
  missingAssetWarning,
  defaultExternalFetcher,
  type AssetLoader,
  type ExternalFetcher,
} from '@/lib/export/assets';

export interface HtmlEnv {
  loader?: AssetLoader;
  fetcher?: ExternalFetcher;
  /** Try to download remote (https) images so the output needs no network. Default true. */
  inlineExternal?: boolean;
}

export interface PackagedFile {
  path: string;
  bytes: Uint8Array;
}

interface AssetPlan {
  /** asset id → URL used in HTML */
  urls: Map<string, string>;
  /** custom font asset id → URL used inside CSS */
  fontUrls: Map<string, string>;
  /** remote image URL → replacement */
  external: Map<string, string>;
  files: PackagedFile[];
  warnings: string[];
}

/** Base64 encoding is the slow part of live previews; blobs are immutable, so cache it. */
const dataUrlCache = new WeakMap<Blob, Map<string, string>>();

async function cachedDataUrl(blob: Blob, bytes: () => Promise<Uint8Array>, mime: string): Promise<string> {
  let byMime = dataUrlCache.get(blob);
  const hit = byMime?.get(mime);
  if (hit) return hit;
  const url = bytesToDataUrl(await bytes(), mime);
  if (!byMime) {
    byMime = new Map();
    dataUrlCache.set(blob, byMime);
  }
  byMime.set(mime, url);
  return url;
}

function fontIds(p: Portfolio): Set<string> {
  return new Set(p.metadata.customFonts.map((f) => f.assetId));
}

function fontMimeFor(p: Portfolio, id: string, mime: string): string {
  if (mime && mime !== 'application/octet-stream') return mime;
  const f = p.metadata.customFonts.find((x) => x.assetId === id);
  const byFormat: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' };
  return (f && byFormat[f.format]) || 'application/octet-stream';
}

/** Remote image URLs referenced by visible content (deduplicated). */
export function externalImageUrls(p: Portfolio): string[] {
  const urls = new Set<string>();
  for (const i of collectImages(p)) if (isExternalImage(i.ref.src)) urls.add(i.ref.src.trim());
  if (isExternalImage(p.metadata.favicon)) urls.add(p.metadata.favicon.trim());
  return [...urls];
}

async function planAssets(p: Portfolio, target: 'inline' | 'files', env: HtmlEnv): Promise<AssetPlan> {
  const plan: AssetPlan = { urls: new Map(), fontUrls: new Map(), external: new Map(), files: [], warnings: [] };
  const fonts = fontIds(p);
  const { assets, missing } = await loadAssets(p, collectAssetIds(p, false), env.loader);
  if (missing.length) plan.warnings.push(missingAssetWarning(missing.length));

  for (const [id, a] of assets) {
    const isFont = fonts.has(id);
    const mime = isFont ? fontMimeFor(p, id, a.mime) : a.mime;
    if (target === 'inline') {
      const url = await cachedDataUrl(a.blob, () => blobToBytes(a.blob), mime);
      if (isFont) plan.fontUrls.set(id, url);
      else plan.urls.set(id, url);
    } else {
      const bytes = await blobToBytes(a.blob);
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = extensionFor(mime, a.name);
      if (isFont) {
        plan.files.push({ path: `assets/fonts/${safeId}.${ext}`, bytes });
        // Referenced from css/styles.css, hence the parent hop.
        plan.fontUrls.set(id, `../assets/fonts/${safeId}.${ext}`);
      } else {
        plan.files.push({ path: `assets/images/${safeId}.${ext}`, bytes });
        plan.urls.set(id, `assets/images/${safeId}.${ext}`);
      }
    }
  }

  if (env.inlineExternal !== false) {
    const fetcher = env.fetcher ?? defaultExternalFetcher;
    const remote = externalImageUrls(p);
    let failed = 0;
    let n = 0;
    for (const url of remote) {
      const blob = await fetcher(url).catch(() => null);
      if (!blob) {
        failed++;
        continue;
      }
      const bytes = await blobToBytes(blob);
      const mime = blob.type || 'image/png';
      if (target === 'inline') plan.external.set(url, bytesToDataUrl(bytes, mime));
      else {
        n++;
        const path = `assets/images/remote-${n}.${extensionFor(mime)}`;
        plan.files.push({ path, bytes });
        plan.external.set(url, path);
      }
    }
    if (failed) plan.warnings.push(`${failed} external image${failed === 1 ? '' : 's'} could not be downloaded (offline or blocked by CORS) and will load from the original URL.`);
  }
  return plan;
}

/** Deep copy with remote image URLs swapped for their packaged replacements. */
function rewriteExternal(p: Portfolio, map: Map<string, string>): Portfolio {
  if (!map.size) return p;
  const walk = (v: unknown, key: string | null): unknown => {
    if (typeof v === 'string') return (key === 'src' || key === 'favicon') && map.has(v.trim()) ? map.get(v.trim()) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, null));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val, k);
      return out;
    }
    return v;
  };
  return { ...p, sections: walk(p.sections, null) as Portfolio['sections'], metadata: walk(p.metadata, null) as Portfolio['metadata'] };
}

const DATA_BLOCK = /<script type="application\/json" id="pos-data">[\s\S]*?<\/script>/;

/** Embedded data is always the user's original portfolio (asset refs intact, no inlined blobs). */
function restoreEmbeddedData(html: string, original: Portfolio): string {
  return html.replace(DATA_BLOCK, () => `<script type="application/json" id="pos-data">${jsonForScript(original)}</script>`);
}

export interface StandaloneHtml {
  html: string;
  warnings: string[];
}

/** One self-contained HTML file: images + fonts as data URLs, CSS and runtime inline. */
export async function buildStandaloneHtml(p: Portfolio, opts: { fontDelivery: 'system' | 'cdn'; embedData: boolean }, env: HtmlEnv = {}): Promise<StandaloneHtml> {
  const plan = await planAssets(p, 'inline', env);
  const rendered = renderPortfolio(rewriteExternal(p, plan.external), {
    mode: 'export',
    assetUrl: (id) => plan.urls.get(id) ?? null,
    fontUrl: (id) => plan.fontUrls.get(id) ?? null,
    fontDelivery: opts.fontDelivery,
    embedData: opts.embedData,
  });
  const html = opts.embedData ? restoreEmbeddedData(rendered.html, p) : rendered.html;
  return { html, warnings: plan.warnings };
}

export interface SitePackage {
  files: PackagedFile[];
  warnings: string[];
  render: RenderResult;
}

const FAVICON_DATA = /<link rel="icon" href="data:image\/svg\+xml,([^"]*)">/;

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function siteUrlOf(p: Portfolio): string {
  const raw = p.metadata.siteUrl.trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const u = new URL(raw);
    return u.toString().endsWith('/') ? u.toString() : `${u.toString()}/`;
  } catch {
    return '';
  }
}

function readme(p: Portfolio, siteUrl: string): string {
  const title = p.metadata.title || 'Portfolio';
  return `# ${title}

This folder is a complete, static website generated by Portfolio OS.
It has no build step and no server code — any static host can serve it.

## Preview locally

Open \`index.html\` in your browser (double-click it). Everything uses relative
paths, so it works straight from disk.

## Deploy

### Netlify (drag & drop)
1. Go to https://app.netlify.com/drop
2. Drag this whole \`portfolio\` folder onto the page.
3. Your site is live on a \`*.netlify.app\` URL — add a custom domain in Site settings.

### Vercel
1. Install the CLI: \`npm i -g vercel\`
2. From inside this folder run: \`vercel --prod\`
   (or import the folder from a Git repository at https://vercel.com/new — framework preset "Other", no build command, output directory \`.\`).

### GitHub Pages
1. Create a repository and push the contents of this folder to the \`main\` branch.
2. In the repository: Settings → Pages → "Deploy from a branch" → \`main\` / \`(root)\`.
3. The included \`.nojekyll\` file makes GitHub serve every file as-is. Sub-path URLs
   (\`https://<user>.github.io/<repo>/\`) work because all links are relative.

### Cloudflare Pages
1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Pages → "Upload assets".
2. Upload this folder. No build command is needed.

### Any other static host
Upload every file in this folder (keeping the structure) to your web root — S3,
Firebase Hosting, Render, Surge, nginx, Apache… \`index.html\` is the entry point and
\`404.html\` is the not-found page.

## Files

| Path | Purpose |
| --- | --- |
| \`index.html\` | The page |
| \`css/styles.css\` | Theme + layout styles |
| \`js/app.js\` | Small runtime (navigation, theme toggle, animations) |
| \`assets/images/\` | Your images |
| \`assets/fonts/\` | Custom fonts |
| \`assets/icons/\` | Favicon |
| \`robots.txt\` | Search engine rules |
${siteUrl ? '| `sitemap.xml` | Sitemap for search engines |\n' : ''}| \`404.html\` | Not-found page |
| \`.nojekyll\` | Tells GitHub Pages to skip Jekyll processing |
${siteUrl ? `\nConfigured site URL: ${siteUrl}\n` : '\nTip: set a Site URL in the SEO settings before exporting to get a sitemap and absolute social-share links.\n'}`;
}

function notFoundPage(p: Portfolio, render: RenderResult, siteUrl: string): string {
  const pal = p.theme.palettes[p.theme.defaultScheme];
  const title = p.metadata.title || 'Portfolio';
  const lang = xmlEsc(p.metadata.language || 'en');
  const home = siteUrl || './';
  const favicon = FAVICON_DATA.exec(render.html) ? '<link rel="icon" href="assets/icons/favicon.svg">' : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found · ${xmlEsc(title)}</title>
<meta name="robots" content="noindex">
${siteUrl ? favicon.replace('assets/', `${siteUrl}assets/`) : favicon}
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-items:center;background:${pal.background};color:${pal.text};font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px}
  h1{font-size:clamp(48px,12vw,96px);margin:0;letter-spacing:-.04em;color:${pal.primary}}
  p{color:${pal.muted};margin:8px 0 24px}
  a{display:inline-block;padding:10px 18px;border-radius:999px;background:${pal.primary};color:${pal.primaryContrast};text-decoration:none;font-weight:600}
</style>
</head>
<body>
<main>
<h1>404</h1>
<p>This page doesn't exist.</p>
<a href="${xmlEsc(home)}">Back to ${xmlEsc(title)}</a>
</main>
</body>
</html>
`;
}

/** Every file of the deployable website, relative to the `portfolio/` root. */
export async function buildSitePackage(p: Portfolio, opts: { fontDelivery: 'system' | 'cdn'; embedData: boolean }, env: HtmlEnv = {}): Promise<SitePackage> {
  const plan = await planAssets(p, 'files', env);
  const render = renderPortfolio(rewriteExternal(p, plan.external), {
    mode: 'export',
    assetUrl: (id) => plan.urls.get(id) ?? null,
    fontUrl: (id) => plan.fontUrls.get(id) ?? null,
    fontDelivery: opts.fontDelivery,
    embedData: opts.embedData,
    external: { cssHref: 'css/styles.css', jsSrc: 'js/app.js' },
  });
  const enc = new TextEncoder();
  const files: PackagedFile[] = [];
  let html = opts.embedData ? restoreEmbeddedData(render.html, p) : render.html;

  const fav = FAVICON_DATA.exec(html);
  if (fav) {
    let svg = '';
    try {
      svg = decodeURIComponent(decodeEntities(fav[1] ?? ''));
    } catch {
      svg = '';
    }
    if (svg) {
      files.push({ path: 'assets/icons/favicon.svg', bytes: enc.encode(svg) });
      html = html.replace(FAVICON_DATA, '<link rel="icon" type="image/svg+xml" href="assets/icons/favicon.svg">');
    }
  }

  const siteUrl = siteUrlOf(p);
  files.push({ path: 'index.html', bytes: enc.encode(html) });
  files.push({ path: 'css/styles.css', bytes: enc.encode(render.css) });
  files.push({ path: 'js/app.js', bytes: enc.encode(render.js) });
  files.push(...plan.files);
  files.push({ path: 'README.md', bytes: enc.encode(readme(p, siteUrl)) });
  files.push({ path: 'robots.txt', bytes: enc.encode(`User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}sitemap.xml\n` : ''}`) });
  if (siteUrl) {
    const lastmod = (p.metadata.updatedAt || new Date().toISOString()).slice(0, 10);
    files.push({
      path: 'sitemap.xml',
      bytes: enc.encode(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${xmlEsc(siteUrl)}</loc>\n    <lastmod>${xmlEsc(lastmod)}</lastmod>\n  </url>\n</urlset>\n`),
    });
  }
  files.push({ path: '.nojekyll', bytes: new Uint8Array(0) });
  files.push({ path: '404.html', bytes: enc.encode(notFoundPage(p, render, siteUrl)) });
  return { files, warnings: plan.warnings, render };
}

/* ------------------------------------------------------------------ */
/* Print                                                               */
/* ------------------------------------------------------------------ */

let activePrintFrame: HTMLIFrameElement | null = null;

/**
 * Print-optimised version: renders the standalone document into a hidden iframe and opens
 * the browser print dialog (relies on the engine's `@media print` rules). Scripts are not
 * executed inside the frame; print CSS makes animated content visible.
 */
export async function printPortfolio(p: Portfolio, env: HtmlEnv = {}): Promise<{ warnings: string[] }> {
  const { html, warnings } = await buildStandaloneHtml(p, { fontDelivery: p.settings.fontDelivery, embedData: false }, env);
  activePrintFrame?.remove();
  const frame = document.createElement('iframe');
  activePrintFrame = frame;
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Print version';
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0', pointerEvents: 'none' });
  await new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error('The print version could not be prepared.'));
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error('The print version could not be prepared.');
  }
  const cleanup = () => {
    if (activePrintFrame === frame) activePrintFrame = null;
    frame.remove();
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  // Web fonts (CDN mode) should be ready before the print snapshot.
  try {
    await win.document.fonts?.ready;
  } catch {
    /* fonts API unavailable */
  }
  win.focus();
  win.print();
  return { warnings };
}
