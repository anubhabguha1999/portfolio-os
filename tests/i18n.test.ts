import { describe, it, expect } from 'vitest';
import { DICTIONARIES, DOC_LANGUAGES, LANGUAGES, formatMonthYear, isRtl, localizeHeading, pdfFontNote, t } from '@/i18n';
import { en } from '@/i18n/en';
import { createDocument, createEntry, createLibExperience, createResume, createResumeSection } from '@/studio/model/defaults';
import { resolveResume, formatDate, formatDateRange } from '@/studio/model/resolve';
import { normalizeDocument, normalizeResume } from '@/studio/storage/repo';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { getResumeTemplate, RESUME_TEMPLATES } from '@/studio/templates/resume';
import { composeStudioDocument } from '@/studio/model/compose-document';
import { renderFlowText } from '@/studio/engine/render-text';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import JSZip from 'jszip';
import { unsupportedChars } from '@/studio/engine/measure';
import { createPortfolio } from '@/lib/portfolio-factory';
import { renderPortfolio } from '@/lib/engine/render';
import { buildSitePackage } from '@/lib/html/build';
import type { Library } from '@/studio/model/types';

const KEYS = Object.keys(en).sort();

function library(): Library {
  const lib = sampleLibrary();
  lib.experience = [createLibExperience({ id: 'x1', company: 'Acme', role: 'Engineer', start: '2021-03', end: '', current: true, achievements: ['Shipped things'] })];
  return lib;
}

describe('dictionaries', () => {
  it('every language has every key, none empty', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...DOC_LANGUAGES].sort());
    for (const code of DOC_LANGUAGES) {
      const d = DICTIONARIES[code] as unknown as Record<string, string>;
      expect(Object.keys(d).sort(), code).toEqual(KEYS);
      for (const k of KEYS) expect(d[k]?.trim(), `${code}.${k}`).toBeTruthy();
      // Placeholders survive translation.
      for (const k of KEYS) for (const ph of en[k as keyof typeof en].match(/\{\w+\}/g) ?? []) expect(d[k], `${code}.${k}`).toContain(ph);
    }
  });

  it('PDF warning is given exactly for scripts the core fonts cannot draw', () => {
    for (const l of LANGUAGES) {
      const chars = Object.values(DICTIONARIES[l.code]).flatMap((s) => unsupportedChars(s));
      if (pdfFontNote(l.code)) expect(chars.length, l.code).toBeGreaterThan(0);
      else expect(chars, l.code).toEqual([]);
    }
  });

  it('flags right-to-left languages', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('he')).toBe(true);
    expect(isRtl('ar-EG')).toBe(true);
    expect(isRtl('de')).toBe(false);
    expect(isRtl('en')).toBe(false);
  });

  it('only localises default headings', () => {
    expect(localizeHeading('Experience', 'de')).toBe('Berufserfahrung');
    expect(localizeHeading('Things I built', 'de')).toBe('Things I built');
    expect(localizeHeading('Experience', 'en')).toBe('Experience');
    expect(t('fr', 'pageOfPages', { page: 1, pages: 2 })).toBe('Page 1 sur 2');
  });
});

describe('dates', () => {
  it('keeps English output and formats other locales with Intl', () => {
    expect(formatDate('2024-01', 'short')).toBe('Jan 2024');
    expect(formatDate('2024-01', 'long')).toBe('January 2024');
    expect(formatDate('2024-01', 'numeric')).toBe('01/2024');
    expect(formatDate('2024-03', 'long', 'de')).toBe('März 2024');
    expect(formatDate('2024-03', 'long', 'fr')).toBe('mars 2024');
    expect(formatDate('2024-03', 'long', 'es')).toMatch(/marzo/);
    expect(formatMonthYear(2024, 2, 'long', 'ja')).toBe('2024年3月');
    expect(formatDateRange('2021-03', '', true, 'short', 'de')).toMatch(/^März 2021 – heute$/);
    expect(formatDate('Spring 2024', 'long', 'de')).toBe('Spring 2024');
  });
});

describe('resume language', () => {
  it('prints German default headings but keeps a custom heading', () => {
    const resume = createResume('R');
    resume.style.language = 'de';
    resume.sections.push(createResumeSection('custom', { title: 'Things I built', entries: [createEntry({ title: 'Robot' })] }));
    const r = resolveResume(resume, library(), sampleProfile());
    const titles = r.sections.map((s) => s.title);
    expect(titles).toContain('Berufserfahrung');
    expect(titles).toContain('Ausbildung');
    expect(titles).toContain('Things I built');
    expect(titles).not.toContain('Experience');
    const exp = r.sections.find((s) => s.kind === 'experience')!;
    expect(exp.items[0]!.date).toBe('März 2021 – heute');
    const flow = getResumeTemplate('ats-minimal').compose({ ...r, style: { ...r.style, pageNumbers: true } });
    const txt = renderFlowText(flow);
    expect(txt.toUpperCase()).toContain('BERUFSERFAHRUNG');
    expect(txt.toUpperCase()).toContain('THINGS I BUILT');
    expect(flow.meta.lang).toBe('de-DE');
    expect(flow.footer?.runs[0]?.text).toContain('Seite {page} von {pages}');
  });

  it('leaves English output untouched', () => {
    const resume = createResume('R');
    const r = resolveResume(resume, library(), sampleProfile());
    expect(r.sections.find((s) => s.kind === 'experience')!.title).toBe('Experience');
    const flow = getResumeTemplate('ats-minimal').compose(r);
    expect(flow.dir).toBeUndefined();
    expect(flow.meta.lang).toBeUndefined();
  });

  it('mirrors Arabic resumes (RTL flag, columns and alignment) and warns about PDF fonts', async () => {
    const resume = createResume('R');
    const lib = library();
    const tpl = RESUME_TEMPLATES.find((x) => x.columns === 2)!;
    const ltr = tpl.compose(resolveResume({ ...resume, style: { ...resume.style, ...tpl.defaults, language: 'en' } }, lib, sampleProfile()));
    const rtl = tpl.compose(resolveResume({ ...resume, style: { ...resume.style, ...tpl.defaults, language: 'ar' } }, lib, sampleProfile()));
    expect(rtl.dir).toBe('rtl');
    expect(rtl.meta.lang).toBe('ar');
    // The sidebar column moves to the other side of the page.
    const W = ltr.page.width;
    ltr.columns.forEach((c, i) => expect(rtl.columns[i]!.x).toBeCloseTo(W - c.x - c.width, 5));
    const laid = layoutFlow(rtl);
    expect(laid.pages.length).toBeGreaterThan(0);
    expect(laid.stats.unsupportedChars.length).toBeGreaterThan(0);
    expect(laidPdfBytes(laid, {}).byteLength).toBeGreaterThan(1000);
    // DOCX keeps the Arabic text, as right-to-left paragraphs.
    const docx = await renderFlowDocx(rtl, { images: {} });
    const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:bidi/>');
    expect(xml).toContain('الخبرة');
    expect(pdfFontNote('ar')).toMatch(/Arabic/);
    expect(pdfFontNote('de')).toBeNull();
  });

  it('old resumes and documents without a language load as English', () => {
    const r = normalizeResume({ id: 'old', name: 'Old', sections: [{ kind: 'experience' }], style: { baseSize: 11 } })!;
    expect(r.style.language).toBe('en');
    const d = normalizeDocument({ id: 'd', kind: 'report', page: { paper: 'a4' } })!;
    expect(d.page.language).toBe('en');
    expect(normalizeResume({ id: 'x', style: { language: 'de-AT' } })!.style.language).toBe('de');
    expect(normalizeResume({ id: 'x', style: { language: 'xx' } })!.style.language).toBe('en');
  });
});

describe('letter language', () => {
  it('translates untouched defaults, keeps edited text, localises the date', () => {
    const d = createDocument('cover-letter', 'L');
    d.page.language = 'es';
    d.letter = { ...d.letter!, date: '2026-09-30', role: 'Diseñador', body: 'Hola.' };
    const txt = renderFlowText(composeStudioDocument(d, sampleProfile(), sampleLibrary()));
    expect(txt).toContain('Estimado/a responsable de selección:');
    expect(txt).toContain('Atentamente,');
    expect(txt).toContain('30 de septiembre de 2026');
    d.letter.salutation = 'Hola Ana,';
    const txt2 = renderFlowText(composeStudioDocument(d, sampleProfile(), sampleLibrary()));
    expect(txt2).toContain('Hola Ana,');
  });
});

describe('website language', () => {
  it('export has lang/dir and localised engine strings; embedded data stays original', async () => {
    const p = createPortfolio({ title: 'Site', sections: ['hero', 'experience', 'contact'] });
    p.metadata.language = 'ar';
    p.settings.backToTop = true;
    const { html } = renderPortfolio(p, { mode: 'export', embedData: true });
    expect(html).toMatch(/<html lang="ar" dir="rtl"/);
    expect(html).toContain('انتقل إلى المحتوى');
    expect(html).toContain('العودة إلى الأعلى');
    expect(html).toContain('>الخبرة<');
    expect(html).toContain('"heading":"Experience"');
    const pkg = await buildSitePackage(p, { fontDelivery: 'system', embedData: false }, { inlineExternal: false });
    const notFound = new TextDecoder().decode(pkg.files.find((f) => f.path === '404.html')!.bytes);
    expect(notFound).toMatch(/<html lang="ar" dir="rtl">/);
    expect(notFound).toContain('الصفحة غير موجودة');

    p.metadata.language = 'en';
    const en1 = renderPortfolio(p, { mode: 'export' }).html;
    expect(en1).toMatch(/<html lang="en" class=/);
    expect(en1).toContain('Skip to content');
    expect(en1).toContain('>Experience<');
  });
});
