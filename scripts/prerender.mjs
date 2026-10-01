/**
 * Post-build SEO step (runs after `vite build`).
 *
 * For every indexable route in src/config/seo-routes.json it writes dist/<route>/index.html
 * with that route's own <title>, description, canonical, Open Graph/Twitter tags,
 * JSON-LD and real, readable content inside #root. Crawlers get a complete page
 * without running JavaScript; React replaces the content when the app boots.
 *
 * It also writes:
 *   dist/app.html     — SPA shell (noindex) served for private routes (editors, share links)
 *   dist/sitemap.xml  — indexable routes only
 *   dist/robots.txt   — crawl rules + sitemap location
 *   dist/llms.txt     — plain-text site summary for AI crawlers
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContentPages } from './content-pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const cfg = JSON.parse(readFileSync(join(root, 'src/config/seo-routes.json'), 'utf8'));
const SITE = (process.env.VITE_SITE_URL || cfg.siteUrl).replace(/\/$/, '');
// index.html hard-codes the default domain; swap it when VITE_SITE_URL points elsewhere.
const template = readFileSync(join(dist, 'index.html'), 'utf8').replaceAll(cfg.siteUrl, SITE);
const today = new Date().toISOString().slice(0, 10);
const indexable = cfg.routes.filter((r) => r.index);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urlOf = (path) => `${SITE}${path === '/' ? '/' : path}`;
const ldJson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/* ------------------------------ JSON-LD ------------------------------ */

const org = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: cfg.siteName, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 } };
const website = { '@type': 'WebSite', '@id': `${SITE}/#website`, name: cfg.siteName, url: `${SITE}/`, inLanguage: 'en', publisher: { '@id': `${SITE}/#organization` } };
const app = {
  '@type': 'WebApplication',
  '@id': `${SITE}/#app`,
  name: cfg.siteName,
  url: `${SITE}/`,
  description: indexable[0].description,
  applicationCategory: 'DesignApplication',
  applicationSubCategory: 'Portfolio and resume builder',
  operatingSystem: 'Any (runs in a modern web browser)',
  browserRequirements: 'Requires JavaScript and IndexedDB. Works offline once installed.',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  image: `${SITE}${cfg.defaultImage}`,
  screenshot: `${SITE}${cfg.defaultImage}`,
  featureList: [
    'Portfolio website builder with templates and themes',
    'Resume and CV builder with 12 templates and ATS checks',
    'Cover letter and document templates',
    'Import JSON Resume files',
    'Export to HTML, PDF, DOCX, ZIP, Next.js and Vite',
    'Works offline; data stays in the browser',
  ],
  publisher: { '@id': `${SITE}/#organization` },
};

function jsonLdFor(route) {
  const page = {
    '@type': 'WebPage',
    '@id': `${urlOf(route.path)}#webpage`,
    url: urlOf(route.path),
    name: route.title,
    description: route.description,
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE}/#website` },
    about: { '@id': `${SITE}/#app` },
    primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE}${cfg.defaultImage}` },
    dateModified: today,
  };
  const graph = [org, website, app, page];
  if (route.path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: cfg.siteName, item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: route.h1 ?? route.title, item: urlOf(route.path) },
      ],
    });
  }
  return ldJson({ '@context': 'https://schema.org', '@graph': graph });
}

/* ---------------------------- static body ---------------------------- */

const NAV_LABELS = { '/': 'Home', '/resumes': 'Resume builder', '/templates': 'Portfolio templates', '/documents': 'Cover letters & documents', '/new': 'Create a portfolio', '/about': 'How it works' };

const HUB_LINKS = [
  ['/resume-examples', 'Resume examples by job title', 'Sample resumes, ATS keywords and writing tips for each role.'],
  ['/portfolio-examples', 'Portfolio website examples', 'What to include in a portfolio for developers, designers, photographers and more.'],
  ['/guides', 'Career guides', 'ATS-friendly resumes, cover letters, tailoring and portfolio websites.'],
]
  .map(([path, name, desc]) => `<li><a href="${path}"><strong>${name}</strong></a> — ${desc}</li>`)
  .join('');

function contentFor(route) {
  const nav = indexable.map((r) => `<li><a href="${r.path}"${r.path === route.path ? ' aria-current="page"' : ''}>${esc(NAV_LABELS[r.path] ?? r.h1 ?? r.title)}</a></li>`).join('');
  const points = (route.points ?? []).map((p) => `<li>${esc(p)}</li>`).join('');
  const related = indexable
    .filter((r) => r.path !== route.path)
    .map((r) => `<li><a href="${r.path}"><strong>${esc(r.h1 ?? r.title)}</strong></a> — ${esc(r.description)}</li>`)
    .join('');
  return `<div id="seo-shell"><style>#seo-shell{max-width:72rem;margin:0 auto;padding:1.25rem 1rem 4rem;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e7e5f0;background:#0b0b0f;min-height:100vh}#seo-shell a{color:#a99cff}#seo-shell nav ul{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;list-style:none;padding:0;margin:0 0 3rem;font-size:14px}#seo-shell h1{font-size:clamp(2rem,5vw,3.25rem);line-height:1.05;letter-spacing:-.03em;margin:0 0 1rem;color:#fff}#seo-shell h2{font-size:1.25rem;margin:2.5rem 0 .75rem;color:#fff}#seo-shell p{max-width:44rem;color:#b9b6c8}#seo-shell ul.points,#seo-shell ul.related{padding-left:1.25rem;color:#b9b6c8}#seo-shell footer{margin-top:3rem;font-size:13px;color:#8f8ba3}</style>
<header><nav aria-label="Main"><ul><li><a href="/"><strong>${esc(cfg.siteName)}</strong></a></li>${nav}</ul></nav></header>
<main><h1>${esc(route.h1 ?? route.title)}</h1><p>${esc(route.intro ?? route.description)}</p>${points ? `<h2>Features</h2><ul class="points">${points}</ul>` : ''}<p><a href="${route.path === '/resumes' ? '/resumes' : route.path === '/documents' ? '/documents' : '/new'}">Get started free</a>, no sign-up needed.</p><h2>Explore ${esc(cfg.siteName)}</h2><ul class="related">${related}${HUB_LINKS}</ul></main>
<footer>${esc(cfg.siteName)}: a free, private portfolio website, resume and cover letter builder that runs in your browser.</footer></div>`;
}

/* ------------------------------- head -------------------------------- */

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html is missing <meta ${attr}="${key}">`);
  return html.replace(re, `$1${esc(value)}$2`);
}

function pageHtml(route) {
  let html = template;
  const url = urlOf(route.path);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`);
  html = setMeta(html, 'name', 'description', route.description);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:title', route.title);
  html = setMeta(html, 'property', 'og:description', route.description);
  html = setMeta(html, 'name', 'twitter:title', route.title);
  html = setMeta(html, 'name', 'twitter:description', route.description);
  html = html.replace('<!-- seo:jsonld -->', jsonLdFor(route));
  html = html.replace('<!-- seo:content -->', contentFor(route));
  return html;
}

for (const route of indexable) {
  const out = route.path === '/' ? join(dist, 'index.html') : join(dist, route.path.slice(1), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, pageHtml(route));
}

// SPA shell for private routes: same app, never indexed, no marketing copy.
let shell = template
  .replace(/<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex, nofollow"')
  .replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '')
  .replace('<!-- seo:jsonld -->', '')
  .replace('<!-- seo:content -->', '');
writeFileSync(join(dist, 'app.html'), shell);

/* --------------------------- content pages --------------------------- */

const contentPages = buildContentPages({ SITE, cfg, dist, today });

/* ------------------------- sitemap / robots -------------------------- */

const sitemapRoutes = [...indexable, ...contentPages];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapRoutes
  .map(
    (r) => `  <url>
    <loc>${urlOf(r.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq ?? 'monthly'}</changefreq>
    <priority>${(r.priority ?? 0.5).toFixed(1)}</priority>${r.path === '/' ? `\n    <image:image><image:loc>${SITE}${cfg.defaultImage}</image:loc></image:image>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

const privatePaths = cfg.routes.filter((r) => !r.index).map((r) => r.path);
const robots = `# ${cfg.siteName}: public pages are open to every crawler, including AI search crawlers.
User-agent: *
Allow: /
${privatePaths.map((p) => `Disallow: ${p}`).join('\n')}

Sitemap: ${SITE}/sitemap.xml
`;
writeFileSync(join(dist, 'robots.txt'), robots);

const llms = `# ${cfg.siteName}

> ${indexable[0].description}

${cfg.siteName} is a free, local-first web app. Everything runs in the browser: there are no accounts, no uploads and no tracking, and it works offline once installed.

## Pages

${indexable.map((r) => `- [${r.h1 ?? r.title}](${urlOf(r.path)}): ${r.description}`).join('\n')}

## Resume examples, portfolio examples and guides

${contentPages.map((r) => `- [${r.title}](${urlOf(r.path)}): ${r.description}`).join('\n')}

## Key facts

- Price: free
- Platforms: any modern web browser (installable as a PWA)
- Exports: standalone HTML, PDF, Word (DOCX), ZIP website, Next.js and Vite source code
- Resume Studio: 12 templates, ATS checks, JSON Resume import, PDF/DOCX/TXT/JSON export
- Privacy: data is stored in the browser (IndexedDB) and never sent to a server
`;
writeFileSync(join(dist, 'llms.txt'), llms);

console.log(`prerender: ${indexable.length} app pages, ${contentPages.length} content pages, app.html, sitemap.xml (${sitemapRoutes.length} urls), robots.txt, llms.txt → ${SITE}`);
