/**
 * Small, typed helpers for authoring templates. Everything goes through
 * `createPortfolio` / `createSection`, so templates always conform to the schema.
 */
import type {
  AnimationConfig,
  CtaButton,
  EducationItem,
  ExperienceItem,
  Portfolio,
  PortfolioMetadata,
  PortfolioSettings,
  ProjectItem,
  SectionDataMap,
  SectionStyle,
  SectionType,
  SkillItem,
  SocialItem,
  TestimonialItem,
  ColorScheme,
} from '@/types/portfolio';
import { createPortfolio } from '@/lib/portfolio-factory';
import { createSection, uniqueAnchor } from '@/sections/registry';
import { uid } from '@/utils/id';

export type StyleSpec = Partial<Omit<SectionStyle, 'animation' | 'hideOn'>> & { animation?: Partial<AnimationConfig> };

export interface SectionSpec<K extends SectionType = SectionType> {
  type: K;
  data: Partial<SectionDataMap[K]>;
  style?: StyleSpec;
  name?: string;
}

export type AnySectionSpec = { [K in SectionType]: SectionSpec<K> }[SectionType];

/** Declare a section with typed data overrides. */
export function section<K extends SectionType>(type: K, data: Partial<SectionDataMap[K]>, style?: StyleSpec, name?: string): SectionSpec<K> {
  return { type, data, ...(style ? { style } : {}), ...(name ? { name } : {}) };
}

export interface TemplateSpec {
  themeId: string;
  scheme: ColorScheme;
  metadata: Partial<Omit<PortfolioMetadata, 'createdAt' | 'updatedAt' | 'customFonts'>>;
  navigation?: Partial<PortfolioSettings['navigation']>;
  footer?: Partial<PortfolioSettings['footer']>;
  settings?: Partial<Pick<PortfolioSettings, 'showThemeToggle' | 'smoothScroll' | 'animations' | 'backToTop'>>;
  sections: AnySectionSpec[];
}

/** Assemble a full portfolio from a template spec. */
export function buildPortfolio(spec: TemplateSpec): Portfolio {
  const p = createPortfolio({ title: spec.metadata.title ?? 'Portfolio', themeId: spec.themeId, sections: [] });
  p.metadata = { ...p.metadata, ...spec.metadata };
  p.settings = {
    ...p.settings,
    ...spec.settings,
    colorScheme: spec.scheme,
    navigation: { ...p.settings.navigation, ...spec.navigation },
    footer: { ...p.settings.footer, ...spec.footer },
  };
  for (const s of spec.sections) {
    const sec = createSection(s.type, s.data as never, p.sections);
    if (s.name) sec.name = s.name;
    if (s.style) {
      const { animation, anchor, ...rest } = s.style;
      Object.assign(sec.style, rest);
      if (animation) sec.style.animation = { ...sec.style.animation, ...animation };
      if (anchor) sec.style.anchor = uniqueAnchor(anchor, p.sections);
    }
    p.sections.push(sec);
  }
  p.sections.forEach((s, i) => (s.order = i));
  return p;
}

/* ----------------------------- Item factories ---------------------------- */

export const cta = (label: string, url: string, variant: CtaButton['variant'] = 'primary'): CtaButton => ({ id: uid('cta'), label, url, variant });

export function job(i: Omit<Partial<ExperienceItem>, 'id'> & Pick<ExperienceItem, 'company' | 'role' | 'start'>): ExperienceItem {
  return { id: uid('exp'), location: '', end: '', current: false, url: '', description: '', achievements: [], technologies: [], ...i };
}

export function work(i: Omit<Partial<ProjectItem>, 'id'> & Pick<ProjectItem, 'title' | 'description' | 'image'>): ProjectItem {
  return { id: uid('prj'), gallery: [], technologies: [], github: '', live: '', caseStudy: '', role: '', duration: '', features: [], featured: false, ...i };
}

/** `skills('Frontend', [['TypeScript', 8, 5], ['React', 7]])` — name, years, level. */
export function skills(category: string, list: Array<[name: string, years?: number, level?: number, icon?: string]>): SkillItem[] {
  return list.map(([name, years = 0, level = 0, icon = '']) => ({ id: uid('skl'), name, category, years, level, icon, color: '' }));
}

export function school(i: Omit<Partial<EducationItem>, 'id'> & Pick<EducationItem, 'institution' | 'degree'>): EducationItem {
  return { id: uid('edu'), field: '', location: '', start: '', end: '', grade: '', description: '', ...i };
}

export function quote(i: Omit<Partial<TestimonialItem>, 'id'> & Pick<TestimonialItem, 'quote' | 'author'>): TestimonialItem {
  return { id: uid('tst'), role: '', company: '', avatar: { src: '', alt: '' }, ...i };
}

export function social(platform: string, url: string, label = ''): SocialItem {
  return { id: uid('soc'), platform, url, label: label || platform };
}

/** Attach generated ids to a list of plain items. */
export function withIds<T extends { id: string }>(prefix: string, list: Array<Omit<T, 'id'>>): T[] {
  return list.map((item) => ({ ...item, id: uid(prefix) }) as T);
}
