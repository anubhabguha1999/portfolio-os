import { uid } from '@/utils/id';
import type {
  BlockKind,
  BlockStyle,
  CoverLetterData,
  DocBlockNode,
  DocumentKind,
  DocumentPageSettings,
  ImageEdit,
  ItemRef,
  LibAchievement,
  LibCertification,
  LibEducation,
  LibExperience,
  LibProject,
  LibSkill,
  Library,
  LibraryKind,
  LocalEntry,
  Profile,
  ResumeDoc,
  ResumeSection,
  ResumeSectionKind,
  ResumeStyle,
  StudioDocument,
} from './types';

const now = () => new Date().toISOString();

export function emptyProfile(): Profile {
  return { name: '', headline: '', bio: '', email: '', phone: '', location: '', website: '', socialLinks: [], updatedAt: now() };
}

export function emptyLibrary(): Library {
  return { experience: [], projects: [], education: [], skills: [], certifications: [], achievements: [], updatedAt: now() };
}

/* ---------------------------- Library items ------------------------- */

export const createLibExperience = (over: Partial<LibExperience> = {}): LibExperience => ({
  id: uid('exp'),
  company: '',
  role: '',
  location: '',
  start: '',
  end: '',
  current: false,
  url: '',
  description: '',
  achievements: [],
  technologies: [],
  ...over,
});

export const createLibProject = (over: Partial<LibProject> = {}): LibProject => ({
  id: uid('prj'),
  title: '',
  description: '',
  technologies: [],
  role: '',
  duration: '',
  github: '',
  live: '',
  features: [],
  resumeSummary: '',
  resumeBullets: [],
  ...over,
});

export const createLibEducation = (over: Partial<LibEducation> = {}): LibEducation => ({
  id: uid('edu'),
  institution: '',
  degree: '',
  field: '',
  location: '',
  start: '',
  end: '',
  grade: '',
  description: '',
  ...over,
});

export const createLibSkill = (over: Partial<LibSkill> = {}): LibSkill => ({ id: uid('skl'), name: '', category: '', level: 0, ...over });

export const createLibCertification = (over: Partial<LibCertification> = {}): LibCertification => ({
  id: uid('crt'),
  name: '',
  issuer: '',
  date: '',
  credentialId: '',
  url: '',
  ...over,
});

export const createLibAchievement = (over: Partial<LibAchievement> = {}): LibAchievement => ({ id: uid('ach'), title: '', description: '', date: '', url: '', ...over });

export const LIB_FACTORIES = {
  experience: createLibExperience,
  projects: createLibProject,
  education: createLibEducation,
  skills: createLibSkill,
  certifications: createLibCertification,
  achievements: createLibAchievement,
} satisfies Record<LibraryKind, (over?: never) => unknown>;

/* ------------------------------ Sections ---------------------------- */

export interface SectionKindInfo {
  kind: ResumeSectionKind;
  label: string;
  title: string;
  /** Library collection backing this section (if any). */
  library: LibraryKind | null;
  /** Standard heading ATS parsers recognise. */
  standard: string[];
  side: boolean;
  description: string;
}

export const SECTION_KINDS: SectionKindInfo[] = [
  { kind: 'profile', label: 'Profile', title: 'Profile', library: null, standard: [], side: false, description: 'Name, headline, contact details and photo.' },
  { kind: 'summary', label: 'Professional Summary', title: 'Summary', library: null, standard: ['summary', 'professional summary', 'profile', 'about', 'objective', 'career summary'], side: false, description: 'A short pitch — shared bio or resume-specific.' },
  { kind: 'experience', label: 'Experience', title: 'Experience', library: 'experience', standard: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history'], side: false, description: 'Roles, dates and measurable achievements.' },
  { kind: 'projects', label: 'Projects', title: 'Projects', library: 'projects', standard: ['projects', 'selected projects', 'personal projects', 'key projects'], side: false, description: 'Shared with your portfolio; resume copy can be detached.' },
  { kind: 'skills', label: 'Skills', title: 'Skills', library: 'skills', standard: ['skills', 'core skills', 'key skills', 'competencies', 'core competencies'], side: true, description: 'A compact list of skills.' },
  { kind: 'technical-skills', label: 'Technical Skills', title: 'Technical Skills', library: 'skills', standard: ['technical skills', 'technologies', 'tech stack', 'tools'], side: true, description: 'Skills grouped by category.' },
  { kind: 'education', label: 'Education', title: 'Education', library: 'education', standard: ['education', 'academic background', 'qualifications'], side: true, description: 'Degrees and institutions.' },
  { kind: 'certifications', label: 'Certifications', title: 'Certifications', library: 'certifications', standard: ['certifications', 'certificates', 'licenses', 'licenses & certifications'], side: true, description: 'Certificates and licenses.' },
  { kind: 'achievements', label: 'Achievements', title: 'Achievements', library: 'achievements', standard: ['achievements', 'accomplishments', 'key achievements'], side: false, description: 'Highlights worth calling out.' },
  { kind: 'awards', label: 'Awards', title: 'Awards', library: null, standard: ['awards', 'honors', 'honours', 'awards & honors'], side: true, description: 'Awards and honours.' },
  { kind: 'languages', label: 'Languages', title: 'Languages', library: null, standard: ['languages'], side: true, description: 'Languages and proficiency.' },
  { kind: 'interests', label: 'Interests', title: 'Interests', library: null, standard: ['interests', 'hobbies', 'hobbies & interests'], side: true, description: 'A few personal interests.' },
  { kind: 'publications', label: 'Publications', title: 'Publications', library: null, standard: ['publications', 'papers', 'research'], side: false, description: 'Papers, articles and talks.' },
  { kind: 'open-source', label: 'Open Source', title: 'Open Source', library: null, standard: ['open source', 'open-source contributions', 'contributions'], side: false, description: 'Projects you maintain or contribute to.' },
  { kind: 'volunteer', label: 'Volunteer Experience', title: 'Volunteer Experience', library: null, standard: ['volunteer experience', 'volunteering', 'volunteer work', 'community'], side: false, description: 'Community and volunteer roles.' },
  { kind: 'references', label: 'References', title: 'References', library: null, standard: ['references'], side: false, description: 'Referees or "available on request".' },
  { kind: 'custom', label: 'Custom Section', title: 'Custom Section', library: null, standard: [], side: false, description: 'Anything else — text, bullets or entries.' },
];

export function sectionInfo(kind: ResumeSectionKind): SectionKindInfo {
  return SECTION_KINDS.find((k) => k.kind === kind) ?? SECTION_KINDS[SECTION_KINDS.length - 1]!;
}

export function createEntry(over: Partial<LocalEntry> = {}): LocalEntry {
  return { id: uid('ent'), title: '', subtitle: '', date: '', location: '', url: '', description: '', bullets: [], hidden: false, ...over };
}

export function createRef(libId: string): ItemRef {
  return { id: uid('ref'), libId, hidden: false, detached: [], overrides: {} };
}

export function createResumeSection(kind: ResumeSectionKind, over: Partial<ResumeSection> = {}): ResumeSection {
  const info = sectionInfo(kind);
  return {
    id: uid('rs'),
    kind,
    title: info.title,
    hidden: false,
    refs: [],
    autoInclude: info.library !== null,
    entries: [],
    text: kind === 'summary' ? null : kind === 'references' ? 'Available on request.' : '',
    display: 'auto',
    skillIds: null,
    maxBullets: 0,
    placement: 'auto',
    ...over,
  };
}

export const DEFAULT_RESUME_STYLE: ResumeStyle = {
  paper: 'a4',
  margins: 'normal',
  font: 'template',
  baseSize: 10,
  lineHeight: 1.35,
  spacing: 1,
  accent: '#1f3a8a',
  colorPreset: 'navy',
  atsSafe: false,
  sidebarWidth: 0.32,
  headerAlign: 'left',
  headerHeight: 'normal',
  borderStyle: 'hairline',
  iconStyle: 'none',
  photo: 'none',
  pageNumbers: false,
  pageLimit: 0,
  repeatHeadings: true,
  dateFormat: 'short',
  fit: null,
};

export const DEFAULT_SECTION_ORDER: ResumeSectionKind[] = ['profile', 'summary', 'experience', 'projects', 'technical-skills', 'education', 'certifications', 'achievements'];

export function createResume(name = 'My Resume', over: Partial<ResumeDoc> = {}): ResumeDoc {
  const t = now();
  return {
    id: uid('res'),
    name,
    kind: 'resume',
    templateId: 'ats-minimal',
    style: { ...DEFAULT_RESUME_STYLE },
    sections: DEFAULT_SECTION_ORDER.map((k) => createResumeSection(k)),
    headline: null,
    contact: { email: true, phone: true, location: true, website: true, social: true },
    photoVariant: null,
    meta: { author: '', title: '', subject: '', keywords: [], creator: '' },
    fileName: '',
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/* ------------------------------ Images ------------------------------ */

export function defaultImageEdit(over: Partial<ImageEdit> = {}): ImageEdit {
  return {
    aspect: '1:1',
    customRatio: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    adjustments: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, blur: 0, sharpness: 0 },
    filter: 'none',
    duotone: ['#1e1b4b', '#fde68a'],
    background: { kind: 'original', color: '#f1f5f9', gradient: ['#6366f1', '#ec4899'], angle: 135 },
    shape: 'circle',
    radius: 0.18,
    ring: 0,
    ringColor: '#ffffff',
    ...over,
  };
}

/* ----------------------------- Documents ---------------------------- */

export const DEFAULT_BLOCK_STYLE: BlockStyle = { align: 'left', spaceBefore: 0, spaceAfter: 0, size: 'md', tone: 'default' };

export function createBlock(kind: BlockKind): DocBlockNode {
  const base = { id: uid('blk'), style: { ...DEFAULT_BLOCK_STYLE } };
  switch (kind) {
    case 'heading':
      return { ...base, kind, text: 'Heading', level: 2 };
    case 'paragraph':
      return { ...base, kind, text: 'Write something here. **Bold**, *italic* and [links](https://example.com) are supported.' };
    case 'image':
      return { ...base, kind, src: '', caption: '', width: 1 };
    case 'profile':
      return { ...base, kind, showPhoto: true, showContact: true, showBio: false };
    case 'quote':
      return { ...base, kind, text: 'A memorable quote.', cite: '' };
    case 'list':
      return { ...base, kind, ordered: false, items: ['First point', 'Second point'] };
    case 'table':
      return { ...base, kind, header: ['Item', 'Detail'], rows: [['', ''], ['', '']] };
    case 'divider':
      return { ...base, kind, variant: 'line' };
    case 'timeline':
      return { ...base, kind, items: [{ id: uid('tl'), date: '2024', title: 'Milestone', text: '' }] };
    case 'columns':
      return { ...base, kind, count: 2, columns: [{ id: uid('col'), heading: 'Column one', text: '' }, { id: uid('col'), heading: 'Column two', text: '' }] };
    case 'callout':
      return { ...base, kind, variant: 'info', title: 'Note', text: 'Something worth highlighting.' };
    case 'code':
      return { ...base, kind, language: 'ts', code: 'const hello = "world";' };
    case 'stats':
      return { ...base, kind, items: [{ id: uid('st'), value: '40%', label: 'Faster' }, { id: uid('st'), value: '12', label: 'Releases' }, { id: uid('st'), value: '3M', label: 'Users' }] };
    case 'project':
      return { ...base, kind, libId: null, title: 'Project', text: '', tags: [], url: '' };
    case 'experience':
      return { ...base, kind, libId: null, role: 'Role', company: 'Company', dates: '', text: '' };
    case 'signature':
      return { ...base, kind, name: '', title: '', date: '' };
    case 'footer':
      return { ...base, kind, text: '' };
    case 'spacer':
      return { ...base, kind, height: 8 };
    case 'pageBreak':
      return { ...base, kind };
  }
}

export const BLOCK_KINDS: Array<{ kind: BlockKind; label: string; group: 'Text' | 'Media' | 'Layout' | 'Career' }> = [
  { kind: 'heading', label: 'Heading', group: 'Text' },
  { kind: 'paragraph', label: 'Paragraph', group: 'Text' },
  { kind: 'list', label: 'List', group: 'Text' },
  { kind: 'quote', label: 'Quote', group: 'Text' },
  { kind: 'callout', label: 'Callout', group: 'Text' },
  { kind: 'code', label: 'Code Block', group: 'Text' },
  { kind: 'image', label: 'Image', group: 'Media' },
  { kind: 'profile', label: 'Profile', group: 'Media' },
  { kind: 'table', label: 'Table', group: 'Layout' },
  { kind: 'columns', label: 'Columns', group: 'Layout' },
  { kind: 'divider', label: 'Divider', group: 'Layout' },
  { kind: 'spacer', label: 'Spacer', group: 'Layout' },
  { kind: 'pageBreak', label: 'Page Break', group: 'Layout' },
  { kind: 'footer', label: 'Footer', group: 'Layout' },
  { kind: 'stats', label: 'Statistics', group: 'Career' },
  { kind: 'timeline', label: 'Timeline', group: 'Career' },
  { kind: 'project', label: 'Project Card', group: 'Career' },
  { kind: 'experience', label: 'Experience Card', group: 'Career' },
  { kind: 'signature', label: 'Signature', group: 'Career' },
];

export const DEFAULT_PAGE: DocumentPageSettings = {
  paper: 'a4',
  orientation: 'portrait',
  margins: 'normal',
  pageNumbers: true,
  headerText: '',
  footerText: '',
  font: 'template',
  baseSize: 10.5,
  lineHeight: 1.45,
  accent: '#1f3a8a',
};

export function emptyLetter(): CoverLetterData {
  return {
    recipient: '',
    recipientTitle: 'Hiring Manager',
    company: '',
    address: '',
    role: '',
    date: new Date().toISOString().slice(0, 10),
    salutation: 'Dear Hiring Manager,',
    opening: '',
    body: '',
    closing: '',
    signOff: 'Sincerely,',
    signature: '',
  };
}

export const DOCUMENT_KINDS: Array<{ kind: DocumentKind; label: string; description: string; template: string }> = [
  { kind: 'cover-letter', label: 'Cover Letter', description: 'Recipient, opening, body and signature.', template: 'letter-professional' },
  { kind: 'portfolio', label: 'Portfolio PDF', description: 'Selected projects as a printable booklet.', template: 'doc-modern' },
  { kind: 'case-study', label: 'Case Study', description: 'Problem, approach, outcome.', template: 'doc-editorial' },
  { kind: 'proposal', label: 'Proposal', description: 'Scope, timeline and pricing.', template: 'doc-corporate' },
  { kind: 'profile', label: 'Personal Profile', description: 'A one-page introduction.', template: 'doc-luxury' },
  { kind: 'report', label: 'Project Report', description: 'Status, results and next steps.', template: 'doc-technical' },
  { kind: 'presentation', label: 'Presentation PDF', description: 'Landscape, slide-like pages.', template: 'doc-creative' },
  { kind: 'custom', label: 'Custom Document', description: 'Start from a blank page.', template: 'doc-professional' },
];

export function createDocument(kind: DocumentKind, name?: string, over: Partial<StudioDocument> = {}): StudioDocument {
  const t = now();
  const info = DOCUMENT_KINDS.find((k) => k.kind === kind);
  return {
    id: uid('doc'),
    name: name || info?.label || 'Untitled document',
    kind,
    templateId: info?.template ?? 'doc-professional',
    page: { ...DEFAULT_PAGE, orientation: kind === 'presentation' ? 'landscape' : 'portrait', pageNumbers: kind !== 'cover-letter' },
    blocks: [],
    letter: kind === 'cover-letter' ? emptyLetter() : null,
    meta: { author: '', title: '', subject: '', keywords: [], creator: '' },
    fileName: '',
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/* --------------------------- From a template ------------------------- */

type StarterSpec = { kind: ResumeSectionKind } & Partial<Pick<ResumeSection, 'title' | 'display' | 'placement' | 'maxBullets'>>;

/**
 * A new resume laid out the way a template intends (section order, display hints),
 * optionally seeded with resume-only example entries (languages, strengths…).
 */
export function createResumeFromStarter(name: string, templateId: string, starter: StarterSpec[] | undefined, entries: Record<string, Array<Partial<LocalEntry>>> = {}, over: Partial<ResumeDoc> = {}): ResumeDoc {
  const specs: StarterSpec[] = starter ?? DEFAULT_SECTION_ORDER.map((kind) => ({ kind }));
  const sections = specs.map((spec) => {
    const { kind, ...rest } = spec;
    const sec = createResumeSection(kind, rest);
    const seed = (rest.title && entries[rest.title]) || entries[kind];
    if (seed && sectionInfo(kind).library === null && kind !== 'summary') sec.entries = seed.map((e) => createEntry(e));
    return sec;
  });
  return createResume(name, { templateId, sections, ...over });
}
