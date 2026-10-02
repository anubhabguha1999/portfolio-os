/**
 * Resume content embedded in exported PDFs (XMP metadata), so a PDF made here imports back
 * exactly instead of being re-guessed from its layout.
 *
 *  - Built from the *resolved* resume: only what is printed on the page. Hidden items, the rest
 *    of the library and resume-only overrides that are not shown never get in.
 *  - Written only when "Document metadata" is on (the same switch as title / author).
 *  - On import it is parsed like any Portfolio OS JSON: every value is coerced and capped.
 */
import type { ResolvedItem, ResolvedResume } from '@/studio/model/resolve';
import { sectionInfo } from '@/studio/model/defaults';

/** XMP namespace for the embedded copy. */
export const EMBED_NS = 'https://portfolioos.online/ns/resume/1/';
export const EMBED_FORMAT = 'portfolio-os-resume';

const text = (s: string | undefined) => (s ?? '').trim();

export function embeddedResumeData(r: ResolvedResume): Record<string, unknown> {
  const contact = (kind: string) => r.contact.find((c) => c.kind === kind);
  const summary = r.sections.find((s) => s.kind === 'summary')?.text ?? '';
  const lib: Record<string, unknown[]> = { experience: [], projects: [], education: [], skills: [], certifications: [], achievements: [] };
  const sections: Array<{ kind: string; title: string; entries: unknown[] }> = [];
  const push = (kind: string, items: ResolvedItem[], map: (i: ResolvedItem) => Record<string, unknown>) => lib[kind]!.push(...items.map(map));

  for (const s of r.sections) {
    const info = sectionInfo(s.kind);
    if (s.kind === 'skills' || s.kind === 'technical-skills') {
      for (const g of s.skills) g.names.forEach((name, i) => lib.skills!.push({ name, category: g.category, level: g.levels[i] ?? 0 }));
      continue;
    }
    switch (info.library) {
      case 'experience':
        push('experience', s.items, (i) => ({ role: i.title, company: i.subtitle, location: i.location, start: i.start, end: i.end, current: i.current, url: i.url, description: i.description, achievements: i.bullets, technologies: i.tags }));
        break;
      case 'projects':
        push('projects', s.items, (i) => ({ title: i.title, role: i.subtitle, duration: i.date, live: i.url, description: i.description, resumeSummary: i.description, features: i.bullets, resumeBullets: i.bullets, technologies: i.tags }));
        break;
      case 'education':
        push('education', s.items, (i) => ({ degree: i.title, institution: i.subtitle, location: i.location, start: i.start, end: i.end, description: i.description }));
        break;
      case 'certifications':
        push('certifications', s.items, (i) => ({ name: i.title, issuer: i.subtitle, date: i.start, url: i.url }));
        break;
      case 'achievements':
        push('achievements', s.items, (i) => ({ title: i.title, description: i.description, date: i.start, url: i.url }));
        break;
      default:
        if (s.kind !== 'summary' && s.kind !== 'profile' && s.items.length)
          sections.push({ kind: s.kind, title: s.title, entries: s.items.map((i) => ({ title: i.title, subtitle: i.subtitle, date: i.start || i.date, location: i.location, url: i.url, description: i.description, bullets: i.bullets })) });
    }
  }

  return {
    format: EMBED_FORMAT,
    version: 1,
    embedded: true,
    profile: {
      name: text(r.name),
      headline: text(r.headline),
      bio: text(summary),
      email: text(contact('email')?.label),
      phone: text(contact('phone')?.label),
      location: text(contact('location')?.label),
      website: text(contact('website')?.url),
      socialLinks: r.contact.filter((c) => c.kind === 'social').map((c) => ({ platform: c.platform ?? '', label: c.label, url: c.url ?? '' })),
    },
    library: lib,
    resume: { sections },
  };
}

/** The embedded JSON from a PDF's raw XMP packet, or null. */
export function embeddedFromXmp(xmp: string | null | undefined): string | null {
  if (!xmp || !xmp.includes(EMBED_NS)) return null;
  const m = /<jspdf:metadata>([\s\S]*?)<\/jspdf:metadata>/.exec(xmp);
  if (!m) return null;
  return m[1]!.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
