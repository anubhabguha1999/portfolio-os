import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { docxText, readResumeFile, resumeFileKind } from '@/knowledge/import/resume-file';

const TEXT = `Srijita Saha
Content & SEO Specialist
saha.srijita@example.com | +91 90730 21054 | Kolkata, India

EXPERIENCE
GLBL WriteX Solutions Pvt. Ltd. | Kolkata, West Bengal, India
Subject Matter Expert • 09/2022 – 07/2025
• Authored academic content across essays, dissertations and reports.

EDUCATION
M.Sc. in Geography, University of Kalyani
2021 – 2023

SKILLS
SEO, Content Strategy, Canva, Jira`;

function docx(paras: Array<string | { bullet: string }>): Uint8Array {
  const body = paras
    .map((p) => (typeof p === 'string' ? `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;')}</w:t></w:r></w:p>` : `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>${p.bullet}</w:t></w:r></w:p>`))
    .join('');
  return zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`), '[Content_Types].xml': strToU8('<Types/>') });
}

describe('resume files', () => {
  it('recognises the supported kinds', () => {
    expect(resumeFileKind({ name: 'cv.PDF', type: '' })).toBe('pdf');
    expect(resumeFileKind({ name: 'cv.docx', type: '' })).toBe('docx');
    expect(resumeFileKind({ name: 'cv.md', type: '' })).toBe('text');
    expect(resumeFileKind({ name: 'cv.json', type: '' })).toBe('json');
    expect(resumeFileKind({ name: 'cv.doc', type: 'application/msword' })).toBeNull();
  });

  it('reads a plain-text resume into profile and library', async () => {
    const r = await readResumeFile(new File([TEXT], 'cv.txt', { type: 'text/plain' }));
    expect(r.source).toBe('document');
    expect(r.profile).toMatchObject({ name: 'Srijita Saha', email: 'saha.srijita@example.com' });
    expect(r.library.experience[0]).toMatchObject({ role: 'Subject Matter Expert', company: 'GLBL WriteX Solutions Pvt. Ltd.', start: '2022-09', end: '2025-07' });
    expect(r.library.skills.map((s) => s.name)).toContain('Canva');
  });

  it('reads paragraphs and bullets from a .docx', async () => {
    const bytes = docx([...TEXT.split('\n').filter((l) => !l.startsWith('•')), { bullet: 'Mentored two new writers.' }]);
    expect(docxText(bytes)).toContain('• Mentored two new writers.');
    const r = await readResumeFile(new File([bytes as Uint8Array<ArrayBuffer>], 'cv.docx'));
    expect(r.profile.name).toBe('Srijita Saha');
    expect(r.library.experience).toHaveLength(1);
  });

  it('explains unreadable files', async () => {
    await expect(readResumeFile(new File(['not a zip'], 'cv.docx'))).rejects.toThrow(/not a readable Word/);
    await expect(readResumeFile(new File([''], 'cv.txt'))).rejects.toThrow(/no text/);
  });
});
