import type { Portfolio, PortfolioMetadata, PortfolioSettings, SectionType } from '@/types/portfolio';
import { createSection } from '@/sections/registry';
import { getTheme, DEFAULT_THEME_ID } from '@/lib/theme/themes';
import { uid } from '@/utils/id';
import { SCHEMA_VERSION } from '@/config/brand';

export function defaultMetadata(): PortfolioMetadata {
  const now = new Date().toISOString();
  return {
    title: 'My Portfolio',
    description: '',
    keywords: [],
    author: '',
    siteUrl: '',
    language: 'en',
    ogImage: { src: '', alt: '' },
    favicon: '✦',
    twitterHandle: '',
    customFonts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultSettings(): PortfolioSettings {
  return {
    colorScheme: 'system',
    showThemeToggle: true,
    navigation: { enabled: true, style: 'bar', sticky: true, brand: '' },
    footer: { enabled: true, text: '', showCredit: false },
    smoothScroll: true,
    animations: true,
    fontDelivery: 'system',
    backToTop: true,
  };
}

export const STARTER_SECTIONS: SectionType[] = ['hero', 'about', 'experience', 'projects', 'skills', 'contact', 'social'];

export function createPortfolio(opts: { title?: string; themeId?: string; sections?: SectionType[] } = {}): Portfolio {
  const p: Portfolio = {
    id: uid('pf'),
    version: SCHEMA_VERSION,
    metadata: { ...defaultMetadata(), title: opts.title ?? 'My Portfolio' },
    theme: getTheme(opts.themeId ?? DEFAULT_THEME_ID),
    sections: [],
    settings: defaultSettings(),
  };
  for (const type of opts.sections ?? STARTER_SECTIONS) p.sections.push(createSection(type, {}, p.sections));
  p.sections.forEach((s, i) => (s.order = i));
  return p;
}
