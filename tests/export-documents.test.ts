import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { createPortfolio } from '@/lib/portfolio-factory';
import { useAssets } from '@/stores/assets';
import { exportPdf, exportDocx, type PdfExportOptions } from '@/lib/export';
import { renderPdf, pdfText } from '@/lib/pdf';
import type { PdfRenderOptions } from '@/lib/pdf/types';
import type { DocModel } from '@/types/document';
import type { Portfolio } from '@/types/portfolio';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBlob = () => new Blob([Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0))], { type: 'image/png' });

function fixture(): Portfolio {
  const p = createPortfolio({ title: 'Ada Portfolio', sections: ['hero', 'about', 'experience', 'projects', 'skills', 'contact', 'social'] });
  for (const s of p.sections) {
    if (s.type === 'hero') {
      s.data.name = 'Ada Lovelace';
      s.data.title = 'Analyst — “Engines” & Notes';
      s.data.image = { src: 'asset:img_1', alt: 'Portrait of Ada' };
    }
    if (s.type === 'about') s.data.body = 'I translate and annotate papers on the Analytical Engine. I care about clear writing.';
    if (s.type === 'experience') {
      const it = s.data.items[0]!;
      Object.assign(it, { role: 'Mathematician', company: 'Babbage & Co', location: 'London', start: '1842-01', end: '1843-09', current: false, achievements: ['Published the first algorithm', 'Wrote extensive notes'], technologies: ['Mathematics'] });
    }
    if (s.type === 'projects') {
      const it = s.data.items[0]!;
      Object.assign(it, { title: 'Note G', description: 'An algorithm for Bernoulli numbers.', live: 'https://example.com/note-g', image: { src: 'asset:img_1', alt: 'Diagram' } });
    }
    if (s.type === 'contact') s.data.email = 'ada@example.com';
  }
  return p;
}

const pdfOptions = (over: Partial<PdfExportOptions> = {}): PdfExportOptions => ({
  mode: 'resume',
  resumeLength: 'one-page',
  resumeTemplate: 'modern',
  pageSize: 'a4',
  customSize: { width: 210, height: 297 },
  orientation: 'portrait',
  margins: 18,
  headerText: '',
  footerText: '',
  pageNumbers: false,
  sectionPageBreaks: false,
  includeImages: true,
  ...over,
});

const latin1 = async (blob: Blob) => new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));

beforeEach(() => {
  useAssets.setState({ projectId: null, blobs: {}, meta: {}, urls: {}, loaded: false });
});

function withAssets(p: Portfolio) {
  useAssets.setState({ projectId: p.id, blobs: { img_1: pngBlob() }, meta: { img_1: { id: 'img_1', name: 'a.png', mime: 'image/png', size: 68, width: 1, height: 1 } }, urls: {}, loaded: true });
}

const env = { useWorker: false, compress: false, fetcher: async () => null };

describe('PDF export', () => {
  it('produces a real PDF with vector text, links, metadata and page numbers', async () => {
    const p = fixture();
    withAssets(p);
    const stages: string[] = [];
    const res = await exportPdf(p, pdfOptions({ pageNumbers: true, footerText: 'Confidential', headerText: 'Resume' }), (s) => stages.push(s.stage), env);
    const raw = await latin1(res.blob);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(res.filename).toBe('ada-lovelace-resume.pdf');
    expect(res.pageCount).toBe(1);
    expect(raw).toContain('(Ada Lovelace) Tj');
    expect(raw).toContain('/URI (mailto:ada@example.com)');
    expect(raw).toContain('(Page 1 of 1) Tj');
    expect(raw).toMatch(/\/Title \(/);
    expect(raw).toMatch(/\/Author \(Ada Lovelace\)/);
    // Smart punctuation is normalised to WinAnsi-safe characters.
    expect(raw).toContain('Analyst - "Engines" & Notes');
    expect(stages[0]).toBe('Preparing document…');
    expect(stages.some((s) => s.startsWith('Rendering pages…'))).toBe(true);
    expect(stages).toContain('Generating PDF…');
    expect(stages[stages.length - 1]).toBe('Done');
  });

  it('embeds images in the portfolio PDF and honours page size', async () => {
    const p = fixture();
    withAssets(p);
    const res = await exportPdf(p, pdfOptions({ mode: 'portfolio', pageSize: 'letter', orientation: 'landscape', sectionPageBreaks: true }), undefined, env);
    const raw = await latin1(res.blob);
    expect(raw).toContain('/Subtype /Image');
    expect(raw).toMatch(/\/MediaBox \[0 0 792\.?\d* 612\.?\d*\]/);
    expect(res.pageCount).toBeGreaterThan(1);
    expect(raw).toContain('/URI (https://example.com/note-g)');
  });

  it('ATS resumes contain no images', async () => {
    const p = fixture();
    withAssets(p);
    const res = await exportPdf(p, pdfOptions({ resumeTemplate: 'ats' }), undefined, env);
    const raw = await latin1(res.blob);
    expect(raw).not.toContain('/Subtype /Image');
    expect(raw).toContain('(WORK EXPERIENCE) Tj');
  });

  it('fits content to the target page count by scaling, and reports overflow', () => {
    const base: PdfRenderOptions = {
      pageSize: 'a4',
      customSize: { width: 210, height: 297 },
      orientation: 'portrait',
      margins: 18,
      headerText: '',
      footerText: '',
      pageNumbers: false,
      sectionPageBreaks: false,
      includeImages: false,
      template: 'modern',
      fitPages: null,
      compress: false,
    };
    const model = (paragraphs: number): DocModel => ({
      kind: 'resume',
      title: 'Fit test',
      author: 'Ada Lovelace',
      subject: '',
      keywords: [],
      header: { name: 'Ada Lovelace', headline: 'Engineer', contact: [] },
      theme: { primary: '#2563eb', text: '#111827', muted: '#4b5563', border: '#d1d5db', font: 'helvetica' },
      sections: [
        {
          id: 's',
          title: 'Notes',
          blocks: Array.from({ length: paragraphs }, (_, i) => ({ kind: 'paragraph' as const, runs: [{ text: `Paragraph ${i + 1}. The engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves, one card at a time.` }] })),
        },
      ],
    });
    // Find the smallest content that just overflows one page at natural size.
    let n = 10;
    while (renderPdf(model(n), {}, base).pageCount < 2) n++;
    const fitted = renderPdf(model(n), {}, { ...base, fitPages: 1 });
    expect(fitted.pageCount).toBe(1);
    expect(fitted.scale).toBeLessThan(1);
    expect(fitted.scale).toBeGreaterThanOrEqual(0.78);
    expect(fitted.overflow).toBe(false);

    const huge = renderPdf(model(n * 4), {}, { ...base, fitPages: 1 });
    expect(huge.overflow).toBe(true);
    expect(huge.scale).toBe(0.78);
    expect(huge.pageCount).toBeGreaterThan(1);
  });

  it('keeps headings with the following content', () => {
    const lines = Array.from({ length: 200 }, (_, i) => ({ kind: 'paragraph' as const, runs: [{ text: `Line ${i}` }] }));
    const doc: DocModel = {
      kind: 'portfolio',
      title: 't',
      author: 'a',
      subject: '',
      keywords: [],
      header: null,
      theme: { primary: '#2563eb', text: '#111827', muted: '#4b5563', border: '#d1d5db', font: 'helvetica' },
      sections: [
        { id: 'a', title: 'First', blocks: lines.slice(0, 53) },
        { id: 'b', title: 'SecondHeading', blocks: lines.slice(53, 60) },
      ],
    };
    const raw = new TextDecoder('latin1').decode(
      new Uint8Array(
        renderPdf(doc, {}, { pageSize: 'a4', customSize: { width: 210, height: 297 }, orientation: 'portrait', margins: 18, headerText: '', footerText: '', pageNumbers: false, sectionPageBreaks: false, includeImages: false, template: 'portfolio', fitPages: null, compress: false }).buffer,
      ),
    );
    // Split into page content streams and make sure the heading never ends a page.
    const pages = raw.split(/\/Type \/Page\b(?!s)/);
    for (const pg of pages) {
      const texts = [...pg.matchAll(/\(([^)]*)\) Tj/g)].map((m) => m[1]);
      if (texts.length) expect(texts[texts.length - 1]).not.toBe('SecondHeading');
    }
  });

  it('normalises text for WinAnsi fonts', () => {
    expect(pdfText('\u201cHi\u201d \u2014 it\u2019s\u2026 \u2022 ok\u00a0\u{1F44B} caf\u00e9 \u0141\u00f3d\u017a')).toBe('"Hi" - it\'s... \u00b7 ok  caf\u00e9 L\u00f3dz');
  });
});

describe('DOCX export', () => {
  it('produces an editable Word document with headings, links and the name', async () => {
    const p = fixture();
    withAssets(p);
    const res = await exportDocx(p, { mode: 'resume', resumeLength: 'two-page', resumeTemplate: 'modern', includeImages: false, pageNumbers: true }, undefined, env);
    const bytes = new Uint8Array(await res.blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
    expect(res.filename).toBe('ada-lovelace-resume.docx');
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Ada Lovelace');
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>/);
    expect(xml).toMatch(/<w:numPr>/);
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    expect(rels).toContain('mailto:ada@example.com');
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).toContain('Ada Lovelace');
    const footers = Object.keys(zip.files).filter((f) => /^word\/footer\d*\.xml$/.test(f));
    expect(footers.length).toBeGreaterThan(0);
    const footerXml = await zip.file(footers[0]!)!.async('string');
    expect(footerXml).toContain('NUMPAGES');
  });

  it('embeds images in the full portfolio document', async () => {
    const p = fixture();
    withAssets(p);
    const res = await exportDocx(p, { mode: 'portfolio', resumeLength: 'full', resumeTemplate: 'modern', includeImages: true, pageNumbers: false }, undefined, env);
    const zip = await JSZip.loadAsync(new Uint8Array(await res.blob.arrayBuffer()));
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Note G');
    expect(xml).toContain('<w:tab/>');
  });
});
