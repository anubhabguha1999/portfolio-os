// @vitest-environment node
/**
 * Real PDF → PDF.js → layout → semantic, end to end (no mocks of the parser).
 * The PDF is generated with jsPDF so the test has no binary fixtures.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';

const require = createRequire(import.meta.url);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href }));

const { closePdf, openPdf, PdfPasswordError, readMetadata, readPage, looksScanned } = await import('@/knowledge/pdf/pdf');
const { analyse } = await import('@/knowledge/analysis/pipeline');
const { DEFAULT_EXTRACTION_OPTIONS } = await import('@/knowledge/types');

function resumePdf(encryption?: { userPassword: string; ownerPassword: string; userPermissions: Array<'print'> }): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', ...(encryption ? { encryption } : {}) });
  doc.setProperties({ title: 'Jane Doe — Resume', author: 'Jane Doe' });
  let y = 60;
  const line = (t: string, size = 10, bold = false, x = 50) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(t, x, y);
    y += size * 1.45;
  };
  line('Jane Doe', 22, true);
  line('Senior Frontend Engineer', 12);
  line('jane@example.com | +1 415 555 0134 | Austin, TX');
  doc.textWithLink('GitHub', 50, y, { url: 'https://github.com/janedoe' });
  doc.link(120, y - 9, 30, 12, { url: 'javascript:alert(1)' });
  y += 20;
  line('EXPERIENCE', 12, true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Senior Frontend Engineer, Northwind Labs', 50, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Mar 2022 - Present', 545 - doc.getTextWidth('Mar 2022 - Present'), y);
  y += 15;
  line('• Led the ReactJS design system used by 6 product teams.', 10, false, 58);
  line('• Cut bundle size by 38% with Vite and code splitting.', 10, false, 58);
  y += 6;
  line('SKILLS', 12, true);
  line('React.js, TypeScript, Node.js, GraphQL, Figma');
  return doc.output('arraybuffer');
}

describe('PDF extraction end to end', () => {
  it('reads text, fonts, links and metadata, then extracts the resume', async () => {
    const pdf = await openPdf(resumePdf());
    const meta = await readMetadata(pdf);
    const raw = [await readPage(pdf, 1, { images: true, links: true })];
    closePdf(pdf);

    expect(meta).toMatchObject({ title: 'Jane Doe — Resume', author: 'Jane Doe', pageCount: 1 });
    expect(looksScanned(raw[0]!)).toBe(false);
    const name = raw[0]!.items.find((i) => i.text === 'Jane Doe')!;
    expect(name.fontSize).toBeGreaterThan(20);
    expect(name.bold).toBe(true);
    expect(name.y).toBeGreaterThan(30);
    expect(name.y).toBeLessThan(60);

    const out = analyse({ docId: 'd', docName: 'Jane-Resume.pdf', raw, metadata: meta, options: DEFAULT_EXTRACTION_OPTIONS });
    const r = out.semantic.resume!;
    expect(out.semantic.docType).toBe('resume');
    expect(r.profile.name.value).toBe('Jane Doe');
    expect(r.profile.email.value).toBe('jane@example.com');
    expect(r.experience[0]).toMatchObject({ current: true });
    expect(r.experience[0]!.startDate.value).toBe('2022-03');
    expect(r.experience[0]!.company.value).toBe('Northwind Labs');
    expect(r.skills.map((s) => s.name)).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'GraphQL', 'Figma']));
    expect(out.links.some((l) => l.url === 'https://github.com/janedoe' && l.origin === 'annotation' && l.text === 'GitHub')).toBe(true);
    expect(out.links.some((l) => /^javascript:/i.test(l.url))).toBe(false);
  });

  it('asks for a password and opens with the right one', async () => {
    const bytes = resumePdf({ userPassword: 'secret', ownerPassword: 'owner', userPermissions: ['print'] });
    await expect(openPdf(bytes)).rejects.toBeInstanceOf(PdfPasswordError);
    await expect(openPdf(bytes, 'wrong')).rejects.toMatchObject({ incorrect: true });
    const pdf = await openPdf(bytes, 'secret');
    const page = await readPage(pdf, 1, { images: false, links: false });
    closePdf(pdf);
    expect(page.items.some((i) => i.text.includes('Jane Doe'))).toBe(true);
  });
});
