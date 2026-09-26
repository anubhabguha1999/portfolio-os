import type { DocBlock } from '@/types/document';
import type { FieldDef } from '@/types/fields';
import type { ImageRef, Portfolio, SectionDataMap, SectionOf, SectionType, SocialItem } from '@/types/portfolio';

export type RenderMode = 'preview' | 'export';

export interface ImageOptions {
  className?: string;
  width?: number;
  height?: number;
  eager?: boolean;
  sizes?: string;
  /** Presentational image: renders alt="" regardless of ref.alt. */
  decorative?: boolean;
}

/** Everything a section renderer may use. Renderers produce HTML strings only. */
export interface RenderContext {
  portfolio: Portfolio;
  mode: RenderMode;
  /** Returns an <img> tag, or '' when the ref has no usable source. */
  image(ref: ImageRef | undefined, opts?: ImageOptions): string;
  /** Attribute string that applies a background image to an element. */
  backgroundImage(src: string): string;
  /** Resolved URL for a media src (used for <video>, og:image, etc). */
  mediaUrl(src: string): string;
  markdown(md: string): string;
  icon(name: string, className?: string): string;
  /** Social links gathered from the Social section (used by hero/contact/footer). */
  socialLinks(): SocialItem[];
  /** Registers CSS that should be emitted once for the whole document. */
  addCss(key: string, css: string): void;
}

export interface DocContext {
  portfolio: Portfolio;
  markdownBlocks(md: string): DocBlock[];
  plain(md: string): string;
}

export type SectionCategory = 'essentials' | 'work' | 'credibility' | 'content' | 'advanced';

export interface SectionDefinition<K extends SectionType = SectionType> {
  type: K;
  label: string;
  description: string;
  /** lucide-react icon name used by the builder UI. */
  icon: string;
  category: SectionCategory;
  /** Only one instance makes sense (hero, contact). */
  singleton?: boolean;
  /** Renderer manages its own container (full-bleed backgrounds). */
  fullBleed?: boolean;
  createData(): SectionDataMap[K];
  fields: FieldDef[];
  /** Inner HTML for the section. The engine wraps it in <section>. */
  render(data: SectionDataMap[K], ctx: RenderContext, section: SectionOf<K>): string;
  /** Section content for PDF / DOCX. */
  toDocument(data: SectionDataMap[K], ctx: DocContext): DocBlock[];
  /** Heading shown in the section wrapper (and PDF/DOCX). */
  heading(data: SectionDataMap[K]): string;
  isEmpty(data: SectionDataMap[K]): boolean;
  /** Collect image refs so exports can bundle them and analyzers can audit alt text. */
  images(data: SectionDataMap[K]): Array<{ ref: ImageRef; label: string }>;
  /** Collect links for validation. */
  links(data: SectionDataMap[K]): Array<{ url: string; label: string }>;
}

export type SectionRegistry = { [K in SectionType]: SectionDefinition<K> };
