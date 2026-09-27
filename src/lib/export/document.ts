import type { DocModel, DocRun } from '@/types/document';
import type { Portfolio } from '@/types/portfolio';
import { buildPortfolioDocument } from '@/lib/document/build';
import { buildResumeDocument } from '@/lib/document/resume';
import type { DocTemplate } from '@/lib/pdf/types';

export interface DocumentSpec {
  mode: 'portfolio' | 'resume';
  resumeLength: 'one-page' | 'two-page' | 'full';
  resumeTemplate: 'classic' | 'modern' | 'ats';
  includeImages: boolean;
}

export function templateOf(spec: Pick<DocumentSpec, 'mode' | 'resumeTemplate'>): DocTemplate {
  return spec.mode === 'portfolio' ? 'portfolio' : spec.resumeTemplate;
}

const plain = (runs: DocRun[]) => runs.map((r) => r.text).join('').trim().toLowerCase();

/** The DocModel an export renders (shared by PDF, DOCX and the studio outline). */
export function buildExportDocument(p: Portfolio, spec: DocumentSpec): DocModel {
  if (spec.mode === 'resume') {
    return buildResumeDocument(p, {
      length: spec.resumeLength,
      template: spec.resumeTemplate,
      includeProjects: true,
      includePhoto: spec.includeImages && spec.resumeTemplate !== 'ats',
    });
  }
  const doc = buildPortfolioDocument(p, { includeImages: spec.includeImages });
  // The header already shows the hero headline; drop the duplicate lead line from the intro.
  const intro = doc.sections[0];
  const headline = doc.header?.headline.trim().toLowerCase();
  if (intro && intro.id === 'intro' && headline) {
    const first = intro.blocks[0];
    if (first && first.kind === 'paragraph' && plain(first.runs) === headline) {
      const rest = intro.blocks.slice(1);
      doc.sections = rest.length ? [{ ...intro, blocks: rest }, ...doc.sections.slice(1)] : doc.sections.slice(1);
    }
  }
  return doc;
}

export function fitTargetOf(spec: Pick<DocumentSpec, 'mode' | 'resumeLength'>): number | null {
  if (spec.mode !== 'resume') return null;
  return spec.resumeLength === 'one-page' ? 1 : spec.resumeLength === 'two-page' ? 2 : null;
}
