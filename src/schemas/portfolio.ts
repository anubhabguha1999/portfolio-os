import { z } from 'zod';
import type { Portfolio, PortfolioSection, SectionStyle, ThemeConfig } from '@/types/portfolio';
import { SECTION_TYPES, defaultSectionStyle, getDefinition, isSectionType } from '@/sections/registry';
import { defaultMetadata, defaultSettings } from '@/lib/portfolio-factory';
import { getTheme, DEFAULT_THEME_ID } from '@/lib/theme/themes';
import { SCHEMA_VERSION } from '@/config/brand';
import { uid } from '@/utils/id';
import type { FieldDef } from '@/types/fields';
import { migrate } from './migrations';

const sectionShape = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES as [string, ...string[]]),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  locked: z.boolean().optional(),
  order: z.number().optional(),
  data: z.record(z.string(), z.unknown()),
  style: z.record(z.string(), z.unknown()).optional(),
});

export const portfolioShape = z.object({
  id: z.string().min(1),
  version: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  theme: z.record(z.string(), z.unknown()),
  sections: z.array(sectionShape),
  settings: z.record(z.string(), z.unknown()),
});

export class PortfolioValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'PortfolioValidationError';
    this.issues = issues;
  }
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merge `value` onto `defaults`, keeping only keys with the same primitive type. */
function mergeDefaults<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (isObj(defaults)) {
    if (!isObj(value)) return defaults;
    const out: Json = { ...defaults };
    for (const [k, dv] of Object.entries(defaults)) {
      if (k in value) out[k] = mergeDefaults(dv, value[k]);
    }
    return out as T;
  }
  if (value === undefined || value === null) return defaults;
  if (typeof defaults === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return (Number.isFinite(n) ? n : defaults) as T;
  }
  if (typeof defaults === typeof value) return value as T;
  if (typeof defaults === 'string' && (typeof value === 'number' || typeof value === 'boolean')) return String(value) as T;
  return defaults;
}

/** Normalise list items against the field schema so missing keys get safe defaults. */
function normalizeFields(fields: FieldDef[], data: Json, defaults: Json): Json {
  const out = mergeDefaults(defaults, data);
  for (const f of fields) {
    if (f.kind === 'list') {
      const raw = data[f.key];
      const items = Array.isArray(raw) ? raw : (defaults[f.key] as unknown[]) ?? [];
      const seen = new Set<string>();
      out[f.key] = items.filter(isObj).map((item) => {
        const base = f.createItem();
        const merged = normalizeFields(f.fields, item, base);
        let id = typeof merged.id === 'string' && merged.id ? merged.id : uid('itm');
        if (seen.has(id)) id = uid('itm');
        seen.add(id);
        if ('id' in base) merged.id = id;
        return merged;
      });
    } else if (f.kind === 'tags' || f.kind === 'stringList') {
      const raw = data[f.key];
      out[f.key] = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' || typeof x === 'number').map(String) : (defaults[f.key] ?? []);
    } else if (f.kind === 'imageList') {
      const raw = data[f.key];
      out[f.key] = Array.isArray(raw) ? raw.filter(isObj).map((r) => ({ src: typeof r.src === 'string' ? r.src : '', alt: typeof r.alt === 'string' ? r.alt : '' })) : [];
    } else if ((f.kind === 'select' || f.kind === 'segmented') && f.key in out) {
      const allowed = f.options.map((o) => o.value);
      const v = String(out[f.key]);
      if (!allowed.includes(v)) out[f.key] = defaults[f.key];
      else if (typeof defaults[f.key] === 'number') out[f.key] = Number(v);
    }
  }
  return out;
}

export function normalizeSection(raw: Json, index: number): PortfolioSection | null {
  const type = raw.type;
  if (!isSectionType(type)) return null;
  const def = getDefinition(type);
  const defaults = def.createData() as unknown as Json;
  const data = normalizeFields(def.fields, isObj(raw.data) ? raw.data : {}, defaults);
  const style = mergeDefaults<SectionStyle>(defaultSectionStyle(type), raw.style);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('sec'),
    type,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : def.label,
    enabled: raw.enabled !== false,
    locked: raw.locked === true,
    order: index,
    style,
    data,
  } as unknown as PortfolioSection;
}

function normalizeTheme(raw: Json): ThemeConfig {
  const base = getTheme(typeof raw.id === 'string' ? raw.id : DEFAULT_THEME_ID);
  const merged = mergeDefaults(base, raw);
  merged.id = typeof raw.id === 'string' ? raw.id : base.id;
  return merged;
}

export interface ParseResult {
  portfolio: Portfolio;
  migratedFrom: string | null;
  warnings: string[];
}

/**
 * Parse *anything* claiming to be a portfolio: migrate old schemas, validate the
 * structure, then normalise every section against its definition.
 */
export function parsePortfolio(input: unknown): ParseResult {
  const warnings: string[] = [];
  const { value, from } = migrate(input);
  const res = portfolioShape.safeParse(value);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new PortfolioValidationError('This file is not a valid portfolio (or it is corrupted).', issues);
  }
  const raw = res.data;
  const sections: PortfolioSection[] = [];
  const ids = new Set<string>();
  const anchors = new Set<string>();
  const ordered = [...raw.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  ordered.forEach((s) => {
    const n = normalizeSection(s as Json, sections.length);
    if (!n) {
      warnings.push(`Skipped unknown section type "${String(s.type)}".`);
      return;
    }
    if (ids.has(n.id)) n.id = uid('sec');
    ids.add(n.id);
    let anchor = n.style.anchor || n.type;
    let i = 2;
    while (anchors.has(anchor)) anchor = `${n.style.anchor}-${i++}`;
    n.style.anchor = anchor;
    anchors.add(anchor);
    sections.push(n);
  });
  const metadata = mergeDefaults(defaultMetadata(), raw.metadata);
  const portfolio: Portfolio = {
    id: raw.id,
    version: SCHEMA_VERSION,
    metadata,
    theme: normalizeTheme(raw.theme),
    sections,
    settings: mergeDefaults(defaultSettings(), raw.settings),
  };
  return { portfolio, migratedFrom: from, warnings };
}

export function isPortfolioLike(v: unknown): boolean {
  try {
    parsePortfolio(v);
    return true;
  } catch {
    return false;
  }
}
