/**
 * Portfolio data model used by generated React/Next.js projects.
 *
 * This file is copied verbatim into every exported project as
 * `src/types/portfolio.ts`, so it must stay dependency-free.
 */

export interface SiteImage {
  /** Public path under /images or an absolute https URL. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface SiteLink {
  label: string;
  href: string;
}

export interface SocialLink {
  platform: string;
  label: string;
  href: string;
  /** Icon name from components/Icon. */
  icon: string;
}

export interface Cta {
  label: string;
  href: string;
  variant: 'primary' | 'secondary' | 'ghost';
}

export type SectionBackground = 'default' | 'surface' | 'primary' | 'accent' | 'inverted' | 'gradient' | 'transparent';

export interface SectionBase {
  id: string;
  /** Anchor id used for in-page navigation. */
  anchor: string;
  heading: string;
  intro: string;
  background: SectionBackground;
  width: 'narrow' | 'default' | 'wide' | 'full';
  align: 'left' | 'center';
  spacing: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Entrance animation (only used when animations are enabled). */
  animation: 'none' | 'fade' | 'slide' | 'scale' | 'blur';
  /** Timing of the entrance animation: milliseconds, easing, and whether it plays on load instead of on scroll. */
  motion: { duration: number; delay: number; easing: 'ease' | 'ease-out' | 'ease-in-out' | 'spring' | 'linear'; onLoad: boolean };
  hideOn: { mobile: boolean; tablet: boolean; desktop: boolean };
}

export interface HeroSection extends SectionBase {
  type: 'hero';
  eyebrow: string;
  name: string;
  title: string;
  description: string;
  image: SiteImage | null;
  layout: 'centered' | 'split' | 'minimal' | 'bold';
  ctas: Cta[];
  showSocial: boolean;
  background: SectionBackground;
  backdrop: 'none' | 'gradient' | 'grid' | 'spotlight' | 'aurora' | 'image';
  backdropImage: SiteImage | null;
  overlayOpacity: number;
  typingPhrases: string[];
  availability: string;
}

export interface AboutSection extends SectionBase {
  type: 'about';
  /** Pre-sanitised HTML rendered from Markdown at export time. */
  bodyHtml: string;
  image: SiteImage | null;
  highlights: string[];
  layout: 'split' | 'stacked' | 'quote';
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  location: string;
  start: string;
  end: string;
  /** Human-readable range, e.g. "Mar 2021 – Present". */
  period: string;
  current: boolean;
  url: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface ExperienceSection extends SectionBase {
  type: 'experience';
  style: 'timeline' | 'cards' | 'compact' | 'alternating';
  items: ExperienceEntry[];
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  period: string;
  grade: string;
  description: string;
}

export interface EducationSection extends SectionBase {
  type: 'education';
  items: EducationEntry[];
}

export interface Project {
  id: string;
  /** URL segment for /projects/[slug]. */
  slug: string;
  title: string;
  description: string;
  image: SiteImage | null;
  gallery: SiteImage[];
  technologies: string[];
  github: string;
  live: string;
  /** Pre-sanitised HTML case study ('' when none). */
  caseStudyHtml: string;
  role: string;
  duration: string;
  features: string[];
  featured: boolean;
  /** True when the project has its own detail page. */
  hasPage: boolean;
}

export interface ProjectsSection extends SectionBase {
  type: 'projects';
  layout: 'grid' | 'masonry' | 'horizontal' | 'featured' | 'minimal' | 'editorial';
  /** Slugs into `portfolio.projects`, in display order. */
  projectSlugs: string[];
}

export interface SkillEntry {
  id: string;
  name: string;
  category: string;
  /** 0 = not specified, 1–5 self-assessed. */
  level: number;
}

export interface SkillsSection extends SectionBase {
  type: 'skills';
  display: 'tags' | 'grouped' | 'bars' | 'orbit' | 'grid' | 'stack';
  items: SkillEntry[];
}

export interface ServicesSection extends SectionBase {
  type: 'services';
  items: Array<{ id: string; title: string; description: string; icon: string; price: string }>;
}

export interface AchievementsSection extends SectionBase {
  type: 'achievements';
  items: Array<{ id: string; title: string; description: string; date: string; url: string }>;
}

export interface CertificationsSection extends SectionBase {
  type: 'certifications';
  items: Array<{ id: string; name: string; issuer: string; date: string; credentialId: string; url: string }>;
}

export interface TestimonialsSection extends SectionBase {
  type: 'testimonials';
  layout: 'grid' | 'carousel' | 'single';
  items: Array<{ id: string; quote: string; author: string; role: string; company: string; avatar: SiteImage | null }>;
}

export interface BlogSection extends SectionBase {
  type: 'blog';
  items: Array<{ id: string; title: string; excerpt: string; date: string; url: string; tags: string[] }>;
}

export interface ContactSection extends SectionBase {
  type: 'contact';
  body: string;
  email: string;
  phone: string;
  location: string;
  availability: string;
  /** Composes an email with mailto: — no backend. */
  showForm: boolean;
}

export interface SocialSection extends SectionBase {
  type: 'social';
  style: 'icons' | 'list' | 'buttons';
}

export interface StatsSection extends SectionBase {
  type: 'stats';
  items: Array<{ id: string; value: string; label: string; suffix: string }>;
}

export interface TimelineSection extends SectionBase {
  type: 'timeline';
  items: Array<{ id: string; date: string; title: string; description: string }>;
}

export interface GallerySection extends SectionBase {
  type: 'gallery';
  layout: 'grid' | 'masonry' | 'strip';
  items: Array<{ id: string; image: SiteImage; caption: string }>;
}

export interface CustomSection extends SectionBase {
  type: 'custom';
  /** Pre-sanitised HTML. Scoped custom CSS lives in the stylesheet. */
  html: string;
}

export type Section =
  | HeroSection
  | AboutSection
  | ExperienceSection
  | EducationSection
  | ProjectsSection
  | SkillsSection
  | ServicesSection
  | AchievementsSection
  | CertificationsSection
  | TestimonialsSection
  | BlogSection
  | ContactSection
  | SocialSection
  | StatsSection
  | TimelineSection
  | GallerySection
  | CustomSection;

export type SectionType = Section['type'];

export interface PageDefinition {
  /** Route path: "/", "/about", "/projects", "/contact". */
  path: string;
  title: string;
  description: string;
  /** Section ids rendered on this page, in order. */
  sectionIds: string[];
}

export interface SiteSeo {
  title: string;
  description: string;
  keywords: string[];
  author: string;
  lang: string;
  /** Canonical origin, e.g. "https://example.com" — null when not supplied. */
  siteUrl: string | null;
  twitterHandle: string;
  ogImage: SiteImage | null;
  favicon: string | null;
}

export interface PortfolioData {
  seo: SiteSeo;
  person: {
    name: string;
    headline: string;
    email: string;
    location: string;
    image: SiteImage | null;
  };
  theme: {
    /** Colour scheme the site starts in. */
    scheme: 'light' | 'dark' | 'system';
    toggle: boolean;
    cardStyle: 'flat' | 'outlined' | 'elevated' | 'glass' | 'brutal';
    buttonStyle: 'solid' | 'outline' | 'pill' | 'brutal' | 'underline';
  };
  nav: {
    enabled: boolean;
    brand: string;
    style: 'bar' | 'floating' | 'minimal';
    sticky: boolean;
    links: SiteLink[];
  };
  /** `text` may contain {year}; `credit` adds a "Built with Portfolio OS" note. */
  footer: { enabled: boolean; text: string; credit: boolean };
  /** Site-wide extras: smooth in-page scrolling, a back-to-top button and a film-grain overlay. */
  chrome: { smoothScroll: boolean; backToTop: boolean; grain: boolean };
  social: SocialLink[];
  sections: Section[];
  projects: Project[];
  pages: PageDefinition[];
}
