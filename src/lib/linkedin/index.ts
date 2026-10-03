/**
 * Deterministic LinkedIn copy from the shared profile + library (or a resolved resume).
 * Pure functions with no network access: the same data always yields the same text,
 * and every block respects LinkedIn's field limits.
 */
import type { Library, Profile } from '@/studio/model/types';
import { displayUrl, formatDateRange, type ResolvedResume } from '@/studio/model/resolve';

export const LINKEDIN_LIMITS = {
  headline: 220,
  about: 2600,
  experienceTitle: 100,
  experienceDescription: 2000,
  projectDescription: 2000,
  skills: 50,
  skillName: 80,
} as const;

/* ------------------------------ source ------------------------------ */

export interface LinkedInRole {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  dates: string;
  description: string;
  bullets: string[];
  tags: string[];
}

export interface LinkedInProject {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  url: string;
  tags: string[];
}

export interface LinkedInLink {
  id: string;
  title: string;
  description: string;
  url: string;
  kind: 'project' | 'certification' | 'achievement' | 'website';
}

export interface LinkedInSource {
  name: string;
  headline: string;
  summary: string;
  email: string;
  website: string;
  location: string;
  roles: LinkedInRole[];
  projects: LinkedInProject[];
  /** Skill names in priority order (may contain duplicates; generation dedupes). */
  skills: Array<{ name: string; level: number; category: string }>;
  /** Extra items worth featuring (certifications / achievements with links). */
  links: LinkedInLink[];
}

const clean = (s: string | undefined | null) => (s ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

export function sourceFromProfile(profile: Profile, library: Library): LinkedInSource {
  return {
    name: clean(profile.name),
    headline: clean(profile.headline),
    summary: (profile.bio ?? '').replace(/\*\*/g, '').trim(),
    email: clean(profile.email),
    website: clean(profile.website),
    location: clean(profile.location),
    roles: library.experience
      .filter((e) => clean(e.role) || clean(e.company))
      .map((e) => ({
        id: e.id,
        title: clean(e.role),
        company: clean(e.company),
        location: clean(e.location),
        start: e.start,
        end: e.end,
        current: e.current,
        dates: formatDateRange(e.start, e.end, e.current, 'short'),
        description: clean(e.description),
        bullets: e.achievements.map(clean).filter(Boolean),
        tags: e.technologies.map(clean).filter(Boolean),
      })),
    projects: library.projects
      .filter((p) => clean(p.title))
      .map((p) => ({
        id: p.id,
        title: clean(p.title),
        description: clean(p.resumeSummary) || clean(p.description),
        bullets: (p.resumeBullets.some((b) => b.trim()) ? p.resumeBullets : p.features).map(clean).filter(Boolean),
        url: clean(p.live) || clean(p.github),
        tags: p.technologies.map(clean).filter(Boolean),
      })),
    skills: library.skills.map((s) => ({ name: clean(s.name), level: s.level, category: clean(s.category) })).filter((s) => s.name),
    links: [
      ...library.certifications.filter((c) => clean(c.url)).map((c) => ({ id: c.id, title: clean(c.name), description: clean(c.issuer), url: clean(c.url), kind: 'certification' as const })),
      ...library.achievements.filter((a) => clean(a.url)).map((a) => ({ id: a.id, title: clean(a.title), description: clean(a.description), url: clean(a.url), kind: 'achievement' as const })),
    ],
  };
}

/** Uses what a specific resume prints (its headline, summary, chosen entries and detached copy). */
export function sourceFromResume(resolved: ResolvedResume, profile: Profile): LinkedInSource {
  const sections = resolved.sections;
  const of = (kind: string) => sections.filter((s) => s.kind === kind);
  const summary = of('summary')[0]?.text ?? profile.bio ?? '';
  return {
    name: clean(resolved.name),
    headline: clean(resolved.headline),
    summary: summary.replace(/\*\*/g, '').trim(),
    email: clean(profile.email),
    website: clean(profile.website),
    location: clean(profile.location),
    roles: of('experience')
      .flatMap((s) => s.items)
      .map((i) => ({
        id: i.libId ?? i.id,
        title: clean(i.title),
        company: clean(i.subtitle),
        location: clean(i.location),
        start: i.start,
        end: i.end,
        current: i.current,
        dates: i.date,
        description: clean(i.description),
        bullets: i.bullets.map(clean).filter(Boolean),
        tags: i.tags.map(clean).filter(Boolean),
      })),
    projects: of('projects')
      .flatMap((s) => s.items)
      .map((i) => ({ id: i.libId ?? i.id, title: clean(i.title), description: clean(i.description), bullets: i.bullets.map(clean).filter(Boolean), url: clean(i.url), tags: i.tags.map(clean).filter(Boolean) })),
    skills: sections
      .filter((s) => s.kind === 'skills' || s.kind === 'technical-skills')
      .flatMap((s) => s.skills.flatMap((g) => g.names.map((name, k) => ({ name: clean(name), level: g.levels[k] ?? 0, category: clean(g.category) })))),
    links: [...of('certifications'), ...of('achievements')].flatMap((s) =>
      s.items.filter((i) => clean(i.url)).map((i) => ({ id: i.id, title: clean(i.title), description: clean(i.subtitle || i.description), url: clean(i.url), kind: s.kind === 'certifications' ? ('certification' as const) : ('achievement' as const) })),
    ),
  };
}

/* ------------------------------ helpers ----------------------------- */

/** Cut to `max` characters at a word boundary, adding an ellipsis when anything was dropped. */
export function truncateAtWord(text: string, max: number, ellipsis = '…'): string {
  const t = text.trim();
  if (t.length <= max) return t;
  if (max <= ellipsis.length) return t.slice(0, max);
  const room = max - ellipsis.length;
  const slice = t.slice(0, room + 1);
  const cut = slice.search(/\s\S*$/);
  const head = (cut > 0 ? slice.slice(0, cut) : t.slice(0, room)).replace(/[\s,;:–—-]+$/, '');
  return head + ellipsis;
}

/** Joins as many whole parts as fit in `max` characters (never cuts a part mid-way). */
function joinFitting(parts: string[], sep: string, max: number): string {
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    const next = out ? out + sep + p : p;
    if (next.length > max) continue;
    out = next;
  }
  return out;
}

/** Whole lines that fit in `max`; if even the first does not fit, it is word-truncated. */
function fitBlocks(blocks: string[], sep: string, max: number): string {
  const kept: string[] = [];
  let len = 0;
  for (const b of blocks.filter(Boolean)) {
    const add = (kept.length ? sep.length : 0) + b.length;
    if (len + add <= max) {
      kept.push(b);
      len += add;
    } else if (!kept.length) {
      return truncateAtWord(b, max);
    } else break;
  }
  return kept.join(sep);
}

export function skillKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Deduped (case/space-insensitive), ordered skills, capped at LinkedIn's 50. */
export function linkedinSkills(src: LinkedInSource, max: number = LINKEDIN_LIMITS.skills): string[] {
  // Frequency across roles and projects nudges well-evidenced skills up.
  const evidence = new Map<string, number>();
  for (const t of [...src.roles.flatMap((r) => r.tags), ...src.projects.flatMap((p) => p.tags)]) evidence.set(skillKey(t), (evidence.get(skillKey(t)) ?? 0) + 1);
  const seen = new Map<string, { name: string; level: number; evidence: number; order: number }>();
  let order = 0;
  const add = (raw: string, level: number) => {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, LINKEDIN_LIMITS.skillName);
    const key = skillKey(name);
    if (!key) return;
    const prev = seen.get(key);
    if (prev) prev.level = Math.max(prev.level, level);
    else seen.set(key, { name, level, evidence: evidence.get(key) ?? 0, order: order++ });
  };
  for (const s of src.skills) add(s.name, s.level);
  const listed = order;
  for (const t of [...src.roles.flatMap((r) => r.tags), ...src.projects.flatMap((p) => p.tags)]) add(t, 0);
  return [...seen.values()]
    .sort((a, b) => {
      // Listed skills first, then technologies only seen in roles/projects.
      const la = a.order < listed ? 0 : 1;
      const lb = b.order < listed ? 0 : 1;
      return la - lb || b.level - a.level || b.evidence - a.evidence || a.order - b.order;
    })
    .slice(0, max)
    .map((s) => s.name);
}

const METRIC = /\d|%|\$|€|£|₹/;

/** Bullets that carry a number — the strongest proof points — in source order. */
export function highlights(src: LinkedInSource, max = 5): string[] {
  const all = [...src.roles.flatMap((r) => r.bullets), ...src.projects.flatMap((p) => p.bullets)];
  const metric = all.filter((b) => METRIC.test(b));
  const seen = new Set<string>();
  return [...metric, ...all.filter((b) => !METRIC.test(b))]
    .filter((b) => {
      const k = b.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

/** Whole years of experience across roles (overlaps merged), or 0 when unknown. */
export function yearsOfExperience(src: LinkedInSource, today = new Date()): number {
  const toMonth = (v: string) => {
    const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(v.trim());
    return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
  };
  const nowM = today.getFullYear() * 12 + today.getMonth();
  const spans = src.roles
    .map((r) => {
      const s = toMonth(r.start);
      const e = r.current ? nowM : (toMonth(r.end) ?? null);
      return s !== null && e !== null && e >= s ? [s, e] : null;
    })
    .filter((x): x is number[] => !!x)
    .sort((a, b) => a[0]! - b[0]!);
  let total = 0;
  let cur: number[] | null = null;
  for (const sp of spans) {
    if (cur && sp[0]! <= cur[1]!) cur[1] = Math.max(cur[1]!, sp[1]!);
    else {
      if (cur) total += cur[1]! - cur[0]!;
      cur = [...sp];
    }
  }
  if (cur) total += cur[1]! - cur[0]!;
  return Math.floor(total / 12);
}

function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const ensurePeriod = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

function role(src: LinkedInSource): string {
  return src.headline || src.roles[0]?.title || 'Professional';
}

function currentRole(src: LinkedInSource): LinkedInRole | undefined {
  return src.roles.find((r) => r.current) ?? src.roles[0];
}

/* ------------------------------ headline ---------------------------- */

export interface Variant {
  id: string;
  label: string;
  text: string;
}

export function headlineVariants(src: LinkedInSource, today = new Date()): Variant[] {
  const max = LINKEDIN_LIMITS.headline;
  const r = role(src);
  const skills = linkedinSkills(src, 6);
  const cur = currentRole(src);
  const years = yearsOfExperience(src, today);
  const value = sentences(src.summary)[0]?.replace(/[.!?]+$/, '') ?? '';
  const metric = highlights(src, 1).find((h) => METRIC.test(h))?.replace(/[.!?]+$/, '') ?? '';
  const fit = (parts: string[]) => joinFitting(parts, ' | ', max) || truncateAtWord(parts.filter(Boolean).join(' | '), max);

  const out: Variant[] = [
    { id: 'role-skills', label: 'Role | Skills', text: fit([r, skills.slice(0, 4).join(' · ')]) },
    { id: 'role-company', label: 'Role at company', text: fit([cur?.company && cur.title ? `${cur.title} at ${cur.company}` : r, skills.slice(0, 3).join(', '), years ? `${years}+ years experience` : '']) },
    { id: 'role-value', label: 'Role | Value', text: fit([r, value ? truncateAtWord(value, 120) : '', skills.slice(0, 3).join(' · ')]) },
  ];
  if (metric) out.push({ id: 'role-proof', label: 'Role | Proof', text: fit([r, truncateAtWord(metric, 140)]) });
  const seen = new Set<string>();
  return out.filter((v) => v.text && !seen.has(v.text) && seen.add(v.text));
}

/* ------------------------------- about ------------------------------ */

function cta(src: LinkedInSource): string {
  const ways = [src.email, src.website ? displayUrl(src.website) : ''].filter(Boolean);
  if (!ways.length) return 'Feel free to connect or send me a message.';
  return `Let's connect — reach me at ${ways.join(' or ')}.`;
}

function groupedSkills(src: LinkedInSource, max = 24): string[] {
  const top = new Set(linkedinSkills(src, max).map(skillKey));
  const groups = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const s of src.skills) {
    const k = skillKey(s.name);
    if (!top.has(k) || seen.has(k)) continue;
    seen.add(k);
    const cat = s.category || 'Core skills';
    groups.set(cat, [...(groups.get(cat) ?? []), s.name]);
  }
  const rest = linkedinSkills(src, max).filter((n) => !seen.has(skillKey(n)));
  if (rest.length) groups.set('Also', [...(groups.get('Also') ?? []), ...rest]);
  return [...groups].map(([cat, names]) => `${cat}: ${names.join(', ')}`);
}

export function aboutVariants(src: LinkedInSource, today = new Date()): Variant[] {
  const max = LINKEDIN_LIMITS.about;
  const summarySentences = sentences(src.summary);
  const paragraphs = src.summary
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hl = highlights(src, 5).map((h) => `• ${ensurePeriod(h)}`);
  const skills = linkedinSkills(src, 10);
  const years = yearsOfExperience(src, today);
  const companies = [...new Set(src.roles.map((r) => r.company).filter(Boolean))].slice(0, 4);
  const close = cta(src);

  const story: string[] = [];
  if (paragraphs.length) story.push(...paragraphs);
  else story.push(`I'm ${/^[aeiou]/i.test(role(src)) ? 'an' : 'a'} ${role(src)}${src.location ? ` based in ${src.location}` : ''}.`);
  if (companies.length) story.push(`${years ? `Over the past ${years}+ years` : 'Along the way'} I've worked with ${listJoin(companies)}.`);
  if (hl.length) story.push(['A few things I’m proud of:', ...hl].join('\n'));
  if (skills.length) story.push(`What I work with: ${skills.join(', ')}.`);
  story.push(close);

  const concise: string[] = [];
  concise.push(summarySentences.slice(0, 2).join(' ') || `${role(src)}${years ? ` with ${years}+ years of experience` : ''}.`);
  if (hl.length) concise.push(hl.slice(0, 3).join('\n'));
  concise.push(close);

  const focus: string[] = [];
  focus.push(`${role(src)}${years ? ` · ${years}+ years` : ''}${src.location ? ` · ${src.location}` : ''}`);
  if (summarySentences[0]) focus.push(summarySentences[0]);
  const groups = groupedSkills(src);
  if (groups.length) focus.push(['What I bring:', ...groups.map((g) => `• ${g}`)].join('\n'));
  if (hl.length) focus.push(['Results:', ...hl.slice(0, 4)].join('\n'));
  focus.push(close);

  // Keep the call to action: fit the body in what is left, then append it.
  const build = (blocks: string[]) => {
    const body = blocks.slice(0, -1);
    const end = blocks[blocks.length - 1]!;
    const room = max - end.length - 2;
    const fitted = fitBlocks(body, '\n\n', Math.max(0, room));
    return fitted ? `${fitted}\n\n${end}` : truncateAtWord(end, max);
  };

  return [
    { id: 'story', label: 'First-person story', text: build(story) },
    { id: 'concise', label: 'Concise', text: build(concise) },
    { id: 'skills', label: 'Skills-focused', text: build(focus) },
  ];
}

/* ----------------------------- experience --------------------------- */

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  dates: string;
  description: string;
}

/** Plain-text description: the role summary, then "• " bullets, cut at whole bullets to fit 2,000. */
export function experienceDescription(r: Pick<LinkedInRole, 'description' | 'bullets' | 'tags'>, max: number = LINKEDIN_LIMITS.experienceDescription): string {
  const blocks: string[] = [];
  if (r.description) blocks.push(r.description);
  const bullets = r.bullets.map((b) => `• ${ensurePeriod(b)}`);
  const skills = r.tags.length ? `Skills: ${r.tags.join(' · ')}` : '';
  // Bullets are separate lines; the summary and skills are separate paragraphs.
  const lines: string[] = [];
  let len = 0;
  const push = (s: string, sep: string) => {
    const add = (lines.length ? sep.length : 0) + s.length;
    if (len + add > max) return false;
    lines.push((lines.length ? sep : '') + s);
    len += add;
    return true;
  };
  if (blocks[0] && !push(blocks[0], '')) return truncateAtWord(blocks[0], max);
  for (let k = 0; k < bullets.length; k++) {
    if (!push(bullets[k]!, k === 0 && lines.length ? '\n\n' : '\n')) {
      if (!lines.length) return truncateAtWord(bullets[k]!, max);
      break;
    }
  }
  if (skills) push(skills, '\n\n');
  return lines.join('');
}

export function experienceEntries(src: LinkedInSource): ExperienceEntry[] {
  return src.roles.map((r) => ({
    id: r.id,
    title: truncateAtWord(r.title, LINKEDIN_LIMITS.experienceTitle),
    company: r.company,
    location: r.location,
    dates: r.dates,
    description: experienceDescription(r),
  }));
}

/* ------------------------------ projects ---------------------------- */

export interface ProjectEntry {
  id: string;
  title: string;
  url: string;
  description: string;
}

export function projectEntries(src: LinkedInSource): ProjectEntry[] {
  return src.projects.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    description: experienceDescription({ description: p.description, bullets: p.bullets, tags: p.tags }, LINKEDIN_LIMITS.projectDescription),
  }));
}

/** Links worth adding to LinkedIn's Featured section: live projects first, then credentials and the website. */
export function featuredSuggestions(src: LinkedInSource, max = 6): LinkedInLink[] {
  const out: LinkedInLink[] = [
    ...src.projects.filter((p) => p.url).map((p) => ({ id: p.id, title: p.title, description: truncateAtWord(p.description, 200), url: p.url, kind: 'project' as const })),
    ...src.links,
  ];
  if (src.website) out.push({ id: 'website', title: src.name ? `${src.name} — portfolio` : 'Portfolio website', description: 'Personal website and portfolio.', url: src.website, kind: 'website' });
  const seen = new Set<string>();
  return out
    .filter((l) => {
      const k = displayUrl(l.url).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

/* ------------------------------ bundle ------------------------------ */

export interface LinkedInBundle {
  headlines: Variant[];
  about: Variant[];
  experience: ExperienceEntry[];
  skills: string[];
  projects: ProjectEntry[];
  featured: LinkedInLink[];
}

export function generateLinkedIn(src: LinkedInSource, today = new Date()): LinkedInBundle {
  return {
    headlines: headlineVariants(src, today),
    about: aboutVariants(src, today),
    experience: experienceEntries(src),
    skills: linkedinSkills(src),
    projects: projectEntries(src),
    featured: featuredSuggestions(src),
  };
}

/** Full text of one experience entry, ready to paste. */
export function experienceText(e: ExperienceEntry): string {
  return [e.title, [e.company, e.location].filter(Boolean).join(' · '), e.dates, '', e.description].join('\n').trim();
}
