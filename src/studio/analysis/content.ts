/**
 * Deterministic resume content checks (rules, no AI service).
 */
import type { ResolvedItem, ResolvedResume } from '@/studio/model/resolve';
import type { Library, ResumeDoc } from '@/studio/model/types';

export interface ContentFinding {
  id: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  ref?: string;
}

const WEAK = /^(responsible for|worked on|helped|duties included|tasked with|involved in)\b/i;
const METRIC = /[\d%$€£×]/;

function dateClass(v: string): 'ym' | 'y' | 'text' | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{1,2}$/.test(s)) return 'ym';
  if (/^\d{4}$/.test(s)) return 'y';
  return 'text';
}

function ym(v: string): number | null {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v.trim());
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
}

export function analyzeContent(resolved: ResolvedResume, resume: ResumeDoc, library: Library, now = new Date()): ContentFinding[] {
  const out: ContentFinding[] = [];
  const profileRef = resolved.profileSectionId ?? undefined;
  const has = (k: string) => resolved.contact.some((c) => c.kind === k);
  if (!has('email')) out.push({ id: 'missing-email', level: 'error', message: 'Missing email address.', ...(profileRef ? { ref: profileRef } : {}) });
  if (!has('phone')) out.push({ id: 'missing-phone', level: 'warn', message: 'Missing phone number.', ...(profileRef ? { ref: profileRef } : {}) });
  if (!resolved.headline.trim()) out.push({ id: 'missing-headline', level: 'info', message: 'No headline under your name (e.g. "Senior Backend Engineer").', ...(profileRef ? { ref: profileRef } : {}) });

  const expSections = resolved.sections.filter((s) => s.kind === 'experience');
  const expItems: ResolvedItem[] = expSections.flatMap((s) => s.items);
  for (const it of expItems) {
    if (!it.start.trim() && !it.end.trim() && !it.current) out.push({ id: `exp-dates-${it.id}`, level: 'warn', message: `"${it.title || it.subtitle || 'Position'}" has no dates.`, ref: it.id });
    if (!it.bullets.some((b) => METRIC.test(b)) && !METRIC.test(it.description)) out.push({ id: `exp-metrics-${it.id}`, level: 'info', message: `"${it.title || it.subtitle || 'Position'}" has no measurable achievements (numbers, %, $).`, ref: it.id });
  }

  const skills = resolved.sections.filter((s) => s.kind === 'skills' || s.kind === 'technical-skills').reduce((n, s) => n + s.skills.reduce((m, g) => m + g.names.length, 0), 0);
  const uniqueSkills = Math.max(skills, 0);
  if (uniqueSkills > 30) out.push({ id: 'too-many-skills', level: 'warn', message: `${uniqueSkills} skills listed — focus on the 15–25 most relevant.` });

  const summary = resolved.sections.find((s) => s.kind === 'summary');
  if (summary) {
    const words = summary.text.split(/\s+/).filter(Boolean).length;
    if (words > 90) out.push({ id: 'long-summary', level: 'warn', message: `Summary is ${words} words; aim for 40–80.`, ref: summary.id });
  }

  // Date formats across dated items (raw values).
  const dated = resolved.sections.filter((s) => ['experience', 'education', 'volunteer'].includes(s.kind)).flatMap((s) => s.items);
  const classes = new Set<string>();
  for (const it of dated) for (const v of [it.start, it.end]) {
    const c = dateClass(v);
    if (c) classes.add(c);
  }
  if (classes.size > 1) out.push({ id: 'date-formats', level: 'info', message: 'Dates use mixed formats (month + year, year only, free text). Pick one style.' });

  const nowYm = now.getFullYear() * 12 + now.getMonth();
  for (const it of dated) {
    const s = ym(it.start);
    const e = ym(it.end);
    if (e !== null && !it.current && e > nowYm) out.push({ id: `future-${it.id}`, level: 'warn', message: `"${it.title || it.subtitle}" ends in the future — mark it as current instead?`, ref: it.id });
    if (s !== null && e !== null && e < s) out.push({ id: `order-${it.id}`, level: 'error', message: `"${it.title || it.subtitle}" ends before it starts.`, ref: it.id });
  }

  // Bullets across all items.
  const all = resolved.sections.flatMap((s) => s.items.flatMap((it) => it.bullets.map((b) => ({ b: b.trim(), it }))));
  const withDot = all.filter((x) => /[.!?]$/.test(x.b)).length;
  if (withDot > 0 && withDot < all.length) out.push({ id: 'punctuation', level: 'info', message: `${withDot} of ${all.length} bullets end with a full stop — make them consistent.` });
  const seen = new Map<string, string>();
  for (const { b, it } of all) {
    const key = b.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) out.push({ id: `dup-${it.id}-${key.slice(0, 20)}`, level: 'warn', message: `Duplicate bullet: "${b.slice(0, 60)}${b.length > 60 ? '…' : ''}"`, ref: it.id });
    else seen.set(key, it.id);
    if (b.length > 220) out.push({ id: `long-${it.id}-${key.slice(0, 20)}`, level: 'info', message: `Long bullet (${b.length} characters) — split or tighten it.`, ref: it.id });
    if (WEAK.test(b)) out.push({ id: `weak-${it.id}-${key.slice(0, 20)}`, level: 'info', message: `Weak opener: "${b.split(/\s+/).slice(0, 3).join(' ')}…" — start with an action verb.`, ref: it.id });
    if (/\bI\b/.test(b) || /\b(me|my|myself)\b/i.test(b)) out.push({ id: `pronoun-${it.id}-${key.slice(0, 20)}`, level: 'info', message: 'Avoid first-person pronouns (I, me, my) in bullets.', ref: it.id });
  }

  const present = new Set(resolved.sections.map((s) => s.id));
  for (const s of resume.sections) {
    if (s.kind === 'profile' || s.hidden) continue;
    if (!present.has(s.id)) out.push({ id: `empty-${s.id}`, level: 'info', message: `"${s.title}" is empty and will not be shown.`, ref: s.id });
  }
  void library;
  return out;
}
