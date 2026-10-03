/**
 * Output-language helpers shared by the document engine (resumes, letters, documents)
 * and the portfolio website engine. English is the source and the fallback.
 *
 *  - `t(lang, key)`       a fixed string ("Present", "Page {page} of {pages}"…)
 *  - `localizeHeading()`  translate a heading only when it is one of the engine's
 *                         English defaults — anything the user typed is kept as is
 *  - `formatMonthYear()`  "YYYY-MM" → localised month + year (Intl.DateTimeFormat)
 *  - `isRtl()`            right-to-left scripts (Arabic, Hebrew)
 *  - `pdfFontNote()`      honest warning when the PDF core fonts can't draw a script
 */
import type { Dict, DictKey, DocLanguage } from './types';
import { DOC_LANGUAGES } from './types';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { it } from './it';
import { nl } from './nl';
import { hi } from './hi';
import { ar } from './ar';
import { he } from './he';
import { zh } from './zh';
import { ja } from './ja';

export { DOC_LANGUAGES };
export type { Dict, DictKey, DocLanguage };

export const DICTIONARIES: Record<DocLanguage, Dict> = { en, es, fr, de, pt, it, nl, hi, ar, he, zh, ja };

export interface LanguageInfo {
  code: DocLanguage;
  /** English name (the app UI is English). */
  label: string;
  /** Name in the language itself. */
  native: string;
  /** BCP 47 locale used for Intl formatting and the document's language tag. */
  locale: string;
  dir: 'ltr' | 'rtl';
  /** Writing system; anything but Latin is outside the PDF core fonts (WinAnsi). */
  script: 'Latin' | 'Devanagari' | 'Arabic' | 'Hebrew' | 'Han' | 'Japanese';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', native: 'English', locale: 'en-US', dir: 'ltr', script: 'Latin' },
  { code: 'es', label: 'Spanish', native: 'Español', locale: 'es-ES', dir: 'ltr', script: 'Latin' },
  { code: 'fr', label: 'French', native: 'Français', locale: 'fr-FR', dir: 'ltr', script: 'Latin' },
  { code: 'de', label: 'German', native: 'Deutsch', locale: 'de-DE', dir: 'ltr', script: 'Latin' },
  { code: 'pt', label: 'Portuguese', native: 'Português', locale: 'pt-PT', dir: 'ltr', script: 'Latin' },
  { code: 'it', label: 'Italian', native: 'Italiano', locale: 'it-IT', dir: 'ltr', script: 'Latin' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands', locale: 'nl-NL', dir: 'ltr', script: 'Latin' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', dir: 'ltr', script: 'Devanagari' },
  { code: 'ar', label: 'Arabic', native: 'العربية', locale: 'ar', dir: 'rtl', script: 'Arabic' },
  { code: 'he', label: 'Hebrew', native: 'עברית', locale: 'he-IL', dir: 'rtl', script: 'Hebrew' },
  { code: 'zh', label: 'Chinese (Simplified)', native: '简体中文', locale: 'zh-CN', dir: 'ltr', script: 'Han' },
  { code: 'ja', label: 'Japanese', native: '日本語', locale: 'ja-JP', dir: 'ltr', script: 'Japanese' },
];

/** Options for a language <Select> ("German — Deutsch"). */
export const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l.code, label: l.code === 'en' ? l.label : `${l.label} — ${l.native}` }));

export function isDocLanguage(v: unknown): v is DocLanguage {
  return typeof v === 'string' && (DOC_LANGUAGES as readonly string[]).includes(v);
}

/** Primary subtag of a BCP 47 tag, lower-cased ("pt-BR" → "pt"). */
export function baseLanguage(tag: string | undefined | null): string {
  return (tag ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
}

/** Any stored value (missing, "de-AT", garbage) → a supported language; English by default. */
export function normalizeLanguage(v: unknown): DocLanguage {
  if (isDocLanguage(v)) return v;
  const b = typeof v === 'string' ? baseLanguage(v) : '';
  return isDocLanguage(b) ? b : 'en';
}

export function languageInfo(lang: string | undefined | null): LanguageInfo {
  const code = normalizeLanguage(lang);
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

const RTL_BASES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'yi', 'ps', 'dv', 'ckb', 'sd', 'ug']);

/** Right-to-left? Accepts any BCP 47 tag, so website languages like "fa" or "ar-EG" work too. */
export function isRtl(lang: string | undefined | null): boolean {
  return RTL_BASES.has(baseLanguage(lang));
}

export function dirOf(lang: string | undefined | null): 'ltr' | 'rtl' {
  return isRtl(lang) ? 'rtl' : 'ltr';
}

/** The dictionary for a language (English for anything unsupported). */
export function dict(lang: string | undefined | null): Dict {
  return DICTIONARIES[normalizeLanguage(lang)];
}

/** A fixed string, with `{name}` placeholders filled from `vars`. Falls back to English. */
export function t(lang: string | undefined | null, key: DictKey, vars: Record<string, string | number> = {}): string {
  const s = dict(lang)[key] || en[key];
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/* ------------------------------ Headings ------------------------------ */

/** Dictionary keys that are headings the engines (or templates) print by default. */
const HEADING_KEYS: DictKey[] = [
  'profile', 'summary', 'professionalSummary', 'about', 'aboutMe', 'careerObjective', 'summaryOfQualifications',
  'experience', 'workExperience', 'workHistory', 'employmentHistory', 'projects', 'selectedWork', 'skills',
  'technicalSkills', 'professionalSkills', 'skillsSummary', 'strengths', 'education', 'certifications', 'courses',
  'conferencesCourses', 'achievements', 'keyAchievements', 'highlights', 'awards', 'languages', 'language', 'interests',
  'publications', 'openSource', 'volunteer', 'references', 'contact', 'contactDetails', 'personalInfo', 'services',
  'kindWords', 'writing', 'elsewhere', 'journey', 'gallery', 'customSection', 'letsWorkTogether',
];

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** English default heading (case-insensitive) → key. Extra English spellings the engines use map to the same key. */
const HEADING_INDEX: Map<string, DictKey> = (() => {
  const m = new Map<string, DictKey>();
  for (const k of HEADING_KEYS) if (!m.has(norm(en[k]))) m.set(norm(en[k]), k);
  m.set('custom', 'customSection');
  m.set('open-source', 'openSource');
  return m;
})();

/** The dictionary key of an English default heading, or null for user-typed headings. */
export function headingKey(title: string): DictKey | null {
  return HEADING_INDEX.get(norm(title)) ?? null;
}

/**
 * Translate a heading only if it is one of the English defaults. Headings the user typed
 * ("Things I've built") are returned untouched; English is always returned untouched.
 */
export function localizeHeading(title: string, lang: string | undefined | null): string {
  if (normalizeLanguage(lang) === 'en') return title;
  const k = headingKey(title);
  return k ? t(lang, k) : title;
}

/** Translate an exact English default string (salutation, sign-off…); anything else is kept. */
export function localizeDefault(value: string, key: DictKey, lang: string | undefined | null): string {
  if (normalizeLanguage(lang) === 'en') return value;
  return value.trim() === en[key] ? t(lang, key) : value;
}

/* -------------------------------- Dates -------------------------------- */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${locale}|${JSON.stringify(o)}`;
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' });
    fmtCache.set(k, f);
  }
  return f;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Month + year for a stored "YYYY-MM" value. English keeps the engine's original output
 * ("Jan 2024", "January 2024", "01/2024"); other languages use Intl.DateTimeFormat.
 * `monthIndex` is 0-based.
 */
export function formatMonthYear(year: number, monthIndex: number, fmt: 'short' | 'long' | 'numeric', lang: string | undefined | null = 'en'): string {
  const code = normalizeLanguage(lang);
  if (code === 'en') {
    if (fmt === 'numeric') return `${String(monthIndex + 1).padStart(2, '0')}/${year}`;
    return `${(fmt === 'long' ? MONTHS_LONG : MONTHS_SHORT)[monthIndex]} ${year}`;
  }
  const d = new Date(Date.UTC(year, monthIndex, 1));
  const o: Intl.DateTimeFormatOptions = fmt === 'numeric' ? { year: 'numeric', month: '2-digit' } : { year: 'numeric', month: fmt === 'long' ? 'long' : 'short' };
  try {
    return dtf(languageInfo(code).locale, o).format(d);
  } catch {
    return formatMonthYear(year, monthIndex, fmt, 'en');
  }
}

/** A full date ("30 September 2026" in English; localised otherwise). `monthIndex` is 0-based. */
export function formatFullDate(year: number, monthIndex: number, day: number, lang: string | undefined | null = 'en'): string {
  const code = normalizeLanguage(lang);
  if (code === 'en') return `${day} ${MONTHS_LONG[monthIndex]} ${year}`;
  try {
    return dtf(languageInfo(code).locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(year, monthIndex, day)));
  } catch {
    return formatFullDate(year, monthIndex, day, 'en');
  }
}

/* ---------------------------- PDF coverage ---------------------------- */

/**
 * PDFs (and the paged preview, which uses the same metrics) are drawn with the 14 PDF
 * core fonts, which only encode Latin-1 (WinAnsi). There is no embedded Unicode font,
 * so Devanagari, Arabic, Hebrew, Chinese and Japanese text cannot be drawn and is removed.
 * Returns a user-facing note for those languages, or null when the PDF is fine.
 */
export function pdfFontNote(lang: string | undefined | null): string | null {
  const info = languageInfo(lang);
  if (info.script === 'Latin') return null;
  const rtl = info.dir === 'rtl' ? ' The layout is mirrored (right-aligned text, bullets and sidebar on the right), but' : '';
  return `${info.label} uses the ${info.script} script, which the built-in PDF fonts cannot draw.${rtl} ${info.label} text is left out of the PDF and the page preview until an embedded ${info.script} font is available. DOCX and TXT exports keep it in full${info.dir === 'rtl' ? ' (right-to-left in DOCX)' : ''}.`;
}
