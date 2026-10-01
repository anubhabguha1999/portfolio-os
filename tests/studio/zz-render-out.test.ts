import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { RESUME_TEMPLATES } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createResume, createResumeSection, createEntry } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
const OUT = process.env.STUDIO_OUT;
it.skipIf(!OUT)('writes pdfs', () => {
  mkdirSync(OUT!, { recursive: true });
  for (const t of RESUME_TEMPLATES) {
    const resume = createResume('R', { templateId: t.id, style: { ...createResume().style, ...t.defaults, photo: 'none' } });
    resume.sections.push(createResumeSection('languages', { entries: [createEntry({ title: 'English', subtitle: 'Native' }), createEntry({ title: 'German', subtitle: 'C1' })] }));
    const r = resolveResume(resume, sampleLibrary(), sampleProfile());
    const laid = layoutFlow(t.compose(r));
    console.log(t.id, laid.pages.length, JSON.stringify(laid.issues));
    writeFileSync(`${OUT}/${t.id}.pdf`, new Uint8Array(laidPdfBytes(laid, {})));
  }
});
