/**
 * Resume values from a .json file → shared Profile + Library + resume-only entries.
 *
 * Accepted shapes:
 *   - JSON Resume (https://jsonresume.org/schema): basics, work, education, skills, projects…
 *   - Portfolio OS resume export ({ format: 'portfolio-os-resume', profile, library, resume })
 *   - PDF Intelligence exports (structured or semantic JSON): resume fields are detected locally
 *
 * The file is treated purely as data: every value is coerced to a trimmed, length-capped
 * string, ids are always regenerated, and nothing is ever rendered as HTML.
 */
import {
  createEntry,
  createLibAchievement,
  createLibCertification,
  createLibEducation,
  createLibExperience,
  createLibProject,
  createLibSkill,
  emptyLibrary,
  emptyProfile,
  sectionInfo,
} from '@/studio/model/defaults';
import type { SamplePersona } from '@/studio/model/sample';
import type { Library, LibraryKind, LocalEntry, Profile, ResumeDoc, ResumeSectionKind, SocialLink } from '@/studio/model/types';
import { uid } from '@/utils/id';
import { isKnowledgeExport, resumeFromKnowledgeExport } from '@/knowledge/import/from-export';

export const MAX_JSON_BYTES = 2 * 1024 * 1024;

export type ImportEntries = Record<string, Array<Partial<LocalEntry>>>;

export interface ResumeJsonImport {
  source: 'json-resume' | 'portfolio-os';
  profile: Profile;
  library: Library;
  /** Resume-only entries keyed by section kind (languages, interests, volunteer…). */
  entries: ImportEntries;
  warnings: string[];
}

export class ResumeJsonError extends Error {}

/* ------------------------------ coercion ----------------------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => arr(v).filter(isObj);

function str(v: unknown, max = 2000): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return '';
  // Drop control characters except newlines and tabs.
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

function strs(v: unknown, max = 600, limit = 60): string[] {
  return arr(v)
    .map((x) => str(x, max))
    .filter(Boolean)
    .slice(0, limit);
}

/** JSON Resume ISO dates ("2021", "2021-03", "2021-03-14") → the library's "YYYY-MM". */
export function isoMonth(v: unknown): string {
  const s = str(v, 40);
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(s);
  if (!m) return s;
  return m[2] ? `${m[1]}-${m[2].padStart(2, '0')}` : m[1]!;
}

function safeUrl(v: unknown): string {
  const s = str(v, 500);
  if (!s) return '';
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return '';
}

function locationOf(v: unknown): string {
  if (typeof v === 'string') return str(v, 200);
  if (!isObj(v)) return '';
  return [str(v.address, 120), str(v.city, 80), str(v.region, 80), str(v.countryCode ?? v.country, 60)].filter(Boolean).join(', ');
}

function durationOf(start: unknown, end: unknown): string {
  const s = isoMonth(start);
  const e = isoMonth(end);
  const label = (x: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(x);
    return m ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : x;
  };
  if (s && e) return `${label(s)} – ${label(e)}`;
  if (s) return `${label(s)} – Present`;
  return label(e);
}

/* ---------------------------- JSON Resume ---------------------------- */

function fromJsonResume(data: Obj, warnings: string[]): ResumeJsonImport {
  const b = isObj(data.basics) ? data.basics : {};
  const profiles = objs(b.profiles);
  const socialLinks: SocialLink[] = profiles
    .map((p) => {
      const network = str(p.network, 40).toLowerCase();
      const url = safeUrl(p.url) || (network === 'github' && str(p.username) ? `https://github.com/${str(p.username, 80)}` : network === 'linkedin' && str(p.username) ? `https://linkedin.com/in/${str(p.username, 80)}` : '');
      return { id: uid('sl'), platform: network || 'website', label: str(p.username, 120) || url.replace(/^https?:\/\//, ''), url };
    })
    .filter((s) => s.url)
    .slice(0, 12);
  const profile: Profile = {
    ...emptyProfile(),
    name: str(b.name, 120),
    headline: str(b.label, 160),
    bio: str(b.summary, 4000),
    email: str(b.email, 200),
    phone: str(b.phone, 60),
    location: locationOf(b.location),
    website: safeUrl(b.url ?? b.website),
    socialLinks,
  };

  const lib = emptyLibrary();
  lib.experience = objs(data.work)
    .slice(0, 40)
    .map((w) =>
      createLibExperience({
        company: str(w.name ?? w.company, 160),
        role: str(w.position, 160),
        location: locationOf(w.location),
        start: isoMonth(w.startDate),
        end: isoMonth(w.endDate),
        current: !!str(w.startDate) && !str(w.endDate),
        url: safeUrl(w.url),
        description: str(w.summary ?? w.description, 3000),
        achievements: strs(w.highlights),
        technologies: strs(w.keywords, 60),
      }),
    )
    .filter((e) => e.company || e.role);
  lib.education = objs(data.education)
    .slice(0, 20)
    .map((e) =>
      createLibEducation({
        institution: str(e.institution, 200),
        degree: str(e.studyType, 160),
        field: str(e.area, 160),
        location: locationOf(e.location),
        start: isoMonth(e.startDate),
        end: isoMonth(e.endDate),
        grade: str(e.score ?? e.gpa, 60),
        description: strs(e.courses, 120).join(', '),
      }),
    )
    .filter((e) => e.institution || e.degree);
  const skills: Library['skills'] = [];
  for (const s of objs(data.skills).slice(0, 40)) {
    const name = str(s.name, 80);
    const keywords = strs(s.keywords, 80);
    const level = levelOf(s.level);
    if (keywords.length) for (const k of keywords) skills.push(createLibSkill({ name: k, category: name, level }));
    else if (name) skills.push(createLibSkill({ name, level }));
  }
  lib.skills = skills.slice(0, 200);
  lib.projects = objs(data.projects)
    .slice(0, 40)
    .map((p) =>
      createLibProject({
        title: str(p.name, 160),
        description: str(p.description, 3000),
        resumeSummary: str(p.description, 1200),
        resumeBullets: strs(p.highlights),
        technologies: strs(p.keywords, 60),
        role: strs(p.roles, 80).join(', '),
        duration: durationOf(p.startDate, p.endDate),
        live: safeUrl(p.url),
        github: /github\.com/i.test(str(p.url)) ? safeUrl(p.url) : '',
      }),
    )
    .filter((p) => p.title);
  lib.certifications = objs(data.certificates)
    .slice(0, 40)
    .map((c) => createLibCertification({ name: str(c.name, 200), issuer: str(c.issuer, 160), date: isoMonth(c.date), url: safeUrl(c.url) }))
    .filter((c) => c.name);
  lib.achievements = objs(data.awards)
    .slice(0, 40)
    .map((a) => createLibAchievement({ title: str(a.title, 200), description: [str(a.awarder, 160), str(a.summary, 600)].filter(Boolean).join(' — '), date: isoMonth(a.date) }))
    .filter((a) => a.title);

  const entries: ImportEntries = {};
  const put = (kind: ResumeSectionKind, list: Array<Partial<LocalEntry>>) => {
    const clean = list.filter((e) => e.title);
    if (clean.length) entries[kind] = clean.slice(0, 40);
  };
  put('languages', objs(data.languages).map((l) => ({ title: str(l.language ?? l.name, 80), subtitle: str(l.fluency, 80) })));
  put('interests', objs(data.interests).map((i) => ({ title: str(i.name, 80), description: strs(i.keywords, 60).join(', ') })));
  put(
    'volunteer',
    objs(data.volunteer).map((v) => ({ title: str(v.position, 160), subtitle: str(v.organization, 160), date: durationOf(v.startDate, v.endDate), url: safeUrl(v.url), description: str(v.summary, 2000), bullets: strs(v.highlights) })),
  );
  put('publications', objs(data.publications).map((p) => ({ title: str(p.name, 240), subtitle: str(p.publisher, 160), date: isoMonth(p.releaseDate), url: safeUrl(p.url), description: str(p.summary, 1200) })));
  put('references', objs(data.references).map((r) => ({ title: str(r.name, 120), description: str(r.reference, 1200) })));

  return { source: 'json-resume', profile, library: lib, entries, warnings };
}

function levelOf(v: unknown): number {
  const s = str(v, 40).toLowerCase();
  if (!s) return 0;
  const n = Number(s);
  if (Number.isFinite(n)) return Math.max(0, Math.min(5, Math.round(n)));
  return s.includes('master') || s.includes('expert') ? 5 : s.includes('advanced') ? 4 : s.includes('intermediate') ? 3 : s.includes('beginner') || s.includes('basic') ? 1 : 0;
}

/* --------------------------- Portfolio OS ---------------------------- */

function fromPortfolioOs(data: Obj, warnings: string[]): ResumeJsonImport {
  const p = isObj(data.profile) ? data.profile : {};
  const profile: Profile = {
    ...emptyProfile(),
    name: str(p.name, 120),
    headline: str(p.headline, 160),
    bio: str(p.bio, 4000),
    email: str(p.email, 200),
    phone: str(p.phone, 60),
    location: str(p.location, 200),
    website: safeUrl(p.website),
    socialLinks: objs(p.socialLinks)
      .map((s) => ({ id: uid('sl'), platform: str(s.platform, 40) || 'website', label: str(s.label, 120), url: safeUrl(s.url) }))
      .filter((s) => s.url)
      .slice(0, 12),
  };
  const l = isObj(data.library) ? data.library : {};
  const lib = emptyLibrary();
  lib.experience = objs(l.experience).slice(0, 40).map((e) => createLibExperience({ company: str(e.company, 160), role: str(e.role, 160), location: str(e.location, 160), start: isoMonth(e.start), end: isoMonth(e.end), current: e.current === true, url: safeUrl(e.url), description: str(e.description, 3000), achievements: strs(e.achievements), technologies: strs(e.technologies, 60) }));
  lib.projects = objs(l.projects).slice(0, 40).map((e) => createLibProject({ title: str(e.title, 160), description: str(e.description, 3000), technologies: strs(e.technologies, 60), role: str(e.role, 120), duration: str(e.duration, 80), github: safeUrl(e.github), live: safeUrl(e.live), features: strs(e.features), resumeSummary: str(e.resumeSummary, 1200), resumeBullets: strs(e.resumeBullets) }));
  lib.education = objs(l.education).slice(0, 20).map((e) => createLibEducation({ institution: str(e.institution, 200), degree: str(e.degree, 160), field: str(e.field, 160), location: str(e.location, 160), start: isoMonth(e.start), end: isoMonth(e.end), grade: str(e.grade, 60), description: str(e.description, 1200) }));
  lib.skills = objs(l.skills).slice(0, 200).map((e) => createLibSkill({ name: str(e.name, 80), category: str(e.category, 80), level: levelOf(e.level) })).filter((s) => s.name);
  lib.certifications = objs(l.certifications).slice(0, 40).map((e) => createLibCertification({ name: str(e.name, 200), issuer: str(e.issuer, 160), date: isoMonth(e.date), credentialId: str(e.credentialId, 120), url: safeUrl(e.url) }));
  lib.achievements = objs(l.achievements).slice(0, 40).map((e) => createLibAchievement({ title: str(e.title, 200), description: str(e.description, 1200), date: isoMonth(e.date), url: safeUrl(e.url) }));

  const entries: ImportEntries = {};
  const resume = isObj(data.resume) ? data.resume : {};
  for (const s of objs(resume.sections)) {
    const kind = str(s.kind, 40) as ResumeSectionKind;
    const list = objs(s.entries)
      .map((e) => ({ title: str(e.title, 240), subtitle: str(e.subtitle, 240), date: str(e.date, 60), location: str(e.location, 160), url: safeUrl(e.url), description: str(e.description, 2000), bullets: strs(e.bullets) }))
      .filter((e) => e.title);
    if (!list.length) continue;
    const key = kind === 'custom' ? str(s.title, 80) || 'Custom Section' : kind;
    entries[key] = list.slice(0, 40);
  }
  return { source: 'portfolio-os', profile, library: lib, entries, warnings };
}

/* ------------------------------ entry ------------------------------- */

export function parseResumeJson(text: string): ResumeJsonImport {
  if (text.length > MAX_JSON_BYTES) throw new ResumeJsonError('This file is larger than 2 MB. Resume JSON files are usually a few kilobytes.');
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    throw new ResumeJsonError(`This is not valid JSON${err instanceof Error ? ` (${err.message.replace(/^JSON\.parse: /, '')})` : ''}.`);
  }
  if (!isObj(data)) throw new ResumeJsonError('Expected a JSON object with resume fields, such as "basics" and "work".');
  const warnings: string[] = [];
  let out: ResumeJsonImport;
  if (isKnowledgeExport(data)) {
    let found: ReturnType<typeof resumeFromKnowledgeExport> = null;
    try {
      found = resumeFromKnowledgeExport(data);
    } catch {
      found = null;
    }
    if (!found) throw new ResumeJsonError('This Extract Your Data export has no resume content. Export it from a resume or CV, or set the document type to Resume and extract again.');
    // Same coercion as a Portfolio OS export: the file is data, never trusted.
    out = fromPortfolioOs({ profile: found.profile, library: found.library, resume: { sections: Object.entries(found.entries).map(([kind, entries]) => ({ kind, entries })) } }, warnings);
    warnings.push('Fields were detected from a PDF export by local rules. Check them before use.');
  } else if (data.format === 'portfolio-os-resume' || (isObj(data.profile) && isObj(data.library))) out = fromPortfolioOs(data, warnings);
  else if (isObj(data.basics) || Array.isArray(data.work) || Array.isArray(data.education) || Array.isArray(data.skills)) out = fromJsonResume(data, warnings);
  else throw new ResumeJsonError('No resume fields found. Use the JSON Resume format ("basics", "work", "education", "skills"…), a Portfolio OS resume export, or an Extract Your Data JSON export.');
  const c = importCounts(out);
  if (!out.profile.name) warnings.push('No name found. The resume will show "Your Name" until you add one.');
  if (!c.experience && !c.education && !c.projects) warnings.push('No work, education or projects found.');
  return out;
}

export function importCounts(i: Pick<ResumeJsonImport, 'library' | 'entries'>): Record<LibraryKind | 'languages' | 'other', number> {
  const { languages = [], ...rest } = i.entries;
  return {
    experience: i.library.experience.length,
    education: i.library.education.length,
    projects: i.library.projects.length,
    skills: i.library.skills.length,
    certifications: i.library.certifications.length,
    achievements: i.library.achievements.length,
    languages: languages.length,
    other: Object.values(rest).reduce((n, l) => n + l.length, 0),
  };
}

/* ------------------------------- merge ------------------------------ */

const keyOf: { [K in LibraryKind]: (x: Library[K][number]) => string } = {
  experience: (x) => `${x.company}|${x.role}|${x.start}`,
  projects: (x) => x.title,
  education: (x) => `${x.institution}|${x.degree}|${x.field}`,
  skills: (x) => x.name,
  certifications: (x) => x.name,
  achievements: (x) => x.title,
};

/** Add imported items to an existing library, skipping ones that are already there. */
export function mergeLibrary(base: Library, add: Library): Library {
  const out: Library = { ...base };
  for (const kind of Object.keys(keyOf) as LibraryKind[]) {
    const key = keyOf[kind] as (x: unknown) => string;
    const seen = new Set((base[kind] as unknown[]).map((x) => key(x).toLowerCase()));
    const extra = (add[kind] as unknown[]).filter((x) => !seen.has(key(x).toLowerCase()));
    (out as unknown as Record<LibraryKind, unknown[]>)[kind] = [...(base[kind] as unknown[]), ...extra];
  }
  return out;
}

/** Fill only the profile fields that are empty, and add social links that are new. */
export function mergeProfile(base: Profile, add: Profile): Profile {
  const pick = (a: string | undefined, b: string | undefined) => (a?.trim() ? a : b ?? '');
  const urls = new Set(base.socialLinks.map((s) => s.url.toLowerCase()));
  return {
    ...base,
    name: pick(base.name, add.name),
    headline: pick(base.headline, add.headline),
    bio: pick(base.bio, add.bio),
    email: pick(base.email, add.email),
    phone: pick(base.phone, add.phone),
    location: pick(base.location, add.location),
    website: pick(base.website, add.website),
    socialLinks: [...base.socialLinks, ...add.socialLinks.filter((s) => !urls.has(s.url.toLowerCase()))],
  };
}

/**
 * Make sure a new resume shows everything that was imported: library kinds and
 * resume-only entries the template's starter left out get their own section.
 */
export function ensureSectionsFor(resume: ResumeDoc, library: Library, entries: ImportEntries, make: (kind: ResumeSectionKind, title?: string) => ResumeDoc['sections'][number]): ResumeDoc {
  const sections = [...resume.sections];
  const has = (kind: ResumeSectionKind) => sections.some((s) => s.kind === kind || (kind === 'skills' && s.kind === 'technical-skills') || (kind === 'technical-skills' && s.kind === 'skills'));
  const libKind: Array<[LibraryKind, ResumeSectionKind]> = [
    ['experience', 'experience'],
    ['projects', 'projects'],
    ['education', 'education'],
    ['skills', 'technical-skills'],
    ['certifications', 'certifications'],
    ['achievements', 'achievements'],
  ];
  for (const [lk, kind] of libKind) if (library[lk].length && !has(kind)) sections.push(make(kind));
  for (const [key, list] of Object.entries(entries)) {
    if (!list.length) continue;
    const known = sectionInfo(key as ResumeSectionKind).kind === key;
    const kind = (known ? key : 'custom') as ResumeSectionKind;
    const exists = known ? sections.some((s) => s.kind === kind) : sections.some((s) => s.kind === 'custom' && s.title === key);
    if (exists) continue;
    const sec = make(kind, known ? undefined : key);
    sec.entries = list.map((e) => createEntry(e));
    sections.push(sec);
  }
  return { ...resume, sections };
}

/* ------------------------------ sample ------------------------------ */

/** A persona as a JSON Resume document: the downloadable reference file. */
export function personaToJsonResume(persona: SamplePersona): Obj {
  const p = persona.profile();
  const l = persona.library();
  const day = (m: string) => (m ? (/^\d{4}-\d{2}$/.test(m) ? `${m}-01` : m) : undefined);
  const [city, region, country] = (p.location ?? '').split(',').map((s) => s.trim());
  const grouped = new Map<string, string[]>();
  for (const s of l.skills) grouped.set(s.category || 'Skills', [...(grouped.get(s.category || 'Skills') ?? []), s.name]);
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: p.name,
      label: p.headline,
      email: p.email,
      phone: p.phone,
      url: p.website,
      summary: p.bio,
      location: { city, region, countryCode: country },
      profiles: p.socialLinks.map((s) => ({ network: s.platform, username: s.label, url: s.url })),
    },
    work: l.experience.map((e) => ({ name: e.company, position: e.role, location: e.location, startDate: day(e.start), endDate: e.current ? undefined : day(e.end), summary: e.description || undefined, highlights: e.achievements, keywords: e.technologies })),
    education: l.education.map((e) => ({ institution: e.institution, studyType: e.degree, area: e.field || undefined, startDate: day(e.start), endDate: day(e.end), score: e.grade || undefined })),
    skills: [...grouped].map(([name, keywords]) => ({ name, keywords })),
    projects: l.projects.map((x) => ({ name: x.title, description: x.resumeSummary || x.description, highlights: x.resumeBullets, keywords: x.technologies, url: x.live || x.github || undefined })),
    certificates: l.certifications.map((c) => ({ name: c.name, issuer: c.issuer, date: day(c.date) })),
    awards: l.achievements.map((a) => ({ title: a.title, summary: a.description, date: day(a.date) })),
    languages: (persona.entries.languages ?? []).map((e) => ({ language: e.title, fluency: e.subtitle })),
    interests: Object.entries(persona.entries)
      .filter(([k]) => k !== 'languages')
      .flatMap(([, list]) => list.map((e) => ({ name: e.title }))),
  };
}
