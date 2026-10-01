/**
 * Static content pages (resume examples, portfolio examples, guides) built by prerender.mjs.
 *
 * These pages are plain HTML: they don't boot the React app, which would send unknown
 * routes back to "/". Calls to action link into the app with full page loads.
 * Content lives in scripts/seo-content/*.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import resumeExamples from './seo-content/resume-examples.mjs';
import portfolioExamples from './seo-content/portfolio-examples.mjs';
import guides from './seo-content/guides.mjs';

// First publication date for every content page; dateModified is the build date.
const PUBLISHED = '2026-10-01';

export const CONTENT_PREFIXES = ['/resume-examples', '/portfolio-examples', '/guides'];

const SECTIONS = [
  {
    base: '/resume-examples',
    pages: resumeExamples,
    hub: {
      title: 'Free Resume Examples by Job Title (2026) — Portfolio OS',
      description: 'Resume examples for software engineers, nurses, teachers, analysts, freshers and more, with ATS keywords, writing tips and a free resume builder.',
      h1: 'Resume examples by job title',
      intro: 'Each example shows a complete sample resume for the role, the skills and keywords recruiters and applicant tracking systems look for, and the mistakes that get resumes rejected. Open the matching template in Resume Studio and make it yours, free and without signing up.',
      label: 'Resume examples',
    },
    cta: { href: '/resumes', label: 'Build this resume free' },
    kind: 'resume',
  },
  {
    base: '/portfolio-examples',
    pages: portfolioExamples,
    hub: {
      title: 'Portfolio Website Examples & Free Templates — Portfolio OS',
      description: 'Portfolio website examples and advice for developers, designers, photographers, writers and architects, with free templates you can export as HTML.',
      h1: 'Portfolio website examples by profession',
      intro: 'What to include, how to structure your projects and case studies, and how to write a homepage that gets you hired, broken down by profession. Every guide pairs with a free Portfolio OS template you can export as a standalone website.',
      label: 'Portfolio examples',
    },
    cta: { href: '/templates', label: 'Start this portfolio free' },
    kind: 'portfolio',
  },
  {
    base: '/guides',
    pages: guides,
    hub: {
      title: 'Resume, Cover Letter & Portfolio Guides — Portfolio OS',
      description: 'Practical guides to ATS-friendly resumes, cover letters, tailoring applications, JSON Resume and building a portfolio website.',
      h1: 'Career guides',
      intro: 'Clear, practical guides to the documents that get you interviews: ATS-friendly resumes, cover letters, tailoring each application and building a portfolio website.',
      label: 'Guides',
    },
    cta: { href: '/resumes', label: 'Open Resume Studio' },
    kind: 'guide',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldJson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const CSS = `:root{--bg:#fbfaf7;--fg:#17151f;--muted:#55526a;--line:#e6e3dc;--card:#fff;--accent:#5b47e0;--accent-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0f;--fg:#f1eff8;--muted:#a9a5bb;--line:#24222e;--card:#13121a;--accent:#a99cff;--accent-fg:#0b0b0f}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent)}.wrap{max-width:46rem;margin:0 auto;padding:0 16px}.wide{max-width:68rem}
header.site{border-bottom:1px solid var(--line)}header.site .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.25rem;padding-top:14px;padding-bottom:14px;font-size:14px}
header.site .brand{font-weight:700;color:var(--fg);text-decoration:none;margin-right:auto}header.site nav a{color:var(--muted);text-decoration:none;margin-left:1rem}header.site nav a:hover{color:var(--fg)}
.crumbs{font-size:13px;color:var(--muted);margin:28px 0 8px}.crumbs a{color:var(--muted)}
h1{font-size:clamp(2rem,5.5vw,2.9rem);line-height:1.1;letter-spacing:-.025em;margin:0 0 16px}h2{font-size:1.45rem;line-height:1.3;letter-spacing:-.01em;margin:44px 0 10px}h3{font-size:1.05rem;margin:0 0 4px}
p,li{color:var(--muted)}.lead{font-size:1.15rem}.meta{font-size:13px;color:var(--muted)}
.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;margin:8px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px;margin:24px 0}
.resume h3{font-size:1.5rem;margin:0}.resume .role{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 1rem;margin-top:16px}.resume .role strong{color:var(--fg)}.resume ul{margin:6px 0 0;padding-left:1.2rem}
.resume .label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:20px 0 4px;font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0;list-style:none}.chips li{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:14px}
ol.steps{padding-left:1.3rem}ol.steps li{margin-bottom:12px}ol.steps strong{color:var(--fg)}
details{border-top:1px solid var(--line);padding:14px 0}details:last-child{border-bottom:1px solid var(--line)}summary{cursor:pointer;font-weight:600;color:var(--fg)}details p{margin:8px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;padding:0;list-style:none}.grid li{margin:0}.grid a{display:block;height:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;text-decoration:none}.grid a strong{color:var(--fg);display:block;margin-bottom:4px}.grid a span{color:var(--muted);font-size:15px}
footer.site{border-top:1px solid var(--line);margin-top:64px;padding:28px 0 40px;font-size:14px}footer.site .cols{display:flex;flex-wrap:wrap;gap:24px 48px}footer.site ul{list-style:none;padding:0;margin:8px 0 0}footer.site li{margin:4px 0}footer.site a{color:var(--muted)}`;

function head({ SITE, cfg, url, title, description, jsonld }) {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<link rel="canonical" href="${url}" />
<meta name="theme-color" content="#0b0b0f" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${esc(cfg.siteName)}" />
<meta property="og:locale" content="${cfg.locale}" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}${cfg.defaultImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="${cfg.twitterCard}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${SITE}${cfg.defaultImage}" />
${ldJson({ '@context': 'https://schema.org', '@graph': jsonld })}
<style>${CSS}</style>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<header class="site"><div class="wrap wide"><a class="brand" href="/">${esc(cfg.siteName)}</a><nav aria-label="Main"><a href="/resume-examples">Resume examples</a><a href="/portfolio-examples">Portfolio examples</a><a href="/guides">Guides</a><a href="/resumes">Resume builder</a></nav></div></header>
`;
}

function footer(cfg) {
  const col = (s) => `<div><strong>${esc(s.hub.label)}</strong><ul>${s.pages.map((p) => `<li><a href="${s.base}/${p.slug}">${esc(p.h1)}</a></li>`).join('')}</ul></div>`;
  const app = `<div><strong>${esc(cfg.siteName)}</strong><ul><li><a href="/">Home</a></li><li><a href="/resumes">Resume builder</a></li><li><a href="/templates">Portfolio templates</a></li><li><a href="/documents">Cover letter builder</a></li><li><a href="/about">How it works</a></li></ul></div>`;
  return `<footer class="site"><div class="wrap wide"><div class="cols">${app}${SECTIONS.map(col).join('')}</div><p class="meta">${esc(cfg.siteName)}: a free, private portfolio website, resume and cover letter builder that runs in your browser. No sign-up, works offline.</p></div></footer>
</body>
</html>
`;
}

const breadcrumbs = (SITE, cfg, trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: cfg.siteName, url: `${SITE}/` }, ...trail].map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url })),
});

const crumbsHtml = (trail) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${trail.map((t, i) => (i === trail.length - 1 ? ` / <span aria-current="page">${esc(t.name)}</span>` : ` / <a href="${t.path}">${esc(t.name)}</a>`)).join('')}</nav>`;

function sampleResume(s) {
  const roles = s.experience
    .map((e) => `<div class="role"><span><strong>${esc(e.role)}</strong>, ${esc(e.company)}</span><span class="meta">${esc(e.dates)}</span></div><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`)
    .join('');
  return `<div class="card resume" aria-label="Sample resume"><h3>${esc(s.name)}</h3><p class="meta" style="margin:2px 0 0">${esc(s.headline)}</p><p class="label">Summary</p><p style="margin:0">${esc(s.summary)}</p><p class="label">Experience</p>${roles}<p class="label">Education</p><p style="margin:0">${esc(s.education)}</p><p class="label">Skills</p><ul class="chips">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>`;
}

function articleBody(section, page) {
  const parts = [];
  if (page.sample) parts.push(`<h2>Sample ${esc(page.h1.replace(/ example$/i, '').toLowerCase())}</h2>${sampleResume(page.sample)}`);
  if (page.template) parts.push(`<p>Recommended template: <strong>${esc(page.template)}</strong>. <a href="${section.cta.href}">Open it in ${section.kind === 'portfolio' ? 'Portfolio Studio' : 'Resume Studio'}</a> and replace the sample content with yours.</p>`);
  if (page.steps?.length) parts.push(`<h2>Step by step</h2><ol class="steps">${page.steps.map((st) => `<li><strong>${esc(st.name)}.</strong> ${esc(st.text)}</li>`).join('')}</ol>`);
  for (const sec of page.sections) {
    parts.push(`<h2>${esc(sec.heading)}</h2>${(sec.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${sec.list?.length ? `<ul>${sec.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`);
  }
  if (page.faqs?.length) parts.push(`<h2>Frequently asked questions</h2>${page.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}`);
  return parts.join('\n');
}

function relatedHtml(section, page) {
  const siblings = section.pages.filter((p) => p.slug !== page.slug);
  const others = SECTIONS.filter((s) => s !== section).map((s) => s.pages[0]).filter(Boolean);
  const items = [
    ...siblings.slice(0, 6).map((p) => ({ href: `${section.base}/${p.slug}`, p })),
    ...SECTIONS.filter((s) => s !== section).map((s, i) => ({ href: `${s.base}/${others[i].slug}`, p: others[i] })),
  ];
  return `<h2>Related</h2><ul class="grid">${items.map(({ href, p }) => `<li><a href="${href}"><strong>${esc(p.h1)}</strong><span>${esc(p.description)}</span></a></li>`).join('')}</ul>`;
}

function pageJsonLd({ SITE, cfg, section, page, url, today }) {
  const trail = [
    { name: section.hub.label, url: `${SITE}${section.base}` },
    { name: page.h1, url },
  ];
  const graph = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: page.h1,
      description: page.description,
      url,
      mainEntityOfPage: url,
      inLanguage: 'en',
      image: `${SITE}${cfg.defaultImage}`,
      datePublished: PUBLISHED,
      dateModified: today,
      author: { '@type': 'Organization', name: cfg.siteName, url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: cfg.siteName, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } },
      isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: cfg.siteName, url: `${SITE}/` },
    },
    breadcrumbs(SITE, cfg, trail),
  ];
  if (page.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return graph;
}

function writePage(dist, path, html) {
  const dir = join(dist, path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

/** Writes every content page and hub; returns sitemap entries. */
export function buildContentPages({ SITE, cfg, dist, today }) {
  const entries = [];
  for (const section of SECTIONS) {
    const hubUrl = `${SITE}${section.base}`;
    const hubLd = [
      { '@type': 'CollectionPage', '@id': `${hubUrl}#webpage`, url: hubUrl, name: section.hub.title, description: section.hub.description, inLanguage: 'en', isPartOf: { '@id': `${SITE}/#website` }, dateModified: today },
      { '@type': 'ItemList', itemListElement: section.pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${hubUrl}/${p.slug}`, name: p.h1 })) },
      breadcrumbs(SITE, cfg, [{ name: section.hub.label, url: hubUrl }]),
    ];
    const hubHtml =
      head({ SITE, cfg, url: hubUrl, title: section.hub.title, description: section.hub.description, jsonld: hubLd }) +
      `<main class="wrap wide">${crumbsHtml([{ name: section.hub.label, path: section.base }])}<h1>${esc(section.hub.h1)}</h1><p class="lead">${esc(section.hub.intro)}</p>
<ul class="grid">${section.pages.map((p) => `<li><a href="${section.base}/${p.slug}"><strong>${esc(p.h1)}</strong><span>${esc(p.description)}</span></a></li>`).join('')}</ul>
<p style="margin-top:32px"><a class="btn" href="${section.cta.href}">${esc(section.cta.label)}</a></p></main>` +
      footer(cfg);
    writePage(dist, section.base, hubHtml);
    entries.push({ path: section.base, title: section.hub.h1, description: section.hub.description, priority: 0.8, changefreq: 'weekly' });

    for (const page of section.pages) {
      const path = `${section.base}/${page.slug}`;
      const url = `${SITE}${path}`;
      const html =
        head({ SITE, cfg, url, title: page.title, description: page.description, jsonld: pageJsonLd({ SITE, cfg, section, page, url, today }) }) +
        `<main class="wrap"><article>${crumbsHtml([{ name: section.hub.label, path: section.base }, { name: page.h1, path }])}
<h1>${esc(page.h1)}</h1><p class="meta">Updated <time datetime="${today}">${new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time> · ${esc(cfg.siteName)}</p>
<p class="lead">${esc(page.intro)}</p><p><a class="btn" href="${section.cta.href}">${esc(section.cta.label)}</a></p>
${articleBody(section, page)}
<div class="card"><h3>Make yours in minutes</h3><p style="margin:4px 0 8px">Free, private and no sign-up. Everything stays in your browser, and you can export PDF, Word or a full website.</p><a class="btn" href="${section.cta.href}">${esc(section.cta.label)}</a></div>
</article>${relatedHtml(section, page)}</main>` +
        footer(cfg);
      writePage(dist, path, html);
      entries.push({ path, title: page.h1, description: page.description, priority: 0.7, changefreq: 'monthly' });
    }
  }
  return entries;
}
