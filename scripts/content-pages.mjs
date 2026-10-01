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

const AUTHOR_URL = 'https://anubhab-guha.vercel.app/';

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
    hubCta: 'Open Resume Studio',
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
    hubCta: 'Browse portfolio templates',
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

const CSS = `:root{color-scheme:dark;--bg:#08080b;--panel:#111117;--elevated:#17171f;--line:#25252f;--line-strong:#34343f;--fg:#ededf2;--muted:#a0a0ad;--subtle:#6c6c7a;--accent:#8b7cff;--accent-strong:#a397ff;--accent-fg:#0b0716;--accent-soft:rgba(139,124,255,.14);--ok:#3ecf8e;--paper:#fdfcf9;--ink:#1d1b24;--ink-muted:#5a5766;--shadow:0 30px 80px -40px rgba(0,0,0,.8);--sans:'Inter var','Inter',ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;--display:'Iowan Old Style','Palatino Linotype','URW Palladio L',P052,Georgia,serif;--mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace}
@media (prefers-color-scheme:light){:root{color-scheme:light;--bg:#f6f6f8;--panel:#fff;--elevated:#fff;--line:#e4e4ea;--line-strong:#d3d3dc;--fg:#16161d;--muted:#5c5c6b;--subtle:#8a8a98;--accent:#6a58f5;--accent-strong:#5543e6;--accent-fg:#fff;--accent-soft:rgba(106,88,245,.1);--ok:#149f63;--shadow:0 30px 70px -45px rgba(22,22,40,.35)}}
*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body::before{content:"";position:fixed;inset:-20% -10% auto;height:620px;z-index:-1;pointer-events:none;background:radial-gradient(48% 60% at 24% 30%,var(--accent-soft),transparent 70%),radial-gradient(40% 50% at 80% 10%,rgba(90,176,255,.08),transparent 70%)}
a{color:inherit}img,svg{display:block}:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.wrap{width:100%;max-width:72rem;margin:0 auto;padding:0 16px}@media (min-width:640px){.wrap{padding:0 24px}}
.skip{position:absolute;left:12px;top:-60px;z-index:60;background:var(--accent);color:var(--accent-fg);padding:8px 14px;border-radius:10px;font-weight:600;text-decoration:none}.skip:focus{top:12px}
/* header */
header.site{position:sticky;top:0;z-index:40;border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent);background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px)}
header.site .wrap{display:flex;align-items:center;gap:12px;height:60px}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:650;font-size:14.5px;letter-spacing:-.01em;text-decoration:none;color:var(--fg);flex-shrink:0}.brand svg{width:26px;height:26px}
.nav{display:flex;gap:2px;margin-left:16px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}.nav::-webkit-scrollbar{display:none}
.nav a{white-space:nowrap;padding:7px 11px;border-radius:9px;font-size:13.5px;color:var(--muted);text-decoration:none;transition:color .15s,background .15s}.nav a:hover{color:var(--fg);background:var(--elevated)}.nav a[aria-current]{color:var(--fg);background:var(--elevated);box-shadow:inset 0 0 0 1px var(--line)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 18px;border-radius:11px;background:var(--accent);color:var(--accent-fg);font-weight:600;font-size:14px;text-decoration:none;white-space:nowrap;box-shadow:0 8px 24px -10px var(--accent);transition:background .15s,transform .15s}.btn:hover{background:var(--accent-strong);transform:translateY(-1px)}
.btn.sm{height:34px;padding:0 13px;font-size:13px;border-radius:10px;box-shadow:none}.btn.ghost{background:transparent;color:var(--fg);box-shadow:inset 0 0 0 1px var(--line-strong)}.btn.ghost:hover{background:var(--elevated)}
.btn svg{width:15px;height:15px}
.subnav{display:none;gap:6px;overflow-x:auto;padding:10px 16px;border-bottom:1px solid var(--line);scrollbar-width:none}.subnav::-webkit-scrollbar{display:none}.subnav a{white-space:nowrap;font-size:13px;padding:6px 11px;border-radius:999px;border:1px solid var(--line);color:var(--muted);text-decoration:none}.subnav a[aria-current]{color:var(--fg);border-color:var(--accent);background:var(--accent-soft)}
@media (max-width:719px){html{scroll-padding-top:140px}.nav{display:none}header.site .btn{margin-left:auto}.subnav{display:flex}}
/* type */
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}.eyebrow::before{content:"";width:18px;height:1px;background:currentColor;opacity:.7}
h1{font-size:clamp(2.1rem,5.6vw,3.6rem);line-height:1.04;letter-spacing:-.035em;font-weight:650;margin:14px 0 18px;text-wrap:balance}
h1 em,h2 em{font-family:var(--display);font-style:italic;font-weight:400;letter-spacing:-.01em;color:var(--accent-strong)}
.lead{font-size:clamp(1.05rem,1.6vw,1.2rem);line-height:1.65;color:var(--muted);max-width:44rem;margin:0;text-wrap:pretty}
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:var(--subtle);margin:0}.crumbs a{color:var(--muted);text-decoration:none}.crumbs a:hover{color:var(--fg)}.crumbs .sep{opacity:.5}
.meta{font-size:13px;color:var(--subtle)}
/* hero */
.hero{padding:56px 0 40px}@media (min-width:900px){.hero{padding:84px 0 56px}}
.hero .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
.stats{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:26px;font-size:13px;color:var(--subtle)}.stats span{display:inline-flex;align-items:center;gap:7px}.stats span::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok)}
/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:14px;padding:0;margin:0;list-style:none}
.tile{position:relative;display:flex;flex-direction:column;height:100%;padding:22px 22px 20px;border-radius:18px;background:var(--panel);border:1px solid var(--line);text-decoration:none;transition:border-color .2s,transform .2s,background .2s;overflow:hidden}
.tile:hover{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));transform:translateY(-2px)}.tile:hover .arrow{transform:translateX(3px);color:var(--accent)}
.tile .num{font:500 11px/1 var(--mono);color:var(--subtle);letter-spacing:.06em}.tile strong{display:block;margin:14px 0 8px;font-size:17px;line-height:1.3;letter-spacing:-.015em;font-weight:620;color:var(--fg)}
.tile span.d{flex:1;font-size:14px;line-height:1.6;color:var(--muted)}.tile .arrow{margin-top:18px;font-size:13px;font-weight:600;color:var(--muted);transition:transform .2s,color .2s}
.tile::after{content:"";position:absolute;right:-40px;top:-40px;width:120px;height:120px;border-radius:50%;background:var(--accent-soft);opacity:0;transition:opacity .25s}.tile:hover::after{opacity:1}
/* article layout */
.page{display:grid;gap:40px;padding:36px 0 24px}@media (min-width:1024px){.page{grid-template-columns:minmax(0,1fr) 280px;gap:64px;padding-top:48px}}
article{min-width:0;max-width:44rem}
.article-head{padding-bottom:28px;margin-bottom:8px;border-bottom:1px solid var(--line)}
.byline{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:22px;font-size:13px;color:var(--subtle)}.byline .dot{width:3px;height:3px;border-radius:50%;background:currentColor}@media (max-width:480px){.byline .dot{display:none}.byline{gap:4px 14px}}
.prose h2{font-size:clamp(1.35rem,2.4vw,1.65rem);line-height:1.25;letter-spacing:-.02em;font-weight:640;margin:52px 0 14px;text-wrap:balance}
.prose h2 a.anchor{color:inherit;text-decoration:none}.prose h2 a.anchor:hover::after{content:" #";color:var(--subtle)}
.prose>p,.prose li{color:var(--muted);font-size:16.5px;line-height:1.78}.prose>p{margin:0 0 16px}.prose strong{color:var(--fg);font-weight:620}
.prose>ul{padding:0;margin:4px 0 18px;list-style:none}.prose>ul li{position:relative;padding-left:26px;margin:8px 0}.prose>ul li::before{content:"";position:absolute;left:6px;top:.72em;width:7px;height:7px;border-radius:2px;background:var(--accent);opacity:.85;transform:rotate(45deg)}
.prose a{color:var(--accent-strong);text-underline-offset:3px}
.note{display:flex;gap:12px;align-items:flex-start;margin:20px 0;padding:16px 18px;border-radius:14px;background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);font-size:15px;color:var(--fg)}.note p{margin:0;color:var(--fg);font-size:15px;line-height:1.6}
/* steps */
ol.steps{list-style:none;padding:0;margin:8px 0 0;counter-reset:s;display:grid;gap:10px}
ol.steps li{counter-increment:s;position:relative;padding:18px 18px 18px 64px;border-radius:16px;background:var(--panel);border:1px solid var(--line);margin:0}
ol.steps li::before{content:counter(s,decimal-leading-zero);position:absolute;left:18px;top:18px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font:600 12px/1 var(--mono);color:var(--accent-strong);background:var(--accent-soft)}
ol.steps strong{display:block;color:var(--fg);font-size:16px;margin-bottom:2px}ol.steps span{display:block;font-size:15px;line-height:1.65;color:var(--muted)}
/* sample resume */
.paper{margin:12px 0 8px;padding:clamp(22px,4vw,40px);border-radius:6px;background:var(--paper);color:var(--ink);box-shadow:var(--shadow),0 0 0 1px rgba(0,0,0,.06);font-size:14px;line-height:1.55}
.paper .name{font-weight:400;font-family:var(--display);font-size:clamp(1.6rem,3.6vw,2.1rem);line-height:1.1;letter-spacing:-.01em;margin:0;color:var(--ink)}
.paper .headline{margin:6px 0 0;line-height:1.4;color:#5b47e0;font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase}
.paper .label{display:flex;align-items:center;gap:10px;margin:22px 0 8px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}.paper .label::after{content:"";flex:1;height:1px;background:#e4e1d8}
.paper p.text{margin:0;color:var(--ink-muted);font-size:14px;line-height:1.6}
.paper .role{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 12px;margin-top:12px}.paper .role strong{color:var(--ink)}.paper .role .co{color:var(--ink-muted)}.paper .role .when{font-size:12.5px;color:#8a8696;font-variant-numeric:tabular-nums}
.paper ul{margin:6px 0 0;padding:0;list-style:none}.paper ul li{position:relative;padding-left:16px;margin:4px 0;color:var(--ink-muted);font-size:14px;line-height:1.55}.paper ul li::before{content:"";position:absolute;left:3px;top:.62em;width:4px;height:4px;border-radius:50%;background:#8a8696}
.paper ul.chips{display:flex;flex-wrap:wrap;gap:6px}.paper ul.chips li{padding:3px 10px;margin:0;border-radius:999px;background:#f1efe8;color:var(--ink);font-size:12.5px}.paper ul.chips li::before{display:none}
.paper-caption{font-size:12.5px;color:var(--subtle);margin:10px 0 0}
/* faq */
.faq{border-top:1px solid var(--line)}.faq details{border-bottom:1px solid var(--line)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:18px 2px;font-weight:600;font-size:16px;color:var(--fg)}.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";flex-shrink:0;width:22px;height:22px;border-radius:7px;border:1px solid var(--line-strong);background:linear-gradient(var(--muted),var(--muted)) center/10px 1.5px no-repeat,linear-gradient(var(--muted),var(--muted)) center/1.5px 10px no-repeat;transition:transform .2s}
.faq details[open] summary::after{transform:rotate(45deg)}.faq details p{margin:0 0 18px;padding-right:38px;color:var(--muted);font-size:15.5px;line-height:1.7}
/* aside */
aside.rail{display:grid;gap:14px;align-content:start}@media (min-width:1024px) and (min-height:720px){aside.rail{position:sticky;top:84px}}
.toc{padding:4px 0}.toc p{margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--subtle)}
.toc ol{list-style:none;margin:0;padding:0;border-left:1px solid var(--line)}.toc a{display:block;padding:6px 0 6px 14px;margin-left:-1px;border-left:1px solid transparent;font-size:13.5px;line-height:1.4;color:var(--muted);text-decoration:none}.toc a:hover{color:var(--fg);border-left-color:var(--accent)}
@media (max-width:1023px){.toc{display:none}}
.cta-card{position:relative;overflow:hidden;padding:22px;border-radius:18px;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 22%,var(--panel)),var(--panel) 60%);border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line))}
.cta-card h3{margin:0 0 6px;font-size:17px;letter-spacing:-.015em}.cta-card p{margin:0 0 16px;font-size:14px;line-height:1.6;color:var(--muted)}.cta-card .btn{width:100%}
.cta-card ul{list-style:none;padding:0;margin:0 0 16px;display:grid;gap:6px}.cta-card li{font-size:13px;color:var(--muted);padding-left:20px;position:relative}.cta-card li::before{content:"✓";position:absolute;left:0;color:var(--ok);font-weight:700}
/* bands */
.section-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px;margin:72px 0 20px}.section-head h2{margin:0;font-size:clamp(1.4rem,2.6vw,1.8rem);letter-spacing:-.025em;font-weight:640}
.band{margin:80px 0 0;padding:clamp(28px,5vw,48px);border-radius:24px;background:radial-gradient(80% 120% at 0% 0%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 60%),var(--panel);border:1px solid var(--line);display:grid;gap:20px;align-items:center}@media (min-width:860px){.band{grid-template-columns:1fr auto}}
.band h2{margin:0 0 8px;font-size:clamp(1.5rem,3vw,2.1rem);letter-spacing:-.03em;line-height:1.15}.band p{margin:0;color:var(--muted);max-width:36rem}.band .actions{display:flex;flex-wrap:wrap;gap:10px}
/* footer */
footer.site{margin-top:96px;border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
footer.site .top{display:grid;gap:36px;padding-top:52px;padding-bottom:44px}@media (min-width:860px){footer.site .top{grid-template-columns:1.3fr repeat(4,1fr)}}
footer.site .about p{margin:14px 0 0;max-width:20rem;font-size:13.5px;line-height:1.65;color:var(--muted)}
footer.site h2{margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--subtle)}
footer.site ul{list-style:none;margin:0;padding:0;display:grid;gap:11px}footer.site li a{font-size:13.5px;line-height:1.45;color:var(--muted);text-decoration:none;transition:color .15s}footer.site li a:hover{color:var(--fg)}
footer.site .bottom{border-top:1px solid color-mix(in srgb,var(--line) 50%,transparent)}footer.site .bottom .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;padding-top:20px;padding-bottom:28px;font-size:12.5px;color:var(--subtle)}
footer.site .bottom a{color:var(--muted);font-weight:600;text-decoration:none}footer.site .bottom a:hover{color:var(--fg);text-decoration:underline;text-underline-offset:3px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}`;

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3a8ff"/><stop offset="1" stop-color="#6a58f5"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg)"/><path d="M10 22V10h6.2a4.2 4.2 0 0 1 0 8.4H10" fill="none" stroke="#0b0716" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="22" r="2" fill="#0b0716"/></svg>`;
const ARROW = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const NAV = [
  { href: '/resume-examples', label: 'Resume examples' },
  { href: '/portfolio-examples', label: 'Portfolio examples' },
  { href: '/guides', label: 'Guides' },
  { href: '/resumes', label: 'Resume builder' },
  { href: '/templates', label: 'Templates' },
];

/** "Career guides" → "Career <em>guides</em>": the last word in the display italic, like the app. */
const accentLast = (s) => {
  const t = esc(s);
  const i = t.lastIndexOf(' ');
  return i < 0 ? `<em>${t}</em>` : `${t.slice(0, i)} <em>${t.slice(i + 1)}</em>`;
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function head({ SITE, cfg, url, title, description, jsonld, active }) {
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
<meta name="color-scheme" content="dark light" />
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
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap"><a class="brand" href="/">${LOGO}${esc(cfg.siteName)}</a><nav class="nav" aria-label="Main">${NAV.map((n) => `<a href="${n.href}"${n.href === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}</nav><a class="btn sm" href="/studio">Open app</a></div><nav class="subnav" aria-label="Sections">${NAV.map((n) => `<a href="${n.href}"${n.href === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}</nav></header>
`;
}

function footer(cfg) {
  const col = (s) => `<nav aria-label="${esc(s.hub.label)}"><h2>${esc(s.hub.label)}</h2><ul>${s.pages.slice(0, 4).map((p) => `<li><a href="${s.base}/${p.slug}">${esc(p.h1)}</a></li>`).join('')}<li><a href="${s.base}">All ${esc(s.hub.label.toLowerCase())} →</a></li></ul></nav>`;
  const app = `<nav aria-label="Product"><h2>Product</h2><ul><li><a href="/resumes">Resume builder</a></li><li><a href="/templates">Portfolio templates</a></li><li><a href="/documents">Cover letter builder</a></li><li><a href="/knowledge">Extract your data</a></li><li><a href="/about">How it works</a></li></ul></nav>`;
  return `<footer class="site"><div class="wrap top"><div class="about"><a class="brand" href="/">${LOGO}${esc(cfg.siteName)}</a><p>A free, private portfolio website, resume and cover letter builder that runs entirely in your browser. No sign-up, works offline.</p></div>${app}${SECTIONS.map(col).join('')}</div>
<div class="bottom"><div class="wrap"><span>Everything you create stays on your device.</span><span>Made by <a href="${AUTHOR_URL}" rel="author" target="_blank">Anubhab Guha</a></span></div></div></footer>
</body>
</html>
`;
}

const breadcrumbs = (SITE, cfg, trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: cfg.siteName, url: `${SITE}/` }, ...trail].map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url })),
});

const crumbsHtml = (trail) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${trail.map((t, i) => `<span class="sep" aria-hidden="true">/</span>${i === trail.length - 1 ? `<span aria-current="page">${esc(t.name)}</span>` : `<a href="${t.path}">${esc(t.name)}</a>`}`).join('')}</nav>`;

function sampleResume(s) {
  const roles = s.experience
    .map((e) => `<div class="role"><span><strong>${esc(e.role)}</strong> <span class="co">· ${esc(e.company)}</span></span><span class="when">${esc(e.dates)}</span></div><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`)
    .join('');
  return `<figure style="margin:0"><div class="paper" role="img" aria-label="Sample resume for ${esc(s.name)}"><p class="name">${esc(s.name)}</p><p class="headline">${esc(s.headline)}</p><p class="label">Summary</p><p class="text">${esc(s.summary)}</p><p class="label">Experience</p>${roles}<p class="label">Education</p><p class="text">${esc(s.education)}</p><p class="label">Skills</p><ul class="chips">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div><figcaption class="paper-caption">Sample content. Open the template and replace it with yours.</figcaption></figure>`;
}

/** Article sections with anchor ids, plus the table of contents built from them. */
function articleBody(section, page) {
  const parts = [];
  const toc = [];
  const h2 = (text) => {
    let id = slug(text) || `s${toc.length + 1}`;
    while (toc.some((t) => t.id === id)) id += '-2';
    toc.push({ id, text });
    return `<h2 id="${id}"><a class="anchor" href="#${id}">${esc(text)}</a></h2>`;
  };
  if (page.sample) parts.push(`${h2(`Sample ${page.h1.replace(/ example$/i, '').toLowerCase()}`)}${sampleResume(page.sample)}`);
  if (page.template) parts.push(`<div class="note"><p>Recommended template: <strong>${esc(page.template)}</strong>. <a href="${section.cta.href}">Open it in ${section.kind === 'portfolio' ? 'Portfolio Studio' : 'Resume Studio'}</a> and replace the sample content with yours.</p></div>`);
  if (page.steps?.length) parts.push(`${h2('Step by step')}<ol class="steps">${page.steps.map((st) => `<li><strong>${esc(st.name)}</strong><span>${esc(st.text)}</span></li>`).join('')}</ol>`);
  for (const sec of page.sections) {
    parts.push(`${h2(sec.heading)}${(sec.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${sec.list?.length ? `<ul>${sec.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`);
  }
  if (page.faqs?.length) parts.push(`${h2('Frequently asked questions')}<div class="faq">${page.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`);
  return { html: parts.join('\n'), toc };
}

const tile = (href, title, text, n) => `<li><a class="tile" href="${href}">${n ? `<span class="num">${n}</span>` : ''}<strong>${esc(title)}</strong><span class="d">${esc(text)}</span><span class="arrow">Read →</span></a></li>`;

function relatedHtml(section, page) {
  const siblings = section.pages.filter((p) => p.slug !== page.slug).slice(0, 4);
  const others = SECTIONS.filter((s) => s !== section).map((s) => ({ s, p: s.pages[0] })).filter((x) => x.p);
  const items = [...siblings.map((p) => tile(`${section.base}/${p.slug}`, p.h1, p.description, section.hub.label)), ...others.map(({ s, p }) => tile(`${s.base}/${p.slug}`, p.h1, p.description, s.hub.label))];
  return `<section aria-labelledby="related"><div class="section-head"><h2 id="related">Keep reading</h2><a class="btn sm ghost" href="${section.base}">All ${esc(section.hub.label.toLowerCase())}</a></div><ul class="grid">${items.join('')}</ul></section>`;
}

const band = (section, hub = false) => `<section class="band" aria-label="Get started"><div><h2>Make yours in <em>minutes</em></h2><p>Free, private and no sign-up. Everything stays in your browser, and you can export PDF, Word or a complete website.</p></div><div class="actions"><a class="btn" href="${section.cta.href}">${esc(hub ? (section.hubCta ?? section.cta.label) : section.cta.label)} ${ARROW}</a><a class="btn ghost" href="/about">How it works</a></div></section>`;

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
      head({ SITE, cfg, url: hubUrl, title: section.hub.title, description: section.hub.description, jsonld: hubLd, active: section.base }) +
      `<main id="main" class="wrap"><section class="hero">${crumbsHtml([{ name: section.hub.label, path: section.base }])}<p class="eyebrow" style="margin-top:28px">${esc(section.hub.label)}</p><h1>${accentLast(section.hub.h1)}</h1><p class="lead">${esc(section.hub.intro)}</p>
<div class="actions"><a class="btn" href="${section.cta.href}">${esc(section.hubCta ?? section.cta.label)} ${ARROW}</a><a class="btn ghost" href="#all">Browse ${section.pages.length} ${esc(section.hub.label.toLowerCase())}</a></div>
<div class="stats"><span>Free, no sign-up</span><span>Private: stays in your browser</span><span>Export PDF, Word or HTML</span></div></section>
<ul class="grid" id="all">${section.pages.map((p, i) => tile(`${section.base}/${p.slug}`, p.h1, p.description, String(i + 1).padStart(2, '0'))).join('')}</ul>
${band(section, true)}</main>` +
      footer(cfg);
    writePage(dist, section.base, hubHtml);
    entries.push({ path: section.base, title: section.hub.h1, description: section.hub.description, priority: 0.8, changefreq: 'weekly' });

    for (const page of section.pages) {
      const path = `${section.base}/${page.slug}`;
      const url = `${SITE}${path}`;
      const body = articleBody(section, page);
      const date = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      const words = [page.intro, ...page.sections.flatMap((x) => [...(x.p ?? []), ...(x.list ?? [])]), ...(page.steps ?? []).map((x) => x.text), ...(page.faqs ?? []).map((x) => x.a)].join(' ').split(/\s+/).length;
      const toc = body.toc.length > 2 ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ol>${body.toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : '';
      const html =
        head({ SITE, cfg, url, title: page.title, description: page.description, jsonld: pageJsonLd({ SITE, cfg, section, page, url, today }), active: section.base }) +
        `<main id="main" class="wrap"><div class="page"><article><header class="article-head">${crumbsHtml([{ name: section.hub.label, path: section.base }, { name: page.h1, path }])}
<p class="eyebrow" style="margin-top:28px">${esc(section.hub.label.replace(/s$/, ''))}</p><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.intro)}</p>
<div class="byline"><span>Updated <time datetime="${today}">${date}</time></span><span class="dot"></span><span>${Math.max(1, Math.round(words / 230))} min read</span><span class="dot"></span><span>${esc(cfg.siteName)}</span></div></header>
<div class="prose">${body.html}</div></article>
<aside class="rail">${toc}<div class="cta-card"><h3>${section.kind === 'portfolio' ? 'Build this portfolio' : section.kind === 'resume' ? 'Build this resume' : 'Put it into practice'}</h3><p>Start from a template and make it yours in minutes.</p><ul><li>Free, no account</li><li>Private: stays on your device</li><li>${section.kind === 'portfolio' ? 'Export a complete website' : 'Export PDF and Word'}</li></ul><a class="btn" href="${section.cta.href}">${esc(section.cta.label)}</a></div></aside></div>
${relatedHtml(section, page)}
${band(section)}</main>` +
        footer(cfg);
      writePage(dist, path, html);
      entries.push({ path, title: page.h1, description: page.description, priority: 0.7, changefreq: 'monthly' });
    }
  }
  return entries;
}
