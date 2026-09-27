import type { Portfolio, PortfolioSection } from '@/types/portfolio';
import type { FieldDef } from '@/types/fields';
import { getDefinition } from '@/sections/registry';
import { collectImages, collectLinks, visibleSections, socialLinksOf } from '@/lib/engine/collect';
import { checkUrl } from '@/utils/url';
import type { AnalysisReport, CheckResult } from './types';
import { agree, memo1, plural, report } from './shared';

type Item = NonNullable<CheckResult['items']>[number];
type Json = Record<string, unknown>;

export const HERO_DESCRIPTION_MAX = 280;
export const HERO_TITLE_MAX = 90;

const TEXT_KINDS = new Set<FieldDef['kind']>(['text', 'textarea', 'markdown', 'email', 'url', 'tel']);
/** Keys whose defaults are sensible final values, not filler. */
const IGNORED_KEYS = new Set(['heading', 'category', 'platform', 'label', 'icon', 'variant', 'date', 'suffix']);
const GENERIC_PLACEHOLDER = /\blorem ipsum\b|\byour name\b|@example\.(com|org)\b|\bexample\.com\b/i;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function isPlaceholderValue(value: unknown, defaults: unknown[]): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (GENERIC_PLACEHOLDER.test(v)) return true;
  return defaults.some((d) => typeof d === 'string' && d.trim() === v && !d.trim().startsWith('#'));
}

function walkFields(fields: FieldDef[], data: Json, defaults: Json[], where: string, out: string[]): void {
  for (const f of fields) {
    if (IGNORED_KEYS.has(f.key)) continue;
    if (TEXT_KINDS.has(f.kind)) {
      if (isPlaceholderValue(data[f.key], defaults.map((d) => d[f.key]))) out.push(`${where}${f.label}: "${String(data[f.key]).trim().slice(0, 60)}"`);
    } else if (f.kind === 'list') {
      const items = Array.isArray(data[f.key]) ? (data[f.key] as unknown[]).filter(isObj) : [];
      const itemDefaults: Json[] = [f.createItem()];
      for (const d of defaults) {
        const list = d[f.key];
        if (Array.isArray(list)) itemDefaults.push(...list.filter(isObj));
      }
      items.forEach((item, i) => {
        const title = typeof item[f.titleKey] === 'string' && String(item[f.titleKey]).trim() ? String(item[f.titleKey]).trim().slice(0, 40) : `#${i + 1}`;
        walkFields(f.fields, item, itemDefaults, `${f.itemLabel} "${title}" → `, out);
      });
    }
  }
}

/** Fields that still contain the default text a new section is created with. */
export function placeholdersIn(section: PortfolioSection): string[] {
  const def = getDefinition(section.type);
  const out: string[] = [];
  walkFields(def.fields, section.data as unknown as Json, [def.createData() as unknown as Json], '', out);
  return out;
}

function enabledOf<T extends PortfolioSection['type']>(p: Portfolio, type: T): Array<Extract<PortfolioSection, { type: T }>> {
  return visibleSections(p).filter((s): s is Extract<PortfolioSection, { type: T }> => s.type === type);
}

function checkAbout(p: Portfolio): CheckResult {
  const about = enabledOf(p, 'about')[0];
  const words = about ? about.data.body.split(/\s+/).filter(Boolean).length : 0;
  const status = !about || words === 0 ? 'warn' : words < 25 ? 'warn' : 'pass';
  return {
    id: 'content-about',
    label: 'About section',
    weight: 2,
    status,
    detail: !about ? 'No About section. Visitors want to know who you are — add two or three short paragraphs.' : words === 0 ? 'The About section is empty.' : words < 25 ? `The About text is very short (${words} words).` : `About section present (${words} words).`,
    sectionId: about?.id ?? null,
  };
}

function checkContact(p: Portfolio): CheckResult {
  const c = enabledOf(p, 'contact')[0];
  const has = c && (c.data.email.trim() || c.data.phone.trim());
  return {
    id: 'content-contact',
    label: 'Contact information',
    weight: 3,
    status: has ? 'pass' : 'fail',
    detail: !c ? 'There is no Contact section — visitors have no way to reach you.' : has ? 'Visitors can reach you by email or phone.' : 'The Contact section has no email or phone number.',
    sectionId: c?.id ?? null,
  };
}

function checkProjectDescriptions(p: Portfolio): CheckResult {
  const items: Item[] = [];
  let total = 0;
  for (const s of enabledOf(p, 'projects')) {
    for (const pr of s.data.items) {
      total++;
      if (pr.description.trim().length < 20) items.push({ message: `"${pr.title || 'Untitled project'}" ${pr.description.trim() ? 'has a very short description' : 'has no description'}`, sectionId: s.id });
    }
  }
  return {
    id: 'content-project-desc',
    label: 'Project descriptions',
    weight: 2,
    status: total === 0 ? 'warn' : items.length ? 'warn' : 'pass',
    detail: total === 0 ? 'No projects yet. Show two to six pieces of work you are proud of.' : items.length ? `${plural(items.length, 'project')} ${agree(items.length, 'needs', 'need')} a description: what it is, who it is for and the outcome.` : total === 1 ? 'The project is described.' : `All ${plural(total, 'project')} are described.`,
    sectionId: items[0]?.sectionId ?? enabledOf(p, 'projects')[0]?.id ?? null,
    items,
  };
}

function checkProjectLinks(p: Portfolio): CheckResult {
  const items: Item[] = [];
  let total = 0;
  for (const s of enabledOf(p, 'projects')) {
    for (const pr of s.data.items) {
      total++;
      if (!pr.live.trim() && !pr.github.trim() && !pr.caseStudy.trim()) items.push({ message: `"${pr.title || 'Untitled project'}" has no live link, source link or case study`, sectionId: s.id });
    }
  }
  return {
    id: 'content-project-links',
    label: 'Project links',
    weight: 1,
    status: total && items.length ? 'warn' : total ? 'pass' : 'info',
    detail: !total ? 'No projects to check.' : items.length ? `${plural(items.length, 'project')} ${agree(items.length, 'gives', 'give')} visitors nowhere to go next.` : 'Every project links to a demo, source or case study.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkSocial(p: Portfolio): CheckResult {
  const social = enabledOf(p, 'social')[0];
  const valid = socialLinksOf(p).filter((s) => {
    const r = checkUrl(s.url);
    return r.ok && !/^https?:\/\/(www\.)?[^/]+\/?$/.test(s.url.trim());
  });
  return {
    id: 'content-social',
    label: 'Social links',
    weight: 1,
    status: valid.length ? 'pass' : 'warn',
    detail: valid.length ? `${plural(valid.length, 'profile')} linked.` : social ? 'The Social Links section has no complete profile URLs (a bare domain like https://github.com/ is not your profile).' : 'No social links — add GitHub, LinkedIn or wherever your work lives.',
    sectionId: social?.id ?? null,
  };
}

function checkExperience(p: Portfolio): CheckResult {
  const xp = enabledOf(p, 'experience');
  const count = xp.reduce((n, s) => n + s.data.items.length, 0);
  return {
    id: 'content-experience',
    label: 'Experience',
    weight: 1,
    status: count ? 'pass' : 'warn',
    detail: count ? `${plural(count, 'position')} listed.` : xp.length ? 'The Experience section has no positions.' : 'No Experience section. Even freelance or open-source work counts.',
    sectionId: xp[0]?.id ?? null,
  };
}

function checkHeroLength(p: Portfolio): CheckResult {
  const hero = enabledOf(p, 'hero')[0];
  if (!hero) return { id: 'content-hero-length', label: 'Hero text length', weight: 1, status: 'info', detail: 'No hero section.' };
  const items: Item[] = [];
  if (hero.data.title.length > HERO_TITLE_MAX) items.push({ message: `Headline is ${hero.data.title.length} characters (keep it under ${HERO_TITLE_MAX})`, sectionId: hero.id });
  if (hero.data.description.length > HERO_DESCRIPTION_MAX) items.push({ message: `Introduction is ${hero.data.description.length} characters (keep it under ${HERO_DESCRIPTION_MAX})`, sectionId: hero.id });
  return {
    id: 'content-hero-length',
    label: 'Hero text length',
    weight: 1,
    status: items.length ? 'warn' : 'pass',
    detail: items.length ? 'The first screen is easier to scan when the headline is one line and the intro two or three.' : 'The hero headline and introduction are concise.',
    sectionId: hero.id,
    items,
  };
}

function checkAltText(p: Portfolio): CheckResult {
  const missing = collectImages(p).filter((i) => !i.ref.alt.trim() && i.label !== 'Favicon');
  return {
    id: 'content-alt',
    label: 'Image descriptions',
    weight: 2,
    status: missing.length ? 'warn' : 'pass',
    detail: missing.length ? `${plural(missing.length, 'image')} ${missing.length === 1 ? 'has' : 'have'} no description (alt text).` : 'Every image has a description.',
    sectionId: missing[0]?.sectionId ?? null,
    items: missing.map((i) => ({ message: `${i.label} — ${i.sectionName}`, sectionId: i.sectionId })),
  };
}

function checkPlaceholders(p: Portfolio): CheckResult {
  const items: Item[] = [];
  for (const s of visibleSections(p)) for (const msg of placeholdersIn(s)) items.push({ message: `${s.name}: ${msg}`, sectionId: s.id });
  return {
    id: 'content-placeholders',
    label: 'Placeholder text',
    weight: 3,
    status: items.length ? 'fail' : 'pass',
    detail: items.length ? `${plural(items.length, 'field')} still ${agree(items.length, 'contains', 'contain')} starter text like "Your Name" or "Project title".` : 'No starter text left.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkSeo(p: Portfolio): CheckResult {
  const m = p.metadata;
  const items: Item[] = [];
  if (!m.title.trim()) items.push({ message: 'Missing page title' });
  else if (m.title.trim() === 'My Portfolio') items.push({ message: 'Page title is still "My Portfolio" — use your name and role' });
  if (!m.description.trim()) items.push({ message: 'Missing meta description (shown under your name in search results)' });
  else if (m.description.trim().length < 50) items.push({ message: `Meta description is short (${m.description.trim().length} characters, aim for 50–160)` });
  else if (m.description.trim().length > 160) items.push({ message: `Meta description is long (${m.description.trim().length} characters, aim for 50–160)` });
  return {
    id: 'content-seo',
    label: 'SEO title & description',
    weight: 2,
    status: items.length ? 'warn' : 'pass',
    detail: items.length ? 'Search engines and link previews use these.' : 'Title and description are set.',
    items,
  };
}

/** Links that parse but do not look like a real destination. */
export function suspiciousUrl(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  const r = checkUrl(v);
  if (!r.ok) return r.reason;
  if (/\s/.test(v)) return 'contains spaces';
  if (/^https?:\/\/?$/i.test(v) || v === 'https://' || v === 'http://') return 'incomplete URL';
  if (/^(https?:)?\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(v)) return 'points to a local address';
  const m = /^https?:\/\/([^/?#]+)/i.exec(v);
  if (m && m[1] && !m[1].includes('.') && !m[1].startsWith('[')) return 'hostname has no domain';
  if (/^mailto:/i.test(v) && !/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+/i.test(v)) return 'invalid email address';
  if (/example\.(com|org|net)/i.test(v)) return 'placeholder domain';
  return null;
}

function checkUrls(p: Portfolio): CheckResult {
  const items: Item[] = [];
  for (const l of collectLinks(p)) {
    const reason = suspiciousUrl(l.url);
    if (reason) items.push({ message: `${l.label} (${l.sectionName}): "${l.url.slice(0, 60)}" — ${reason}`, sectionId: l.sectionId });
  }
  return {
    id: 'content-urls',
    label: 'Link quality',
    weight: 2,
    status: items.length ? 'warn' : 'pass',
    detail: items.length ? `${plural(items.length, 'link')} ${agree(items.length, 'looks', 'look')} broken or unfinished.` : 'All links look well-formed.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

export const contentAudit = memo1((p: Portfolio): AnalysisReport => {
  const checks = [
    checkPlaceholders(p),
    checkContact(p),
    checkAbout(p),
    checkProjectDescriptions(p),
    checkProjectLinks(p),
    checkExperience(p),
    checkSocial(p),
    checkHeroLength(p),
    checkAltText(p),
    checkSeo(p),
    checkUrls(p),
  ];
  return report('content', 'Content quality', checks);
});
