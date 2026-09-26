import type { PortfolioSection, SectionType, SectionOf, SectionStyle } from '@/types/portfolio';
import type { SectionCategory, SectionDefinition, SectionRegistry } from './types';
import { heroSection } from './defs/hero';
import { aboutSection } from './defs/about';
import { experienceSection } from './defs/experience';
import { educationSection } from './defs/education';
import { projectsSection } from './defs/projects';
import { skillsSection } from './defs/skills';
import { contactSection } from './defs/contact';
import { customSection } from './defs/custom';
import {
  servicesSection,
  achievementsSection,
  certificationsSection,
  testimonialsSection,
  blogSection,
  socialSection,
  statsSection,
  timelineSection,
  gallerySection,
} from './defs/simple-lists';
import { uid } from '@/utils/id';
import { slugify } from '@/utils/escape';

/**
 * The section registry. To add a new section type:
 *   1. add its data interface + key to `SectionDataMap` (types/portfolio.ts)
 *   2. create a `SectionDefinition` in sections/defs
 *   3. register it here.
 * The builder, preview, HTML, PDF, DOCX, analyzers and validators pick it up automatically.
 */
export const SECTION_REGISTRY: SectionRegistry = {
  hero: heroSection,
  about: aboutSection,
  experience: experienceSection,
  education: educationSection,
  projects: projectsSection,
  skills: skillsSection,
  services: servicesSection,
  achievements: achievementsSection,
  certifications: certificationsSection,
  testimonials: testimonialsSection,
  blog: blogSection,
  contact: contactSection,
  social: socialSection,
  stats: statsSection,
  timeline: timelineSection,
  gallery: gallerySection,
  custom: customSection,
};

export const SECTION_TYPES = Object.keys(SECTION_REGISTRY) as SectionType[];

export const SECTION_CATEGORIES: Array<{ id: SectionCategory; label: string }> = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'work', label: 'Work' },
  { id: 'credibility', label: 'Credibility' },
  { id: 'content', label: 'Content' },
  { id: 'advanced', label: 'Advanced' },
];

export function getDefinition<K extends SectionType>(type: K): SectionDefinition<K> {
  return SECTION_REGISTRY[type] as unknown as SectionDefinition<K>;
}

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && value in SECTION_REGISTRY;
}

export function defaultSectionStyle(type: SectionType): SectionStyle {
  return {
    background: 'default',
    paddingY: type === 'hero' ? 'xl' : 'md',
    width: 'default',
    align: 'left',
    animation: { type: 'fade', duration: 700, delay: 0, easing: 'ease-out', trigger: type === 'hero' ? 'load' : 'scroll' },
    hideOn: { mobile: false, tablet: false, desktop: false },
    anchor: type === 'hero' ? 'top' : type,
    showInNav: !['hero', 'stats', 'social'].includes(type),
  };
}

export function createSection<K extends SectionType>(type: K, overrides: Partial<SectionOf<K>['data']> = {}, existing: PortfolioSection[] = []): SectionOf<K> & PortfolioSection {
  const def = getDefinition(type);
  const style = defaultSectionStyle(type);
  style.anchor = uniqueAnchor(style.anchor, existing);
  return {
    id: uid('sec'),
    type,
    name: def.label,
    enabled: true,
    locked: false,
    order: existing.length,
    style,
    data: { ...def.createData(), ...overrides },
  } as unknown as SectionOf<K> & PortfolioSection;
}

export function uniqueAnchor(base: string, sections: PortfolioSection[], selfId?: string): string {
  const root = slugify(base);
  const taken = new Set(sections.filter((s) => s.id !== selfId).map((s) => s.style.anchor));
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

/** Call a definition method with correct typing for a union section. */
export function withDefinition<R>(section: PortfolioSection, fn: <K extends SectionType>(def: SectionDefinition<K>, s: SectionOf<K>) => R): R {
  return fn(getDefinition(section.type), section as SectionOf<typeof section.type>);
}
