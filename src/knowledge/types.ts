/* ------------------------------------------------------------------ *
 * PDF Intelligence + Local Knowledge Library — data model.
 *
 *   file (.pdf .txt .md .json)
 *     │  parse locally (PDF.js / OCR / text)
 *     ↓
 *   RawPage[]  ──▶  analyse (worker)  ──▶  Extraction
 *                                             ├── pages → blocks (structure)
 *                                             ├── links, metadata
 *                                             └── semantic (resume fields + confidence + provenance)
 *                                                    │ human review
 *                                                    ↓
 *                                        shared Profile + Library (source of truth)
 *
 * Everything is stored in IndexedDB on this device. Nothing is uploaded.
 * ------------------------------------------------------------------ */

import type { LibraryKind } from '@/studio/model/types';

export type KnowledgeFileKind = 'pdf' | 'txt' | 'md' | 'json';

export type DocumentType = 'resume' | 'cv' | 'portfolio' | 'certificate' | 'report' | 'invoice' | 'article' | 'book' | 'technical' | 'other';

export const DOCUMENT_TYPES: Array<{ id: DocumentType; label: string }> = [
  { id: 'resume', label: 'Resume' },
  { id: 'cv', label: 'CV' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'report', label: 'Report' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'article', label: 'Article' },
  { id: 'book', label: 'Book' },
  { id: 'technical', label: 'Technical documentation' },
  { id: 'other', label: 'Other' },
];

export const DEFAULT_FOLDERS = ['Resume', 'Projects', 'Education', 'Certificates', 'Documents'] as const;

export const DEFAULT_TAGS = ['resume', 'experience', 'project', 'certificate', 'education', 'personal', 'technical'] as const;

export type DocStatus = 'new' | 'processing' | 'needs-ocr' | 'needs-review' | 'completed' | 'failed';

/** A document in the library. The original bytes live separately (and can be deleted). */
export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: KnowledgeFileKind;
  mime: string;
  size: number;
  /** SHA-256 of the original bytes: detects re-imports of the same or a newer file. */
  hash: string;
  pageCount: number;
  docType: DocumentType;
  /** Whether docType was chosen by the user (true) or detected (false). */
  docTypeLocked: boolean;
  folder: string;
  tags: string[];
  status: DocStatus;
  error: string | null;
  /** Original file still stored? */
  hasOriginal: boolean;
  /** Current extraction version id (null until processed). */
  currentVersion: string | null;
  /** Earlier document this one replaces or was kept beside (re-import of a newer file). */
  previousOf: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBlob {
  id: string;
  blob: Blob;
}

/* ------------------------------ raw parse ---------------------------- */

/** One positioned run of text as the parser gives it. Coordinates are PDF points, origin top-left. */
export interface RawTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  /** OCR word confidence 0–1; absent for real PDF text. */
  confidence?: number;
}

export interface RawLink {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawImage {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawPage {
  page: number;
  width: number;
  height: number;
  items: RawTextItem[];
  links: RawLink[];
  images: RawImage[];
  /** Text came from OCR. */
  ocr: boolean;
  /** Plain text / Markdown: every line break was typed by the author, so lines are never re-joined. */
  hardBreaks?: boolean;
}

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string | null;
  modificationDate: string | null;
  pageCount: number;
  pdfVersion: string;
  encrypted: boolean;
}

/* ------------------------------ structure ---------------------------- */

export type BlockType = 'title' | 'heading' | 'subheading' | 'paragraph' | 'list' | 'table' | 'image' | 'header' | 'footer';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedLine extends Box {
  text: string;
  fontSize: number;
  bold: boolean;
  /** Lowest OCR word confidence on the line, when OCR produced it. */
  confidence?: number;
  words?: Array<Box & { text: string; confidence?: number }>;
}

export interface ExtractedBlock extends Box {
  id: string;
  page: number;
  type: BlockType;
  text: string;
  lines: ExtractedLine[];
  /** list blocks */
  items?: string[];
  /** table blocks */
  rows?: string[][];
  /** Table detection is a heuristic; true when the column grid is irregular. */
  uncertain?: boolean;
  level?: 1 | 2 | 3;
  /** Lowest OCR confidence inside the block (0–1). */
  confidence?: number;
}

export interface ExtractedLink {
  text: string;
  url: string;
  page: number;
  /** Where the link came from: a PDF annotation or a URL written in the text. */
  origin: 'annotation' | 'text';
}

export interface ExtractedPage {
  page: number;
  width: number;
  height: number;
  ocr: boolean;
  /** See RawPage.hardBreaks. */
  hardBreaks?: boolean;
  blocks: ExtractedBlock[];
}

/* ------------------------------ semantic ----------------------------- */

export interface Provenance {
  docId: string;
  docName: string;
  page: number;
  blockId: string | null;
}

/** A detected value with how sure the rules are and where it came from. */
export interface SemanticField<T = string> {
  value: T;
  confidence: number;
  source: Provenance | null;
  /** Original text before normalisation (e.g. "React.js" → "React"). */
  original?: string;
}

export interface SemanticExperience {
  company: SemanticField;
  role: SemanticField;
  location: SemanticField;
  startDate: SemanticField<string | null>;
  endDate: SemanticField<string | null>;
  current: boolean;
  description: SemanticField;
  achievements: string[];
  technologies: string[];
}

export interface SemanticProject {
  title: SemanticField;
  description: SemanticField;
  technologies: string[];
  url: string;
  features: string[];
}

export interface SemanticEducation {
  institution: SemanticField;
  degree: SemanticField;
  field: string;
  startDate: string | null;
  endDate: string | null;
  grade: string;
}

export interface SemanticSkill {
  name: string;
  original: string;
  category: string;
  confidence: number;
  source: Provenance | null;
}

export interface SemanticCertification {
  name: SemanticField;
  issuer: string;
  date: string;
  url: string;
}

export interface SemanticResume {
  profile: {
    name: SemanticField;
    headline: SemanticField;
    email: SemanticField;
    phone: SemanticField;
    location: SemanticField;
    website: SemanticField;
    github: SemanticField;
    linkedin: SemanticField;
    summary: SemanticField;
  };
  socialLinks: Array<{ platform: string; url: string; source: Provenance | null }>;
  experience: SemanticExperience[];
  education: SemanticEducation[];
  projects: SemanticProject[];
  skills: SemanticSkill[];
  certifications: SemanticCertification[];
  achievements: Array<{ title: string; description: string; date: string }>;
  languages: Array<{ language: string; fluency: string }>;
}

export interface SemanticData {
  docType: DocumentType;
  /** How sure the classifier is about docType (0–1). */
  docTypeConfidence: number;
  /** Present when the document looks like a resume or CV. */
  resume: SemanticResume | null;
}

/* ----------------------------- extraction ---------------------------- */

export interface ExtractionOptions {
  text: boolean;
  metadata: boolean;
  links: boolean;
  tables: boolean;
  images: boolean;
  structure: boolean;
  ocr: 'auto' | 'always' | 'never';
  semantic: 'auto' | 'resume' | 'portfolio' | 'generic';
  /** 1-based page numbers; null = all pages. */
  pages: number[] | null;
  password?: string;
}

export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  text: true,
  metadata: true,
  links: true,
  tables: true,
  images: true,
  structure: true,
  ocr: 'auto',
  semantic: 'auto',
  pages: null,
};

export interface OcrSummary {
  pages: number;
  words: number;
  /** Mean word confidence 0–1. */
  confidence: number;
  /** Words below the review threshold. */
  uncertain: Array<{ page: number; blockId: string; text: string; confidence: number }>;
}

export interface Extraction {
  id: string;
  docId: string;
  version: number;
  label: string;
  /** 'extraction' = produced by the engine; 'corrections' = user edits saved on top. */
  origin: 'extraction' | 'corrections';
  createdAt: string;
  options: ExtractionOptions;
  metadata: PdfMetadata | null;
  pages: ExtractedPage[];
  links: ExtractedLink[];
  semantic: SemanticData;
  ocr: OcrSummary | null;
  warnings: string[];
  stats: { pages: number; words: number; blocks: number; tables: number; images: number; links: number };
}

/* ------------------------------ provenance --------------------------- */

/** Where an imported library item or profile field came from, and its value at import time. */
export interface ProvenanceRecord {
  key: string;
  kind: LibraryKind | 'profile';
  itemId: string;
  field: string;
  original: unknown;
  source: Provenance;
  importedAt: string;
}

/* -------------------------------- search ----------------------------- */

export interface SearchHit {
  docId: string;
  docName: string;
  page: number;
  blockId: string | null;
  /** Where the match is: file name, body text, JSON field, metadata or a tag. */
  field: 'name' | 'text' | 'json' | 'metadata' | 'tag';
  snippet: string;
  score: number;
}
