import { describe, expect, it } from 'vitest';
import { analyse } from '@/knowledge/analysis/pipeline';
import { exportJson } from '@/knowledge/export/formats';
import { DEFAULT_EXTRACTION_OPTIONS, type Extraction, type KnowledgeDoc, type RawPage, type RawTextItem } from '@/knowledge/types';
import { parseResumeJson } from '@/studio/import/resume-json';

/** Sidebar on the left (Contact, Skills, Education), name + experience in the right column. */
function twoColumnResume(): RawPage {
  const items: RawTextItem[] = [];
  const put = (text: string, x: number, y: number, size = 9, bold = false) => items.push({ text, x, y, width: text.length * size * 0.42, height: size, fontSize: size, fontName: 'F', bold });
  put('CONTACT', 13, 118, 9.5, true);
  put('saha.srijita@example.com', 13, 139);
  put('+91 90730 21054', 13, 151);
  put('SKILLS', 13, 191, 9.5, true);
  put('SEO, Content Strategy, Canva, Jira', 13, 211);
  put('EDUCATION', 13, 511, 9.5, true);
  put('M.Sc. in Geography', 13, 534, 9.5, true);
  put('2021 – 2023 University of Kalyani', 13, 546, 8.5);
  put('SRIJITA SAHA', 211, 12, 23, true);
  put('CONTENT & SEO SPECIALIST', 211, 41, 11);
  put('WORK EXPERIENCE', 211, 309, 12, true);
  put('GLBL WriteX Solutions Pvt. Ltd. | Kolkata, West Bengal, India', 211, 338, 10.25, true);
  put('Subject Matter Expert • 09/2022 – 07/2025', 211, 351, 10.25);
  put('• Authored academic content across essays, dissertations, reports and case studies for global clients.', 211, 369, 10);
  return { page: 1, width: 612, height: 792, items, links: [], images: [], ocr: false };
}

const doc = { id: 'kd', name: 'Srijita Saha Final Resume.pdf', kind: 'pdf', hash: 'h' } as KnowledgeDoc;
const extraction = (): Extraction => ({ ...analyse({ docId: 'kd', docName: doc.name, raw: [twoColumnResume()], metadata: null, options: DEFAULT_EXTRACTION_OPTIONS }), id: 'x', docId: 'kd', version: 1, label: 'v1', origin: 'extraction', createdAt: '2026-10-01T00:00:00Z' });

describe('two-column resumes', () => {
  it('takes the large name in the main column, not the first sidebar heading', () => {
    const r = extraction().semantic.resume!;
    expect(r.profile.name.value).toBe('Srijita Saha');
    expect(r.profile.headline.value).toBe('CONTENT & SEO SPECIALIST');
    expect(r.experience[0]).toMatchObject({ role: { value: 'Subject Matter Expert' }, company: { value: 'GLBL WriteX Solutions Pvt. Ltd.' }, location: { value: 'Kolkata, West Bengal, India' } });
  });
});

describe('re-importing PDF Intelligence JSON exports', () => {
  it('imports a structured export in Resume Studio', () => {
    const json = JSON.stringify(exportJson(doc, extraction(), 'structured'));
    const r = parseResumeJson(json);
    expect(r.profile.name).toBe('Srijita Saha');
    expect(r.profile.email).toBe('saha.srijita@example.com');
    expect(r.library.experience[0]).toMatchObject({ role: 'Subject Matter Expert', company: 'GLBL WriteX Solutions Pvt. Ltd.', start: '2022-09', end: '2025-07' });
    expect(r.warnings.join(' ')).toMatch(/local rules/);
  });

  it('still reads older structured exports without per-line data', () => {
    const data = exportJson(doc, extraction(), 'structured') as unknown as { pages: Array<{ blocks: Array<Record<string, unknown>> }> };
    for (const p of data.pages) for (const b of p.blocks) delete b.lines;
    expect(parseResumeJson(JSON.stringify(data)).profile.name).toBe('Srijita Saha');
  });

  it('imports a semantic export', () => {
    const r = parseResumeJson(JSON.stringify(exportJson(doc, extraction(), 'semantic')));
    expect(r.profile.name).toBe('Srijita Saha');
    expect(r.library.skills.map((s) => s.name)).toContain('Canva');
  });

  it('explains when an export has no resume content', () => {
    const data = { ...exportJson(doc, extraction(), 'semantic'), resume: null };
    expect(() => parseResumeJson(JSON.stringify(data))).toThrow(/no resume content/);
  });
});
