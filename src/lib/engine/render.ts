import type { Portfolio, PortfolioSection } from '@/types/portfolio';
import type { ImageOptions, RenderContext, RenderMode } from '@/sections/types';
import { getDefinition, withDefinition } from '@/sections/registry';
import { iconSvg, socialIconFor } from '@/sections/icons';
import { renderMarkdown } from '@/lib/sanitize';
import { themeCssVariables, activePalette } from '@/lib/theme/tokens';
import { googleFontsHref } from '@/lib/theme/fonts';
import { esc, jsonForScript } from '@/utils/escape';
import { safeHref, safeMediaSrc } from '@/utils/url';
import { BRAND } from '@/config/brand';
import { isAssetRef, assetIdOf, TRANSPARENT_PIXEL } from './assets';
import { visibleSections, socialLinksOf, heroOf, contactOf } from './collect';
import baseCss from './portfolio.css?raw';
import runtimeJs from './runtime.js?raw';

export interface RenderOptions {
  mode: RenderMode;
  /** Export: map an asset id to a URL (data URL for standalone, relative path for ZIP). */
  assetUrl?: (id: string) => string | null;
  /** Font delivery override; defaults to portfolio.settings.fontDelivery. */
  fontDelivery?: 'system' | 'cdn';
  /** Emit <link>/<script src> to external files instead of inlining (ZIP export). */
  external?: { cssHref: string; jsSrc: string };
  /** Embed the portfolio JSON so the file can be re-imported. */
  embedData?: boolean;
  /** Visual editing aids in the preview iframe. */
  editing?: boolean;
  /** Custom font face sources: asset id → URL. */
  fontUrl?: (assetId: string) => string | null;
}

export interface RenderResult {
  /** Complete HTML document. */
  html: string;
  /** Full stylesheet (tokens + base + section-scoped custom CSS). */
  css: string;
  /** Runtime script. */
  js: string;
  /** Inner markup of #pos-root (used for live preview patches). */
  body: string;
  /** Class list for <html>. */
  rootClass: string;
  config: RuntimeConfig;
}

export interface RuntimeConfig {
  animations: boolean;
  scheme: Portfolio['settings']['colorScheme'];
  defaultScheme: 'light' | 'dark';
  preview: boolean;
  /** Preview only: custom fonts the iframe loads from posted asset blobs. */
  fonts?: Array<{ family: string; assetId: string; weight: string; style: string }>;
}

const ANIMATION_EASINGS: Record<string, string> = {
  ease: 'ease',
  'ease-out': 'cubic-bezier(.16,1,.3,1)',
  'ease-in-out': 'cubic-bezier(.65,0,.35,1)',
  spring: 'cubic-bezier(.2,.9,.25,1.15)',
  linear: 'linear',
};

function createContext(portfolio: Portfolio, opts: RenderOptions, cssBucket: Map<string, string>): RenderContext {
  const resolve = (src: string): { url: string; assetId: string | null } => {
    if (isAssetRef(src)) {
      const id = assetIdOf(src);
      if (opts.mode === 'preview') return { url: '', assetId: id };
      const url = opts.assetUrl?.(id) ?? null;
      return { url: url ?? '', assetId: id };
    }
    return { url: safeMediaSrc(src), assetId: null };
  };

  return {
    portfolio,
    mode: opts.mode,
    image(ref, o: ImageOptions = {}) {
      if (!ref || !ref.src) return '';
      const { url, assetId } = resolve(ref.src);
      if (!url && !(opts.mode === 'preview' && assetId)) return '';
      const alt = o.decorative ? '' : ref.alt;
      const attrs = [
        opts.mode === 'preview' && assetId ? `src="${TRANSPARENT_PIXEL}" data-pos-asset="${esc(assetId)}"` : `src="${esc(url)}"`,
        `alt="${esc(alt)}"`,
        o.className ? `class="${esc(o.className)}"` : '',
        o.width ? `width="${o.width}"` : '',
        o.height ? `height="${o.height}"` : '',
        o.eager ? 'fetchpriority="high"' : 'loading="lazy"',
        'decoding="async"',
        opts.mode === 'export' && assetId ? `data-pos-asset="${esc(assetId)}"` : '',
      ].filter(Boolean);
      return `<img ${attrs.join(' ')}>`;
    },
    backgroundImage(src) {
      const { url, assetId } = resolve(src);
      if (opts.mode === 'preview' && assetId) return `data-pos-bg-asset="${esc(assetId)}"`;
      return url ? `style="background-image:url('${esc(url).replace(/'/g, '%27')}')"` : '';
    },
    mediaUrl(src) {
      return resolve(src).url;
    },
    markdown: (md) => renderMarkdown(md),
    icon: (name, className) => iconSvg(name, className),
    socialLinks: () => socialLinksOf(portfolio),
    addCss(key, css) {
      cssBucket.set(key, css);
    },
  };
}

function sectionClasses(s: PortfolioSection): string {
  const st = s.style;
  return [
    'pos-section',
    `s-${s.type}`,
    `bg-${st.background}`,
    `py-${st.paddingY}`,
    `w-${st.width}`,
    `align-${st.align}`,
    st.hideOn.mobile ? 'hide-mobile' : '',
    st.hideOn.tablet ? 'hide-tablet' : '',
    st.hideOn.desktop ? 'hide-desktop' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function renderSection(s: PortfolioSection, ctx: RenderContext, animationsOn: boolean): string {
  const def = getDefinition(s.type);
  let inner: string;
  try {
    inner = withDefinition(s, (d, sec) => d.render(sec.data, ctx, sec));
  } catch (err) {
    // One broken section never takes down the page.
    console.error(`[${BRAND.name}] Failed to render section "${s.name}"`, err);
    inner = ctx.mode === 'preview' ? `<div class="container"><p role="alert">This section could not be rendered: ${esc(err instanceof Error ? err.message : String(err))}</p></div>` : '';
  }
  const a = s.style.animation;
  const anim = animationsOn && a.type !== 'none' && a.type !== 'parallax' ? a.type : '';
  const style = anim ? ` style="--anim-duration:${Math.max(0, a.duration)}ms;--anim-delay:${Math.max(0, a.delay)}ms;--anim-ease:${ANIMATION_EASINGS[a.easing] ?? 'ease'}"` : '';
  const animAttrs = anim ? ` data-anim="${anim}" data-trigger="${a.trigger}"` : '';
  const parallax = animationsOn && a.type === 'parallax' ? ' data-parallax="0.08"' : '';
  const editAttrs = ctx.mode === 'preview' ? ` data-label="${esc(s.name)}"` : '';
  const heading = withDefinition(s, (d, sec) => d.heading(sec.data));
  const labelled = heading ? ` aria-label="${esc(heading)}"` : '';
  const content = def.fullBleed ? inner : `<div class="container"${parallax}>${inner}</div>`;
  return `<section id="${esc(s.style.anchor)}" class="${sectionClasses(s)}" data-section-id="${esc(s.id)}"${animAttrs}${style}${editAttrs}${labelled}>${content}</section>`;
}

function renderNav(p: Portfolio, sections: PortfolioSection[], ctx: RenderContext): string {
  const nav = p.settings.navigation;
  if (!nav.enabled) return '';
  const links = sections
    .filter((s) => s.style.showInNav && s.type !== 'hero')
    .map((s) => `<li><a href="#${esc(s.style.anchor)}">${esc(s.name)}</a></li>`)
    .join('');
  const brand = nav.brand || heroOf(p)?.name || p.metadata.author || p.metadata.title;
  const toggle = p.settings.showThemeToggle
    ? `<button type="button" class="icon-btn theme-toggle" data-theme-toggle aria-label="Toggle colour scheme">${iconSvg('moon', 'pi i-moon')}${iconSvg('sun', 'pi i-sun')}</button>`
    : '';
  return `<header class="site-nav nav-${nav.style}${nav.sticky ? ' is-sticky' : ''}">
  <nav class="container nav-inner" aria-label="Primary">
    <a class="nav-brand" href="#top">${esc(brand)}</a>
    ${links ? `<ul class="nav-links" id="pos-nav-links">${links}</ul>` : ''}
    <div class="nav-actions">${toggle}${links ? `<button type="button" class="icon-btn nav-toggle" data-nav-toggle aria-controls="pos-nav-links" aria-expanded="false" aria-label="Menu">${ctx.icon('menu')}</button>` : ''}</div>
  </nav>
</header>`;
}

function renderFooter(p: Portfolio, ctx: RenderContext): string {
  const f = p.settings.footer;
  const top = p.settings.backToTop ? `<button type="button" class="icon-btn back-to-top" data-back-to-top aria-label="Back to top">${ctx.icon('arrow-up')}</button>` : '';
  if (!f.enabled) return top;
  const year = new Date().getFullYear();
  const text = (f.text || `© {year} ${heroOf(p)?.name || p.metadata.author}`).replace(/\{year\}/g, String(year));
  const socials = socialLinksOf(p)
    .filter((s) => safeHref(s.url))
    .map((s) => `<a class="social-icon" href="${esc(safeHref(s.url))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label || s.platform)}">${ctx.icon(socialIconFor(s.platform, s.url))}</a>`)
    .join('');
  return `<footer class="site-footer"><div class="container footer-inner"><p>${esc(text)}${f.showCredit ? ` · Built with ${esc(BRAND.name)}` : ''}</p>${socials ? `<div class="footer-social">${socials}</div>` : ''}</div></footer>${top}`;
}

export function renderBody(p: Portfolio, ctx: RenderContext): string {
  const sections = visibleSections(p);
  const animationsOn = p.settings.animations && p.theme.motion.enabled;
  const parts: string[] = [];
  let heroDone = false;
  for (const s of sections) {
    parts.push(renderSection(s, ctx, animationsOn));
    if (s.type === 'hero' && !heroDone) {
      heroDone = true;
      parts.push('<span id="main-after-hero"></span>');
    }
  }
  return `<a class="skip-link" href="#main">Skip to content</a>${renderNav(p, sections, ctx)}<main id="main" tabindex="-1">${parts.join('\n')}</main>${renderFooter(p, ctx)}`;
}

export function rootClassOf(p: Portfolio): string {
  const t = p.theme;
  return [
    `card-${t.cardStyle}`,
    `btn-${t.buttonStyle}`,
    t.effects.glass ? 'fx-glass' : '',
    t.effects.grain ? 'fx-grain' : '',
    t.effects.gradient ? 'fx-gradient' : '',
    p.settings.smoothScroll ? 'smooth' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function fontFaces(p: Portfolio, opts: RenderOptions): string {
  return p.metadata.customFonts
    .map((f) => {
      const url = opts.mode === 'preview' ? null : (opts.fontUrl?.(f.assetId) ?? null);
      if (!url) return '';
      return `@font-face{font-family:"${f.family.replace(/"/g, '')}";src:url("${url}") format("${f.format}");font-weight:${f.weight};font-style:${f.style};font-display:swap}`;
    })
    .join('\n');
}

export function buildCss(p: Portfolio, opts: RenderOptions, extra: Map<string, string>): string {
  return [
    `/* Generated by ${BRAND.generator} */`,
    fontFaces(p, opts),
    themeCssVariables(p),
    baseCss,
    ...extra.values(),
  ]
    .filter(Boolean)
    .join('\n');
}

function metaTags(p: Portfolio, ctx: RenderContext): string {
  const m = p.metadata;
  const hero = heroOf(p);
  const title = m.title || hero?.name || 'Portfolio';
  const description = m.description || hero?.description || '';
  const canonical = safeHref(m.siteUrl);
  const og = m.ogImage.src ? ctx.mediaUrl(m.ogImage.src) : '';
  const ogAbsolute = og && /^https?:/.test(og) ? og : og && canonical && !og.startsWith('data:') ? new URL(og, canonical.endsWith('/') ? canonical : `${canonical}/`).toString() : '';
  const tags = [
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : '',
    m.keywords.length ? `<meta name="keywords" content="${esc(m.keywords.join(', '))}">` : '',
    m.author ? `<meta name="author" content="${esc(m.author)}">` : '',
    `<meta name="generator" content="${esc(BRAND.generator)}">`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    `<meta property="og:type" content="profile">`,
    `<meta property="og:title" content="${esc(title)}">`,
    description ? `<meta property="og:description" content="${esc(description)}">` : '',
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
    ogAbsolute ? `<meta property="og:image" content="${esc(ogAbsolute)}">` : '',
    ogAbsolute && m.ogImage.alt ? `<meta property="og:image:alt" content="${esc(m.ogImage.alt)}">` : '',
    `<meta name="twitter:card" content="${ogAbsolute ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    description ? `<meta name="twitter:description" content="${esc(description)}">` : '',
    m.twitterHandle ? `<meta name="twitter:creator" content="${esc(m.twitterHandle.startsWith('@') ? m.twitterHandle : `@${m.twitterHandle}`)}">` : '',
    ogAbsolute ? `<meta name="twitter:image" content="${esc(ogAbsolute)}">` : '',
    `<meta name="theme-color" content="${esc(activePalette(p).background)}">`,
    faviconTag(p, ctx),
  ];
  return tags.filter(Boolean).join('\n');
}

function faviconTag(p: Portfolio, ctx: RenderContext): string {
  const fav = p.metadata.favicon.trim();
  if (!fav) return '';
  if (isAssetRef(fav) || /^https?:|^data:image/.test(fav)) {
    const url = ctx.mediaUrl(fav);
    return url ? `<link rel="icon" href="${esc(url)}">` : '';
  }
  // Emoji / short text favicon rendered as inline SVG.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${esc(fav.slice(0, 4))}</text></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

export function structuredData(p: Portfolio): Record<string, unknown> {
  const hero = heroOf(p);
  const contact = contactOf(p);
  const canonical = safeHref(p.metadata.siteUrl) || undefined;
  const person: Record<string, unknown> = {
    '@type': 'Person',
    name: hero?.name || p.metadata.author,
    jobTitle: hero?.title || undefined,
    description: hero?.description || p.metadata.description || undefined,
    url: canonical,
    email: contact?.email ? `mailto:${contact.email}` : undefined,
    address: contact?.location ? { '@type': 'PostalAddress', addressLocality: contact.location } : undefined,
    sameAs: socialLinksOf(p).map((s) => safeHref(s.url)).filter((u) => /^https?:/.test(u)),
  };
  const skills = p.sections.find((s) => s.type === 'skills' && s.enabled);
  if (skills && skills.type === 'skills') person.knowsAbout = skills.data.items.map((i) => i.name);
  const projects = p.sections.find((s) => s.type === 'projects' && s.enabled);
  const works =
    projects && projects.type === 'projects'
      ? projects.data.items.map((w) => ({
          '@type': 'CreativeWork',
          name: w.title,
          description: w.description || undefined,
          url: safeHref(w.live) || safeHref(w.github) || undefined,
          keywords: w.technologies.length ? w.technologies.join(', ') : undefined,
          creator: { '@type': 'Person', name: person.name },
        }))
      : [];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        name: p.metadata.title || String(person.name ?? ''),
        url: canonical,
        dateModified: p.metadata.updatedAt,
        mainEntity: person,
      },
      ...works,
    ],
  };
}

function stripUndefined(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** The Portfolio Engine's primary output: a complete, standalone document. */
export function renderPortfolio(portfolio: Portfolio, opts: RenderOptions): RenderResult {
  const cssBucket = new Map<string, string>();
  const ctx = createContext(portfolio, opts, cssBucket);
  const body = renderBody(portfolio, ctx);
  const css = buildCss(portfolio, opts, cssBucket);
  const rootClass = rootClassOf(portfolio);
  const config: RuntimeConfig = {
    animations: portfolio.settings.animations && portfolio.theme.motion.enabled,
    scheme: portfolio.settings.colorScheme,
    defaultScheme: portfolio.theme.defaultScheme,
    preview: opts.mode === 'preview',
    ...(opts.mode === 'preview' && portfolio.metadata.customFonts.length
      ? { fonts: portfolio.metadata.customFonts.map((f) => ({ family: f.family, assetId: f.assetId, weight: f.weight, style: f.style })) }
      : {}),
  };
  const delivery = opts.fontDelivery ?? portfolio.settings.fontDelivery;
  const t = portfolio.theme.typography;
  const gf = delivery === 'cdn' ? googleFontsHref([t.headingFont, t.bodyFont, t.monoFont]) : null;
  const fontLinks = gf ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(gf)}">` : '';
  const cssTag = opts.external ? `<link rel="stylesheet" href="${esc(opts.external.cssHref)}">` : `<style id="pos-style">${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  const jsTag = opts.external ? `<script src="${esc(opts.external.jsSrc)}" defer></script>` : `<script>${runtimeJs.replace(/<\/script/gi, '<\\/script')}</script>`;
  const jsonLd = `<script type="application/ld+json">${jsonForScript(stripUndefined(structuredData(portfolio)))}</script>`;
  const data = opts.embedData ? `<script type="application/json" id="pos-data">${jsonForScript(portfolio)}</script>` : '';
  const csp =
    opts.mode === 'preview'
      ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https:; media-src https: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: blob: https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; form-action 'none'">`
      : '';
  const scheme = portfolio.settings.colorScheme === 'system' ? '' : ` data-scheme="${portfolio.settings.colorScheme}"`;
  const html = `<!doctype html>
<html lang="${esc(portfolio.metadata.language || 'en')}" class="${rootClass}${opts.mode === 'preview' && opts.editing ? ' pos-editing' : ''}"${opts.mode === 'preview' ? '' : scheme}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${csp}
${metaTags(portfolio, ctx)}
${fontLinks}
${cssTag}
${jsonLd}
</head>
<body>
<div id="pos-root">${body}</div>
<script type="application/json" id="pos-config">${jsonForScript(config)}</script>
${data}
${jsTag}
</body>
</html>
`;
  return { html, css, js: runtimeJs, body, rootClass, config };
}
