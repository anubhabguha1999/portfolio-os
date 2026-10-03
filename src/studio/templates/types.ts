import type { FlowDoc } from '@/studio/engine/flow';
import type { ResolvedResume } from '@/studio/model/resolve';
import type { CoverLetterData, DocBlockNode, DocumentPageSettings, Library, Profile, ResumeSection, ResumeSectionKind, ResumeStyle } from '@/studio/model/types';

export type StyleControl =
  | 'font'
  | 'baseSize'
  | 'lineHeight'
  | 'spacing'
  | 'accent'
  | 'sidebarWidth'
  | 'headerAlign'
  | 'headerHeight'
  | 'borderStyle'
  | 'iconStyle'
  | 'photo'
  | 'margins';

export interface ResumeTemplateDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  columns: 1 | 2;
  /** How friendly the layout is to applicant-tracking parsers. */
  ats: 'high' | 'medium' | 'low';
  supportsPhoto: boolean;
  /** Recently added: shown with a "New" badge in the template pickers. */
  isNew?: boolean;
  defaults: Partial<ResumeStyle>;
  controls: StyleControl[];
  /** Section layout (and example persona) a new resume made from this template starts with. */
  starter?: {
    sections: Array<{ kind: ResumeSectionKind } & Partial<Pick<ResumeSection, 'title' | 'display' | 'placement' | 'maxBullets'>>>;
    persona?: string;
  };
  compose(r: ResolvedResume): FlowDoc;
}

export interface LetterInput {
  letter: CoverLetterData;
  profile: Profile;
  page: DocumentPageSettings;
  photo: string | null;
  meta: FlowDoc['meta'];
}

export interface DocumentInput {
  blocks: DocBlockNode[];
  profile: Profile;
  library: Library;
  page: DocumentPageSettings;
  photo: string | null;
  meta: FlowDoc['meta'];
  title: string;
  kind: string;
}

export interface LetterTemplateDef {
  id: string;
  name: string;
  description: string;
  compose(input: LetterInput): FlowDoc;
}

export interface DocTemplateDef {
  id: string;
  name: string;
  description: string;
  dark?: boolean;
  swatch: [string, string, string];
  compose(input: DocumentInput): FlowDoc;
}
