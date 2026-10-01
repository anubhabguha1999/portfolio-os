import { describe, it, expect } from 'vitest';
import { RESUME_TEMPLATES } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createResume, createResumeSection, createEntry } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import { renderFlowText } from '@/studio/engine/render-text';

describe('engine smoke', () => {
  for (const t of RESUME_TEMPLATES) {
    it(`renders ${t.id}`, async () => {
      const resume = createResume('R', { templateId: t.id, style: { ...createResume().style, ...t.defaults } });
      resume.sections.push(createResumeSection('languages', { entries: [createEntry({ title: 'English', subtitle: 'Native' }), createEntry({ title: 'German', subtitle: 'C1' })] }));
      const r = resolveResume(resume, sampleLibrary(), sampleProfile());
      const flow = t.compose(r);
      const laid = layoutFlow(flow);
      expect(laid.pages.length).toBeGreaterThan(0);
      const pdf = laidPdfBytes(laid, {}, { compress: false });
      expect(pdf.byteLength).toBeGreaterThan(1000);
      const docx = await renderFlowDocx(flow, { images: {} });
      expect(docx.byteLength).toBeGreaterThan(1000);
      const txt = renderFlowText(flow);
      expect(txt.toLowerCase()).toContain('alex morgan');
      expect(txt).toContain('Northwind Health');
      console.log(t.id, 'pages', laid.pages.length, 'issues', laid.issues.map(i => i.kind).join(','), 'fill', laid.stats.lastPageRatio.toFixed(2));
    });
  }
});
