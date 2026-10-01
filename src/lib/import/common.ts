import type { CtaButton, PortfolioSection, SectionDataMap, SectionOf, SectionType, SocialItem } from '@/types/portfolio';
import { createSection, getDefinition } from '@/sections/registry';
import { uid } from '@/utils/id';

/* --------------------------------- Dates -------------------------------- */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_NAME = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const SINGLE_DATE = `(?:\\b${MONTH_NAME}\\s*,?\\s*\\d{4}(?![A-Za-z0-9])|(?<![A-Za-z0-9])\\d{1,2}\\s*[/.-]\\s*\\d{4}(?![A-Za-z0-9])|(?<![A-Za-z0-9])\\d{4}\\s*[/.-]\\s*\\d{1,2}(?![A-Za-z0-9])|(?<![A-Za-z0-9])(?:19|20)\\d{2}(?![A-Za-z0-9]))`;
const PRESENT = '(?:present|current|now|today|ongoing)';
const RANGE_SEP = '\\s*(?:-|–|—|to|until|→)\\s*';

/** Matches "Jan 2020 – Present", "2018 - 2021", "03/2019–06/2022", "Since 2019" style ranges. */
export const DATE_RANGE_RE = new RegExp(`(${SINGLE_DATE})(?:${RANGE_SEP}(${SINGLE_DATE}|${PRESENT}))?`, 'i');

/** "Jan 2020" → "2020-01", "03/2019" → "2019-03", "2018" → "2018" (no month is invented). */
export function normalizeDate(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/\.$/, '');
  let m = new RegExp(`^(${MONTH_NAME})\\s*,?\\s*(\\d{4})$`, 'i').exec(v);
  if (m) {
    const month = MONTHS[m[1]!.replace('.', '')];
    return month ? `${m[2]}-${String(month).padStart(2, '0')}` : m[2]!;
  }
  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(v);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{4})\s*[/.-]\s*(\d{1,2})$/.exec(v);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]!.padStart(2, '0')}`;
  m = /^((?:19|20)\d{2})$/.exec(v);
  if (m) return m[1]!;
  return '';
}

export interface DateRange {
  start: string;
  end: string;
  current: boolean;
  /** The matched text, so callers can strip it from a line. */
  match: string;
}

export function findDateRange(text: string): DateRange | null {
  const m = DATE_RANGE_RE.exec(text);
  if (!m) return null;
  const start = normalizeDate(m[1] ?? '');
  if (!start) return null;
  const endRaw = (m[2] ?? '').trim();
  const current = new RegExp(`^${PRESENT}$`, 'i').test(endRaw);
  const end = current ? '' : endRaw ? normalizeDate(endRaw) : '';
  return { start, end, current, match: m[0] };
}

/** Remove a date range plus surrounding punctuation/parentheses from a line. */
export function stripDates(line: string, range: DateRange | null): string {
  if (!range) return line.trim();
  return line
    .replace(range.match, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,|·•–—-]+|[\s,|·•–—(-]+$/g, '')
    .trim();
}

/* --------------------------- Role / company split ------------------------- */

const ROLE_WORDS =
  /\b(engineer|developer|designer|manager|lead|intern|analyst|consultant|director|architect|scientist|specialist|officer|head|founder|co-founder|vp|cto|ceo|cfo|coo|president|researcher|programmer|administrator|coordinator|editor|writer|associate|assistant|technician|strategist|producer|owner|partner|principal|staff|senior|junior|sr\.?|jr\.?|teacher|lecturer|professor|fellow|contractor|freelancer?|advisor|executive|representative|marketer|accountant|nurse|recruiter|expert|tutor|trainer|instructor)\b/i;

export function looksLikeRole(s: string): boolean {
  return ROLE_WORDS.test(s);
}

/**
 * "Role at Company", "Role @ Company", "Role, Company" → role first;
 * "Company — Role", "Company | Role", "Company - Role" → company first (unless only the left side reads like a job title).
 */
export function splitRoleCompany(line: string): { role: string; company: string } {
  const text = line.trim();
  let m = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(text);
  if (m) return { role: m[1]!.trim(), company: m[2]!.trim() };
  m = /^(.+?)\s+(?:—|–|-|\|)\s+(.+)$/.exec(text);
  if (m) {
    const left = m[1]!.trim();
    const right = m[2]!.trim();
    if (looksLikeRole(left) && !looksLikeRole(right)) return { role: left, company: right };
    return { role: right, company: left };
  }
  m = /^(.+?),\s+(.+)$/.exec(text);
  if (m) {
    const left = m[1]!.trim();
    const right = m[2]!.trim();
    if (looksLikeRole(right) && !looksLikeRole(left)) return { role: right, company: left };
    return { role: left, company: right };
  }
  return looksLikeRole(text) ? { role: text, company: '' } : { role: '', company: text };
}

/* ---------------------------------- Links -------------------------------- */

const SOCIAL_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)github\.com$/i, 'GitHub'],
  [/(^|\.)gitlab\.com$/i, 'GitLab'],
  [/(^|\.)linkedin\.com$/i, 'LinkedIn'],
  [/(^|\.)(twitter|x)\.com$/i, 'X'],
  [/(^|\.)dribbble\.com$/i, 'Dribbble'],
  [/(^|\.)behance\.net$/i, 'Behance'],
  [/(^|\.)instagram\.com$/i, 'Instagram'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, 'YouTube'],
  [/(^|\.)medium\.com$/i, 'Medium'],
  [/(^|\.)substack\.com$/i, 'Substack'],
  [/(^|\.)dev\.to$/i, 'DEV'],
  [/(^|\.)stackoverflow\.com$/i, 'Stack Overflow'],
  [/(^|\.)mastodon\.social$|(^|\.)bsky\.app$/i, 'Mastodon'],
  [/(^|\.)codepen\.io$/i, 'CodePen'],
  [/(^|\.)kaggle\.com$/i, 'Kaggle'],
];

/** Turn "github.com/ada" into "https://github.com/ada"; returns '' for anything that is not a web URL. */
export function normalizeWebUrl(raw: string): string {
  let v = raw.trim().replace(/[),.;]+$/, '');
  if (!v) return '';
  if (/^www\./i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v)) v = `https://${v}`;
  if (!/^https?:\/\//i.test(v)) return '';
  try {
    const u = new URL(v);
    return u.hostname.includes('.') ? u.toString().replace(/\/$/, u.pathname === '/' ? '/' : '') : '';
  } catch {
    return '';
  }
}

export function socialPlatformOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [re, name] of SOCIAL_HOSTS) if (re.test(host)) return name;
  } catch {
    return null;
  }
  return null;
}

export function socialItem(platform: string, url: string): SocialItem {
  return { id: uid('soc'), platform, url, label: platform };
}

/* ------------------------------- Sections -------------------------------- */

type ListItemOf<K extends SectionType> = SectionDataMap[K] extends { items: Array<infer I> } ? I : never;

/** A fully-shaped list item for a section type, created by the definition's own factory. */
export function newItem<K extends SectionType>(type: K, overrides: Partial<ListItemOf<K>>): ListItemOf<K> {
  const def = getDefinition(type);
  const field = def.fields.find((f) => f.kind === 'list' && f.key === 'items');
  const base = field && field.kind === 'list' ? field.createItem() : { id: uid('itm') };
  return { ...base, ...overrides } as ListItemOf<K>;
}

export function addSection<K extends SectionType>(sections: PortfolioSection[], type: K, data: Partial<SectionDataMap[K]>, name?: string): SectionOf<K> {
  const s = createSection(type, data, sections);
  if (name) s.name = name;
  s.order = sections.length;
  sections.push(s);
  return s;
}

/** Hero buttons that only point at sections that exist. */
export function heroCtas(sections: PortfolioSection[]): CtaButton[] {
  const anchor = (t: SectionType) => sections.find((s) => s.type === t)?.style.anchor;
  const out: CtaButton[] = [];
  const work = anchor('projects') ?? anchor('experience');
  if (work) out.push({ id: uid('cta'), label: anchor('projects') ? 'View my work' : 'See my experience', url: `#${work}`, variant: 'primary' });
  const contact = anchor('contact');
  if (contact) out.push({ id: uid('cta'), label: 'Get in touch', url: `#${contact}`, variant: out.length ? 'secondary' : 'primary' });
  return out;
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sentence = cut.lastIndexOf('. ');
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
