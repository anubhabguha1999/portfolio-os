// @vitest-environment node
/** A resume exported as PDF here imports back exactly (embedded XMP copy), not re-guessed from layout. */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href }));

const { readResumeFile } = await import('@/knowledge/import/resume-file');
const { composeResume } = await import('@/features/studio/resume/useResumeLayout');
const { layoutFlow } = await import('@/studio/engine/layout');
const { laidPdfBytes } = await import('@/studio/engine/render-pdf');
const { createResume, createResumeSection, createEntry } = await import('@/studio/model/defaults');
const { sampleLibrary, sampleProfile } = await import('@/studio/model/sample');

function pdfOf(templateId: string, metadata = true): File {
  const resume = createResume('R', { templateId });
  resume.sections.push(createResumeSection('languages', { entries: [createEntry({ title: 'English', subtitle: 'Native' })] }));
  const { flow } = composeResume(resume, sampleLibrary(), sampleProfile());
  const laid = layoutFlow(metadata ? flow : { ...flow, data: undefined });
  return new File([new Uint8Array(laidPdfBytes(laid, {}, { metadata }))], 'Alex_Morgan_Resume.pdf', { type: 'application/pdf' });
}

describe('PDF round trip', () => {
  it('imports every printed field back from a two-column template', async () => {
    const lib = sampleLibrary();
    const r = await readResumeFile(pdfOf('navy-sidebar'));
    expect(r.profile.name).toBe(sampleProfile().name);
    expect(r.profile.email).toBe(sampleProfile().email);
    expect(r.library.experience.map((e) => e.role)).toEqual(lib.experience.map((e) => e.role));
    expect(r.library.experience[0]!.achievements).toEqual(lib.experience[0]!.achievements.filter((a) => a.trim()));
    expect(r.library.skills.map((s) => s.name).sort()).toEqual(lib.skills.map((s) => s.name).sort());
    expect(r.entries.languages?.[0]).toMatchObject({ title: 'English', subtitle: 'Native' });
  });

  it('falls back to reading the layout when document metadata was switched off', async () => {
    const r = await readResumeFile(pdfOf('ats-minimal', false));
    expect(r.source).toBe('document');
    expect(r.profile.name).toBe(sampleProfile().name);
  });
});
