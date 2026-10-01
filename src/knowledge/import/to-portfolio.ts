/**
 * Library items → portfolio sections (pure). Items keep their library id, so a linked portfolio
 * stays in sync with Resume Studio and the library.
 *
 *  - Target: the given section if it has the right type, else the first section of that type,
 *    else a new section placed before Contact.
 *  - Items already in the section (same id) are not added twice; locked sections are skipped.
 */
import type { Portfolio, PortfolioSection, SectionType } from '@/types/portfolio';
import type { Library, LibraryKind } from '@/studio/model/types';
import { createSection, getDefinition } from '@/sections/registry';
import { SHARED_FIELDS } from '@/studio/sync/portfolio';

type Loose = Record<string, unknown>;

/** Section type that shows a library kind (they share names). */
export const sectionTypeFor = (kind: LibraryKind): SectionType => kind as SectionType;

function newItem(type: SectionType): Loose {
  const list = getDefinition(type).fields.find((f) => f.kind === 'list' && f.key === 'items');
  return list && list.kind === 'list' ? list.createItem() : {};
}

export function toPortfolioItem(kind: LibraryKind, lib: Loose & { id: string }): Loose {
  const base = newItem(sectionTypeFor(kind));
  const shared = Object.fromEntries(SHARED_FIELDS[kind].filter((f) => lib[f] !== undefined).map((f) => [f, structuredClone(lib[f])]));
  return { ...base, ...shared, id: lib.id };
}

export interface PortfolioInsert {
  portfolio: Portfolio;
  /** Section that received the items, per kind. */
  sections: Partial<Record<LibraryKind, string>>;
  added: number;
  locked: string[];
}

export function insertIntoPortfolio(p: Portfolio, library: Library, picks: Array<{ kind: LibraryKind; id: string }>, targetId?: string | null): PortfolioInsert {
  let sections = [...p.sections].sort((a, b) => a.order - b.order);
  const out: PortfolioInsert = { portfolio: p, sections: {}, added: 0, locked: [] };
  const byKind = new Map<LibraryKind, string[]>();
  for (const x of picks) byKind.set(x.kind, [...(byKind.get(x.kind) ?? []), x.id]);

  for (const [kind, ids] of byKind) {
    const type = sectionTypeFor(kind);
    const items = ids.map((id) => (library[kind] as unknown as Array<Loose & { id: string }>).find((x) => x.id === id)).filter(Boolean) as Array<Loose & { id: string }>;
    if (!items.length) continue;
    const target = sections.find((s) => s.id === targetId && s.type === type) ?? sections.find((s) => s.type === type);
    if (target?.locked) {
      out.locked.push(target.name);
      continue;
    }
    if (target) {
      const data = target.data as unknown as Loose;
      const cur = (data.items as Loose[]) ?? [];
      const fresh = items.filter((it) => !cur.some((c) => c.id === it.id)).map((it) => toPortfolioItem(kind, it));
      out.added += fresh.length;
      sections = sections.map((s) => (s.id === target.id ? ({ ...s, data: { ...data, items: [...cur, ...fresh] } } as unknown as PortfolioSection) : s));
      out.sections[kind] = target.id;
    } else {
      const section = createSection(type, { items: items.map((it) => toPortfolioItem(kind, it)) } as never, sections) as PortfolioSection;
      const end = sections.findIndex((s) => s.type === 'contact');
      sections.splice(end >= 0 ? end : sections.length, 0, section);
      out.added += items.length;
      out.sections[kind] = section.id;
    }
  }
  out.portfolio = { ...p, sections: sections.map((s, i) => (s.order === i ? s : { ...s, order: i })) };
  return out;
}
