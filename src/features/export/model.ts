import type { Portfolio } from '@/types/portfolio';
import type { DocxExportOptions, HtmlExportOptions, PdfExportOptions, ZipExportOptions } from '@/lib/export';

export type FormatId = 'html' | 'zip' | 'pdf' | 'docx' | 'json' | 'resume';

export const FORMAT_IDS: readonly FormatId[] = ['html', 'zip', 'pdf', 'docx', 'json', 'resume'];

export function isFormatId(v: string | null): v is FormatId {
  return !!v && (FORMAT_IDS as readonly string[]).includes(v);
}

/** Every concrete export action (a format can offer more than one). */
export type ExportTarget = 'html' | 'zip' | 'json' | 'pdf' | 'docx' | 'resume-pdf' | 'resume-docx';

export const TARGET_LABEL: Record<ExportTarget, string> = {
  html: 'HTML file',
  zip: 'Website ZIP',
  json: 'JSON backup',
  pdf: 'PDF',
  docx: 'Word document',
  'resume-pdf': 'Resume PDF',
  'resume-docx': 'Resume DOCX',
};

export interface ResumeSettings {
  length: 'one-page' | 'two-page' | 'full';
  template: 'classic' | 'modern' | 'ats';
  includePhoto: boolean;
  pageNumbers: boolean;
  pageSize: 'a4' | 'letter';
}

export interface StudioOptions {
  html: HtmlExportOptions;
  zip: ZipExportOptions;
  pdf: PdfExportOptions;
  docx: DocxExportOptions;
  resume: ResumeSettings;
}

export function defaultOptions(p: Portfolio): StudioOptions {
  const fontDelivery = p.settings.fontDelivery;
  const letter = typeof navigator !== 'undefined' && /^en-(US|CA)$/i.test(navigator.language || '');
  return {
    html: { fontDelivery, embedData: false },
    zip: { fontDelivery, embedData: false, includeProjectJson: true },
    pdf: {
      mode: 'portfolio',
      resumeLength: 'one-page',
      resumeTemplate: 'modern',
      pageSize: letter ? 'letter' : 'a4',
      customSize: { width: 210, height: 297 },
      orientation: 'portrait',
      margins: 18,
      headerText: '',
      footerText: '',
      pageNumbers: true,
      sectionPageBreaks: false,
      // Text-only by default; images are opt-in via the “Include images” switch.
      includeImages: false,
    },
    docx: { mode: 'resume', resumeLength: 'two-page', resumeTemplate: 'modern', includeImages: false, pageNumbers: true },
    resume: { length: 'one-page', template: 'modern', includePhoto: false, pageNumbers: false, pageSize: letter ? 'letter' : 'a4' },
  };
}

export function resumePdfOptions(r: ResumeSettings): PdfExportOptions {
  return {
    mode: 'resume',
    resumeLength: r.length,
    resumeTemplate: r.template,
    pageSize: r.pageSize,
    customSize: { width: 210, height: 297 },
    orientation: 'portrait',
    margins: r.template === 'ats' ? 18 : 16,
    headerText: '',
    footerText: '',
    pageNumbers: r.pageNumbers,
    sectionPageBreaks: false,
    includeImages: r.includePhoto && r.template !== 'ats',
  };
}

export function resumeDocxOptions(r: ResumeSettings): DocxExportOptions {
  return { mode: 'resume', resumeLength: r.length, resumeTemplate: r.template, includeImages: r.includePhoto && r.template !== 'ats', pageNumbers: r.pageNumbers };
}
