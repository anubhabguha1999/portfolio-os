/* ------------------------------------------------------------------ *
 * Studio data model — shared by Profile, Resume and Document Studio.
 *
 *            SHARED PROFILE + LIBRARY
 *                     │
 *       ┌─────────────┼──────────────┐
 *   Portfolio      Resumes      Documents / Cover letters
 *
 * The library holds entities that several outputs reuse (experience, projects…).
 * Resumes reference library items by id and may *detach* individual fields, which
 * are then stored on the resume only.
 * ------------------------------------------------------------------ */

/* ------------------------------ Images ------------------------------ */

/** The original upload. Its bytes live once in the `images` store; everything else is derived. */
export interface ImageAsset {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
  /** Point of interest (fractions of the original) used by smart fit. */
  focal: { x: number; y: number };
  /** Detected or user-set face box (fractions), when known. */
  face?: { x: number; y: number; w: number; h: number } | null;
}

export type AspectKey = '1:1' | '4:5' | '3:4' | '16:9' | 'custom';

export type ProfileShape = 'circle' | 'rounded' | 'square' | 'portrait' | 'hexagon' | 'diamond' | 'custom';

export interface ImageAdjustments {
  /** −100…100, 0 = neutral. */
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  /** 0…100 */
  blur: number;
  sharpness: number;
}

export type ImageFilter = 'none' | 'mono' | 'duotone' | 'sepia';

export type BackgroundKind = 'original' | 'transparent' | 'white' | 'black' | 'color' | 'gradient' | 'blurred';

export interface ImageBackground {
  kind: BackgroundKind;
  color: string;
  gradient: [string, string];
  angle: number;
}

/**
 * Non-destructive edit: the frame has an aspect ratio; the source is positioned in it
 * with zoom (1 = cover), pan (fractions of the frame), rotation and flips.
 */
export interface ImageEdit {
  aspect: AspectKey;
  /** width / height when aspect is 'custom'. */
  customRatio: number;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  adjustments: ImageAdjustments;
  filter: ImageFilter;
  duotone: [string, string];
  background: ImageBackground;
  shape: ProfileShape;
  /** Corner radius for 'rounded' / 'custom', as a fraction of the short edge (0–0.5). */
  radius: number;
  /** Border ring drawn inside the shape (px at 1024 output; 0 = none). */
  ring: number;
  ringColor: string;
}

export type VariantPurpose = 'original' | 'professional' | 'portfolio' | 'resume' | 'dark' | 'light' | 'custom';

export interface ImageVariant {
  id: string;
  name: string;
  purpose: VariantPurpose;
  edit: ImageEdit;
  /** Manual crop overrides per placement aspect (smart fit is used otherwise). */
  placements: Partial<Record<string, { zoom: number; panX: number; panY: number }>>;
  updatedAt: string;
}

export interface ProfileImage {
  asset: ImageAsset;
  variants: ImageVariant[];
  /** Which variant each system uses by default. */
  usage: { portfolio: string; resume: string; documents: string };
}

/* ------------------------------ Profile ----------------------------- */

export interface SocialLink {
  id: string;
  platform: string;
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  headline: string;
  bio: string;
  email: string;
  phone?: string;
  location?: string;
  website?: string;
  profileImage?: ProfileImage;
  socialLinks: SocialLink[];
  updatedAt: string;
}

/* ------------------------------ Library ----------------------------- */

export interface LibExperience {
  id: string;
  company: string;
  role: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  url: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface LibProject {
  id: string;
  title: string;
  /** Long description (portfolio). */
  description: string;
  technologies: string[];
  role: string;
  duration: string;
  github: string;
  live: string;
  features: string[];
  /** Resume-specific defaults — coexist with the long portfolio copy. */
  resumeSummary: string;
  resumeBullets: string[];
}

export interface LibEducation {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  start: string;
  end: string;
  grade: string;
  description: string;
}

export interface LibSkill {
  id: string;
  name: string;
  category: string;
  /** 0 = unspecified, 1–5 self-assessed. */
  level: number;
}

export interface LibCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
  url: string;
}

export interface LibAchievement {
  id: string;
  title: string;
  description: string;
  date: string;
  url: string;
}

export interface Library {
  experience: LibExperience[];
  projects: LibProject[];
  education: LibEducation[];
  skills: LibSkill[];
  certifications: LibCertification[];
  achievements: LibAchievement[];
  updatedAt: string;
}

export type LibraryKind = 'experience' | 'projects' | 'education' | 'skills' | 'certifications' | 'achievements';

export type LibItemOf<K extends LibraryKind> = Library[K][number];

/* ------------------------------ Resume ------------------------------ */

export type ResumeSectionKind =
  | 'profile'
  | 'summary'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'technical-skills'
  | 'education'
  | 'certifications'
  | 'achievements'
  | 'awards'
  | 'languages'
  | 'interests'
  | 'publications'
  | 'open-source'
  | 'volunteer'
  | 'references'
  | 'custom';

/** A reference to a library item with optional resume-only overrides. */
export interface ItemRef {
  id: string;
  libId: string;
  hidden: boolean;
  /** Field names whose value comes from `overrides` instead of the library. */
  detached: string[];
  overrides: Record<string, unknown>;
}

/** Items that exist only in this resume (languages, publications, custom…). */
export interface LocalEntry {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  location: string;
  url: string;
  description: string;
  bullets: string[];
  hidden: boolean;
}

export interface ResumeSection {
  id: string;
  kind: ResumeSectionKind;
  title: string;
  hidden: boolean;
  /** Library-backed sections. */
  refs: ItemRef[];
  /** Append library items that are not referenced yet. */
  autoInclude: boolean;
  /** Local entries (non-library sections and custom). */
  entries: LocalEntry[];
  /** Summary / custom free text; `null` means "use the shared profile bio" for summary. */
  text: string | null;
  /** Presentation hints the templates honour. */
  display: 'auto' | 'list' | 'entries' | 'tags' | 'inline' | 'grid';
  /** Skills: restrict to these library skill ids (null = all). */
  skillIds: string[] | null;
  /** Max bullet points per item (0 = no limit). */
  maxBullets: number;
  /** Where two-column templates place the section. */
  placement: 'auto' | 'main' | 'side';
}

export type PhotoMode = 'none' | 'circle' | 'square' | 'rounded' | 'small-portrait' | 'large-portrait';

export type PaperSize = 'a4' | 'letter' | 'legal';
export type FontChoice = 'template' | 'sans' | 'serif' | 'mono';
export type MarginPreset = 'narrow' | 'normal' | 'wide';

export interface FitAdjust {
  font: number;
  spacing: number;
  margins: number;
  lineHeight: number;
}

export interface ResumeStyle {
  paper: PaperSize;
  margins: MarginPreset;
  font: FontChoice;
  /** Body size in pt. */
  baseSize: number;
  lineHeight: number;
  /** Multiplier for vertical rhythm (0.6–1.6). */
  spacing: number;
  accent: string;
  colorPreset: string;
  atsSafe: boolean;
  /** Fraction of the content width used by the sidebar (two-column templates). */
  sidebarWidth: number;
  headerAlign: 'left' | 'center';
  headerHeight: 'compact' | 'normal' | 'tall';
  borderStyle: 'none' | 'hairline' | 'thick';
  iconStyle: 'none' | 'glyph' | 'label';
  photo: PhotoMode;
  pageNumbers: boolean;
  /** 0 = unlimited. */
  pageLimit: number;
  repeatHeadings: boolean;
  dateFormat: 'short' | 'long' | 'numeric';
  /** Result of Fit to page; null = natural layout. */
  fit: FitAdjust | null;
}

export interface DocumentMeta {
  author: string;
  title: string;
  subject: string;
  keywords: string[];
  creator: string;
}

export interface ResumeDoc {
  id: string;
  name: string;
  kind: 'resume' | 'cv';
  templateId: string;
  style: ResumeStyle;
  sections: ResumeSection[];
  /** Overrides for the header (else shared profile). */
  headline: string | null;
  contact: { email: boolean; phone: boolean; location: boolean; website: boolean; social: boolean };
  /** Variant id of the profile image, null = the "resume" usage default. */
  photoVariant: string | null;
  meta: DocumentMeta;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

/* --------------------------- Cover letter --------------------------- */

export interface CoverLetterData {
  recipient: string;
  recipientTitle: string;
  company: string;
  address: string;
  role: string;
  date: string;
  salutation: string;
  opening: string;
  body: string;
  closing: string;
  signOff: string;
  signature: string;
}

/* ----------------------------- Documents ---------------------------- */

export type BlockKind =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'profile'
  | 'quote'
  | 'list'
  | 'table'
  | 'divider'
  | 'timeline'
  | 'columns'
  | 'callout'
  | 'code'
  | 'stats'
  | 'project'
  | 'experience'
  | 'signature'
  | 'footer'
  | 'spacer'
  | 'pageBreak';

export interface BlockStyle {
  align: 'left' | 'center' | 'right' | 'justify';
  spaceBefore: number;
  spaceAfter: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
  tone: 'default' | 'muted' | 'accent';
}

interface BlockBase {
  id: string;
  style: BlockStyle;
}

export type DocBlockNode =
  | (BlockBase & { kind: 'heading'; text: string; level: 1 | 2 | 3 })
  | (BlockBase & { kind: 'paragraph'; text: string })
  | (BlockBase & { kind: 'image'; src: string; caption: string; width: number; aspect?: number })
  | (BlockBase & { kind: 'profile'; showPhoto: boolean; showContact: boolean; showBio: boolean })
  | (BlockBase & { kind: 'quote'; text: string; cite: string })
  | (BlockBase & { kind: 'list'; ordered: boolean; items: string[] })
  | (BlockBase & { kind: 'table'; header: string[]; rows: string[][] })
  | (BlockBase & { kind: 'divider'; variant: 'line' | 'dots' | 'thick' })
  | (BlockBase & { kind: 'timeline'; items: Array<{ id: string; date: string; title: string; text: string }> })
  | (BlockBase & { kind: 'columns'; count: 2 | 3; columns: Array<{ id: string; heading: string; text: string }> })
  | (BlockBase & { kind: 'callout'; variant: 'info' | 'success' | 'warning' | 'note'; title: string; text: string })
  | (BlockBase & { kind: 'code'; language: string; code: string })
  | (BlockBase & { kind: 'stats'; items: Array<{ id: string; value: string; label: string }> })
  | (BlockBase & { kind: 'project'; libId: string | null; title: string; text: string; tags: string[]; url: string })
  | (BlockBase & { kind: 'experience'; libId: string | null; role: string; company: string; dates: string; text: string })
  | (BlockBase & { kind: 'signature'; name: string; title: string; date: string })
  | (BlockBase & { kind: 'footer'; text: string })
  | (BlockBase & { kind: 'spacer'; height: number })
  | (BlockBase & { kind: 'pageBreak' });

export type DocumentKind =
  | 'resume'
  | 'cv'
  | 'cover-letter'
  | 'portfolio'
  | 'case-study'
  | 'proposal'
  | 'profile'
  | 'report'
  | 'presentation'
  | 'custom';

export interface DocumentPageSettings {
  paper: PaperSize;
  orientation: 'portrait' | 'landscape';
  margins: MarginPreset;
  pageNumbers: boolean;
  headerText: string;
  footerText: string;
  font: FontChoice;
  baseSize: number;
  lineHeight: number;
  accent: string;
}

export interface StudioDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  templateId: string;
  page: DocumentPageSettings;
  blocks: DocBlockNode[];
  /** Cover letters use structured content instead of free blocks. */
  letter: CoverLetterData | null;
  meta: DocumentMeta;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}
