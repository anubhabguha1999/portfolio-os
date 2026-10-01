import { describe, expect, it } from 'vitest';
import { createDocument, emptyLetter } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { composeStudioDocument } from '@/studio/model/compose-document';
import { LETTER_TEMPLATES, formatLetterDate } from '@/studio/templates/letter';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import { renderFlowText } from '@/studio/engine/render-text';

describe('cover letter templates', () => {
  for (const t of LETTER_TEMPLATES) {
    it(`${t.id} composes a one-page letter`, async () => {
      const doc = createDocument('cover-letter', 'Letter', {
        templateId: t.id,
        letter: { ...emptyLetter(), recipient: 'Jordan Lee', company: 'Acme Corp', role: 'Staff Engineer', date: '2026-09-30', opening: 'I am writing to apply.', body: 'First paragraph.\n\nSecond paragraph.', closing: 'Thank you.', signature: 'Alex Morgan' },
      });
      const flow = composeStudioDocument(doc, sampleProfile(), sampleLibrary());
      const laid = layoutFlow(flow);
      expect(laid.pages.length).toBe(1);
      const txt = renderFlowText(flow);
      for (const s of ['Jordan Lee', 'Acme Corp', 'Alex Morgan', 'Second paragraph.', '30 September 2026']) expect(txt).toContain(s);
      expect(laidPdfBytes(laid, {}).byteLength).toBeGreaterThan(1000);
      expect((await renderFlowDocx(flow, { images: {} })).byteLength).toBeGreaterThan(1000);
      expect(flow.meta.title).toContain('Cover Letter');
    });
  }

  it('formats ISO dates and keeps free text', () => {
    expect(formatLetterDate('2026-01-05')).toBe('5 January 2026');
    expect(formatLetterDate('Spring 2026')).toBe('Spring 2026');
  });
});
