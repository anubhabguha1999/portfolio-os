import { describe, it, expect } from 'vitest';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { layoutFlow } from '@/studio/engine/layout';
import { getResumeTemplate } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createResume } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import type { PaperSize } from '@/studio/model/types';

function pdfText(paper: PaperSize): string {
  const resume = createResume('R');
  resume.style.paper = paper;
  const laid = layoutFlow(getResumeTemplate('ats-minimal').compose(resolveResume(resume, sampleLibrary(), sampleProfile())));
  return new TextDecoder('latin1').decode(laidPdfBytes(laid, {}, { compress: false }));
}

describe('PDF output', () => {
  it('is a real text document with links and metadata', () => {
    const s = pdfText('a4');
    expect(s.startsWith('%PDF-')).toBe(true);
    expect(s).toMatch(/\(Alex Morgan\) Tj/);
    expect(s).toContain('/URI');
    expect(s).toContain('mailto:alex.morgan@example.com');
    expect(s).toContain('/Title');
    expect(s).toContain('/Author');
    expect(s).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
  });

  it('uses US Letter dimensions when chosen', () => {
    expect(pdfText('letter')).toMatch(/\/MediaBox \[0 0 612(\.0*)? 792(\.0*)?\]/);
  });
});
