/* ------------------------------------------------------------------ *
 * Portfolio schema — the single source of truth for every output.
 * ------------------------------------------------------------------ */

export type SectionType =
  | 'hero'
  | 'about'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'services'
  | 'achievements'
  | 'certifications'
  | 'testimonials'
  | 'blog'
  | 'contact'
  | 'social'
  | 'stats'
  | 'timeline'
  | 'gallery'
  | 'custom';

/** An image reference. `src` is `asset:<id>` (IndexedDB), an https URL or a data URL. */
export interface ImageRef {
  src: string;
  alt: string;
}

export interface LinkItem {
  label: string;
  url: string;
}

export interface CtaButton {
  id: string;
  label: string;
  url: string;
  variant: 'primary' | 'secondary' | 'ghost';
}

export type HeroBackground = 'none' | 'gradient' | 'particles' | 'grid' | 'spotlight' | 'aurora' | 'image' | 'video';

export interface HeroData {
  eyebrow: string;
  name: string;
  title: string;
  description: string;
  image: ImageRef;
  layout: 'centered' | 'split' | 'minimal' | 'bold';
  ctas: CtaButton[];
  showSocial: boolean;
  background: HeroBackground;
  backgroundImage: ImageRef;
  videoUrl: string;
  overlayOpacity: number;
  typingEnabled: boolean;
  typingPhrases: string[];
  parallax: boolean;
  magneticButtons: boolean;
  availability: string;
}

export interface AboutData {
  heading: string;
  body: string; // markdown
  image: ImageRef;
  highlights: string[];
  layout: 'split' | 'stacked' | 'quote';
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  start: string; // YYYY-MM
  end: string; // YYYY-MM or ''
  current: boolean;
  url: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface ExperienceData {
  heading: string;
  intro: string;
  style: 'timeline' | 'cards' | 'compact' | 'alternating';
  items: ExperienceItem[];
}

export interface EducationItem {
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

export interface EducationData {
  heading: string;
  items: EducationItem[];
}

export type ProjectLayout = 'grid' | 'masonry' | 'horizontal' | 'featured' | 'minimal' | 'editorial';

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  image: ImageRef;
  gallery: ImageRef[];
  technologies: string[];
  github: string;
  live: string;
  caseStudy: string; // markdown
  role: string;
  duration: string;
  features: string[];
  featured: boolean;
}

export interface ProjectsData {
  heading: string;
  intro: string;
  layout: ProjectLayout;
  items: ProjectItem[];
}

export type SkillsDisplay = 'tags' | 'grouped' | 'bars' | 'orbit' | 'grid' | 'stack';

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  /** Optional self-assessed level 1–5. 0 means "not specified" — never rendered as a fake percentage. */
  level: number;
  years: number;
  icon: string;
  color: string;
}

export interface SkillsData {
  heading: string;
  intro: string;
  display: SkillsDisplay;
  items: SkillItem[];
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: string;
}

export interface ServicesData {
  heading: string;
  intro: string;
  items: ServiceItem[];
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  date: string;
  url: string;
}

export interface AchievementsData {
  heading: string;
  items: AchievementItem[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
  url: string;
}

export interface CertificationsData {
  heading: string;
  items: CertificationItem[];
}

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar: ImageRef;
}

export interface TestimonialsData {
  heading: string;
  layout: 'grid' | 'carousel' | 'single';
  items: TestimonialItem[];
}

export interface BlogItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  url: string;
  tags: string[];
}

export interface BlogData {
  heading: string;
  intro: string;
  items: BlogItem[];
}

export interface ContactData {
  heading: string;
  body: string;
  email: string;
  phone: string;
  location: string;
  availability: string;
  /** A form that composes an email with mailto: — no backend involved. */
  showForm: boolean;
}

export interface SocialItem {
  id: string;
  platform: string;
  url: string;
  label: string;
}

export interface SocialData {
  heading: string;
  style: 'icons' | 'list' | 'buttons';
  items: SocialItem[];
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
  suffix: string;
}

export interface StatsData {
  heading: string;
  items: StatItem[];
}

export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface TimelineData {
  heading: string;
  items: TimelineItem[];
}

export interface GalleryItem {
  id: string;
  image: ImageRef;
  caption: string;
}

export interface GalleryData {
  heading: string;
  layout: 'grid' | 'masonry' | 'strip';
  items: GalleryItem[];
}

export interface CustomData {
  heading: string;
  mode: 'markdown' | 'html';
  content: string;
  css: string;
}

export interface SectionDataMap {
  hero: HeroData;
  about: AboutData;
  experience: ExperienceData;
  education: EducationData;
  projects: ProjectsData;
  skills: SkillsData;
  services: ServicesData;
  achievements: AchievementsData;
  certifications: CertificationsData;
  testimonials: TestimonialsData;
  blog: BlogData;
  contact: ContactData;
  social: SocialData;
  stats: StatsData;
  timeline: TimelineData;
  gallery: GalleryData;
  custom: CustomData;
}

/* ------------------------------ Animation ----------------------------- */

export type AnimationType = 'none' | 'fade' | 'slide' | 'scale' | 'blur' | 'reveal' | 'parallax' | 'stagger' | 'magnetic';
export type AnimationEasing = 'ease' | 'ease-out' | 'ease-in-out' | 'spring' | 'linear';
export type AnimationTrigger = 'scroll' | 'load';

export interface AnimationConfig {
  type: AnimationType;
  duration: number; // ms
  delay: number; // ms
  easing: AnimationEasing;
  trigger: AnimationTrigger;
}

/* ------------------------------- Section ------------------------------ */

export type SectionBackground = 'default' | 'surface' | 'primary' | 'accent' | 'inverted' | 'gradient' | 'transparent';
export type SpacingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type SectionWidth = 'narrow' | 'default' | 'wide' | 'full';

export interface SectionStyle {
  background: SectionBackground;
  paddingY: SpacingSize;
  width: SectionWidth;
  align: 'left' | 'center';
  animation: AnimationConfig;
  hideOn: { mobile: boolean; tablet: boolean; desktop: boolean };
  anchor: string;
  showInNav: boolean;
}

interface SectionBase {
  id: string;
  /** Display name — editable ("rename section"). */
  name: string;
  enabled: boolean;
  locked: boolean;
  order: number;
  style: SectionStyle;
}

export type SectionOf<K extends SectionType> = SectionBase & { type: K; data: SectionDataMap[K] };

/** Discriminated union: narrowing on `type` gives a typed `data`. */
export type PortfolioSection = { [K in SectionType]: SectionOf<K> }[SectionType];

/* -------------------------------- Theme ------------------------------- */

export interface ColorPalette {
  primary: string;
  primaryContrast: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export type ColorKey = keyof ColorPalette;
export type ColorScheme = 'light' | 'dark';

export interface TypographyConfig {
  headingFont: string; // font id from catalog or custom font family
  bodyFont: string;
  monoFont: string;
  baseSize: number; // px
  scale: number; // modular ratio
  headingWeight: number;
  bodyWeight: number;
  lineHeight: number;
  headingLineHeight: number;
  letterSpacing: number; // em
  headingLetterSpacing: number; // em
  headingTransform: 'none' | 'uppercase';
}

export interface LayoutConfig {
  maxWidth: number; // px
  sectionSpacing: number; // px (base vertical padding)
  cardRadius: number;
  buttonRadius: number;
  containerPadding: number;
  gridGap: number;
}

export type ShadowStyle = 'none' | 'soft' | 'medium' | 'hard' | 'glow';

export interface EffectsConfig {
  shadow: ShadowStyle;
  blur: number; // px backdrop blur for glass
  glass: boolean;
  gradient: boolean;
  gradientAngle: number;
  borderWidth: number;
  grain: boolean;
}

export interface MotionConfig {
  enabled: boolean;
  duration: number;
  easing: AnimationEasing;
  defaultAnimation: AnimationType;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  palettes: Record<ColorScheme, ColorPalette>;
  defaultScheme: ColorScheme;
  typography: TypographyConfig;
  layout: LayoutConfig;
  effects: EffectsConfig;
  motion: MotionConfig;
  cardStyle: 'flat' | 'outlined' | 'elevated' | 'glass' | 'brutal';
  buttonStyle: 'solid' | 'outline' | 'pill' | 'brutal' | 'underline';
}

/* ------------------------- Metadata & settings ------------------------ */

export interface CustomFont {
  id: string;
  family: string;
  assetId: string;
  format: 'woff2' | 'woff' | 'truetype' | 'opentype';
  weight: string;
  style: 'normal' | 'italic';
}

export interface PortfolioMetadata {
  title: string;
  description: string;
  keywords: string[];
  author: string;
  siteUrl: string;
  language: string;
  ogImage: ImageRef;
  favicon: string; // emoji or asset/url
  twitterHandle: string;
  customFonts: CustomFont[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSettings {
  colorScheme: ColorScheme | 'system';
  showThemeToggle: boolean;
  navigation: { enabled: boolean; style: 'bar' | 'floating' | 'minimal'; sticky: boolean; brand: string };
  footer: { enabled: boolean; text: string; showCredit: boolean };
  smoothScroll: boolean;
  animations: boolean;
  fontDelivery: 'system' | 'cdn';
  backToTop: boolean;
}

export interface Portfolio {
  id: string;
  version: string;
  metadata: PortfolioMetadata;
  theme: ThemeConfig;
  sections: PortfolioSection[];
  settings: PortfolioSettings;
}

/* ------------------------------- Assets ------------------------------- */

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  blob: Blob;
  createdAt: string;
}

/** Serializable asset form used in JSON backups. */
export interface SerializedAsset {
  id: string;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface ProjectBackup {
  format: 'portfolio-os-project';
  formatVersion: 1;
  exportedAt: string;
  generator: string;
  portfolio: Portfolio;
  assets: SerializedAsset[];
}
