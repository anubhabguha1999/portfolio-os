/**
 * ResumeDoc + shared Library + Profile → ResolvedResume: a flat, template-ready view.
 * Templates never read the library or the resume refs directly, so changing templates
 * can never modify content.
 */
import type {
  ItemRef,
  LibAchievement,
  LibCertification,
  LibEducation,
  LibExperience,
  LibProject,
  Library,
  LibraryKind,
  LocalEntry,
  Profile,
  ResumeDoc,
  ResumeSection,
  ResumeSectionKind,
  ResumeStyle,
} from './types';
import { sectionInfo } from './defaults';
import { formatMonthYear, localizeDefault, localizeHeading, t } from '@/i18n';

export interface ResolvedItem {
  /** ItemRef id or LocalEntry id — used for click-to-select. */
  id: string;
  libId: string | null;
  title: string;
  subtitle: string;
  date: string;
  location: string;
  url: string;
  description: string;
  bullets: string[];
  tags: string[];
  /** Raw dates for analysis. */
  start: string;
  end: string;
  current: boolean;
}

export interface SkillGroup {
  category: string;
  names: string[];
  levels: number[];
}

export interface ResolvedSection {
  id: string;
  kind: ResumeSectionKind;
  title: string;
  display: ResumeSection['display'];
  placement: 'main' | 'side';
  /** True when the user left placement on "Auto", so templates may choose. */
  autoPlacement: boolean;
  items: ResolvedItem[];
  text: string;
  skills: SkillGroup[];
  /** Heading repeated on following pages ("Experience (continued)"), in the resume's language. */
  continued?: string;
}

export interface ContactItem {
  kind: 'email' | 'phone' | 'location' | 'website' | 'social';
  label: string;
  url?: string;
  platform?: string;
}

export interface ResolvedResume {
  id: string;
  name: string;
  headline: string;
  contact: ContactItem[];
  /** Image key understood by the image resolver, or null. */
  photo: string | null;
  profileSectionId: string | null;
  sections: ResolvedSection[];
  style: ResumeStyle;
  meta: { title: string; author: string; subject: string; keywords: string[]; creator: string };
}

/** "YYYY-MM" (or "YYYY-MM-DD") → a display date in the resume's language; anything else is kept as typed. */
export function formatDate(value: string, fmt: ResumeStyle['dateFormat'], lang: string = 'en'): string {
  const v = (value ?? '').trim();
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(v);
  if (!m) return v;
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return m[1]!;
  return formatMonthYear(Number(m[1]), mi, fmt, lang);
}

export function formatDateRange(start: string, end: string, current: boolean, fmt: ResumeStyle['dateFormat'], lang: string = 'en'): string {
  const s = formatDate(start, fmt, lang);
  const e = current ? t(lang, 'present') : formatDate(end, fmt, lang);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e;
}

/** Field value honouring detached overrides. */
export function refValue<T extends object, K extends keyof T & string>(ref: ItemRef, lib: T, key: K): T[K] {
  return ref.detached.includes(key) && key in ref.overrides ? (ref.overrides[key] as T[K]) : lib[key];
}

function firstSentences(text: string, n: number): string {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [];
  return sentences.slice(0, n).join('').trim();
}

function limit<T>(arr: T[], n: number): T[] {
  return n > 0 ? arr.slice(0, n) : arr;
}

/** Library items for a section, in resume order, with auto-included ones appended. */
export function sectionRefs<K extends LibraryKind>(section: ResumeSection, library: Library, kind: K): Array<{ ref: ItemRef; item: Library[K][number] }> {
  const items = library[kind] as Array<Library[K][number]>;
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Array<{ ref: ItemRef; item: Library[K][number] }> = [];
  const used = new Set<string>();
  for (const ref of section.refs) {
    const item = byId.get(ref.libId);
    if (!item || used.has(ref.libId)) continue;
    used.add(ref.libId);
    out.push({ ref, item });
  }
  if (section.autoInclude) {
    for (const item of items) if (!used.has(item.id)) out.push({ ref: { id: `auto-${item.id}`, libId: item.id, hidden: false, detached: [], overrides: {} }, item });
  }
  return out;
}

function base(id: string, libId: string | null): ResolvedItem {
  return { id, libId, title: '', subtitle: '', date: '', location: '', url: '', description: '', bullets: [], tags: [], start: '', end: '', current: false };
}

function resolveLibrarySection(section: ResumeSection, library: Library, fmt: ResumeStyle['dateFormat'], lang = 'en'): ResolvedItem[] {
  const info = sectionInfo(section.kind);
  const mb = section.maxBullets;
  switch (info.library) {
    case 'experience':
      return sectionRefs(section, library, 'experience')
        .filter((r) => !r.ref.hidden)
        .map(({ ref, item }) => {
          const e = item as LibExperience;
          const v = <K extends keyof LibExperience & string>(k: K) => refValue(ref, e, k);
          return {
            ...base(ref.id, e.id),
            title: v('role'),
            subtitle: v('company'),
            date: formatDateRange(v('start'), v('end'), v('current'), fmt, lang),
            location: v('location'),
            url: v('url'),
            description: v('description'),
            bullets: limit(v('achievements').filter((b) => b.trim()), mb),
            tags: v('technologies'),
            start: v('start'),
            end: v('end'),
            current: v('current'),
          };
        });
    case 'projects':
      return sectionRefs(section, library, 'projects')
        .filter((r) => !r.ref.hidden)
        .map(({ ref, item }) => {
          const p = item as LibProject;
          const v = <K extends keyof LibProject & string>(k: K) => refValue(ref, p, k);
          const summary = v('resumeSummary').trim() || firstSentences(v('description'), 2);
          const bullets = v('resumeBullets').filter((b) => b.trim());
          return {
            ...base(ref.id, p.id),
            title: v('title'),
            subtitle: v('role'),
            date: v('duration'),
            url: v('live') || v('github'),
            description: summary,
            bullets: limit(bullets.length ? bullets : v('features').filter((b) => b.trim()), mb || 4),
            tags: v('technologies'),
          };
        });
    case 'education':
      return sectionRefs(section, library, 'education')
        .filter((r) => !r.ref.hidden)
        .map(({ ref, item }) => {
          const e = item as LibEducation;
          const v = <K extends keyof LibEducation & string>(k: K) => refValue(ref, e, k);
          return {
            ...base(ref.id, e.id),
            title: [v('degree'), v('field')].filter((s) => s.trim()).join(', '),
            subtitle: v('institution'),
            date: formatDateRange(v('start'), v('end'), false, fmt, lang),
            location: v('location'),
            description: [v('grade'), v('description')].filter((s) => s.trim()).join(' · '),
            start: v('start'),
            end: v('end'),
          };
        });
    case 'certifications':
      return sectionRefs(section, library, 'certifications')
        .filter((r) => !r.ref.hidden)
        .map(({ ref, item }) => {
          const c = item as LibCertification;
          const v = <K extends keyof LibCertification & string>(k: K) => refValue(ref, c, k);
          return { ...base(ref.id, c.id), title: v('name'), subtitle: v('issuer'), date: formatDate(v('date'), fmt, lang), url: v('url'), description: v('credentialId') ? `${t(lang, 'credentialId')} ${v('credentialId')}` : '', start: v('date') };
        });
    case 'achievements':
      return sectionRefs(section, library, 'achievements')
        .filter((r) => !r.ref.hidden)
        .map(({ ref, item }) => {
          const a = item as LibAchievement;
          const v = <K extends keyof LibAchievement & string>(k: K) => refValue(ref, a, k);
          return { ...base(ref.id, a.id), title: v('title'), description: v('description'), date: formatDate(v('date'), fmt, lang), url: v('url'), start: v('date') };
        });
    default:
      return [];
  }
}

function resolveLocal(entries: LocalEntry[], fmt: ResumeStyle['dateFormat'], mb: number, lang = 'en'): ResolvedItem[] {
  return entries
    .filter((e) => !e.hidden)
    .map((e) => ({
      ...base(e.id, null),
      title: e.title,
      subtitle: e.subtitle,
      date: /^\d{4}-\d{1,2}$/.test(e.date.trim()) ? formatDate(e.date, fmt, lang) : e.date,
      location: e.location,
      url: e.url,
      description: e.description,
      bullets: limit(e.bullets.filter((b) => b.trim()), mb),
      start: e.date,
    }));
}

export function skillGroups(section: ResumeSection, library: Library, lang = 'en'): SkillGroup[] {
  const allowed = section.skillIds ? new Set(section.skillIds) : null;
  const hidden = new Set(section.refs.filter((r) => r.hidden).map((r) => r.libId));
  const skills = library.skills.filter((s) => s.name.trim() && (!allowed || allowed.has(s.id)) && !hidden.has(s.id));
  const groups = new Map<string, SkillGroup>();
  // "Other" only makes sense next to real categories.
  const anyCategory = skills.some((s) => s.category.trim());
  for (const s of skills) {
    const cat = s.category.trim() || (section.kind === 'technical-skills' && anyCategory ? t(lang, 'other') : '');
    const g = groups.get(cat) ?? { category: cat, names: [], levels: [] };
    g.names.push(s.name.trim());
    g.levels.push(s.level);
    groups.set(cat, g);
  }
  return [...groups.values()];
}

function contactOf(resume: ResumeDoc, profile: Profile): ContactItem[] {
  const out: ContactItem[] = [];
  const c = resume.contact;
  if (c.email && profile.email.trim()) out.push({ kind: 'email', label: profile.email.trim(), url: `mailto:${profile.email.trim()}` });
  if (c.phone && profile.phone?.trim()) out.push({ kind: 'phone', label: profile.phone.trim(), url: `tel:${profile.phone.replace(/[^\d+]/g, '')}` });
  if (c.location && profile.location?.trim()) out.push({ kind: 'location', label: profile.location.trim() });
  if (c.website && profile.website?.trim()) out.push({ kind: 'website', label: displayUrl(profile.website), url: profile.website.trim() });
  if (c.social)
    for (const s of profile.socialLinks) {
      if (!s.url.trim()) continue;
      out.push({ kind: 'social', label: s.label.trim() || displayUrl(s.url), url: s.url.trim(), platform: s.platform });
    }
  return out;
}

export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** The image key a resume should show, or null. Keys are resolved by the image service. */
export function resumePhotoKey(resume: ResumeDoc, profile: Profile): string | null {
  const img = profile.profileImage;
  if (!img || resume.style.photo === 'none' || resume.style.atsSafe) return null;
  const variant = img.variants.find((v) => v.id === (resume.photoVariant ?? img.usage.resume)) ?? img.variants[0];
  if (!variant) return null;
  return photoKey(variant.id, resume.style.photo);
}

export function photoKey(variantId: string, mode: string): string {
  return `profile:${variantId}:${mode}`;
}

export function resolveResume(resume: ResumeDoc, library: Library, profile: Profile): ResolvedResume {
  const fmt = resume.style.dateFormat;
  const lang = resume.style.language ?? 'en';
  const sections: ResolvedSection[] = [];
  let profileSectionId: string | null = null;
  for (const s of resume.sections) {
    if (s.kind === 'profile') {
      profileSectionId = s.id;
      continue;
    }
    if (s.hidden) continue;
    const info = sectionInfo(s.kind);
    const placement: 'main' | 'side' = s.placement === 'auto' ? (info.side ? 'side' : 'main') : s.placement;
    // Only default (English) headings are localised; headings the user typed are kept.
    const title = localizeHeading(s.title.trim() || info.title, lang);
    const common = { id: s.id, kind: s.kind, title, continued: t(lang, 'continued', { title }), display: s.display, placement, autoPlacement: s.placement === 'auto' };
    if (s.kind === 'summary') {
      const text = (s.text ?? profile.bio).trim();
      if (text) sections.push({ ...common, items: [], text, skills: [] });
      continue;
    }
    if (s.kind === 'skills' || s.kind === 'technical-skills') {
      const skills = skillGroups(s, library, lang);
      if (skills.length) sections.push({ ...common, items: [], text: '', skills });
      continue;
    }
    const items = info.library ? resolveLibrarySection(s, library, fmt, lang) : resolveLocal(s.entries, fmt, s.maxBullets, lang);
    const text = info.library ? '' : localizeDefault((s.text ?? '').trim(), 'availableOnRequest', lang);
    if (items.length || text) sections.push({ ...common, items, text, skills: [] });
  }
  const name = profile.name.trim() || 'Your Name';
  const headline = (resume.headline ?? profile.headline).trim();
  const skillsKw = library.skills.map((s) => s.name).filter(Boolean).slice(0, 20);
  return {
    id: resume.id,
    name,
    headline,
    contact: contactOf(resume, profile),
    photo: resumePhotoKey(resume, profile),
    profileSectionId,
    sections,
    style: resume.style,
    meta: {
      title: resume.meta.title.trim() || `${name} — ${resume.kind === 'cv' ? 'Curriculum Vitae' : 'Resume'}`,
      author: resume.meta.author.trim() || name,
      subject: resume.meta.subject.trim() || headline,
      keywords: resume.meta.keywords.length ? resume.meta.keywords : skillsKw,
      creator: resume.meta.creator.trim() || 'Portfolio OS Resume Studio',
    },
  };
}
