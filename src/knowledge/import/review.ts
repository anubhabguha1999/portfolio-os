/**
 * Human review of semantic extraction before anything reaches the shared profile/library.
 *
 *  - Every field and item gets a decision: accept / ignore (values are editable).
 *  - Existing profile values are never overwritten silently: a field that differs from what is
 *    already there starts as "ignore" and shows both values.
 *  - Items that look like something already in the library are flagged as possible duplicates
 *    with merge / keep both / ignore (merge is the default: it fills blanks, never duplicates).
 *  - Applying a review returns the new profile/library plus provenance for each imported value.
 */
import { createLibAchievement, createLibCertification, createLibEducation, createLibExperience, createLibProject, createLibSkill } from '@/studio/model/defaults';
import type { LibAchievement, LibCertification, LibEducation, LibExperience, LibProject, LibSkill, Library, LibraryKind, LocalEntry, Profile, SocialLink } from '@/studio/model/types';
import { uid } from '@/utils/id';
import { sameSkill } from '../analysis/skills';
import { provenanceKey } from '../storage/repo';
import type { Provenance, ProvenanceRecord, SemanticResume } from '../types';

export type Decision = 'accept' | 'ignore';
export type DuplicateMode = 'merge' | 'keep-both' | 'ignore';

export const REVIEW_THRESHOLD = 0.75;

export type ProfileFieldKey = 'name' | 'headline' | 'bio' | 'email' | 'phone' | 'location' | 'website';

export interface ProfileReviewField {
  key: ProfileFieldKey;
  label: string;
  value: string;
  original: string;
  existing: string;
  confidence: number;
  source: Provenance | null;
  decision: Decision;
}

interface ItemBase<K extends LibraryKind, T> {
  uid: string;
  kind: K;
  value: T;
  confidence: number;
  source: Provenance | null;
  decision: Decision;
  /** Library item this looks like. */
  duplicateOf: string | null;
  duplicateLabel: string;
  duplicateMode: DuplicateMode;
}

export type ReviewItem =
  | ItemBase<'experience', LibExperience>
  | ItemBase<'projects', LibProject>
  | ItemBase<'education', LibEducation>
  | ItemBase<'skills', LibSkill & { original: string }>
  | ItemBase<'certifications', LibCertification>
  | ItemBase<'achievements', LibAchievement>;

export interface Review {
  docId: string;
  docName: string;
  profile: ProfileReviewField[];
  social: Array<{ uid: string; platform: string; url: string; decision: Decision; exists: boolean; source: Provenance | null }>;
  items: ReviewItem[];
  languages: Array<{ uid: string; language: string; fluency: string; decision: Decision }>;
}

const lc = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Similar enough to be the same thing ("Vehicle Mgmt System" vs "Vehicle Management System" is not; exact or containment is). */
const similar = (a: string, b: string) => {
  const x = lc(a);
  const y = lc(b);
  return !!x && !!y && (x === y || (x.length > 5 && y.length > 5 && (x.includes(y) || y.includes(x))));
};

const same = (a: string, b: string) => !!lc(a) && lc(a) === lc(b);

/** Prefer an exact match; fall back to a looser one only when nothing matches exactly. */
function best<T>(list: T[], exact: (x: T) => boolean, loose: (x: T) => boolean): T | undefined {
  return list.find(exact) ?? list.find(loose);
}

function findDuplicate(kind: LibraryKind, v: Record<string, unknown>, library: Library): { id: string; label: string } | null {
  const s = (k: string) => String(v[k] ?? '');
  switch (kind) {
    case 'experience': {
      // Two roles at one company are different items: the title (or start month) must match too.
      const hit = best(
        library.experience,
        (e) => similar(e.company, s('company')) && same(e.role, s('role')),
        (e) => similar(e.company, s('company')) && !!e.start && e.start === s('start') && (!s('role') || !e.role || same(e.role, s('role')) || !looksDifferentRole(e.role, s('role'))),
      );
      return hit ? { id: hit.id, label: `${hit.role} — ${hit.company}` } : null;
    }
    case 'projects': {
      const hit = best(library.projects, (p) => same(p.title, s('title')), (p) => similar(p.title, s('title')));
      return hit ? { id: hit.id, label: hit.title } : null;
    }
    case 'education': {
      const hit = best(
        library.education,
        (e) => similar(e.institution, s('institution')) && same(e.degree, s('degree')),
        (e) => similar(e.institution, s('institution')) && (!e.degree || !s('degree')),
      );
      return hit ? { id: hit.id, label: `${hit.degree} — ${hit.institution}` } : null;
    }
    case 'skills': {
      const hit = library.skills.find((k) => sameSkill(k.name, s('name')));
      return hit ? { id: hit.id, label: hit.name } : null;
    }
    case 'certifications': {
      const hit = best(library.certifications, (c) => same(c.name, s('name')), (c) => similar(c.name, s('name')));
      return hit ? { id: hit.id, label: hit.name } : null;
    }
    case 'achievements': {
      const hit = best(library.achievements, (a) => same(a.title, s('title')), (a) => similar(a.title, s('title')));
      return hit ? { id: hit.id, label: hit.title } : null;
    }
  }
}

/** "Software Developer" vs "Senior Software Developer": different seniority = different role. */
function looksDifferentRole(a: string, b: string): boolean {
  const x = lc(a);
  const y = lc(b);
  return x !== y && (x.includes(y) || y.includes(x));
}

export function buildReview(r: SemanticResume, docId: string, docName: string, profile: Profile, library: Library): Review {
  const p = r.profile;
  const fields: Array<[ProfileFieldKey, string, SemanticResume['profile'][keyof SemanticResume['profile']]]> = [
    ['name', 'Name', p.name],
    ['headline', 'Headline', p.headline],
    ['bio', 'Profile summary', p.summary],
    ['email', 'Email', p.email],
    ['phone', 'Phone', p.phone],
    ['location', 'Location', p.location],
    ['website', 'Website', p.website],
  ];
  const profileFields: ProfileReviewField[] = fields
    .filter(([, , f]) => f.value)
    .map(([key, label, f]) => {
      const existing = String(profile[key] ?? '').trim();
      const same = existing && lc(existing) === lc(f.value);
      return { key, label, value: f.value, original: f.value, existing, confidence: f.confidence, source: f.source, decision: same || (existing && !same) ? 'ignore' : 'accept' };
    });

  const urls = new Set(profile.socialLinks.map((s) => s.url.toLowerCase().replace(/\/$/, '')));
  const socialSeen = new Set<string>();
  const social = [
    ...r.socialLinks,
    ...(p.github.value && !r.socialLinks.some((s) => /github/i.test(s.url)) ? [{ platform: 'GitHub', url: p.github.value, source: p.github.source }] : []),
    ...(p.linkedin.value && !r.socialLinks.some((s) => /linkedin/i.test(s.url)) ? [{ platform: 'LinkedIn', url: p.linkedin.value, source: p.linkedin.source }] : []),
  ]
    .filter((s) => {
      const k = s.url.toLowerCase().replace(/\/$/, '');
      if (socialSeen.has(k)) return false;
      socialSeen.add(k);
      return true;
    })
    .map((s) => {
      const exists = urls.has(s.url.toLowerCase().replace(/\/$/, ''));
      return { uid: uid('rv'), platform: s.platform, url: /^https?:/i.test(s.url) ? s.url : `https://${s.url}`, decision: (exists ? 'ignore' : 'accept') as Decision, exists, source: s.source };
    });

  const items: ReviewItem[] = [];
  const push = <K extends LibraryKind>(kind: K, value: ReviewItem['value'], confidence: number, source: Provenance | null) => {
    const dup = findDuplicate(kind, value as unknown as Record<string, unknown>, library);
    items.push({
      uid: uid('rv'),
      kind,
      value,
      confidence: Math.round(confidence * 100) / 100,
      source,
      decision: confidence >= 0.4 ? 'accept' : 'ignore',
      duplicateOf: dup?.id ?? null,
      duplicateLabel: dup?.label ?? '',
      duplicateMode: 'merge',
    } as ReviewItem);
  };

  for (const e of r.experience) {
    const conf = Math.min(e.role.confidence || 1, e.company.confidence || 1, e.startDate.value ? e.startDate.confidence : 0.6);
    push('experience', createLibExperience({ company: e.company.value, role: e.role.value, location: e.location.value, start: e.startDate.value ?? '', end: e.endDate.value ?? '', current: e.current, description: e.description.value, achievements: e.achievements, technologies: e.technologies }), conf, e.role.source ?? e.company.source);
  }
  for (const x of r.projects) {
    const github = /github\.com|gitlab\.com/i.test(x.url) ? x.url : '';
    push('projects', createLibProject({ title: x.title.value, description: x.description.value, technologies: x.technologies, features: x.features, github, live: github ? '' : x.url, resumeSummary: x.description.value, resumeBullets: x.features }), x.title.confidence, x.title.source);
  }
  for (const e of r.education) push('education', createLibEducation({ institution: e.institution.value, degree: e.degree.value, field: e.field, start: e.startDate ?? '', end: e.endDate ?? '', grade: e.grade }), Math.min(e.institution.confidence || 0.5, e.degree.confidence || 0.6), e.institution.source ?? e.degree.source);
  for (const k of r.skills) push('skills', { ...createLibSkill({ name: k.name, category: k.category }), original: k.original }, k.confidence, k.source);
  for (const c of r.certifications) push('certifications', createLibCertification({ name: c.name.value, issuer: c.issuer, date: c.date, url: c.url }), c.name.confidence, c.name.source);
  for (const a of r.achievements) push('achievements', createLibAchievement({ title: a.title, description: a.description, date: a.date }), 0.7, null);

  return {
    docId,
    docName,
    profile: profileFields,
    social,
    items,
    languages: r.languages.map((l) => ({ uid: uid('rv'), language: l.language, fluency: l.fluency, decision: 'accept' as Decision })),
  };
}

/* -------------------------------- apply ------------------------------ */

export interface ApplyScope {
  profile: boolean;
  kinds: LibraryKind[];
}

export const ALL_SCOPE: ApplyScope = { profile: true, kinds: ['experience', 'projects', 'education', 'skills', 'certifications', 'achievements'] };

export interface ApplyResult {
  profile: Profile;
  library: Library;
  /** Resume-only entries (languages) keyed by section kind. */
  entries: Record<string, Array<Partial<LocalEntry>>>;
  provenance: ProvenanceRecord[];
  counts: { profileFields: number; added: number; merged: number; skipped: number };
  /** Library ids touched (added or merged), per kind. */
  touched: Partial<Record<LibraryKind, string[]>>;
}

const blank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Merge fills blanks and unions lists; it never replaces a value the user already has. */
function mergeInto<T extends Record<string, unknown>>(existing: T, add: T): T {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(add)) {
    if (k === 'id') continue;
    if (Array.isArray(v) && Array.isArray(out[k])) {
      const cur = out[k] as unknown[];
      out[k] = [...cur, ...v.filter((x) => !cur.some((c) => typeof c === 'string' && typeof x === 'string' ? sameSkill(c, x) || lc(c) === lc(x) : JSON.stringify(c) === JSON.stringify(x)))];
    } else if (blank(out[k]) && !blank(v)) out[k] = v;
  }
  return out as T;
}

export function applyReview(review: Review, profile: Profile, library: Library, scope: ApplyScope = ALL_SCOPE): ApplyResult {
  const at = new Date().toISOString();
  const prov: ProvenanceRecord[] = [];
  const src = (s: Provenance | null): Provenance => s ?? { docId: review.docId, docName: review.docName, page: 1, blockId: null };
  const counts = { profileFields: 0, added: 0, merged: 0, skipped: 0 };
  const touched: Partial<Record<LibraryKind, string[]>> = {};
  const touch = (k: LibraryKind, id: string) => (touched[k] = [...(touched[k] ?? []), id]);

  let nextProfile = profile;
  if (scope.profile) {
    nextProfile = { ...profile };
    for (const f of review.profile) {
      if (f.decision !== 'accept' || !f.value.trim()) continue;
      (nextProfile as unknown as Record<string, string>)[f.key] = f.value.trim();
      counts.profileFields++;
      prov.push({ key: provenanceKey('profile', 'profile', f.key), kind: 'profile', itemId: 'profile', field: f.key, original: f.original, source: src(f.source), importedAt: at });
    }
    const add: SocialLink[] = review.social.filter((s) => s.decision === 'accept' && !s.exists).map((s) => ({ id: uid('sl'), platform: s.platform, label: s.platform, url: s.url }));
    if (add.length) {
      nextProfile.socialLinks = [...profile.socialLinks, ...add];
      counts.profileFields += add.length;
    }
  }

  const next: Library = { ...library };
  for (const it of review.items) {
    if (!scope.kinds.includes(it.kind) || it.decision !== 'accept') {
      counts.skipped++;
      continue;
    }
    const list = [...(next[it.kind] as Array<{ id: string }>)] as Array<Record<string, unknown> & { id: string }>;
    const { original: _o, ...value } = it.value as unknown as Record<string, unknown> & { original?: string };
    if (it.duplicateOf && it.duplicateMode === 'ignore') {
      counts.skipped++;
      continue;
    }
    let id: string;
    if (it.duplicateOf && it.duplicateMode === 'merge' && list.some((x) => x.id === it.duplicateOf)) {
      id = it.duplicateOf;
      const i = list.findIndex((x) => x.id === id);
      list[i] = mergeInto(list[i]!, value as Record<string, unknown> & { id: string });
      counts.merged++;
    } else {
      id = uid(it.kind.slice(0, 3));
      list.push({ ...value, id } as Record<string, unknown> & { id: string });
      counts.added++;
    }
    (next as unknown as Record<LibraryKind, unknown[]>)[it.kind] = list;
    touch(it.kind, id);
    for (const [field, v] of Object.entries(value)) {
      if (field === 'id' || blank(v)) continue;
      prov.push({ key: provenanceKey(it.kind, id, field), kind: it.kind, itemId: id, field, original: field === 'name' && it.kind === 'skills' ? (it.value as { original?: string }).original ?? v : v, source: src(it.source), importedAt: at });
    }
  }

  const languages = review.languages.filter((l) => l.decision === 'accept' && l.language.trim()).map((l) => ({ title: l.language.trim(), subtitle: l.fluency.trim() }));
  return { profile: nextProfile, library: next, entries: languages.length ? { languages } : {}, provenance: prov, counts, touched };
}
