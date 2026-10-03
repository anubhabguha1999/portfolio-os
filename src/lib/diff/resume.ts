/**
 * Compare two resumes by what they actually print: both are resolved against the shared
 * profile + library first (so detached fields, hidden items and auto-included entries
 * are honoured), then matched section by section and entry by entry.
 */
import type { Library, Profile, ResumeDoc, ResumeSection, ResumeStyle } from '@/studio/model/types';
import { resolveResume, type ResolvedItem, type ResolvedResume, type ResolvedSection } from '@/studio/model/resolve';
import { diffSequence, diffSet, diffWords, hasChanges, similarity, wordStats, type DiffOp, type SetDiff } from './index';

export type ChangeStatus = 'same' | 'changed' | 'added' | 'removed';

export interface FieldDiff {
  field: string;
  label: string;
  a: string;
  b: string;
  ops: DiffOp<string>[];
  status: ChangeStatus;
}

export interface LineDiff {
  status: ChangeStatus;
  a: string;
  b: string;
  ops: DiffOp<string>[];
}

export interface ItemDiff {
  key: string;
  status: ChangeStatus;
  /** Display title (B's when present). */
  title: string;
  a: ResolvedItem | null;
  b: ResolvedItem | null;
  /** Position changed relative to the other entries present in both. */
  moved: boolean;
  fields: FieldDiff[];
  bullets: LineDiff[];
  tags: SetDiff;
}

export interface SkillsDiff extends SetDiff {
  /** Category headings (for grouped skills). */
  categories: SetDiff;
}

export type Presence = 'shown' | 'hidden' | 'empty' | 'absent';

export interface SectionDiff {
  key: string;
  kind: ResolvedSection['kind'];
  title: string;
  status: ChangeStatus;
  presence: { a: Presence; b: Presence };
  moved: boolean;
  /** Section heading rename. */
  heading: FieldDiff | null;
  text: FieldDiff | null;
  items: ItemDiff[];
  skills: SkillsDiff | null;
  a: ResolvedSection | null;
  b: ResolvedSection | null;
}

export interface DesignDiff {
  key: string;
  label: string;
  a: string;
  b: string;
  changed: boolean;
}

export interface CompareSummary {
  sectionsAdded: number;
  sectionsRemoved: number;
  sectionsChanged: number;
  sectionsMoved: number;
  sectionsHidden: number;
  entriesAdded: number;
  entriesRemoved: number;
  entriesChanged: number;
  entriesMoved: number;
  wordsAdded: number;
  wordsRemoved: number;
  skillsAdded: number;
  skillsRemoved: number;
  designChanges: number;
  /** Everything above that is a content change (excludes design). */
  totalContent: number;
}

export interface ResumeComparison {
  a: ResolvedResume;
  b: ResolvedResume;
  header: { fields: FieldDiff[]; contact: SetDiff; status: ChangeStatus };
  sections: SectionDiff[];
  design: DesignDiff[];
  summary: CompareSummary;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function fieldDiff(field: string, label: string, a: string, b: string): FieldDiff {
  const ops = diffWords(a, b);
  const status: ChangeStatus = a.trim() === b.trim() ? 'same' : !a.trim() ? 'added' : !b.trim() ? 'removed' : 'changed';
  return { field, label, a, b, ops, status };
}

/** Bullet lists: exact matches stay aligned, similar ones pair up as "changed" with an inline diff. */
export function diffLines(a: readonly string[], b: readonly string[]): LineDiff[] {
  const ops = diffSequence(a, b, (x, y) => norm(x) === norm(y));
  const out: LineDiff[] = [];
  let k = 0;
  while (k < ops.length) {
    const op = ops[k]!;
    if (op.type === 'equal') {
      out.push({ status: 'same', a: op.value, b: op.value, ops: [{ type: 'equal', value: op.value }] });
      k++;
      continue;
    }
    // A changed block: deletes then inserts.
    const dels: string[] = [];
    const ins: string[] = [];
    while (k < ops.length && ops[k]!.type !== 'equal') {
      const o = ops[k++]!;
      (o.type === 'delete' ? dels : ins).push(o.value);
    }
    const usedIns = new Set<number>();
    const pairedDel = new Map<number, number>();
    dels.forEach((d, di) => {
      let best = -1;
      let bestScore = 0.4;
      ins.forEach((s, si) => {
        if (usedIns.has(si)) return;
        const score = similarity(d, s);
        if (score > bestScore) {
          best = si;
          bestScore = score;
        }
      });
      if (best >= 0) {
        usedIns.add(best);
        pairedDel.set(di, best);
      }
    });
    const delAt = new Map<number, number>([...pairedDel].map(([di, si]) => [si, di]));
    // Emit in B's order; unpaired deletes go before the block's first insert.
    dels.forEach((d, di) => {
      if (!pairedDel.has(di)) out.push({ status: 'removed', a: d, b: '', ops: [{ type: 'delete', value: d }] });
    });
    ins.forEach((s, si) => {
      const di = delAt.get(si);
      if (di === undefined) out.push({ status: 'added', a: '', b: s, ops: [{ type: 'insert', value: s }] });
      else out.push({ status: 'changed', a: dels[di]!, b: s, ops: diffWords(dels[di]!, s) });
    });
  }
  return out;
}

/** Stable keys for matching: library items by id, local entries by title + subtitle. */
function itemKey(it: ResolvedItem): string {
  return it.libId ? `lib:${it.libId}` : `local:${norm(it.title)}|${norm(it.subtitle)}`;
}

const ITEM_FIELDS: Array<[keyof ResolvedItem & string, string]> = [
  ['title', 'Title'],
  ['subtitle', 'Subtitle'],
  ['date', 'Date'],
  ['location', 'Location'],
  ['url', 'Link'],
  ['description', 'Description'],
];

function itemDiff(key: string, a: ResolvedItem | null, b: ResolvedItem | null, moved: boolean): ItemDiff {
  const fields = ITEM_FIELDS.map(([f, label]) => fieldDiff(f, label, String(a?.[f] ?? ''), String(b?.[f] ?? ''))).filter((f) => f.a || f.b);
  const bullets = diffLines(a?.bullets ?? [], b?.bullets ?? []);
  const tags = diffSet(a?.tags ?? [], b?.tags ?? []);
  let status: ChangeStatus;
  if (!a) status = 'added';
  else if (!b) status = 'removed';
  else status = fields.some((f) => f.status !== 'same') || bullets.some((l) => l.status !== 'same') || tags.added.length || tags.removed.length ? 'changed' : 'same';
  return { key, status, title: (b ?? a)!.title || (b ?? a)!.subtitle || 'Untitled entry', a, b, moved, fields, bullets, tags };
}

/** Entries present in both, whose relative order differs. */
function movedKeys(aKeys: string[], bKeys: string[]): Set<string> {
  const inB = new Set(bKeys);
  const inA = new Set(aKeys);
  const ca = aKeys.filter((k) => inB.has(k));
  const cb = bKeys.filter((k) => inA.has(k));
  const keep = new Set(diffSequence(ca, cb).filter((o) => o.type === 'equal').map((o) => o.value));
  return new Set(cb.filter((k) => !keep.has(k)));
}

function dedupeKeys<T>(list: T[], keyOf: (t: T) => string): Array<{ key: string; value: T }> {
  const seen = new Map<string, number>();
  return list.map((value) => {
    const base = keyOf(value);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n ? `${base}#${n}` : base, value };
  });
}

export function diffItems(a: ResolvedItem[], b: ResolvedItem[]): ItemDiff[] {
  const ka = dedupeKeys(a, itemKey);
  const kb = dedupeKeys(b, itemKey);
  const mapA = new Map(ka.map((x) => [x.key, x.value]));
  const mapB = new Map(kb.map((x) => [x.key, x.value]));
  // Local entries whose title changed: pair leftovers by similarity so they read as "changed".
  const onlyA = ka.filter((x) => !mapB.has(x.key));
  const onlyB = kb.filter((x) => !mapA.has(x.key));
  const alias = new Map<string, string>(); // b key → a key
  const usedA = new Set<string>();
  for (const xb of onlyB) {
    let best: string | null = null;
    let bestScore = 0.5;
    for (const xa of onlyA) {
      if (usedA.has(xa.key) || !!xa.value.libId !== !!xb.value.libId || xa.value.libId) continue;
      const sameTitle = !!norm(xa.value.title) && norm(xa.value.title) === norm(xb.value.title);
      const score = sameTitle ? 1 : similarity(`${xa.value.title} ${xa.value.subtitle} ${xa.value.description} ${xa.value.bullets.join(' ')}`, `${xb.value.title} ${xb.value.subtitle} ${xb.value.description} ${xb.value.bullets.join(' ')}`);
      if (score > bestScore) {
        best = xa.key;
        bestScore = score;
      }
    }
    if (best) {
      usedA.add(best);
      alias.set(xb.key, best);
    }
  }
  const bKeysAsA = kb.map((x) => alias.get(x.key) ?? x.key);
  const moved = movedKeys(
    ka.map((x) => x.key),
    bKeysAsA,
  );
  const out: ItemDiff[] = [];
  // Walk B's order, keeping A-only entries where they sat relative to shared ones.
  const order = diffSequence(
    ka.map((x) => x.key),
    bKeysAsA,
  );
  for (const op of order) {
    const ak = op.value;
    if (op.type === 'delete') {
      // Moved or paired entries are emitted at their B position instead.
      if (!bKeysAsA.includes(ak)) out.push(itemDiff(ak, mapA.get(ak)!, null, false));
      continue;
    }
    const bk = kb[bKeysAsA.indexOf(ak)]!.key;
    out.push(itemDiff(bk, mapA.get(ak) ?? null, mapB.get(bk)!, moved.has(ak)));
  }
  return out;
}

function skillNames(s: ResolvedSection | null): string[] {
  return s ? s.skills.flatMap((g) => g.names) : [];
}

function sectionKey(kind: string, title: string): string {
  return kind === 'custom' ? `custom:${norm(title)}` : kind;
}

interface Slot {
  key: string;
  raw: ResumeSection;
  resolved: ResolvedSection | null;
  presence: Presence;
}

function slots(doc: ResumeDoc, resolved: ResolvedResume): Slot[] {
  const byId = new Map(resolved.sections.map((s) => [s.id, s]));
  const raw = doc.sections.filter((s) => s.kind !== 'profile');
  return dedupeKeys(raw, (s) => sectionKey(s.kind, s.title)).map(({ key, value }) => {
    const r = byId.get(value.id) ?? null;
    return { key, raw: value, resolved: r, presence: value.hidden ? 'hidden' : r ? 'shown' : 'empty' };
  });
}

function sectionDiff(key: string, sa: Slot | undefined, sb: Slot | undefined, moved: boolean): SectionDiff {
  const a = sa?.resolved ?? null;
  const b = sb?.resolved ?? null;
  const any = (b ?? a)!;
  const isSkills = any.kind === 'skills' || any.kind === 'technical-skills';
  const heading = a && b ? fieldDiff('title', 'Heading', a.title, b.title) : null;
  const text = a?.text || b?.text ? fieldDiff('text', any.kind === 'summary' ? 'Summary' : 'Text', a?.text ?? '', b?.text ?? '') : null;
  const items = isSkills ? [] : diffItems(a?.items ?? [], b?.items ?? []);
  let skills: SkillsDiff | null = null;
  if (isSkills) {
    const cats = (s: ResolvedSection | null) => (s ? s.skills.map((g) => g.category).filter(Boolean) : []);
    skills = { ...diffSet(skillNames(a), skillNames(b)), categories: diffSet(cats(a), cats(b)) };
  }
  let status: ChangeStatus;
  if (!a) status = 'added';
  else if (!b) status = 'removed';
  else
    status =
      heading?.status !== 'same' ||
      (text && text.status !== 'same') ||
      items.some((i) => i.status !== 'same' || i.moved) ||
      (skills && (skills.added.length || skills.removed.length || skills.categories.added.length || skills.categories.removed.length))
        ? 'changed'
        : 'same';
  return {
    key,
    kind: any.kind,
    title: any.title,
    status,
    presence: { a: sa?.presence ?? 'absent', b: sb?.presence ?? 'absent' },
    moved,
    heading,
    text,
    items,
    skills,
    a,
    b,
  };
}

const PAPER: Record<string, string> = { a4: 'A4', letter: 'US Letter', legal: 'US Legal' };

type StyleRow = [keyof ResumeStyle, string, (v: ResumeStyle) => string];
const STYLE_ROWS: StyleRow[] = [
  ['paper', 'Page size', (s) => PAPER[s.paper] ?? s.paper],
  ['font', 'Font', (s) => (s.font === 'template' ? 'Template default' : s.font[0]!.toUpperCase() + s.font.slice(1))],
  ['baseSize', 'Body size', (s) => `${s.baseSize} pt`],
  ['lineHeight', 'Line height', (s) => String(s.lineHeight)],
  ['spacing', 'Spacing', (s) => `${Math.round(s.spacing * 100)}%`],
  ['margins', 'Margins', (s) => s.margins],
  ['accent', 'Accent colour', (s) => s.accent],
  ['colorPreset', 'Colour preset', (s) => s.colorPreset],
  ['atsSafe', 'ATS-safe mode', (s) => (s.atsSafe ? 'On' : 'Off')],
  ['photo', 'Photo', (s) => s.photo],
  ['headerAlign', 'Header alignment', (s) => s.headerAlign],
  ['headerHeight', 'Header height', (s) => s.headerHeight],
  ['borderStyle', 'Borders', (s) => s.borderStyle],
  ['iconStyle', 'Icons', (s) => s.iconStyle],
  ['sidebarWidth', 'Sidebar width', (s) => `${Math.round(s.sidebarWidth * 100)}%`],
  ['dateFormat', 'Date format', (s) => s.dateFormat],
  ['pageNumbers', 'Page numbers', (s) => (s.pageNumbers ? 'On' : 'Off')],
  ['pageLimit', 'Page limit', (s) => (s.pageLimit ? String(s.pageLimit) : 'None')],
  ['fit', 'Fit to page', (s) => (s.fit ? 'Applied' : 'Off')],
];

export function diffDesign(a: ResumeDoc, b: ResumeDoc, templateName: (id: string) => string = (id) => id): DesignDiff[] {
  const rows: DesignDiff[] = [
    { key: 'templateId', label: 'Template', a: templateName(a.templateId), b: templateName(b.templateId), changed: a.templateId !== b.templateId },
    { key: 'kind', label: 'Type', a: a.kind === 'cv' ? 'CV' : 'Resume', b: b.kind === 'cv' ? 'CV' : 'Resume', changed: a.kind !== b.kind },
  ];
  for (const [key, label, fmt] of STYLE_ROWS) {
    const va = fmt(a.style);
    const vb = fmt(b.style);
    rows.push({ key, label, a: va, b: vb, changed: va !== vb });
  }
  return rows;
}

export interface CompareInput {
  a: ResumeDoc;
  b: ResumeDoc;
  library: Library;
  profile: Profile;
  templateName?: (id: string) => string;
}

export function compareResumes({ a: docA, b: docB, library, profile, templateName }: CompareInput): ResumeComparison {
  const a = resolveResume(docA, library, profile);
  const b = resolveResume(docB, library, profile);

  const headerFields = [fieldDiff('name', 'Name', a.name, b.name), fieldDiff('headline', 'Headline', a.headline, b.headline)];
  const contact = diffSet(
    a.contact.map((c) => c.label),
    b.contact.map((c) => c.label),
  );
  const headerStatus: ChangeStatus = headerFields.some((f) => f.status !== 'same') || contact.added.length || contact.removed.length ? 'changed' : 'same';

  const slotsA = slots(docA, a);
  const slotsB = slots(docB, b);
  const mapA = new Map(slotsA.map((s) => [s.key, s]));
  const mapB = new Map(slotsB.map((s) => [s.key, s]));
  const shownA = slotsA.filter((s) => s.resolved).map((s) => s.key);
  const shownB = slotsB.filter((s) => s.resolved).map((s) => s.key);
  const moved = movedKeys(shownA, shownB);

  const sections: SectionDiff[] = [];
  for (const op of diffSequence(shownA, shownB)) {
    if (op.type === 'delete' && shownB.includes(op.value)) continue; // moved: emitted at B's position
    // Slots that exist but don't print (hidden / empty) still report their presence.
    sections.push(sectionDiff(op.value, mapA.get(op.value), mapB.get(op.value), moved.has(op.value)));
  }

  const design = diffDesign(docA, docB, templateName);

  const summary: CompareSummary = {
    sectionsAdded: 0,
    sectionsRemoved: 0,
    sectionsChanged: 0,
    sectionsMoved: 0,
    sectionsHidden: 0,
    entriesAdded: 0,
    entriesRemoved: 0,
    entriesChanged: 0,
    entriesMoved: 0,
    wordsAdded: 0,
    wordsRemoved: 0,
    skillsAdded: 0,
    skillsRemoved: 0,
    designChanges: design.filter((d) => d.changed).length,
    totalContent: 0,
  };
  const countWords = (ops: DiffOp<string>[]) => {
    const w = wordStats(ops);
    summary.wordsAdded += w.added;
    summary.wordsRemoved += w.removed;
  };
  for (const f of headerFields) countWords(f.ops);
  for (const s of sections) {
    if (s.status === 'added') summary.sectionsAdded++;
    if (s.status === 'removed') summary.sectionsRemoved++;
    if (s.status === 'changed') summary.sectionsChanged++;
    if (s.moved) summary.sectionsMoved++;
    if ((s.status === 'removed' && s.presence.b === 'hidden') || (s.status === 'added' && s.presence.a === 'hidden')) summary.sectionsHidden++;
    if (s.text) countWords(s.text.ops);
    if (s.skills) {
      summary.skillsAdded += s.skills.added.length;
      summary.skillsRemoved += s.skills.removed.length;
    }
    for (const it of s.items) {
      if (it.status === 'added') summary.entriesAdded++;
      else if (it.status === 'removed') summary.entriesRemoved++;
      else if (it.status === 'changed') summary.entriesChanged++;
      if (it.moved) summary.entriesMoved++;
      if (it.status === 'changed') {
        for (const f of it.fields) countWords(f.ops);
        for (const l of it.bullets) countWords(l.ops);
      }
    }
  }
  summary.totalContent =
    summary.sectionsAdded +
    summary.sectionsRemoved +
    summary.sectionsChanged +
    summary.sectionsMoved +
    (headerStatus === 'changed' ? 1 : 0);

  return { a, b, header: { fields: headerFields, contact, status: headerStatus }, sections, design, summary };
}

/** True when the comparison has any printed-content difference. */
export function hasContentChanges(c: ResumeComparison): boolean {
  return c.header.status !== 'same' || c.sections.some((s) => s.status !== 'same' || s.moved);
}

export { hasChanges };
