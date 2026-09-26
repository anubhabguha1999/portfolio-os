import type { DocBlock, DocModel, DocSection } from '@/types/document';
import type { Portfolio, PortfolioSection } from '@/types/portfolio';
import { heroOf, visibleSections } from '@/lib/engine/collect';
import { contactRuns, docTheme } from './build';
import { markdownToPlain } from '@/lib/sanitize';
import { formatRange, formatMonth } from '@/utils/format';
import { groupSkills } from '@/sections/defs/skills';

export type ResumeLength = 'one-page' | 'two-page' | 'full';
export type ResumeTemplate = 'classic' | 'modern' | 'ats';

export interface ResumeOptions {
  length: ResumeLength;
  template: ResumeTemplate;
  includeProjects: boolean;
  includePhoto: boolean;
}

export const DEFAULT_RESUME_OPTIONS: ResumeOptions = { length: 'one-page', template: 'modern', includeProjects: true, includePhoto: false };

interface Limits {
  experience: number;
  bullets: number;
  projects: number;
  summarySentences: number;
  education: number;
  extras: number;
}

const LIMITS: Record<ResumeLength, Limits> = {
  'one-page': { experience: 4, bullets: 3, projects: 2, summarySentences: 3, education: 2, extras: 3 },
  'two-page': { experience: 7, bullets: 5, projects: 4, summarySentences: 5, education: 4, extras: 6 },
  full: { experience: 99, bullets: 99, projects: 99, summarySentences: 99, education: 99, extras: 99 },
};

function firstSentences(text: string, n: number): string {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [];
  return sentences.slice(0, n).join('').trim();
}

function find<K extends PortfolioSection['type']>(sections: PortfolioSection[], type: K): Extract<PortfolioSection, { type: K }> | undefined {
  return sections.find((s): s is Extract<PortfolioSection, { type: K }> => s.type === type);
}

/**
 * Portfolio → Resume. The same data, re-shaped for recruiters: reverse-chronological,
 * concise, and (for ATS) single-column plain text with standard headings.
 */
export function buildResumeDocument(p: Portfolio, options: Partial<ResumeOptions> = {}): DocModel {
  const o = { ...DEFAULT_RESUME_OPTIONS, ...options };
  const lim = LIMITS[o.length];
  const ats = o.template === 'ats';
  const hero = heroOf(p);
  const sections = visibleSections(p);
  const out: DocSection[] = [];

  const about = find(sections, 'about');
  const summarySource = about ? markdownToPlain(about.data.body) : hero?.description ?? '';
  const summary = firstSentences(summarySource, lim.summarySentences);
  if (summary) out.push({ id: 'summary', title: ats ? 'Summary' : 'Profile', blocks: [{ kind: 'paragraph', runs: [{ text: summary }] }] });

  const exp = find(sections, 'experience');
  if (exp && exp.data.items.length) {
    const items = [...exp.data.items].sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || (b.end || b.start || '9999').localeCompare(a.end || a.start || '9999')).slice(0, lim.experience);
    out.push({
      id: 'experience',
      title: ats ? 'Work Experience' : 'Experience',
      blocks: items.map((i) => {
        const bullets = (i.achievements.length ? i.achievements : i.description ? [i.description] : []).slice(0, lim.bullets);
        const body: DocBlock[] = [];
        if (i.achievements.length && i.description && o.length !== 'one-page') body.push({ kind: 'paragraph', runs: [{ text: i.description }] });
        if (bullets.length) body.push({ kind: 'list', ordered: false, items: bullets.map((b) => [{ text: b }]) });
        if (i.technologies.length && o.length !== 'one-page') body.push({ kind: 'tags', label: 'Technologies', items: i.technologies });
        return { kind: 'entry' as const, title: i.role, subtitle: i.company, meta: formatRange(i.start, i.end, i.current), location: i.location, body };
      }),
    });
  }

  const projects = find(sections, 'projects');
  if (o.includeProjects && projects && projects.data.items.length && lim.projects > 0) {
    const items = [...projects.data.items].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, lim.projects);
    out.push({
      id: 'projects',
      title: 'Projects',
      blocks: items.map((pr) => ({
        kind: 'entry' as const,
        title: pr.title,
        subtitle: pr.technologies.slice(0, 5).join(', '),
        meta: pr.duration,
        ...(pr.live || pr.github ? { link: pr.live || pr.github } : {}),
        body: [
          ...(pr.description ? [{ kind: 'paragraph' as const, runs: [{ text: o.length === 'one-page' ? firstSentences(pr.description, 2) : pr.description }] }] : []),
          ...(pr.features.length && o.length !== 'one-page' ? [{ kind: 'list' as const, ordered: false, items: pr.features.slice(0, lim.bullets).map((f) => [{ text: f }]) }] : []),
        ],
      })),
    });
  }

  const skills = find(sections, 'skills');
  if (skills && skills.data.items.length) {
    const groups = groupSkills(skills.data.items);
    out.push({
      id: 'skills',
      title: 'Skills',
      blocks:
        groups.length > 1
          ? groups.map(([cat, list]) => ({ kind: 'tags' as const, label: cat, items: list.map((s) => s.name) }))
          : [{ kind: 'tags' as const, items: skills.data.items.map((s) => s.name) }],
    });
  }

  const edu = find(sections, 'education');
  if (edu && edu.data.items.length) {
    out.push({
      id: 'education',
      title: 'Education',
      blocks: edu.data.items.slice(0, lim.education).map((e) => ({
        kind: 'entry' as const,
        title: `${e.degree}${e.field ? `, ${e.field}` : ''}`,
        subtitle: e.institution,
        meta: formatRange(e.start, e.end),
        location: e.location,
        body: e.grade ? [{ kind: 'paragraph' as const, runs: [{ text: e.grade }], tone: 'muted' as const }] : [],
      })),
    });
  }

  const certs = find(sections, 'certifications');
  if (certs && certs.data.items.length) {
    out.push({
      id: 'certifications',
      title: 'Certifications',
      blocks: [{ kind: 'list', ordered: false, items: certs.data.items.slice(0, lim.extras).map((c) => [{ text: c.name, bold: true }, { text: ` — ${[c.issuer, formatMonth(c.date)].filter(Boolean).join(', ')}` }]) }],
    });
  }

  const ach = find(sections, 'achievements');
  if (ach && ach.data.items.length) {
    out.push({
      id: 'achievements',
      title: ats ? 'Awards' : 'Achievements',
      blocks: [{ kind: 'list', ordered: false, items: ach.data.items.slice(0, lim.extras).map((a) => [{ text: a.title, bold: true }, ...(a.description ? [{ text: ` — ${a.description}` }] : [])]) }],
    });
  }

  return {
    kind: 'resume',
    title: `${hero?.name || p.metadata.author || 'Resume'} — Resume`,
    author: hero?.name || p.metadata.author,
    subject: hero?.title ?? '',
    keywords: skills?.type === 'skills' ? skills.data.items.map((s) => s.name) : p.metadata.keywords,
    header: {
      name: hero?.name || p.metadata.author || 'Your Name',
      headline: hero?.title ?? '',
      contact: contactRuns(p),
      ...(o.includePhoto && !ats && hero?.image.src ? { photo: hero.image.src } : {}),
    },
    sections: out,
    theme: ats ? { ...docTheme(p), primary: '#111111', font: 'helvetica' } : docTheme(p),
  };
}
