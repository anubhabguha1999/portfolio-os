import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import { getResumeTemplate } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createResume } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';

describe('DOCX output', () => {
  it('uses real headings, lists, hyperlinks and metadata', async () => {
    const r = resolveResume(createResume('R'), sampleLibrary(), sampleProfile());
    const buf = await renderFlowDocx(getResumeTemplate('ats-minimal').compose(r), { images: {} });
    const files = unzipSync(new Uint8Array(buf));
    const xml = strFromU8(files['word/document.xml']!);
    expect(xml).toContain('Alex Morgan');
    expect(xml).toMatch(/w:pStyle w:val="Heading1"/);
    expect(xml).toMatch(/w:pStyle w:val="Title"/);
    expect(xml).toContain('<w:numPr>');
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toContain('Northwind Health');
    const core = strFromU8(files['docProps/core.xml']!);
    expect(core).toMatch(/<dc:title>Alex Morgan/);
    expect(core).toMatch(/<dc:creator>Alex Morgan<\/dc:creator>/);
  });

  it('renders two-column templates as editable tables, not images', async () => {
    const r = resolveResume(createResume('R', { templateId: 'modern-professional' }), sampleLibrary(), sampleProfile());
    const buf = await renderFlowDocx(getResumeTemplate('modern-professional').compose(r), { images: {} });
    const xml = strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']!);
    expect(xml).toContain('<w:tbl>');
    expect(xml).not.toContain('<w:drawing>');
    expect(xml).toContain('TypeScript');
  });
});
