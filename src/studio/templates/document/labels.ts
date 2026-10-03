import { t, type DictKey } from '@/i18n';

const KIND_KEYS: Record<string, DictKey> = {
  resume: 'kindResume',
  cv: 'kindCv',
  'cover-letter': 'kindCoverLetter',
  portfolio: 'kindPortfolio',
  'case-study': 'kindCaseStudy',
  proposal: 'kindProposal',
  profile: 'kindProfile',
  report: 'kindReport',
  presentation: 'kindPresentation',
  custom: 'kindDocument',
};

/** Human names for document kinds (in `lang`, English by default). Kept apart from the templates so list pages don't load the layout engine. */
export function kindLabel(kind: string, lang: string = 'en'): string {
  return t(lang, KIND_KEYS[kind] ?? 'kindDocument');
}
