/**
 * Rule-based semantic extraction. Runs locally (in the analysis worker); no model, no network.
 *
 *  - classifyDocument: resume / CV / certificate / invoice / report / … with a confidence.
 *  - extractResume: reuses the tested resume-text parser on the layout-aware text, then attaches
 *    a confidence and the source page/block to every field. Missing values stay empty: dates,
 *    companies and links are never invented.
 */
import { parseResumeStructure } from '@/lib/import/resume-text';
import { looksLikeRole } from '@/lib/import/common';
import type { DocumentType, ExtractedBlock, ExtractedLink, ExtractedPage, Provenance, SemanticData, SemanticField, SemanticResume, SemanticSkill } from '../types';
import { documentText } from './layout';
import { canonicalSkill, findSkillsInText } from './skills';

/* --------------------------- classification -------------------------- */

const count = (text: string, re: RegExp) => (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length;

const RESUME_HEADINGS = /^(work |professional |relevant )?(experience|employment( history)?|education|skills|technical skills|projects|summary|profile|objective|certifications?|achievements|awards|languages)$/i;

export function classifyDocument(pages: ExtractedPage[], fileName: string): { type: DocumentType; confidence: number } {
  const blocks = pages.flatMap((p) => p.blocks);
  const text = blocks.map((b) => b.text).join('\n');
  const headings = blocks.filter((b) => b.type === 'heading' || b.type === 'subheading' || b.type === 'title').map((b) => b.text.trim().replace(/:$/, ''));
  // Headings can also be plain short lines; count lines that read exactly like resume headings.
  const lines = blocks.flatMap((b) => b.lines.map((l) => l.text.trim().replace(/:$/, '')));
  const resumeHeads = new Set([...headings, ...lines].filter((h) => RESUME_HEADINGS.test(h)).map((h) => h.toLowerCase())).size;
  const n = pages.length;
  const name = fileName.toLowerCase();

  const scores: Record<DocumentType, number> = {
    resume: resumeHeads * 0.16 + (/@[a-z0-9-]+\.[a-z]{2,}/i.test(text) ? 0.14 : 0) + (/\+?\d[\d\s().-]{8,}\d/.test(text) ? 0.08 : 0) + (n <= 3 ? 0.08 : 0) + (/resume|résumé/.test(name) ? 0.25 : 0),
    cv: (/curriculum vitae/i.test(text) ? 0.5 : 0) + (/\bcv\b/.test(name) ? 0.35 : 0) + (resumeHeads >= 3 && n >= 3 ? 0.2 : 0) + (/publications|research interests|conferences/i.test(text) ? 0.2 : 0),
    certificate: (/this is to certify|hereby certif|has successfully completed|certificate of (completion|achievement|participation|excellence)|awarded to|presented to/i.test(text) ? 0.6 : 0) + (/certif/i.test(name) ? 0.3 : 0) + (n <= 2 ? 0.1 : 0),
    invoice: Math.min(0.9, count(text, /\b(invoice|bill to|amount due|subtotal|tax|total due|due date|invoice (no|number|#))\b/i) * 0.15) + (/invoice|receipt/.test(name) ? 0.3 : 0),
    report: Math.min(0.8, count(text, /\b(abstract|introduction|methodology|conclusion|executive summary|table of contents|findings|recommendations)\b/i) * 0.14) + (/report/.test(name) ? 0.25 : 0),
    article: n >= 1 && n <= 15 && blocks.filter((b) => b.type === 'paragraph').length > 8 ? 0.3 : 0,
    book: (n > 60 ? 0.5 : 0) + Math.min(0.4, count(text, /\bchapter\s+\d+/i) * 0.08),
    technical: Math.min(0.8, headings.filter((h) => /\b(api|installation|install|configuration|usage|architecture|endpoints?|reference|getting started|setup|requirements)\b/i.test(h)).length * 0.16) + (/docs?|spec|manual|guide/.test(name) ? 0.2 : 0),
    portfolio: (/portfolio|case stud(y|ies)|selected work/i.test(text) ? 0.3 : 0) + (/portfolio/.test(name) ? 0.35 : 0) + (blocks.filter((b) => b.type === 'image').length >= 4 ? 0.15 : 0),
    other: 0.2,
  };
  // A resume with a CV signal is a CV; a CV-looking file without resume structure is not.
  if (scores.cv > 0.3 && resumeHeads >= 2) scores.cv += 0.25;
  let best: DocumentType = 'other';
  for (const k of Object.keys(scores) as DocumentType[]) if (scores[k] > scores[best]) best = k;
  return { type: best, confidence: Math.min(0.97, scores[best]) };
}

/* ------------------------------ provenance --------------------------- */

const lc = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function locator(pages: ExtractedPage[], docId: string, docName: string) {
  const blocks = pages.flatMap((p) => p.blocks.filter((b) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image'));
  const find = (value: string): ExtractedBlock | null => {
    const v = lc(value);
    if (!v) return null;
    return blocks.find((b) => lc(b.text).includes(v)) ?? blocks.find((b) => v.length > 24 && lc(b.text).includes(v.slice(0, 24))) ?? null;
  };
  return {
    source(value: string): Provenance | null {
      const b = find(value);
      return b ? { docId, docName, page: b.page, blockId: b.id } : null;
    },
    block: find,
  };
}

/* ------------------------------- resume ------------------------------ */

const field = <T>(value: T, confidence: number, source: Provenance | null, original?: string): SemanticField<T> => ({
  value,
  confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100,
  source,
  ...(original !== undefined && original !== value ? { original } : {}),
});

const empty = () => field('', 0, null);

/** OCR text is less reliable: scale confidences by the block's OCR confidence. */
function ocrFactor(b: ExtractedBlock | null): number {
  return b?.confidence !== undefined ? 0.4 + 0.6 * b.confidence : 1;
}

function canonicalList(list: string[]): string[] {
  const out: string[] = [];
  for (const t of list) {
    const name = canonicalSkill(t)?.name ?? t.trim();
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

const NAME_LIKE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*(\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*){1,3}$/;
const SIDEBAR_HEADINGS = /^(contact( me| info(rmation)?| details)?|personal (details|info(rmation)?)|strengths|interests|hobbies|languages|skills|education|references)$/i;

/**
 * Two-column resumes often put a sidebar (Contact, Skills…) first in reading order and the
 * name, in large type, at the top of the main column. Move the most prominent name-like block
 * near the top of page 1 — and the short lines under it in that column (the headline) — to the
 * front, so the parser sees "name, headline, contact" in the usual order.
 */
export function promoteName(pages: ExtractedPage[]): ExtractedPage[] {
  const first = pages[0];
  if (!first) return pages;
  const size = (b: ExtractedBlock) => Math.max(0, ...b.lines.map((l) => l.fontSize));
  const body = first.blocks.filter((b) => b.type !== 'image' && b.type !== 'header' && b.type !== 'footer');
  const median = [...body.map(size)].sort((a, b) => a - b)[Math.floor(body.length / 2)] ?? 0;
  const candidates = body.filter((b) => b.y < first.height * 0.25 && b.lines.length <= 2 && NAME_LIKE.test(b.text.trim()) && !RESUME_HEADINGS.test(b.text.trim()) && !SIDEBAR_HEADINGS.test(b.text.trim()) && size(b) >= median * 1.5);
  const name = candidates.sort((a, b) => size(b) - size(a))[0];
  if (!name) return pages;
  const at = first.blocks.indexOf(name);
  if (at <= 0 || body.slice(0, body.indexOf(name)).some((b) => size(b) >= size(name))) return pages;
  // Follow the name down its own column while the blocks stay short (headline, tagline).
  const moved = [name];
  for (const b of first.blocks.slice(at + 1)) {
    if (Math.abs(b.x - name.x) > 40 || b.lines.length > 2 || RESUME_HEADINGS.test(b.text.trim()) || b.text.length > 120) break;
    moved.push(b);
  }
  return [{ ...first, blocks: [...moved, ...first.blocks.filter((b) => !moved.includes(b))] }, ...pages.slice(1)];
}

export function extractResume(pages: ExtractedPage[], links: ExtractedLink[], docId: string, docName: string): SemanticResume {
  const ordered = promoteName(pages);
  const text = documentText(ordered);
  const parsed = parseResumeStructure(text);
  const loc = locator(pages, docId, docName);
  const src = (v: string) => loc.source(v);
  const conf = (v: string, base: number) => base * ocrFactor(loc.block(v));
  const title = ordered[0]?.blocks.find((b) => b.type === 'title' || b.type === 'heading');

  const allLinks = [...links.map((l) => l.url), ...parsed.links.map((l) => l.url), parsed.website].filter(Boolean);
  const linkOf = (re: RegExp) => allLinks.find((u) => re.test(u)) ?? '';
  const github = linkOf(/github\.com\//i);
  const linkedin = linkOf(/linkedin\.com\//i);
  const website = parsed.website || allLinks.find((u) => /^https?:/i.test(u) && !/github\.com|linkedin\.com|mailto:/i.test(u)) || '';

  const nameConf = !parsed.name ? 0 : title && lc(title.text).includes(lc(parsed.name)) ? 0.92 : /^[A-Z][a-z'-]+(\s[A-Z][a-z'.-]+){1,3}$/.test(parsed.name) ? 0.8 : 0.6;
  const summaryUnderHeading = /\n(professional\s+)?(summary|profile|about( me)?|objective)\s*:?\s*\n/i.test(`\n${text}`);

  const skills: SemanticSkill[] = [];
  const addSkill = (raw: string, base: number, category = '') => {
    const known = canonicalSkill(raw);
    const name = known?.name ?? raw.trim();
    if (!name || name.length > 60 || skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    skills.push({ name, original: raw.trim(), category: known?.category ?? category, confidence: Math.round((known ? Math.max(base, 0.92) : base) * ocrFactor(loc.block(raw)) * 100) / 100, source: src(raw) });
  };
  for (const s of parsed.skills) addSkill(s.name, 0.65, s.category);
  // No skills section: fall back to known technologies mentioned anywhere (lower confidence).
  if (!skills.length) for (const s of findSkillsInText(text)) addSkill(s.original, 0.5, s.category);

  const languages: SemanticResume['languages'] = [];
  for (const o of parsed.other) {
    if (!/^languages?$/i.test(o.heading.trim())) continue;
    for (const part of o.content.split(/[\n,;]|\s[|·•]\s/)) {
      const m = /^[-•\s]*([A-Za-zÀ-ÿ ]{2,30}?)\s*(?:[(:–-]\s*([^)]+?)\)?)?\s*$/.exec(part.trim());
      if (m?.[1] && !/^\d/.test(m[1])) languages.push({ language: m[1].trim(), fluency: (m[2] ?? '').trim() });
    }
  }

  return {
    profile: {
      name: parsed.name ? field(parsed.name, conf(parsed.name, nameConf), src(parsed.name)) : empty(),
      headline: parsed.headline ? field(parsed.headline, conf(parsed.headline, looksLikeRole(parsed.headline) ? 0.78 : 0.55), src(parsed.headline)) : empty(),
      email: parsed.email ? field(parsed.email, conf(parsed.email, 0.98), src(parsed.email)) : empty(),
      phone: parsed.phone ? field(parsed.phone, conf(parsed.phone, /^\+/.test(parsed.phone) ? 0.9 : 0.82), src(parsed.phone)) : empty(),
      location: parsed.location ? field(parsed.location, conf(parsed.location, 0.7), src(parsed.location)) : empty(),
      website: website ? field(website, 0.9, src(website.replace(/^https?:\/\//, ''))) : empty(),
      github: github ? field(github, 0.95, src(github.replace(/^https?:\/\//, ''))) : empty(),
      linkedin: linkedin ? field(linkedin, 0.95, src(linkedin.replace(/^https?:\/\//, ''))) : empty(),
      summary: parsed.summary ? field(parsed.summary, conf(parsed.summary, summaryUnderHeading ? 0.82 : 0.55), src(parsed.summary.slice(0, 60))) : empty(),
    },
    socialLinks: parsed.links.map((l) => ({ platform: l.platform, url: l.url, source: src(l.url.replace(/^https?:\/\/(www\.)?/, '')) })),
    experience: parsed.experience.map((e) => {
      const head = e.role || e.company;
      const base = e.role && e.company ? (looksLikeRole(e.role) ? 0.86 : 0.72) : 0.5;
      const s = src(head);
      const f = ocrFactor(loc.block(head));
      return {
        company: field(e.company, (e.company ? base : 0) * f, e.company ? src(e.company) ?? s : null),
        role: field(e.role, (e.role ? base : 0) * f, e.role ? s : null),
        location: field(e.location, e.location ? 0.7 * f : 0, e.location ? src(e.location) : null),
        startDate: field<string | null>(e.start || null, e.start ? (/^\d{4}-\d{2}$/.test(e.start) ? 0.9 : 0.75) * f : 0, e.start ? s : null),
        endDate: field<string | null>(e.current ? null : e.end || null, e.current || e.end ? 0.88 * f : 0, e.end || e.current ? s : null),
        current: e.current,
        description: field(e.description, e.description ? 0.75 * f : 0, e.description ? src(e.description.slice(0, 50)) : null),
        achievements: e.achievements,
        technologies: canonicalList(e.technologies.length ? e.technologies : findSkillsInText([e.description, ...e.achievements].join('\n')).map((x) => x.name)),
      };
    }),
    education: parsed.education.map((e) => {
      const s = src(e.institution || e.degree);
      const f = ocrFactor(loc.block(e.institution || e.degree));
      return {
        institution: field(e.institution, (e.institution ? 0.82 : 0) * f, e.institution ? s : null),
        degree: field(e.degree, (e.degree ? 0.78 : 0) * f, e.degree ? src(e.degree) ?? s : null),
        field: e.field,
        startDate: e.start || null,
        endDate: e.end || null,
        grade: e.grade,
      };
    }),
    projects: parsed.projects.map((p) => {
      const f = ocrFactor(loc.block(p.title));
      const generic = /^project$/i.test(p.title);
      return {
        title: field(p.title, (generic ? 0.35 : 0.8) * f, src(p.title)),
        description: field(p.description, p.description ? 0.72 * f : 0, p.description ? src(p.description.slice(0, 50)) : null),
        technologies: canonicalList(p.technologies.length ? p.technologies : findSkillsInText([p.description, ...p.features].join('\n')).map((x) => x.name)),
        url: p.live || p.github,
        features: p.features,
      };
    }),
    skills,
    certifications: parsed.certifications.map((c) => ({ name: field(c.name, 0.75 * ocrFactor(loc.block(c.name)), src(c.name)), issuer: c.issuer, date: c.date, url: c.url })),
    achievements: parsed.achievements.map((a) => ({ title: a.title, description: a.description, date: a.date })),
    languages,
  };
}

export function extractSemantic(pages: ExtractedPage[], links: ExtractedLink[], docId: string, docName: string, mode: 'auto' | 'resume' | 'portfolio' | 'generic', forcedType?: DocumentType): SemanticData {
  const detected = classifyDocument(pages, docName);
  const docType = forcedType ?? (mode === 'resume' ? 'resume' : mode === 'portfolio' ? 'portfolio' : detected.type);
  const confidence = forcedType ? 1 : mode === 'auto' ? detected.confidence : 1;
  // Generic documents keep their structure only; they are never forced into a resume schema.
  const resumeLike = mode !== 'generic' && (docType === 'resume' || docType === 'cv' || docType === 'portfolio');
  return { docType, docTypeConfidence: Math.round(confidence * 100) / 100, resume: resumeLike ? extractResume(pages, links, docId, docName) : null };
}
