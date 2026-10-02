/**
 * Portfolio → PortfolioData for generated projects.
 *
 * Everything the generated app needs is resolved here, once, for every framework:
 * visible sections in order, anchors and page routes, project slugs, validated links,
 * sanitised Markdown, scoped custom CSS and image files copied into `public/images/`.
 * The output contains no blob:/asset:/IndexedDB references.
 */
import type { ImageRef, Portfolio, PortfolioSection } from '@/types/portfolio';
import { visibleSections, heroOf, contactOf } from '@/lib/engine/collect';
import { isAssetRef, assetIdOf } from '@/lib/engine/assets';
import { renderMarkdown, sanitizeHtml, scopeCss } from '@/lib/sanitize';
import { safeHref, checkUrl } from '@/utils/url';
import { formatRange, formatMonth } from '@/utils/format';
import { socialIconFor } from '@/sections/icons';
import { defaultAssetLoader, defaultExternalFetcher, blobToBytes, extensionFor, type AssetLoader, type ExternalFetcher } from '@/lib/export/assets';
import type { ExportIssue, ImageFile, SiteBuild, Structure } from './types';
import { fontPlan } from './tokens';
import type { PageDefinition, PortfolioData, Project, Section, SectionBase, SiteImage, SocialLink } from './site-types';

export interface ConvertedImage {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
}

export type ImageConverter = (blob: Blob, info: { width: number; height: number; maxEdge: number }) => Promise<ConvertedImage | null>;

export interface BuildSiteOptions {
  structure: Structure;
  siteUrl: string;
  loader?: AssetLoader;
  fetcher?: ExternalFetcher;
  /** Re-encode images (defaults to WebP via canvas when available). */
  convert?: ImageConverter;
  /** Applied by the validator's "Fix" action. */
  fixes?: { dropInvalidLinks?: boolean; dropMissingImages?: boolean };
  /** Entrance animations in the generated site. Defaults to the portfolio's own setting (site animations and theme motion). */
  animations?: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function slugify(text: string, fallback = 'item'): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base;
  for (let i = 2; taken.has(s); i++) s = `${base}-${i}`;
  taken.add(s);
  return s;
}

/** Canvas re-encode to WebP (browser only). Returns null when unavailable — the original is kept. */
export const defaultConverter: ImageConverter = async (blob, info) => {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  if (/svg|gif/.test(blob.type)) return null;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, info.maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
    if (!out || out.type !== 'image/webp') return null;
    return { bytes: await blobToBytes(out), mime: 'image/webp', width: w, height: h };
  } catch {
    return null;
  }
};

async function dimensionsOf(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const b = await createImageBitmap(blob);
      const d = { width: b.width, height: b.height };
      b.close();
      return d;
    }
  } catch {
    /* fall through */
  }
  return { width: 0, height: 0 };
}

const BG_SET = new Set(['default', 'surface', 'primary', 'accent', 'inverted', 'gradient', 'transparent']);

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export async function buildSiteData(p: Portfolio, o: BuildSiteOptions): Promise<SiteBuild> {
  const problems: ExportIssue[] = [];
  const warnings: string[] = [];
  const images: ImageFile[] = [];
  const loader = o.loader ?? defaultAssetLoader;
  const fetcher = o.fetcher ?? defaultExternalFetcher;
  const convert = o.convert ?? defaultConverter;
  const byKey = new Map<string, SiteImage | null>();
  const taken = new Set<string>();
  let customCss = '';

  /** Copy an image into public/images and return its public descriptor. */
  const image = async (ref: ImageRef | undefined, name: string, sectionId: string, label: string, maxEdge = 2000): Promise<SiteImage | null> => {
    const src = ref?.src?.trim();
    if (!src) return null;
    const key = `${src}|${maxEdge}`;
    if (byKey.has(key)) {
      const hit = byKey.get(key)!;
      return hit ? { ...hit, alt: ref!.alt || hit.alt } : null;
    }
    let blob: Blob | null = null;
    let meta = { width: 0, height: 0 };
    if (isAssetRef(src)) {
      const a = await loader(p.id, assetIdOf(src)).catch(() => null);
      if (a) blob = a.blob.type ? a.blob : new Blob([a.blob], { type: a.mime });
    } else if (/^https?:\/\//i.test(src)) {
      blob = await fetcher(src).catch(() => null);
      if (!blob) {
        // Keep remote images working: the generated app references them directly.
        warnings.push(`${label}: the remote image could not be downloaded and is referenced by URL.`);
        const out: SiteImage = { src, alt: ref!.alt, width: 1200, height: 800 };
        byKey.set(key, out);
        return out;
      }
    } else if (/^data:image\//i.test(src)) {
      try {
        blob = await (await fetch(src)).blob();
      } catch {
        blob = null;
      }
    }
    if (!blob) {
      if (!o.fixes?.dropMissingImages) problems.push({ id: `img-${sectionId}-${name}`, level: 'error', message: `${label} is unavailable (missing from local storage).`, sectionId, fix: 'remove-image' });
      byKey.set(key, null);
      return null;
    }
    meta = await dimensionsOf(blob);
    const converted = await convert(blob, { ...meta, maxEdge }).catch(() => null);
    const bytes = converted?.bytes ?? (await blobToBytes(blob));
    const mime = converted?.mime ?? (blob.type || 'application/octet-stream');
    const ext = extensionFor(mime, src);
    const width = converted?.width || meta.width || 1200;
    const height = converted?.height || meta.height || 800;
    const path = `images/${uniqueSlug(slugify(name, 'image'), taken)}.${ext}`;
    images.push({ path, bytes, mime, width, height });
    const out: SiteImage = { src: `/${path}`, alt: ref!.alt || '', width, height };
    byKey.set(key, out);
    return out;
  };

  /** Validated link: '' when empty or unsafe (unsafe ones are reported). */
  const link = (raw: string | undefined, label: string, sectionId: string): string => {
    const v = (raw ?? '').trim();
    if (!v) return '';
    const res = checkUrl(v);
    if (res.ok) return res.url;
    if (!o.fixes?.dropInvalidLinks) problems.push({ id: `url-${sectionId}-${label}`, level: 'error', message: `Invalid URL for ${label}: “${v.slice(0, 60)}” (${res.reason}).`, sectionId, fix: 'remove-link' });
    return '';
  };

  const sections = visibleSections(p);
  const hero = heroOf(p);
  const anchors = new Set<string>();
  const animationsOn = o.animations ?? (p.settings.animations && p.theme.motion.enabled);
  const base = (s: PortfolioSection, heading: string, intro = ''): SectionBase => {
    const st = s.style;
    const anchor = uniqueSlug(slugify(st.anchor || heading || s.type, s.type), anchors);
    const anim = st.animation.type;
    return {
      id: s.id,
      anchor,
      heading,
      intro,
      background: (BG_SET.has(st.background) ? st.background : 'default') as SectionBase['background'],
      width: st.width,
      align: st.align,
      spacing: st.paddingY,
      animation: !animationsOn || anim === 'none' ? 'none' : anim === 'scale' ? 'scale' : anim === 'blur' ? 'blur' : anim === 'slide' || anim === 'reveal' || anim === 'stagger' || anim === 'parallax' ? 'slide' : 'fade',
      motion: { duration: Math.max(0, st.animation.duration), delay: Math.max(0, st.animation.delay), easing: st.animation.easing, onLoad: st.animation.trigger === 'load' },
      hideOn: { ...st.hideOn },
    };
  };

  /* ------------------------------ projects ----------------------------- */
  const projects: Project[] = [];
  const slugs = new Set<string>();
  const projectSlugsBySection = new Map<string, string[]>();
  for (const s of sections) {
    if (s.type !== 'projects') continue;
    const list: string[] = [];
    for (const it of s.data.items) {
      const slug = uniqueSlug(slugify(it.title, 'project'), slugs);
      const img = await image(it.image, `project-${slug}`, s.id, `Project image “${it.title}”`);
      const gallery: SiteImage[] = [];
      for (let i = 0; i < it.gallery.length; i++) {
        const g = await image(it.gallery[i], `project-${slug}-${i + 2}`, s.id, `Gallery image ${i + 1} of “${it.title}”`);
        if (g) gallery.push(g);
      }
      const caseStudyHtml = it.caseStudy.trim() ? renderMarkdown(it.caseStudy) : '';
      projects.push({
        id: it.id,
        slug,
        title: it.title,
        description: it.description,
        image: img,
        gallery,
        technologies: it.technologies.filter(Boolean),
        github: link(it.github, `“${it.title}” source link`, s.id),
        live: link(it.live, `“${it.title}” live link`, s.id),
        caseStudyHtml,
        role: it.role,
        duration: it.duration,
        features: it.features.filter(Boolean),
        featured: it.featured,
        hasPage: !!caseStudyHtml || gallery.length > 0,
      });
      list.push(slug);
    }
    projectSlugsBySection.set(s.id, list);
  }

  /* ------------------------------ social ------------------------------- */
  const socialSection = sections.find((s) => s.type === 'social');
  const social: SocialLink[] = [];
  if (socialSection?.type === 'social')
    for (const it of socialSection.data.items) {
      const href = link(it.url, `${it.platform || 'social'} link`, socialSection.id);
      if (href) social.push({ platform: it.platform, label: it.label || it.platform, href, icon: socialIconFor(it.platform, href) });
    }

  /* ------------------------------ sections ----------------------------- */
  const out: Section[] = [];
  for (const s of sections) {
    const heading = 'heading' in s.data && typeof s.data.heading === 'string' ? s.data.heading : s.name;
    const intro = 'intro' in s.data && typeof s.data.intro === 'string' ? s.data.intro : '';
    const b = base(s, heading, intro);
    switch (s.type) {
      case 'hero': {
        const d = s.data;
        const backdrop = d.background === 'particles' || d.background === 'video' ? 'gradient' : d.background;
        out.push({
          ...b,
          type: 'hero',
          heading: d.name,
          eyebrow: d.eyebrow,
          name: d.name,
          title: d.title,
          description: d.description,
          image: await image(d.image, 'profile', s.id, 'Profile image', 1200),
          layout: d.layout,
          ctas: d.ctas.map((c) => ({ label: c.label, href: link(c.url, `button “${c.label}”`, s.id), variant: c.variant })).filter((c) => c.label && c.href),
          showSocial: d.showSocial,
          backdrop,
          backdropImage: backdrop === 'image' ? await image(d.backgroundImage, 'hero-background', s.id, 'Hero background', 2400) : null,
          overlayOpacity: d.overlayOpacity,
          typingPhrases: d.typingEnabled ? d.typingPhrases.filter(Boolean) : [],
          availability: d.availability,
        });
        break;
      }
      case 'about':
        out.push({ ...b, type: 'about', bodyHtml: renderMarkdown(s.data.body), image: await image(s.data.image, 'about', s.id, 'About image'), highlights: s.data.highlights.filter(Boolean), layout: s.data.layout });
        break;
      case 'experience':
        out.push({
          ...b,
          type: 'experience',
          style: s.data.style,
          items: s.data.items.map((i) => ({ ...i, url: link(i.url, `“${i.company}” link`, s.id), period: formatRange(i.start, i.end, i.current), achievements: i.achievements.filter(Boolean), technologies: i.technologies.filter(Boolean) })),
        });
        break;
      case 'education':
        out.push({ ...b, type: 'education', items: s.data.items.map((i) => ({ id: i.id, institution: i.institution, degree: i.degree, field: i.field, location: i.location, period: formatRange(i.start, i.end), grade: i.grade, description: i.description })) });
        break;
      case 'projects':
        out.push({ ...b, type: 'projects', layout: s.data.layout, projectSlugs: projectSlugsBySection.get(s.id) ?? [] });
        break;
      case 'skills':
        out.push({ ...b, type: 'skills', display: s.data.display, items: s.data.items.filter((i) => i.name.trim()).map((i) => ({ id: i.id, name: i.name, category: i.category, level: i.level })) });
        break;
      case 'services':
        out.push({ ...b, type: 'services', items: s.data.items.map((i) => ({ ...i })) });
        break;
      case 'achievements':
        out.push({ ...b, type: 'achievements', items: s.data.items.map((i) => ({ ...i, date: formatMonth(i.date), url: link(i.url, `“${i.title}” link`, s.id) })) });
        break;
      case 'certifications':
        out.push({ ...b, type: 'certifications', items: s.data.items.map((i) => ({ ...i, date: formatMonth(i.date), url: link(i.url, `“${i.name}” link`, s.id) })) });
        break;
      case 'testimonials': {
        const items = [];
        for (const t of s.data.items) items.push({ id: t.id, quote: t.quote, author: t.author, role: t.role, company: t.company, avatar: await image(t.avatar, `avatar-${slugify(t.author)}`, s.id, `Photo of ${t.author || 'testimonial author'}`, 320) });
        out.push({ ...b, type: 'testimonials', layout: s.data.layout, items });
        break;
      }
      case 'blog':
        out.push({ ...b, type: 'blog', items: s.data.items.map((i) => ({ ...i, date: formatMonth(i.date), url: link(i.url, `“${i.title}” link`, s.id) })) });
        break;
      case 'contact': {
        const d = s.data;
        out.push({ ...b, type: 'contact', body: d.body, email: /@/.test(d.email) ? d.email.trim() : '', phone: d.phone, location: d.location, availability: d.availability, showForm: d.showForm && /@/.test(d.email) });
        break;
      }
      case 'social':
        out.push({ ...b, type: 'social', style: s.data.style });
        break;
      case 'stats':
        out.push({ ...b, type: 'stats', items: s.data.items.map((i) => ({ ...i })) });
        break;
      case 'timeline':
        out.push({ ...b, type: 'timeline', items: s.data.items.map((i) => ({ ...i, date: formatMonth(i.date) })) });
        break;
      case 'gallery': {
        const items = [];
        for (let i = 0; i < s.data.items.length; i++) {
          const it = s.data.items[i]!;
          const img = await image(it.image, `gallery-${i + 1}`, s.id, `Gallery image ${i + 1}`);
          if (img) items.push({ id: it.id, image: img, caption: it.caption });
        }
        out.push({ ...b, type: 'gallery', layout: s.data.layout, items });
        break;
      }
      case 'custom': {
        const d = s.data;
        const html = d.mode === 'html' ? sanitizeHtml(d.content) : renderMarkdown(d.content);
        if (d.css.trim()) customCss += `/* ${heading || 'Custom section'} */\n${scopeCss(d.css, `[data-section="${s.id}"]`)}\n`;
        out.push({ ...b, type: 'custom', html });
        break;
      }
    }
  }

  /* ------------------------------ pages -------------------------------- */
  const pages = planPages(out, o.structure, p);

  /* ------------------------------ nav ---------------------------------- */
  const inNav = new Set(sections.filter((s) => s.style.showInNav && s.type !== 'hero').map((s) => s.id));
  const navLinks =
    o.structure === 'multi'
      ? pages.filter((pg) => pg.path !== '/').map((pg) => ({ label: pg.title, href: pg.path }))
      : out.filter((s) => inNav.has(s.id) && s.heading.trim()).map((s) => ({ label: s.heading, href: `#${s.anchor}` }));

  /* ------------------------------ seo ---------------------------------- */
  const m = p.metadata;
  const origin = normalizeOrigin(o.siteUrl || m.siteUrl);
  if ((o.siteUrl || m.siteUrl) && !origin) warnings.push('The site URL is not a valid https:// address; sitemap and Open Graph URLs use a placeholder.');
  const ogImage = m.ogImage.src ? await image(m.ogImage, 'og-image', 'seo', 'Social share image', 1600) : (out.find((s) => s.type === 'hero') as { image: SiteImage | null } | undefined)?.image ?? null;
  const contact = contactOf(p);
  const person = hero?.name || m.author || m.title;

  const data: PortfolioData = {
    seo: {
      title: m.title || person || 'Portfolio',
      description: m.description || hero?.description || '',
      keywords: m.keywords.filter(Boolean),
      author: m.author || person || '',
      lang: m.language || 'en',
      siteUrl: origin,
      twitterHandle: m.twitterHandle.replace(/^@?/, m.twitterHandle ? '@' : ''),
      ogImage,
      favicon: null,
    },
    person: {
      name: person || '',
      headline: hero?.title ?? '',
      email: contact?.email && /@/.test(contact.email) ? contact.email : '',
      location: contact?.location ?? '',
      image: (out.find((s) => s.type === 'hero') as { image: SiteImage | null } | undefined)?.image ?? null,
    },
    theme: { scheme: p.settings.colorScheme, toggle: p.settings.showThemeToggle, cardStyle: p.theme.cardStyle, buttonStyle: p.theme.buttonStyle },
    nav: { enabled: p.settings.navigation.enabled, brand: p.settings.navigation.brand || person || m.title, style: p.settings.navigation.style, sticky: p.settings.navigation.sticky, links: navLinks },
    footer: { enabled: p.settings.footer.enabled, text: p.settings.footer.text, credit: p.settings.footer.showCredit },
    chrome: { smoothScroll: p.settings.smoothScroll, backToTop: p.settings.backToTop, grain: p.theme.effects.grain },
    social,
    sections: out,
    projects,
    pages,
  };
  /* ------------------------------ fonts & favicon ---------------------- */
  const fontFiles: SiteBuild['fontFiles'] = [];
  for (const f of fontPlan(p).files) {
    const a = await loader(p.id, f.assetId).catch(() => null);
    if (a) fontFiles.push({ path: f.path, bytes: await blobToBytes(a.blob) });
    else warnings.push(`Font file for ${f.path} is missing; the fallback font is used.`);
  }
  let faviconImage: ImageFile | null = null;
  let faviconText = '';
  const fav = m.favicon.trim();
  if (isAssetRef(fav) || /^https?:\/\//i.test(fav)) {
    const img = await image({ src: fav, alt: '' }, 'favicon-source', 'seo', 'Favicon', 256);
    if (img) {
      faviconImage = images.find((i) => `/${i.path}` === img.src) ?? null;
      data.seo.favicon = img.src;
    }
  } else if (fav) faviconText = [...fav].slice(0, 2).join('');
  if (!faviconText && !faviconImage) faviconText = (person || m.title || 'P').trim().charAt(0).toUpperCase();

  return { data, images, customCss, fontFiles, faviconImage, faviconText, warnings, problems };
}

export function normalizeOrigin(url: string | undefined): string | null {
  const v = (url ?? '').trim();
  if (!v) return null;
  const href = safeHref(v);
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    const u = new URL(href);
    return u.origin;
  } catch {
    return null;
  }
}

const PAGE_OF: Record<Section['type'], '/' | '/about' | '/projects' | '/contact'> = {
  hero: '/',
  stats: '/',
  services: '/',
  testimonials: '/',
  blog: '/',
  custom: '/',
  about: '/about',
  experience: '/about',
  education: '/about',
  skills: '/about',
  certifications: '/about',
  achievements: '/about',
  timeline: '/about',
  projects: '/projects',
  gallery: '/projects',
  contact: '/contact',
  social: '/contact',
};

const PAGE_TITLES: Record<string, string> = { '/': 'Home', '/about': 'About', '/projects': 'Projects', '/contact': 'Contact' };

export function planPages(sections: Section[], structure: Structure, p: Portfolio): PageDefinition[] {
  const desc = p.metadata.description;
  if (structure === 'single') return [{ path: '/', title: p.metadata.title || 'Home', description: desc, sectionIds: sections.map((s) => s.id) }];
  const byPath = new Map<string, string[]>();
  for (const s of sections) {
    const path = PAGE_OF[s.type];
    byPath.set(path, [...(byPath.get(path) ?? []), s.id]);
  }
  // Home always exists; if the portfolio has no hero, its first page's content becomes home.
  if (!byPath.has('/')) {
    const first = [...byPath.entries()][0];
    if (first) {
      byPath.delete(first[0]);
      byPath.set('/', first[1]);
    } else byPath.set('/', []);
  }
  const order = ['/', '/about', '/projects', '/contact'];
  return order
    .filter((path) => byPath.has(path))
    .map((path) => {
      const ids = byPath.get(path)!;
      const first = sections.find((s) => s.id === ids[0]);
      return { path, title: path === '/' ? p.metadata.title || 'Home' : PAGE_TITLES[path]!, description: path === '/' ? desc : `${PAGE_TITLES[path]} — ${first?.heading || p.metadata.title}`.slice(0, 160), sectionIds: ids };
    });
}
