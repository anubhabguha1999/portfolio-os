/**
 * Portfolio ⇄ shared library.
 *
 *  - Items are matched by id (a portfolio experience item and a library experience
 *    entry with the same id are the same thing).
 *  - Pull (library → portfolio) runs when a linked portfolio opens: shared fields and
 *    profile details are refreshed; portfolio-only data (images, galleries, case
 *    studies, layout) is never touched, and library items are not forced into the site.
 *  - Push (portfolio → library) is diff-based: only fields the user actually changed in
 *    the builder are written back, so newer edits made in Resume Studio are never
 *    overwritten by stale portfolio values. New portfolio items join the library.
 *  - Deleting something in the portfolio does not delete it from the library.
 */
import type { Portfolio, PortfolioSection, SectionType } from '@/types/portfolio';
import type { Library, LibraryKind, Profile, SocialLink } from '@/studio/model/types';
import { LIB_FACTORIES } from '@/studio/model/defaults';

const KIND_FOR: Partial<Record<SectionType, LibraryKind>> = {
  experience: 'experience',
  projects: 'projects',
  education: 'education',
  skills: 'skills',
  certifications: 'certifications',
  achievements: 'achievements',
};

/** Fields that are the same thing in both models. */
export const SHARED_FIELDS: Record<LibraryKind, string[]> = {
  experience: ['company', 'role', 'location', 'start', 'end', 'current', 'url', 'description', 'achievements', 'technologies'],
  projects: ['title', 'description', 'technologies', 'role', 'duration', 'github', 'live', 'features'],
  education: ['institution', 'degree', 'field', 'location', 'start', 'end', 'grade', 'description'],
  skills: ['name', 'category', 'level'],
  certifications: ['name', 'issuer', 'date', 'credentialId', 'url'],
  achievements: ['title', 'description', 'date', 'url'],
};

export type ProfileField = 'name' | 'headline' | 'bio' | 'email' | 'phone' | 'location' | 'website' | 'socialLinks';

export interface Projection {
  profile: Partial<Record<ProfileField, unknown>>;
  items: Record<LibraryKind, Record<string, Record<string, unknown>>>;
}

type Loose = Record<string, unknown>;
type AnySection = Omit<PortfolioSection, 'data'> & { data: Loose };
const libList = (library: Library, kind: LibraryKind) => library[kind] as unknown as Array<Loose & { id: string }>;

function sectionsOf(p: Portfolio, type: SectionType): AnySection[] {
  return p.sections.filter((s) => s.type === type) as unknown as AnySection[];
}

function first(p: Portfolio, type: SectionType): AnySection | undefined {
  return sectionsOf(p, type)[0];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, structuredClone(o[k])]));

/** The shared view of a portfolio. */
export function projectPortfolio(p: Portfolio): Projection {
  const items = { experience: {}, projects: {}, education: {}, skills: {}, certifications: {}, achievements: {} } as Projection['items'];
  for (const [type, kind] of Object.entries(KIND_FOR) as Array<[SectionType, LibraryKind]>) {
    for (const s of sectionsOf(p, type)) {
      for (const it of (s.data.items as Array<Record<string, unknown>>) ?? []) {
        if (typeof it.id === 'string') items[kind][it.id] = pick(it, SHARED_FIELDS[kind]);
      }
    }
  }
  const hero = first(p, 'hero')?.data;
  const about = first(p, 'about')?.data;
  const contact = first(p, 'contact')?.data;
  const social = first(p, 'social')?.data;
  const profile: Projection['profile'] = {};
  if (hero) {
    profile.name = hero.name;
    profile.headline = hero.title;
  }
  if (about) profile.bio = about.body;
  if (contact) {
    profile.email = contact.email;
    profile.phone = contact.phone;
    profile.location = contact.location;
  }
  profile.website = p.metadata.siteUrl;
  if (social) profile.socialLinks = ((social.items as Array<Record<string, unknown>>) ?? []).map((s) => ({ id: String(s.id), platform: String(s.platform ?? ''), label: String(s.label ?? ''), url: String(s.url ?? '') }));
  return { profile, items };
}

/** Portfolio edits → library/profile patches (only what changed between two projections). */
export function pushChanges(prev: Projection | null, next: Projection, library: Library, profile: Profile): { library: Library; profile: Profile; changed: boolean } {
  let changed = false;
  const lib: Library = { ...library };
  for (const kind of Object.keys(next.items) as LibraryKind[]) {
    const before = prev?.items[kind] ?? {};
    const list = [...libList(library, kind)];
    let kindChanged = false;
    for (const [id, fields] of Object.entries(next.items[kind])) {
      const idx = list.findIndex((i) => i.id === id);
      if (idx < 0) {
        // New in the portfolio → joins the shared library.
        list.push({ ...(LIB_FACTORIES[kind] as unknown as (o: unknown) => Loose)({}), ...fields, id });
        kindChanged = true;
        continue;
      }
      const old = before[id];
      const patch: Record<string, unknown> = {};
      for (const f of SHARED_FIELDS[kind]) if (!old || !same(old[f], fields[f])) if (!same(list[idx]![f], fields[f])) patch[f] = fields[f];
      if (!old) continue; // first sighting of an existing item: library wins (pull handles it)
      if (Object.keys(patch).length) {
        list[idx] = { ...list[idx]!, ...patch };
        kindChanged = true;
      }
    }
    if (kindChanged) {
      (lib as unknown as Record<string, unknown>)[kind] = list;
      changed = true;
    }
  }
  const prof: Profile = { ...profile };
  for (const [k, v] of Object.entries(next.profile) as Array<[ProfileField, unknown]>) {
    if (prev && same(prev.profile[k], v)) continue;
    if (!prev && profile[k as keyof Profile] && String(profile[k as keyof Profile] ?? '').trim()) continue;
    if (same(profile[k as keyof Profile], v)) continue;
    (prof as unknown as Record<string, unknown>)[k] = k === 'socialLinks' ? (v as SocialLink[]) : String(v ?? '');
    changed = true;
  }
  return { library: lib, profile: prof, changed };
}

/** Library/profile → portfolio: refresh shared fields of matching items and the identity. */
export function pullIntoPortfolio(p: Portfolio, library: Library, profile: Profile): Portfolio {
  let changed = false;
  const sections = p.sections.map((s) => {
    const sec = s as unknown as AnySection;
    const kind = KIND_FOR[s.type];
    let data = sec.data;
    if (kind && Array.isArray(data.items)) {
      const byId = new Map(libList(library, kind).map((i) => [i.id, i]));
      const items = (data.items as Array<Record<string, unknown>>).map((it) => {
        const lib = byId.get(String(it.id));
        if (!lib) return it;
        const patch: Record<string, unknown> = {};
        for (const f of SHARED_FIELDS[kind]) if (lib[f] !== undefined && !same(lib[f], it[f])) patch[f] = structuredClone(lib[f]);
        return Object.keys(patch).length ? { ...it, ...patch } : it;
      });
      if (items.some((it, i) => it !== (data.items as unknown[])[i])) data = { ...data, items };
    }
    const set = (key: string, value: string | undefined) => {
      if (value === undefined || !value.trim() || data[key] === value) return;
      data = { ...data, [key]: value };
    };
    if (s.type === 'hero') {
      set('name', profile.name);
      set('title', profile.headline);
    } else if (s.type === 'about') set('body', profile.bio);
    else if (s.type === 'contact') {
      set('email', profile.email);
      set('phone', profile.phone);
      set('location', profile.location);
    } else if (s.type === 'social' && profile.socialLinks.length) {
      const items = profile.socialLinks.map((l) => ({ id: l.id, platform: l.platform, url: l.url, label: l.label }));
      if (!same(items, data.items)) data = { ...data, items };
    }
    if (data !== sec.data) {
      changed = true;
      return { ...s, data } as unknown as PortfolioSection;
    }
    return s;
  });
  let metadata = p.metadata;
  if (profile.website?.trim() && profile.website !== p.metadata.siteUrl) {
    metadata = { ...metadata, siteUrl: profile.website.trim() };
    changed = true;
  }
  if (profile.name.trim() && !p.metadata.author.trim()) {
    metadata = { ...metadata, author: profile.name.trim() };
    changed = true;
  }
  return changed ? { ...p, sections, metadata } : p;
}

/** First link: bring everything from the portfolio into an empty or partial library, then pull. */
export function linkPortfolio(p: Portfolio, library: Library, profile: Profile): { library: Library; profile: Profile; portfolio: Portfolio } {
  const pushed = pushChanges(null, projectPortfolio(p), library, profile);
  return { library: pushed.library, profile: pushed.profile, portfolio: pullIntoPortfolio(p, pushed.library, pushed.profile) };
}

export function sharedCounts(p: Portfolio, library: Library): { shared: number; portfolioOnly: number; libraryOnly: number } {
  const proj = projectPortfolio(p);
  let shared = 0;
  let portfolioOnly = 0;
  let libraryOnly = 0;
  for (const kind of Object.keys(proj.items) as LibraryKind[]) {
    const ids = new Set(Object.keys(proj.items[kind]));
    const libIds = new Set((library[kind] as Array<{ id: string }>).map((i) => i.id));
    for (const id of ids) if (libIds.has(id)) shared++;
    else portfolioOnly++;
    for (const id of libIds) if (!ids.has(id)) libraryOnly++;
  }
  return { shared, portfolioOnly, libraryOnly };
}
