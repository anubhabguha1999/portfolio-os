/**
 * Conversions from an extraction: TXT, JSON (structured / semantic), Markdown, and the
 * whole Local Knowledge Library as a ZIP. Raw JSON lives in the service (it needs the parser).
 */
import { zipSync, strToU8 } from 'fflate';
import { pageText, reflow, textRightOf } from '../analysis/layout';
import type { Extraction, ExtractedBlock, KnowledgeDoc, SemanticResume } from '../types';
import type { Library, Profile } from '@/studio/model/types';

/* --------------------------------- TXT ------------------------------- */

/** Reflow paragraph lines into sentences; keep headings, bullets and table rows on their own lines. */
function readablePage(ext: Extraction, pageIdx: number): string {
  const page = ext.pages[pageIdx]!;
  const right = textRightOf(page);
  const parts: string[] = [];
  for (const b of page.blocks) {
    if (b.type === 'image' || b.type === 'header' || b.type === 'footer') continue;
    if (b.type === 'paragraph') parts.push(reflow(b.lines, right).join('\n'));
    else if (b.type === 'list') parts.push((b.items ?? []).map((i) => `• ${i}`).join('\n'));
    else if (b.type === 'table') parts.push((b.rows ?? []).map((r) => r.join(' | ')).join('\n'));
    else parts.push(b.text);
  }
  return parts.filter(Boolean).join('\n\n');
}

export function exportText(ext: Extraction, opts: { pageBreaks: boolean }): string {
  const pages = ext.pages.map((p, i) => ({ page: p.page, text: readablePage(ext, i) }));
  if (!opts.pageBreaks) return `${pages.map((p) => p.text).filter(Boolean).join('\n\n')}\n`;
  return `${pages.map((p) => `--- PAGE ${p.page} ---\n\n${p.text}`).join('\n\n')}\n`;
}

/* --------------------------------- JSON ------------------------------ */

const blockJson = (b: ExtractedBlock) => ({
  id: b.id,
  type: b.type,
  page: b.page,
  text: b.text,
  ...(b.level ? { level: b.level } : {}),
  ...(b.items ? { items: b.items } : {}),
  ...(b.rows ? { rows: b.rows } : {}),
  ...(b.uncertain ? { uncertain: true } : {}),
  ...(b.confidence !== undefined ? { confidence: b.confidence } : {}),
  bbox: { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) },
  lines: b.lines.map((l) => ({ text: l.text, fontSize: round(l.fontSize), ...(l.bold ? { bold: true } : {}), bbox: { x: round(l.x), y: round(l.y), width: round(l.width), height: round(l.height) } })),
});

const round = (n: number) => Math.round(n * 10) / 10;

export function exportJson(doc: KnowledgeDoc, ext: Extraction, level: 'structured' | 'semantic') {
  const document = { name: doc.name, kind: doc.kind, type: ext.semantic.docType, pages: ext.stats.pages, sha256: doc.hash, extractedAt: ext.createdAt, version: ext.version };
  if (level === 'semantic') {
    return { format: 'portfolio-os-pdf-semantic', version: 1, document, docTypeConfidence: ext.semantic.docTypeConfidence, resume: ext.semantic.resume, links: ext.links, notice: 'Fields were detected by local rules. Check them before use; confidence is 0–1.' };
  }
  const blocks = ext.pages.flatMap((p) => p.blocks);
  return {
    format: 'portfolio-os-pdf-structured',
    version: 1,
    document,
    metadata: ext.metadata,
    stats: ext.stats,
    warnings: ext.warnings,
    ocr: ext.ocr,
    pages: ext.pages.map((p) => ({ page: p.page, width: round(p.width), height: round(p.height), ocr: p.ocr, blocks: p.blocks.map(blockJson) })),
    headings: blocks.filter((b) => b.type === 'title' || b.type === 'heading' || b.type === 'subheading').map((b) => ({ text: b.text, level: b.level ?? 3, page: b.page, blockId: b.id })),
    paragraphs: blocks.filter((b) => b.type === 'paragraph').map((b) => ({ text: b.text, page: b.page, blockId: b.id })),
    lists: blocks.filter((b) => b.type === 'list').map((b) => ({ items: b.items ?? [], page: b.page, blockId: b.id })),
    tables: blocks.filter((b) => b.type === 'table').map((b) => ({ rows: b.rows ?? [], uncertain: !!b.uncertain, page: b.page, blockId: b.id })),
    images: blocks.filter((b) => b.type === 'image').map((b) => ({ page: b.page, bbox: blockJson(b).bbox })),
    links: ext.links,
  };
}

/* ------------------------------- Markdown ---------------------------- */

const mdEscape = (s: string) => s.replace(/([\\`*_[\]#|])/g, '\\$1');

/** Resume documents become a clean resume outline; other documents keep their own structure. */
export function exportMarkdown(ext: Extraction): string {
  const r = ext.semantic.resume;
  if (r && r.profile.name.value) return resumeMarkdown(r);
  const out: string[] = [];
  for (const p of ext.pages) {
    for (const b of p.blocks) {
      if (b.type === 'header' || b.type === 'footer' || b.type === 'image') continue;
      if (b.type === 'title') out.push(`# ${mdEscape(b.text)}`);
      else if (b.type === 'heading') out.push(`${b.level === 1 ? '#' : '##'} ${mdEscape(b.text)}`);
      else if (b.type === 'subheading') out.push(`### ${mdEscape(b.text)}`);
      else if (b.type === 'list') out.push((b.items ?? []).map((i) => `- ${mdEscape(i)}`).join('\n'));
      else if (b.type === 'table' && b.rows?.length) {
        const [head, ...rows] = b.rows;
        const cell = (c: string) => c.replace(/\|/g, '\\|');
        out.push([`| ${head!.map(cell).join(' | ')} |`, `| ${head!.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n'));
      } else out.push(mdEscape(b.lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()));
    }
  }
  return `${out.filter(Boolean).join('\n\n')}\n`;
}

const range = (a: string | null, b: string | null, current: boolean) => [a, current ? 'Present' : b].filter(Boolean).join(' – ');

export function resumeMarkdown(r: SemanticResume): string {
  const p = r.profile;
  const out: string[] = [`# ${p.name.value}`];
  if (p.headline.value) out.push(`**${p.headline.value}**`);
  const contact = [p.email.value, p.phone.value, p.location.value, p.website.value, p.github.value, p.linkedin.value].filter(Boolean);
  if (contact.length) out.push(contact.join(' · '));
  if (p.summary.value) out.push(`## Summary\n\n${p.summary.value}`);
  if (r.experience.length) {
    out.push('## Experience');
    for (const e of r.experience) {
      out.push(`### ${[e.role.value, e.company.value].filter(Boolean).join(' — ')}`);
      const meta = [range(e.startDate.value, e.endDate.value, e.current), e.location.value].filter(Boolean).join(' · ');
      if (meta) out.push(`*${meta}*`);
      if (e.description.value) out.push(e.description.value);
      if (e.achievements.length) out.push(e.achievements.map((a) => `- ${a}`).join('\n'));
      if (e.technologies.length) out.push(`**Technologies:** ${e.technologies.join(', ')}`);
    }
  }
  if (r.projects.length) {
    out.push('## Projects');
    for (const x of r.projects) {
      out.push(`### ${x.title.value}`);
      if (x.description.value) out.push(x.description.value);
      if (x.features.length) out.push(x.features.map((a) => `- ${a}`).join('\n'));
      if (x.technologies.length) out.push(`**Technologies:** ${x.technologies.join(', ')}`);
      if (x.url) out.push(`<${x.url}>`);
    }
  }
  if (r.education.length) {
    out.push('## Education');
    for (const e of r.education) out.push(`### ${[e.degree.value, e.field].filter(Boolean).join(', ')}${e.institution.value ? ` — ${e.institution.value}` : ''}${e.startDate || e.endDate ? `\n\n*${range(e.startDate, e.endDate, false)}*` : ''}`);
  }
  if (r.skills.length) out.push(`## Skills\n\n${r.skills.map((s) => s.name).join(', ')}`);
  if (r.certifications.length) out.push(`## Certifications\n\n${r.certifications.map((c) => `- ${[c.name.value, c.issuer, c.date].filter(Boolean).join(' — ')}`).join('\n')}`);
  if (r.achievements.length) out.push(`## Achievements\n\n${r.achievements.map((a) => `- ${[a.title, a.description].filter(Boolean).join(': ')}`).join('\n')}`);
  if (r.languages.length) out.push(`## Languages\n\n${r.languages.map((l) => `- ${l.language}${l.fluency ? ` (${l.fluency})` : ''}`).join('\n')}`);
  return `${out.join('\n\n')}\n`;
}

/* --------------------------- structured sources ---------------------- */

/** The shared, approved data as separate JSON files (Profile.json, Experience.json…). */
export function structuredSources(profile: Profile, library: Library): Record<string, unknown> {
  const { profileImage: _img, ...p } = profile;
  return {
    'profile.json': p,
    'experience.json': library.experience,
    'projects.json': library.projects,
    'education.json': library.education,
    'skills.json': library.skills,
    'certifications.json': library.certifications,
    'achievements.json': library.achievements,
  };
}

/* ---------------------------- library ZIP ---------------------------- */

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';

export interface LibraryEntry {
  doc: KnowledgeDoc;
  extraction: Extraction | null;
  original: Blob | null;
}

/**
 * knowledge-library/
 *   documents/   original files (when still stored)
 *   structured/  approved shared data + per-document semantic JSON
 *   text/        readable text per document
 *   markdown/    Markdown per document
 *   library.json index of documents, folders and tags
 */
export async function libraryZip(entries: LibraryEntry[], profile: Profile, library: Library): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  const unique = (path: string) => {
    let p = path;
    for (let i = 2; used.has(p.toLowerCase()); i++) p = path.replace(/(\.[a-z0-9]+)?$/i, ` (${i})$1`);
    used.add(p.toLowerCase());
    return p;
  };
  const root = 'knowledge-library';
  for (const [name, data] of Object.entries(structuredSources(profile, library))) files[`${root}/structured/${name}`] = strToU8(JSON.stringify(data, null, 2));
  const index: unknown[] = [];
  for (const { doc, extraction, original } of entries) {
    const base = safeName(doc.name.replace(/\.[a-z0-9]+$/i, ''));
    if (original) files[unique(`${root}/documents/${safeName(doc.name)}`)] = new Uint8Array(await original.arrayBuffer());
    if (extraction) {
      files[unique(`${root}/text/${base}.txt`)] = strToU8(exportText(extraction, { pageBreaks: true }));
      files[unique(`${root}/markdown/${base}.md`)] = strToU8(exportMarkdown(extraction));
      files[unique(`${root}/structured/documents/${base}.json`)] = strToU8(JSON.stringify(exportJson(doc, extraction, 'structured'), null, 2));
      if (extraction.semantic.resume) files[unique(`${root}/structured/documents/${base}.semantic.json`)] = strToU8(JSON.stringify(exportJson(doc, extraction, 'semantic'), null, 2));
    }
    index.push({ name: doc.name, type: doc.docType, folder: doc.folder, tags: doc.tags, pages: doc.pageCount, size: doc.size, sha256: doc.hash, originalIncluded: !!original, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
  }
  files[`${root}/library.json`] = strToU8(JSON.stringify({ format: 'portfolio-os-knowledge-library', version: 1, exportedAt: new Date().toISOString(), documents: index }, null, 2));
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export { pageText };
