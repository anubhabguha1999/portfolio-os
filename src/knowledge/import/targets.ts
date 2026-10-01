/**
 * After review: write approved data into the shared workspace (single source of truth) and
 * optionally create a resume or a linked portfolio from it.
 *
 *   PDF → semantic → review → Profile + Library ─┬─ Resume Studio (new resume, any template)
 *                                                 └─ Portfolio Studio (new portfolio, linked to the library)
 */
import { createLibProject, createRef, createResumeFromStarter, createResumeSection, sectionInfo } from '@/studio/model/defaults';
import { ensureSectionsFor } from '@/studio/import/resume-json';
import { getResumeTemplate } from '@/studio/templates/resume';
import { applyTemplateStyle } from '@/features/studio/resume/TemplateBrowser';
import { saveResume } from '@/studio/storage/repo';
import { useWorkspace } from '@/studio/store/workspace';
import { createImportedProject, resumeToPortfolio, type ParsedResume } from '@/lib/import';
import { newItem } from '@/lib/import/common';
import type { Library, LibraryKind, ResumeDoc } from '@/studio/model/types';
import { getProject, saveProject } from '@/lib/storage/projects';
import { pullIntoPortfolio } from '@/studio/sync/portfolio';
import { addProvenance } from '../storage/repo';
import { insertIntoPortfolio } from './to-portfolio';
import { applyReview, type ApplyResult, type ApplyScope, type Review } from './review';

/** Apply the review to the shared profile/library, persist, and record provenance. */
export async function commitReview(review: Review, scope: ApplyScope): Promise<ApplyResult> {
  const ws = useWorkspace.getState();
  await ws.init();
  const res = applyReview(review, ws.profile, ws.library, scope);
  if (scope.profile) ws.setProfile(res.profile);
  ws.setLibrary(res.library);
  await ws.flush();
  await addProvenance(res.provenance);
  return res;
}

/**
 * A new resume in the chosen template showing what this PDF contributed (added or merged items,
 * in the PDF's order). Other library items stay one click away in each section.
 */
export async function createResumeFromImport(name: string, templateId: string, library: Library, entries: ApplyResult['entries'], touched: ApplyResult['touched']): Promise<ResumeDoc> {
  const t = getResumeTemplate(templateId);
  let r = createResumeFromStarter(name, t.id, t.starter?.sections, entries, { kind: t.id === 'academic' ? 'cv' : 'resume' });
  r.style = { ...applyTemplateStyle(r.style, t), ...(t.defaults.photo ? { photo: t.defaults.photo } : {}) };
  const scoped: Library = { ...library };
  for (const k of LIB_KINDS) (scoped as unknown as Record<LibraryKind, unknown[]>)[k] = (library[k] as Array<{ id: string }>).filter((i) => touched[k]?.includes(i.id));
  r = ensureSectionsFor(r, scoped, entries, (kind, title) => createResumeSection(kind, title ? { title } : {}));
  r.sections = r.sections.map((sec) => {
    const info = sectionInfo(sec.kind);
    const kind = info.library;
    if (!kind) return sec;
    const ids = touched[kind] ?? [];
    if (kind === 'skills') return { ...sec, skillIds: ids, autoInclude: false };
    return { ...sec, refs: ids.map(createRef), autoInclude: false };
  });
  return saveResume(r);
}

const LIB_KINDS: LibraryKind[] = ['experience', 'projects', 'education', 'skills', 'certifications', 'achievements'];

/**
 * A new portfolio built from library items. Items keep their library ids, so the portfolio is
 * linked: later edits in Resume Studio or the library flow into it (and back).
 */
export async function createPortfolioFromLibrary(touched: ApplyResult['touched'] | null): Promise<string> {
  const ws = useWorkspace.getState();
  await ws.init();
  const { profile, library } = ws;
  const pick = <K extends LibraryKind>(kind: K): Library[K] => (touched ? (library[kind] as Array<{ id: string }>).filter((i) => touched[kind]?.includes(i.id)) : library[kind]) as Library[K];
  const parsed: ParsedResume = {
    name: profile.name,
    headline: profile.headline,
    email: profile.email,
    phone: profile.phone ?? '',
    location: profile.location ?? '',
    links: profile.socialLinks.map((s) => ({ platform: s.platform, url: s.url })),
    website: profile.website ?? '',
    summary: profile.bio,
    experience: pick('experience').map((e) => newItem('experience', { ...e })),
    education: pick('education').map((e) => newItem('education', { ...e })),
    skills: pick('skills').map((s) => newItem('skills', { ...s })),
    projects: pick('projects').map((p) => newItem('projects', { ...createLibProject(), ...p })),
    certifications: pick('certifications').map((c) => newItem('certifications', { ...c })),
    achievements: pick('achievements').map((a) => newItem('achievements', { ...a })),
    other: [],
  };
  const portfolio = resumeToPortfolio(parsed);
  const { project } = await createImportedProject(portfolio, [], 'Imported from PDF Intelligence');
  ws.setLinks({ ...ws.links, [project.id]: { projectId: project.id, enabled: true, lastSyncedAt: new Date().toISOString() } });
  await ws.flush();
  return project.id;
}

/**
 * Put what a review contributed into an existing portfolio: items join the matching sections
 * (created when missing). A linked portfolio also picks up the profile (hero, about, contact).
 */
export async function addToExistingPortfolio(projectId: string, touched: ApplyResult['touched']): Promise<{ added: number; locked: string[] }> {
  const ws = useWorkspace.getState();
  await ws.init();
  const rec = await getProject(projectId);
  if (!rec) throw new Error('That portfolio no longer exists.');
  const picks = LIB_KINDS.flatMap((kind) => (touched[kind] ?? []).map((id) => ({ kind, id })));
  const res = insertIntoPortfolio(rec.portfolio, ws.library, picks);
  const linked = ws.links[projectId]?.enabled;
  const next = linked ? pullIntoPortfolio(res.portfolio, ws.library, ws.profile) : res.portfolio;
  if (next !== rec.portfolio) await saveProject(next);
  return { added: res.added, locked: res.locked };
}
