/**
 * Intermediate document model shared by the PDF and DOCX renderers.
 * Portfolio → DocModel → (PDF | DOCX). Never a screenshot.
 */
export interface DocRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

export type DocBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; runs: DocRun[]; tone?: 'lead' | 'muted' | 'small' }
  | { kind: 'list'; ordered: boolean; items: DocRun[][] }
  | { kind: 'image'; src: string; alt: string; caption?: string; maxWidthRatio?: number }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | {
      kind: 'entry';
      title: string;
      subtitle?: string;
      meta?: string;
      location?: string;
      link?: string;
      body: DocBlock[];
    }
  | { kind: 'tags'; label?: string; items: string[] }
  | { kind: 'quote'; text: string; cite?: string }
  | { kind: 'contact'; items: DocRun[] }
  | { kind: 'divider' }
  | { kind: 'pageBreak' };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocTheme {
  primary: string;
  text: string;
  muted: string;
  border: string;
  font: 'helvetica' | 'times' | 'courier';
}

export interface DocModel {
  kind: 'portfolio' | 'resume';
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  header: { name: string; headline: string; contact: DocRun[]; photo?: string } | null;
  sections: DocSection[];
  theme: DocTheme;
}
