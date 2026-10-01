import type { CertificationItem, EducationItem, ExperienceItem, Portfolio, PortfolioSection, ProjectItem, SkillItem, AchievementItem, SocialItem } from '@/types/portfolio';
import { createPortfolio } from '@/lib/portfolio-factory';
import { addSection, clip, EMAIL_RE, findDateRange, heroCtas, looksLikeRole, newItem, normalizeWebUrl, socialItem, socialPlatformOf, splitRoleCompany, stripDates } from './common';

export type ResumeSectionKind = 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'achievements' | 'contact' | 'other';

const HEADINGS: Array<[ResumeSectionKind, RegExp]> = [
  ['summary', /^(professional\s+)?(summary|profile|about(\s+me)?|objective|career\s+objective|overview|introduction)$/i],
  ['experience', /^((work|professional|relevant|employment)\s+)?(experience|history)$|^employment(\s+history)?$|^work$|^career(\s+history)?$|^positions?\s+held$/i],
  ['education', /^(education|academic\s+background|academics|qualifications|education\s*(&|and)\s*training)$/i],
  ['skills', /^((technical|core|key|professional)\s+)?(skills|competencies|expertise|technologies|tech\s+stack|tools(\s*(&|and)\s*technologies)?)$|^skills\s*(&|and)\s*\w+$/i],
  ['projects', /^((selected|personal|key|side|notable)\s+)?projects$|^portfolio$/i],
  ['certifications', /^(certifications?|licen[cs]es(\s*(&|and)\s*certifications)?|certifications?\s*(&|and)\s*licen[cs]es|courses)$/i],
  ['achievements', /^(awards?|achievements?|honou?rs(\s*(&|and)\s*awards)?|awards?\s*(&|and)\s*(honou?rs|achievements)|accomplishments|recognition)$/i],
  ['contact', /^(contact(\s+(information|details))?|personal\s+details)$/i],
];

// "+", "»" and "›" are how OCR often reads bullet glyphs.
const BULLET_RE = /^\s*(?:[•●▪◦·*–—+»›-]|•|\d+[.)])\s+/;
const PHONE_RE = /\+?\(?\d[\d\s().-]{7,}\d/;
// Any explicit http(s) URL, or a bare domain with a common TLD.
const URL_RE = /\bhttps?:\/\/[^\s,|;)<>"]+|\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|me|co|ai|xyz|design|tech|site|page|info|online|store|studio|cloud|live|link|work|codes|blog|art|us|uk|de|in|ca|eu|au|fr|nl|es|it)(?:\/[^\s,|;)]*)?/gi;
export const DEGREE_RE = /\b(B\.?\s?Sc|M\.?\s?Sc|B\.?\s?A\b|M\.?\s?A\b|B\.?\s?S\b|M\.?\s?S\b|B\.?\s?Tech|M\.?\s?Tech|B\.?\s?E\b|M\.?\s?E\b|B\.?\s?Eng|M\.?\s?Eng|B\.?\s?Com|M\.?\s?Com|BBA|MBA|MCA|BCA|Ph\.?\s?D|Doctor(ate)?|Bachelor'?s?|Master'?s?|Associate'?s?|Diploma|High School|A-Levels?|GCSE|Certificate)\b/i;
export const INSTITUTION_RE = /\b(universit\w*|universidad|college|institute|instituto|institut|school|academy|polytechnic|politecnico|polytechnique|hochschule|conservatory|iit|mit)\b/i;
const LOCATION_RE = /^[A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+){1,2}$/;

export interface ParsedResume {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: Array<{ platform: string; url: string }>;
  website: string;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  achievements: AchievementItem[];
  other: Array<{ heading: string; content: string }>;
}

function headingKind(line: string): { kind: ResumeSectionKind; heading: string } | null {
  const raw = line.trim();
  if (!raw || raw.length > 48 || BULLET_RE.test(raw)) return null;
  const text = raw.replace(/:$/, '').replace(/\s+/g, ' ').trim();
  for (const [kind, re] of HEADINGS) if (re.test(text)) return { kind, heading: titleCase(text) };
  const letters = text.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length >= 3 && letters === letters.toUpperCase() && !/[,@|]/.test(text) && text.split(' ').length <= 5;
  const colonHeading = /:$/.test(raw) && text.split(' ').length <= 4 && /^[A-Za-z &/]+$/.test(text);
  if (allCaps || colonHeading) return { kind: 'other', heading: titleCase(text) };
  return null;
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(And|Of|In|&)\b/g, (w) => w.toLowerCase());
}

const unbullet = (l: string) => l.replace(BULLET_RE, '').trim();
const isBullet = (l: string) => BULLET_RE.test(l);

function isContactLine(line: string): boolean {
  if (EMAIL_RE.test(line)) return true;
  if (phoneIn(line)) return true;
  return new RegExp(URL_RE.source, 'i').test(line);
}

function phoneIn(text: string): string {
  const m = PHONE_RE.exec(text);
  if (!m) return '';
  const digits = m[0].replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return '';
  if (findDateRange(m[0])?.match.replace(/\D/g, '') === digits) return '';
  return m[0].trim();
}

function extractLinks(text: string): string[] {
  const out: string[] = [];
  const withoutEmails = text.replace(new RegExp(EMAIL_RE.source, 'gi'), ' ');
  for (const m of withoutEmails.matchAll(URL_RE)) {
    const u = normalizeWebUrl(m[0]);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

/* ----------------------------- Section parsers ---------------------------- */

function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let cur: ExperienceItem | null = null;
  let headerLines = 0;
  let lastWasBullet = false;
  const start = (): ExperienceItem => {
    const it = newItem('experience', { company: '', role: '' });
    items.push(it);
    headerLines = 0;
    return it;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isBullet(line)) {
      if (!cur) cur = start();
      cur.achievements.push(unbullet(line));
      lastWasBullet = true;
      continue;
    }
    if (lastWasBullet && cur && /^[a-z(]/.test(line)) {
      const a = cur.achievements;
      a[a.length - 1] = `${a[a.length - 1]} ${line}`;
      continue;
    }
    lastWasBullet = false;
    const range = findDateRange(line);
    const rest = stripDates(line, range);
    const c: ExperienceItem | null = cur;
    const startsNew =
      !c ||
      c.achievements.length > 0 ||
      Boolean(c.description) ||
      (range && (c.start || c.end || c.current)) ||
      (headerLines >= 1 && Boolean(c.role) && Boolean(c.company) && looksLikeRole(rest) && !range);
    if (startsNew || !cur) cur = start();
    const e: ExperienceItem = cur;
    headerLines++;
    if (range) {
      e.start = range.start;
      e.end = range.end;
      e.current = range.current;
    }
    if (!rest) continue;
    if (LOCATION_RE.test(rest) && e.role && e.company && !e.location) {
      e.location = rest;
      continue;
    }
    if (!e.role && !e.company) {
      const parts = rest.split(/\s+(?:\||·)\s+/);
      // "Company | City, Region" — the role follows on the next line.
      if (parts.length === 2 && LOCATION_RE.test(parts[1]!.trim()) && !looksLikeRole(parts[1]!) && !looksLikeRole(parts[0]!)) {
        e.company = parts[0]!.trim();
        e.location = parts[1]!.trim();
        continue;
      }
      const head = parts.length > 2 ? `${parts[0]} | ${parts[1]}` : rest;
      const { role, company } = splitRoleCompany(head);
      e.role = role;
      e.company = company;
      if (parts.length > 2 && LOCATION_RE.test(parts[2]!.trim())) e.location = parts[2]!.trim();
      continue;
    }
    if (!e.company) {
      const [company, location] = rest.split(/\s+(?:\||·|—|–)\s+|,\s+(?=[A-Z][a-z]+,?\s)/);
      e.company = company!.trim();
      if (location && !e.location) e.location = location.trim();
      continue;
    }
    if (!e.role && looksLikeRole(rest)) {
      e.role = rest;
      continue;
    }
    if (headerLines <= 3 && LOCATION_RE.test(rest) && !e.location) {
      e.location = rest;
      continue;
    }
    const techs = /^(tech(nologies)?|stack|tools)\s*:\s*(.+)$/i.exec(rest);
    if (techs) {
      e.technologies.push(...splitList(techs[3]!));
      continue;
    }
    e.description = e.description ? `${e.description} ${rest}` : rest;
  }
  return items
    .filter((i) => i.role || i.company)
    .map((i) => ({ ...i, role: i.role || 'Role', company: i.company || '' }));
}

function splitList(text: string): string[] {
  return text
    .split(/\s*(?:,|\||•|·|;|•|\/(?=\s))\s*/)
    .map((s) => s.replace(/^and\s+/i, '').replace(/[.]$/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 40);
}

function parseSkills(lines: string[]): SkillItem[] {
  const out: SkillItem[] = [];
  const seen = new Set<string>();
  let category = 'General';
  for (const raw of lines) {
    const line = unbullet(raw.trim());
    if (!line) continue;
    const cat = /^([A-Za-z][A-Za-z &/+#.-]{1,40}):\s*(.*)$/.exec(line);
    let body = line;
    if (cat) {
      category = cat[1]!.trim();
      body = cat[2] ?? '';
      if (!body.trim()) continue;
    }
    for (const name of splitList(body)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(newItem('skills', { name, category }));
    }
  }
  return out;
}

function parseEducation(lines: string[]): EducationItem[] {
  const out: EducationItem[] = [];
  let cur: EducationItem | null = null;
  const start = (): EducationItem => {
    const it = newItem('education', { institution: '', degree: '' });
    out.push(it);
    return it;
  };
  for (const raw of lines) {
    const line = unbullet(raw.trim());
    if (!line) continue;
    const range = findDateRange(line);
    const rest = stripDates(line, range);
    const hasDegree = DEGREE_RE.test(rest);
    const hasInstitution = INSTITUTION_RE.test(rest);
    const c: EducationItem | null = cur;
    if (!c || !cur || (hasDegree && c.degree) || (hasInstitution && c.institution && !hasDegree)) cur = start();
    const e: EducationItem = cur;
    if (range) {
      if (range.end || range.current) {
        e.start = range.start;
        e.end = range.end;
      } else {
        e.start = '';
        e.end = range.start;
      }
    }
    if (!rest) continue;
    const gpa = /\b(gpa|cgpa|grade|honou?rs|distinction|cum laude|first class)\b/i.test(rest) && !hasDegree && !hasInstitution;
    if (gpa) {
      e.grade = rest;
      continue;
    }
    if (hasDegree && hasInstitution) {
      const parts = rest.split(/\s*(?:,|—|–|\||\bat\b| - )\s*/);
      const degreeParts = parts.filter((p) => DEGREE_RE.test(p) || / in /i.test(p));
      const inst = parts.find((p) => INSTITUTION_RE.test(p) && !DEGREE_RE.test(p));
      assignDegree(e, degreeParts.join(', ') || parts[0] || rest);
      e.institution = inst?.trim() ?? '';
      continue;
    }
    if (hasDegree && !e.degree) {
      assignDegree(e, rest);
      continue;
    }
    if (!e.institution) {
      const [inst, loc] = rest.split(/\s+(?:\||·|—|–)\s+/);
      e.institution = inst!.trim();
      if (loc) e.location = loc.trim();
      continue;
    }
    if (!e.degree) {
      assignDegree(e, rest);
      continue;
    }
    e.description = e.description ? `${e.description} ${rest}` : rest;
  }
  return out.filter((e) => e.degree || e.institution).map((e) => ({ ...e, degree: e.degree || 'Degree', institution: e.institution || '' }));
}

function assignDegree(e: EducationItem, text: string): void {
  const m = /^(.+?)\s+in\s+(.+)$/i.exec(text.trim());
  if (m) {
    e.degree = m[1]!.trim().replace(/,$/, '');
    e.field = m[2]!.trim();
  } else {
    const comma = /^(.+?),\s*(.+)$/.exec(text.trim());
    if (comma && DEGREE_RE.test(comma[1]!) && !DEGREE_RE.test(comma[2]!)) {
      e.degree = comma[1]!.trim();
      e.field = comma[2]!.trim();
    } else e.degree = text.trim();
  }
}

function parseProjects(lines: string[]): ProjectItem[] {
  const out: ProjectItem[] = [];
  let cur: ProjectItem | null = null;
  const start = (title: string): ProjectItem => {
    const it = newItem('projects', { title, description: '' });
    out.push(it);
    return it;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const links = extractLinks(line);
    const applyLinks = (p: ProjectItem) => {
      for (const u of links) {
        if (/github\.com|gitlab\.com|bitbucket\.org/i.test(u)) p.github = p.github || u;
        else p.live = p.live || u;
      }
    };
    if (isBullet(line)) {
      if (!cur) cur = start('Project');
      const text = unbullet(line);
      const techs = /^(tech(nologies)?|stack|built with|tools)\s*:\s*(.+)$/i.exec(text);
      if (techs) cur.technologies.push(...splitList(techs[3]!));
      else cur.features.push(text);
      applyLinks(cur);
      continue;
    }
    const techs = /^(tech(nologies)?|stack|built with|tools)\s*:\s*(.+)$/i.exec(line);
    if (techs && cur) {
      cur.technologies.push(...splitList(techs[3]!));
      continue;
    }
    const range = findDateRange(line);
    let text = stripDates(line, range);
    for (const m of line.matchAll(URL_RE)) text = text.replace(m[0], '').trim();
    text = text.replace(/[\s|–—-]+$/, '').trim();
    // A line that is only a link (and/or dates) belongs to the current project.
    if (!text && cur) {
      applyLinks(cur);
      if (range && !cur.duration) cur.duration = range.match.trim();
      continue;
    }
    const c: ProjectItem | null = cur;
    const newHeader = !c || c.features.length > 0 || (Boolean(c.description) && text.length < 70 && !/[.!?]$/.test(text));
    if (newHeader) {
      const m = /^(.+?)\s+(?:—|–|-|\||:)\s+(.+)$/.exec(text);
      let fresh: ProjectItem;
      if (m && m[1]!.length <= 60) {
        fresh = start(m[1]!.trim());
        const tail = m[2]!.trim();
        if (/,/.test(tail) && tail.split(',').every((t) => t.trim().split(' ').length <= 3)) fresh.technologies.push(...splitList(tail));
        else fresh.description = tail;
      } else fresh = start(text || 'Project');
      if (range) fresh.duration = range.match.trim();
      applyLinks(fresh);
      cur = fresh;
      continue;
    }
    if (!cur) continue;
    const p: ProjectItem = cur;
    applyLinks(p);
    if (text) p.description = p.description ? `${p.description} ${text}` : text;
  }
  return out;
}

function parseCertifications(lines: string[]): CertificationItem[] {
  const out: CertificationItem[] = [];
  for (const raw of lines) {
    const line = unbullet(raw.trim());
    if (!line) continue;
    const range = findDateRange(line);
    const links = extractLinks(line);
    let text = stripDates(line, range);
    for (const u of links) text = text.replace(u.replace(/^https?:\/\//, ''), '').replace(u, '');
    const parts = text.split(/\s*(?:—|–|\||,|\s-\s)\s*/).filter(Boolean);
    const [name = text, issuer = ''] = parts;
    const idMatch = /(?:credential|id|license)\s*(?:id)?\s*[:#]\s*([\w-]+)/i.exec(line);
    out.push(newItem('certifications', { name: name.replace(/\(\s*\)$/, '').trim(), issuer: issuer.replace(/^by\s+/i, '').trim(), date: range?.end || range?.start || '', url: links[0] ?? '', credentialId: idMatch?.[1] ?? '' }));
  }
  return out;
}

function parseAchievements(lines: string[]): AchievementItem[] {
  const out: AchievementItem[] = [];
  for (const raw of lines) {
    const line = unbullet(raw.trim());
    if (!line) continue;
    if (!isBullet(raw) && out.length && /^[a-z]/.test(line)) {
      const last = out[out.length - 1]!;
      last.description = last.description ? `${last.description} ${line}` : line;
      continue;
    }
    const range = findDateRange(line);
    const text = stripDates(line, range);
    const m = /^(.+?)\s+(?:—|–|:|\s-\s)\s+(.+)$/.exec(text);
    out.push(newItem('achievements', { title: (m ? m[1]! : text).trim(), description: m ? m[2]!.trim() : '', date: range?.end || range?.start || '', url: extractLinks(line)[0] ?? '' }));
  }
  return out;
}

/* --------------------------------- Parser --------------------------------- */

export function parseResumeStructure(text: string): ParsedResume {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n').map((l) => l.replace(/\s+$/, ''));
  const blocks: Array<{ kind: ResumeSectionKind; heading: string; lines: string[] }> = [];
  const header: string[] = [];
  let current: { kind: ResumeSectionKind; heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const h = line.trim() ? headingKind(line) : null;
    // The first line is always the name, even when it is written in capitals; a capitalised
    // line right under it that is not a known section ("CONTENT & SEO SPECIALIST") is the headline.
    const headlineSlot = !current && header.length === 1 && h?.kind === 'other';
    if (h && (header.length > 0 || current) && !headlineSlot) {
      current = { ...h, lines: [] };
      blocks.push(current);
      continue;
    }
    // "Skills: React, Node" on one line → a skills block with content.
    const inline = /^([A-Za-z ]{3,30}):\s+(.+)$/.exec(line.trim());
    if (inline && !current) {
      const k = headingKind(`${inline[1]}`);
      if (k && k.kind !== 'other' && k.kind !== 'contact') {
        blocks.push({ ...k, lines: [inline[2]!] });
        continue;
      }
    }
    if (current) current.lines.push(line);
    else if (line.trim()) header.push(line.trim());
  }

  const r: ParsedResume = {
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    website: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    achievements: [],
    other: [],
  };

  // Header: name, headline, contact details.
  const nameLine = header[0] ?? '';
  if (nameLine && !isContactLine(nameLine)) r.name = titleCaseName(nameLine.split(/\s+[|·•]\s+/)[0]!.trim());
  const contactText: string[] = [];
  const headerRest = header.slice(r.name ? 1 : 0);
  headerRest.forEach((line, i) => {
    if (i === 0 && !isContactLine(line) && line.length <= 90 && !LOCATION_RE.test(line)) {
      r.headline = line.replace(/\s*[|·•]\s*$/, '');
      return;
    }
    if (isContactLine(line) || LOCATION_RE.test(line.split(/\s*[|·•]\s*/)[0] ?? '') || /\s[|·•]\s/.test(line)) contactText.push(line);
    else if (!r.summary && line.length > 90) r.summary = line;
    else contactText.push(line);
  });
  const contactBlock = blocks.find((b) => b.kind === 'contact');
  if (contactBlock) contactText.push(...contactBlock.lines);
  const allContact = contactText.join('\n');
  const email = EMAIL_RE.exec(allContact) ?? EMAIL_RE.exec(text);
  r.email = email ? email[0] : '';
  r.phone = phoneIn(allContact.replace(new RegExp(EMAIL_RE.source, 'gi'), ' '));
  for (const u of extractLinks(allContact)) {
    const platform = socialPlatformOf(u);
    if (platform) {
      if (!r.links.some((l) => l.platform === platform)) r.links.push({ platform, url: u });
    } else if (!r.website) r.website = u;
  }
  for (const line of contactText) {
    for (const seg of line.split(/\s*[|·•]\s*|\s{2,}/)) {
      const s = seg.replace(/^(location|address)\s*:\s*/i, '').trim();
      if (!r.location && LOCATION_RE.test(s) && !EMAIL_RE.test(s) && !phoneIn(s) && s.length <= 50) r.location = s;
    }
  }

  for (const b of blocks) {
    switch (b.kind) {
      case 'summary':
        r.summary = [r.summary, b.lines.map((l) => unbullet(l.trim())).filter(Boolean).join(' ')].filter(Boolean).join(' ');
        break;
      case 'experience':
        r.experience.push(...parseExperience(b.lines));
        break;
      case 'education':
        r.education.push(...parseEducation(b.lines));
        break;
      case 'skills':
        r.skills.push(...parseSkills(b.lines).filter((s) => !r.skills.some((x) => x.name.toLowerCase() === s.name.toLowerCase())));
        break;
      case 'projects':
        r.projects.push(...parseProjects(b.lines));
        break;
      case 'certifications':
        r.certifications.push(...parseCertifications(b.lines));
        break;
      case 'achievements':
        r.achievements.push(...parseAchievements(b.lines));
        break;
      case 'contact':
        break;
      case 'other': {
        const content = b.lines
          .map((l) => (isBullet(l) ? `- ${unbullet(l)}` : l.trim()))
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (content) r.other.push({ heading: b.heading, content });
      }
    }
  }
  return r;
}

function titleCaseName(s: string): string {
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) return s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  return s;
}

/** Counts shown before creating a project ("Found: 3 positions, 12 skills…"). */
export function summarizeResume(r: ParsedResume): string[] {
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
  const out: string[] = [];
  if (r.name) out.push(`Name: ${r.name}`);
  if (r.headline) out.push(`Headline: ${r.headline}`);
  const contact = [r.email && 'email', r.phone && 'phone', r.location && 'location', ...r.links.map((l) => l.platform), r.website && 'website'].filter(Boolean);
  if (contact.length) out.push(`Contact: ${contact.join(', ')}`);
  if (r.summary) out.push('Summary');
  if (r.experience.length) out.push(n(r.experience.length, 'position'));
  if (r.skills.length) {
    const cats = new Set(r.skills.map((s) => s.category)).size;
    out.push(`${n(r.skills.length, 'skill')}${cats > 1 ? ` in ${cats} categories` : ''}`);
  }
  if (r.education.length) out.push(n(r.education.length, 'degree'));
  if (r.projects.length) out.push(n(r.projects.length, 'project'));
  if (r.certifications.length) out.push(n(r.certifications.length, 'certification'));
  if (r.achievements.length) out.push(n(r.achievements.length, 'award'));
  if (r.other.length) out.push(`${n(r.other.length, 'other section')} (${r.other.map((o) => o.heading).join(', ')})`);
  return out;
}

export function resumeToPortfolio(r: ParsedResume): Portfolio {
  const title = r.name ? `${r.name}${r.headline ? ` — ${r.headline}` : ''}` : 'Imported resume';
  const p = createPortfolio({ title, sections: [] });
  p.metadata.author = r.name;
  if (r.summary) p.metadata.description = clip(r.summary, 160);
  p.metadata.keywords = r.skills.slice(0, 10).map((s) => s.name);
  if (r.website) p.metadata.siteUrl = r.website;
  const sections: PortfolioSection[] = p.sections;
  const hero = addSection(sections, 'hero', {
    name: r.name || 'Your Name',
    title: r.headline,
    description: r.summary ? clip(r.summary, 240) : '',
    availability: '',
  });
  if (r.summary && r.summary.length > 240) addSection(sections, 'about', { body: r.summary, heading: 'About' });
  if (r.experience.length) addSection(sections, 'experience', { items: r.experience });
  if (r.projects.length) addSection(sections, 'projects', { items: r.projects });
  if (r.skills.length) addSection(sections, 'skills', { items: r.skills, display: new Set(r.skills.map((s) => s.category)).size > 1 ? 'grouped' : 'tags' });
  if (r.education.length) addSection(sections, 'education', { items: r.education });
  if (r.certifications.length) addSection(sections, 'certifications', { items: r.certifications });
  if (r.achievements.length) addSection(sections, 'achievements', { items: r.achievements, heading: 'Awards' });
  for (const o of r.other) {
    const s = addSection(sections, 'custom', { heading: o.heading, mode: 'markdown', content: o.content }, o.heading);
    s.style.showInNav = false;
  }
  if (r.email || r.phone) addSection(sections, 'contact', { email: r.email, phone: r.phone, location: r.location, body: '', showForm: Boolean(r.email) });
  const social: SocialItem[] = r.links.map((l) => socialItem(l.platform, l.url));
  if (r.website) social.push(socialItem('Website', r.website));
  if (social.length) addSection(sections, 'social', { items: social });
  hero.data.ctas = heroCtas(sections);
  return p;
}

/** Deterministic plain-text resume parser: no network, no AI. */
export function parseResumeText(text: string): { portfolio: Portfolio; summary: string[] } {
  const parsed = parseResumeStructure(text);
  return { portfolio: resumeToPortfolio(parsed), summary: summarizeResume(parsed) };
}
