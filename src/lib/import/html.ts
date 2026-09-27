import type { ImageRef, Portfolio, PortfolioSection, SectionType, SocialItem } from '@/types/portfolio';
import { parsePortfolio } from '@/schemas/portfolio';
import { createPortfolio } from '@/lib/portfolio-factory';
import { sanitizeHtml } from '@/lib/sanitize';
import { assetIdOf, assetRef, isAssetRef } from '@/lib/engine/assets';
import { collectAssetIds } from '@/lib/engine/collect';
import { safeMediaSrc } from '@/utils/url';
import { uid } from '@/utils/id';
import { addSection, clip, EMAIL_RE, findDateRange, heroCtas, newItem, normalizeWebUrl, socialItem, socialPlatformOf, splitRoleCompany, stripDates } from './common';
import { DEGREE_RE, INSTITUTION_RE } from './resume-text';

export interface ImportedAsset {
  id: string;
  dataUrl: string;
  name: string;
}

export interface HtmlImportResult {
  portfolio: Portfolio;
  assets: ImportedAsset[];
  warnings: string[];
  /** True when the file is a Portfolio OS export and the project was restored exactly. */
  exact: boolean;
}

const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i;

function parseDoc(html: string): Document {
  // DOMParser builds an inert document: scripts never execute and resources never load.
  return new DOMParser().parseFromString(html, 'text/html');
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const meta = (doc: Document, name: string): string => doc.querySelector(`meta[name="${name}" i], meta[property="${name}" i]`)?.getAttribute('content')?.trim() ?? '';

/* ------------------------------ Own exports ------------------------------ */

function restoreOwnExport(doc: Document, json: string): HtmlImportResult {
  const warnings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('The embedded portfolio data in this file is corrupted.');
  }
  const parsed = parsePortfolio(raw);
  warnings.push(...parsed.warnings);
  if (parsed.migratedFrom) warnings.push(`Migrated from schema v${parsed.migratedFrom}.`);
  const portfolio = parsed.portfolio;
  const assets = new Map<string, ImportedAsset>();
  const add = (id: string, dataUrl: string, name: string) => {
    if (!assets.has(id) && DATA_IMAGE.test(dataUrl)) assets.set(id, { id, dataUrl, name });
  };
  doc.querySelectorAll('img[data-pos-asset]').forEach((img) => {
    const id = img.getAttribute('data-pos-asset') ?? '';
    const src = img.getAttribute('src') ?? '';
    if (id && src.startsWith('data:')) add(id, src, img.getAttribute('alt')?.trim() || id);
  });
  // Background images carry no id attribute, but their section is known.
  for (const s of portfolio.sections) {
    if (s.type !== 'hero' || s.data.background !== 'image' || !isAssetRef(s.data.backgroundImage.src)) continue;
    const el = doc.querySelector(`[data-section-id="${s.id}"] .hero-media[style]`);
    const m = /url\(['"]?(data:[^'")]+)['"]?\)/.exec(el?.getAttribute('style') ?? '');
    if (m && m[1]) add(assetIdOf(s.data.backgroundImage.src), m[1], 'Hero background');
  }
  if (isAssetRef(portfolio.metadata.favicon)) {
    const href = doc.querySelector('link[rel="icon"]')?.getAttribute('href') ?? '';
    if (href.startsWith('data:')) add(assetIdOf(portfolio.metadata.favicon), href, 'Favicon');
  }
  // Custom fonts are inlined in @font-face rules.
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  for (const f of portfolio.metadata.customFonts) {
    const family = f.family.replace(/"/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`font-family:"${family}";src:url\\("(data:[^"]+)"\\)`).exec(css);
    if (m && m[1] && !assets.has(f.assetId)) assets.set(f.assetId, { id: f.assetId, dataUrl: m[1], name: f.family });
  }
  const missing = collectAssetIds(portfolio).filter((id) => !assets.has(id));
  if (missing.length) warnings.push(`${missing.length} image(s) or font(s) were not embedded in this file and could not be restored.`);
  return { portfolio, assets: [...assets.values()], warnings, exact: true };
}

/* ---------------------------- Generic HTML pages --------------------------- */

type Kind = Exclude<SectionType, 'hero' | 'social' | 'stats' | 'timeline' | 'gallery'>;

const CLASSIFIERS: Array<[Kind, RegExp]> = [
  ['experience', /experience|employment|work history|career|professional background|where i('ve| have) worked|jobs?\b/i],
  ['education', /education|academic|degrees?|school|universit/i],
  ['certifications', /certif|licen[cs]e/i],
  ['achievements', /award|achievement|honou?rs?|recognition|accomplishment/i],
  ['testimonials', /testimonial|recommendation|what (people|clients) say|kind words|reviews?|endorsement/i],
  ['services', /services?|what i (do|offer)|offerings|hire me for/i],
  ['blog', /blog|writing|articles?|posts|essays|publications|thoughts/i],
  ['projects', /projects?|portfolio|case stud|selected work|featured work|\bwork\b|things i('ve| have) (made|built)/i],
  ['skills', /skills?|stack|tools|technolog|expertise|toolbox|competenc/i],
  ['about', /about|\bbio\b|who i am|biography|introduction|\bme\b|summary|profile/i],
  ['contact', /contact|get in touch|reach( out| me)?|say hello|let'?s talk|let'?s work|hire me/i],
];

export function classifyHeading(heading: string): Kind | null {
  for (const [kind, re] of CLASSIFIERS) if (re.test(heading)) return kind;
  return null;
}

interface Tok {
  kind: 'h' | 'p' | 'li' | 'quote' | 'cite' | 'img' | 'a' | 'time';
  text: string;
  el: Element;
}

interface Entry {
  title: string;
  lines: string[];
  bullets: string[];
  links: Array<{ href: string; text: string }>;
  images: Element[];
  quotes: string[];
  cites: string[];
  dates: string[];
}

const emptyEntry = (title = ''): Entry => ({ title, lines: [], bullets: [], links: [], images: [], quotes: [], cites: [], dates: [] });

function tokenize(elements: Element[]): Tok[] {
  const out: Tok[] = [];
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (/^h[3-6]$/.test(tag)) out.push({ kind: 'h', text: text(el), el });
    else if (tag === 'p' || tag === 'dd' || tag === 'dt' || tag === 'figcaption' || tag === 'address') {
      if (el.closest('li, blockquote')) continue;
      if (tag === 'figcaption' && el.closest('figure')?.querySelector('blockquote')) out.push({ kind: 'cite', text: text(el), el });
      else out.push({ kind: 'p', text: text(el), el });
    } else if (tag === 'li') {
      if (el.querySelector('li')) continue; // only leaf items
      out.push({ kind: 'li', text: text(el), el });
    } else if (tag === 'blockquote') out.push({ kind: 'quote', text: text(el), el });
    else if (tag === 'cite') out.push({ kind: 'cite', text: text(el), el });
    else if (tag === 'img') out.push({ kind: 'img', text: el.getAttribute('alt') ?? '', el });
    else if (tag === 'a' && el.getAttribute('href')) out.push({ kind: 'a', text: text(el), el });
    else if (tag === 'time') out.push({ kind: 'time', text: el.getAttribute('datetime') || text(el), el });
  }
  return out.filter((t) => t.kind === 'img' || t.kind === 'a' || t.text);
}

function entriesOf(tokens: Tok[]): { intro: Entry; entries: Entry[] } {
  const intro = emptyEntry();
  const entries: Entry[] = [];
  let cur = intro;
  for (const t of tokens) {
    switch (t.kind) {
      case 'h':
        cur = emptyEntry(t.text);
        entries.push(cur);
        break;
      case 'p':
        cur.lines.push(t.text);
        break;
      case 'li':
        cur.bullets.push(t.text);
        break;
      case 'quote':
        cur.quotes.push(t.text);
        break;
      case 'cite':
        cur.cites.push(t.text.replace(/^[—–-]\s*/, ''));
        break;
      case 'img':
        cur.images.push(t.el);
        break;
      case 'a':
        cur.links.push({ href: t.el.getAttribute('href') ?? '', text: t.text });
        break;
      case 'time':
        cur.dates.push(t.text);
        break;
    }
  }
  return { intro, entries };
}

/** Entries from h3 headings, or — when a block is just a list — one entry per list item. */
function itemEntries(tokens: Tok[]): Entry[] {
  const { entries } = entriesOf(tokens);
  if (entries.length) return entries;
  return tokens
    .filter((t) => t.kind === 'li')
    .map((t) => {
      const e = emptyEntry(text(t.el.querySelector('strong, b, h4, h5') ?? t.el) || t.text);
      const rest = t.text.replace(e.title, '').replace(/^[\s:,—–-]+/, '').trim();
      if (rest) e.lines.push(rest);
      t.el.querySelectorAll('a[href]').forEach((a) => e.links.push({ href: a.getAttribute('href') ?? '', text: text(a) }));
      t.el.querySelectorAll('img').forEach((img) => e.images.push(img));
      return e;
    });
}

interface ImageSink {
  assets: ImportedAsset[];
  skipped: number;
}

function imageRef(img: Element | undefined, sink: ImageSink, fallbackAlt = ''): ImageRef {
  if (!img) return { src: '', alt: '' };
  const src = (img.getAttribute('src') ?? '').trim();
  const alt = (img.getAttribute('alt') ?? '').trim() || fallbackAlt;
  if (DATA_IMAGE.test(src)) {
    const id = uid('img');
    sink.assets.push({ id, dataUrl: src, name: alt || `imported-${sink.assets.length + 1}` });
    return { src: assetRef(id), alt };
  }
  if (/^https:\/\//i.test(src) && safeMediaSrc(src)) return { src, alt };
  return { src: '', alt: '' };
}

function webLinks(e: Entry): string[] {
  return e.links.map((l) => normalizeWebUrl(l.href)).filter(Boolean);
}

function markdownOf(tokens: Tok[]): string {
  let out = '';
  let prevList = false;
  for (const t of tokens) {
    let part = '';
    if (t.kind === 'h') part = `### ${t.text}`;
    else if (t.kind === 'p') part = inlineMarkdown(t.el);
    else if (t.kind === 'li') part = `- ${inlineMarkdown(t.el)}`;
    else if (t.kind === 'quote') part = `> ${t.text}`;
    else if (t.kind === 'cite') part = `— ${t.text}`;
    if (!part) continue;
    const isList = t.kind === 'li';
    out += out ? (isList && prevList ? '\n' : '\n\n') : '';
    out += part;
    prevList = isList;
  }
  return out;
}

function inlineMarkdown(el: Element): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent ?? '';
    else if (n.nodeType === 1) {
      const c = n as Element;
      const tag = c.tagName.toLowerCase();
      const inner = inlineMarkdown(c);
      if (tag === 'a' && normalizeWebUrl(c.getAttribute('href') ?? '')) out += `[${inner}](${normalizeWebUrl(c.getAttribute('href') ?? '')})`;
      else if (tag === 'strong' || tag === 'b') out += `**${inner}**`;
      else if (tag === 'em' || tag === 'i') out += `*${inner}*`;
      else if (tag === 'code') out += `\`${inner}\``;
      else if (tag === 'br') out += '\n';
      else out += inner;
    }
  });
  return out.replace(/[ \t]+/g, ' ').trim();
}

interface Block {
  heading: string;
  tokens: Tok[];
}

function elementsBetween(all: Element[], start: Element | null, end: Element | null): Element[] {
  return all.filter((el) => {
    if (start && !(start.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
    if (start && start.contains(el)) return false;
    if (end && !(end.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) return false;
    return true;
  });
}

function splitBlocks(body: HTMLElement, hero: Set<Element>): Block[] {
  const topSections = [...body.querySelectorAll('section, article')].filter(
    (s) => !s.parentElement?.closest('section, article') && !hero.has(s) && !s.querySelector('h1') && s.querySelector('h2, h3'),
  );
  if (topSections.length >= 2) {
    return topSections.map((s) => {
      const h = s.querySelector('h2') ?? s.querySelector('h3');
      const inner = [...s.querySelectorAll('*')].filter((el) => el !== h && !h?.contains(el));
      return { heading: text(h), tokens: tokenize(inner) };
    });
  }
  const all = [...body.querySelectorAll('*')].filter((el) => !hero.has(el));
  const h2s = all.filter((el) => el.tagName === 'H2');
  const blocks: Block[] = [];
  h2s.forEach((h, i) => blocks.push({ heading: text(h), tokens: tokenize(elementsBetween(all, h, h2s[i + 1] ?? null)) }));
  return blocks;
}

function heroRootOf(h1: Element | null): Element | null {
  if (!h1) return null;
  let node: Element = h1;
  while (node.parentElement && node.parentElement.tagName !== 'BODY' && !node.parentElement.querySelector('h2:not(.hero-title)')) node = node.parentElement;
  return node === h1 ? null : node;
}

/** Elements that belong to the hero: its container, or everything between the h1 and the first h2. */
function heroScope(body: HTMLElement, h1: Element | null): Set<Element> {
  const scope = new Set<Element>();
  if (!h1) return scope;
  const root = heroRootOf(h1);
  if (root) {
    scope.add(root);
    root.querySelectorAll('*').forEach((el) => scope.add(el));
    return scope;
  }
  const all = [...body.querySelectorAll('*')];
  const nextH2 = all.find((el) => el.tagName === 'H2' && h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null;
  scope.add(h1);
  for (const el of elementsBetween(all, h1, nextH2)) scope.add(el);
  return scope;
}

export function importGenericHtml(rawDoc: Document): HtmlImportResult {
  const warnings: string[] = [];
  const detected: string[] = [];
  const sink: ImageSink = { assets: [], skipped: 0 };
  const unsafe = rawDoc.querySelectorAll('script:not([type="application/ld+json"]), iframe, object, embed').length + [...rawDoc.querySelectorAll('*')].filter((el) => el.getAttributeNames().some((a) => /^on/i.test(a))).length;

  rawDoc.querySelectorAll('img[src]').forEach((img) => {
    const src = (img.getAttribute('src') ?? '').trim();
    if (src && !DATA_IMAGE.test(src) && !/^https:\/\//i.test(src)) sink.skipped++;
  });
  const clean = parseDoc(`<!doctype html><html><body>${sanitizeHtml(rawDoc.body?.innerHTML ?? '')}</body></html>`);
  const body = clean.body;

  // Links anywhere on the page (nav and footer included) → social + contact.
  const socials: SocialItem[] = [];
  let email = '';
  let phone = '';
  body.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (/^mailto:/i.test(href)) {
      const m = EMAIL_RE.exec(decodeURIComponent(href.slice(7)));
      if (m && !email) email = m[0];
      return;
    }
    if (/^tel:/i.test(href)) {
      if (!phone) phone = text(a) || href.slice(4);
      return;
    }
    const url = normalizeWebUrl(href);
    const platform = url ? socialPlatformOf(url) : null;
    if (platform && url && isProfileUrl(url, platform) && !socials.some((s) => s.url === url)) socials.push(socialItem(platform, url));
  });
  if (!email) {
    const m = EMAIL_RE.exec(body.textContent ?? '');
    if (m) email = m[0];
  }
  body.querySelectorAll('nav, footer, [role="navigation"], .skip-link').forEach((n) => n.remove());

  // Metadata.
  const title = rawDoc.title.trim();
  const description = meta(rawDoc, 'description') || meta(rawDoc, 'og:description');
  const keywords = meta(rawDoc, 'keywords')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const author = meta(rawDoc, 'author');
  const lang = rawDoc.documentElement.getAttribute('lang')?.trim() ?? '';

  // Hero.
  const h1 = body.querySelector('h1');
  const name = text(h1) || author || title.split(/\s[|—–-]\s/)[0]?.trim() || '';
  const hero$ = heroScope(body, h1);
  let heroTitle = '';
  let heroDescription = '';
  if (h1) {
    const after = [...hero$].filter((el) => el.matches('p, h2, h3, span')).filter((el) => h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !el.closest('a, button') && !(el.tagName === 'SPAN' && el.closest('p, h2, h3')));
    for (const el of after) {
      const t = text(el);
      if (!t || t === name) continue;
      if (!heroTitle && t.length <= 100 && !heroDescription) heroTitle = t;
      else if (!heroDescription && t.length > 20) heroDescription = t;
      if (heroTitle && heroDescription) break;
    }
  }
  if (!heroDescription && description) heroDescription = description;
  const firstH2 = body.querySelector('h2');
  const heroImgEl =
    [...hero$].filter((el) => el.tagName === 'IMG').find((i) => imgUsable(i)) ??
    [...body.querySelectorAll('img')].find((i) => imgUsable(i) && (!firstH2 || i.compareDocumentPosition(firstH2) & Node.DOCUMENT_POSITION_FOLLOWING));
  const heroImage = imageRef(heroImgEl, sink, name ? `Portrait of ${name}` : '');
  if (name) detected.push(`name "${name}"`);

  const p = createPortfolio({ title: title || (name ? `${name} — Portfolio` : 'Imported portfolio'), sections: [] });
  p.metadata.description = description;
  p.metadata.keywords = keywords;
  p.metadata.author = author || name;
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) p.metadata.language = lang;
  const og = meta(rawDoc, 'og:image');
  if (/^https:\/\//i.test(og)) p.metadata.ogImage = { src: og, alt: meta(rawDoc, 'og:image:alt') };
  const canonical = rawDoc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? meta(rawDoc, 'og:url');
  if (/^https?:\/\//i.test(canonical)) p.metadata.siteUrl = canonical;
  const sections: PortfolioSection[] = p.sections;
  const hero = addSection(sections, 'hero', { name: name || 'Your Name', title: heroTitle, description: clip(heroDescription, 280), image: heroImage, layout: heroImage.src ? 'split' : 'centered' });

  let unknown = 0;
  let contactSeen = false;
  for (const block of splitBlocks(body, hero$)) {
    if (!block.tokens.length) continue;
    const kind = classifyHeading(block.heading);
    const heading = block.heading || 'Section';
    const { intro, entries } = entriesOf(block.tokens);
    switch (kind) {
      case 'about': {
        const img = block.tokens.find((t) => t.kind === 'img');
        const paragraphs = block.tokens.filter((t) => t.kind === 'p').map((t) => inlineMarkdown(t.el));
        addSection(sections, 'about', {
          heading,
          body: paragraphs.join('\n\n') || intro.bullets.join('\n\n'),
          highlights: paragraphs.length ? block.tokens.filter((t) => t.kind === 'li').map((t) => t.text).slice(0, 8) : [],
          image: imageRef(img?.el, sink),
        });
        detected.push('About');
        break;
      }
      case 'experience': {
        const items = itemEntries(block.tokens).map((e) => {
          const all = [e.title, ...e.lines, ...e.dates];
          const range = all.map((l) => findDateRange(l)).find(Boolean) ?? null;
          const { role, company } = splitRoleCompany(stripDates(e.title, findDateRange(e.title)));
          const lines = e.lines.map((l) => stripDates(l, findDateRange(l))).filter(Boolean);
          let companyName = company;
          let rest = lines;
          if (!companyName && lines[0] && lines[0].length <= 60) {
            companyName = lines[0];
            rest = lines.slice(1);
          }
          return newItem('experience', {
            role: role || e.title,
            company: companyName,
            start: range?.start ?? '',
            end: range?.end ?? '',
            current: range?.current ?? false,
            description: rest.join(' '),
            achievements: e.bullets,
            url: webLinks(e)[0] ?? '',
          });
        });
        if (items.length) {
          addSection(sections, 'experience', { heading, items });
          detected.push(`${items.length} position${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'projects': {
        const items = itemEntries(block.tokens).map((e) => {
          const links = webLinks(e);
          const short = e.bullets.length >= 2 && e.bullets.every((b) => b.split(/\s+/).length <= 3);
          return newItem('projects', {
            title: e.title,
            description: e.lines.join(' '),
            image: imageRef(e.images[0], sink, e.title),
            github: links.find((l) => /github\.com|gitlab\.com|bitbucket\.org/i.test(l)) ?? '',
            live: links.find((l) => !/github\.com|gitlab\.com|bitbucket\.org/i.test(l)) ?? '',
            technologies: short ? e.bullets : [],
            features: short ? [] : e.bullets,
          });
        });
        if (items.length) {
          addSection(sections, 'projects', { heading, intro: intro.lines.join('\n\n'), items });
          detected.push(`${items.length} project${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'skills': {
        const items: ReturnType<typeof newItem<'skills'>>[] = [];
        const seen = new Set<string>();
        const push = (name: string, category: string) => {
          const n = name.trim();
          if (!n || n.length > 40 || seen.has(n.toLowerCase())) return;
          seen.add(n.toLowerCase());
          items.push(newItem('skills', { name: n, category }));
        };
        const groups = entries.length ? entries : [intro];
        for (const g of groups) {
          const category = g.title || 'General';
          for (const b of g.bullets) push(b, category);
          for (const l of g.lines) for (const part of l.split(/\s*[,|•·;]\s*/)) push(part, category);
        }
        if (entries.length) for (const b of intro.bullets) push(b, 'General');
        if (items.length) {
          addSection(sections, 'skills', { heading, items, display: new Set(items.map((i) => i.category)).size > 1 ? 'grouped' : 'tags' });
          detected.push(`${items.length} skill${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'education': {
        const items = itemEntries(block.tokens).map((e) => {
          const range = [e.title, ...e.lines, ...e.dates].map((l) => findDateRange(l)).find(Boolean) ?? null;
          const t = stripDates(e.title, findDateRange(e.title));
          const lines = e.lines.map((l) => stripDates(l, findDateRange(l))).filter(Boolean);
          const titleIsDegree = DEGREE_RE.test(t) || !INSTITUTION_RE.test(t);
          return newItem('education', {
            degree: titleIsDegree ? t : (lines[0] ?? ''),
            institution: titleIsDegree ? (lines[0] ?? '') : t,
            start: range && (range.end || range.current) ? range.start : '',
            end: range ? range.end || (range.current ? '' : range.start) : '',
            description: lines.slice(1).join(' '),
          });
        });
        if (items.length) {
          addSection(sections, 'education', { heading, items });
          detected.push(`${items.length} education entr${items.length === 1 ? 'y' : 'ies'}`);
        }
        break;
      }
      case 'services': {
        const items = itemEntries(block.tokens).map((e) => newItem('services', { title: e.title, description: e.lines.join(' ') }));
        if (items.length) {
          addSection(sections, 'services', { heading, intro: intro.lines.join('\n\n'), items });
          detected.push('Services');
        }
        break;
      }
      case 'testimonials': {
        const quotes = block.tokens.filter((t) => t.kind === 'quote');
        const items = quotes.map((q) => {
          const fig = q.el.closest('figure');
          const cite = text(fig?.querySelector('figcaption, cite') ?? q.el.querySelector('cite') ?? nextText(q.el)).replace(/^[—–-]\s*/, '');
          const [author = '', ...roleParts] = cite.split(/\s*,\s*/);
          const roleCompany = roleParts.join(', ');
          const { role, company } = roleCompany ? splitRoleCompany(roleCompany) : { role: '', company: '' };
          return newItem('testimonials', { quote: text(q.el.querySelector('p') ?? q.el).replace(cite, '').replace(/[—–-]\s*$/, '').trim(), author: author || 'Anonymous', role, company });
        });
        if (items.length) {
          addSection(sections, 'testimonials', { heading, items });
          detected.push(`${items.length} testimonial${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'blog': {
        const items = itemEntries(block.tokens).map((e) => {
          const range = [...e.dates, ...e.lines].map((l) => findDateRange(l)).find(Boolean);
          return newItem('blog', { title: e.title, url: webLinks(e)[0] ?? '', excerpt: e.lines.filter((l) => !findDateRange(l) || l.length > 40).join(' '), date: range?.start ?? '' });
        });
        if (items.length) {
          addSection(sections, 'blog', { heading, intro: intro.lines.join('\n\n'), items });
          detected.push(`${items.length} post${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'certifications': {
        const items = itemEntries(block.tokens).map((e) => {
          const range = [e.title, ...e.lines].map((l) => findDateRange(l)).find(Boolean) ?? null;
          const [nm = e.title, issuer = ''] = stripDates(e.title, findDateRange(e.title)).split(/\s+(?:—|–|-|\|)\s+|,\s+/);
          return newItem('certifications', { name: nm, issuer: issuer || (e.lines[0] ? stripDates(e.lines[0], findDateRange(e.lines[0])) : ''), date: range?.end || range?.start || '', url: webLinks(e)[0] ?? '' });
        });
        if (items.length) {
          addSection(sections, 'certifications', { heading, items });
          detected.push(`${items.length} certification${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'achievements': {
        const items = itemEntries(block.tokens).map((e) => {
          const range = [e.title, ...e.lines].map((l) => findDateRange(l)).find(Boolean) ?? null;
          return newItem('achievements', { title: stripDates(e.title, findDateRange(e.title)), description: e.lines.join(' '), date: range?.end || range?.start || '', url: webLinks(e)[0] ?? '' });
        });
        if (items.length) {
          addSection(sections, 'achievements', { heading, items });
          detected.push(`${items.length} award${items.length === 1 ? '' : 's'}`);
        }
        break;
      }
      case 'contact': {
        if (contactSeen) break;
        contactSeen = true;
        addSection(sections, 'contact', {
          heading,
          body: block.tokens
            .filter((t) => t.kind === 'p' && !EMAIL_RE.test(t.text))
            .map((t) => inlineMarkdown(t.el))
            .join('\n\n'),
          email,
          phone,
          showForm: Boolean(email),
        });
        detected.push('Contact');
        break;
      }
      default: {
        const content = markdownOf(block.tokens);
        if (!content.trim()) break;
        unknown++;
        addSection(sections, 'custom', { heading, mode: 'markdown', content }, heading.slice(0, 40));
      }
    }
  }

  if (!contactSeen && (email || phone)) {
    addSection(sections, 'contact', { email, phone, body: '', showForm: Boolean(email) });
    detected.push('contact details');
  }
  if (socials.length) {
    addSection(sections, 'social', { items: socials });
    detected.push(`${socials.length} social link${socials.length === 1 ? '' : 's'} (${socials.map((s) => s.platform).join(', ')})`);
  }
  hero.data.ctas = heroCtas(sections);

  warnings.unshift(detected.length ? `Detected: ${detected.join(', ')}.` : 'No recognisable portfolio structure was found — review the imported content.');
  if (unknown) warnings.push(`${unknown} block${unknown === 1 ? '' : 's'} could not be classified and ${unknown === 1 ? 'was' : 'were'} imported as custom Markdown sections.`);
  if (sink.skipped) warnings.push(`${sink.skipped} image${sink.skipped === 1 ? '' : 's'} with relative or insecure URLs could not be imported. Upload them in the builder.`);
  if (unsafe) warnings.push('Scripts, embeds and event handlers were removed — nothing from the file was executed.');
  return { portfolio: p, assets: sink.assets, warnings, exact: false };
}

/** A profile page (github.com/ada), not a deep link to a repo or post. */
function isProfileUrl(url: string, platform: string): boolean {
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean);
    if (segs.some((s) => /^(share|sharer|intent|status|posts?|p)$/i.test(s))) return false;
    // Substack profiles live on a subdomain (ada.substack.com), everything else on a path.
    const min = platform === 'Substack' ? 0 : 1;
    const max = platform === 'LinkedIn' || platform === 'YouTube' ? 2 : 1;
    return segs.length >= min && segs.length <= max;
  } catch {
    return false;
  }
}

function imgUsable(img: Element): boolean {
  const src = img.getAttribute('src') ?? '';
  if (!DATA_IMAGE.test(src) && !/^https:\/\//i.test(src)) return false;
  const w = Number(img.getAttribute('width') || 0);
  const h = Number(img.getAttribute('height') || 0);
  return (w === 0 || w >= 120) && (h === 0 || h >= 120);
}

function nextText(el: Element): Element | null {
  const n = el.nextElementSibling;
  return n && n.textContent && n.textContent.trim().length < 120 ? n : null;
}

/**
 * Import an HTML file. A Portfolio OS export (with embedded `pos-data`) is restored exactly;
 * any other page is sanitised and mapped heuristically. Nothing in the file is ever executed.
 */
export async function importHtmlDocument(html: string): Promise<HtmlImportResult> {
  const doc = parseDoc(html);
  const data = doc.querySelector('script#pos-data[type="application/json"]');
  if (data && data.textContent?.trim()) return restoreOwnExport(doc, data.textContent);
  if (!doc.body || !doc.body.textContent?.trim()) throw new Error('This HTML file has no readable content.');
  return importGenericHtml(doc);
}
