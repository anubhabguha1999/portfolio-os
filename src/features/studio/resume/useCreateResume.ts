import { useNavigate } from 'react-router-dom';
import { toast } from '@/stores/ui';
import type { LocalEntry, ResumeDoc } from '@/studio/model/types';
import { createResumeFromStarter, createResumeSection } from '@/studio/model/defaults';
import { ensureSectionsFor, type ImportEntries } from '@/studio/import/resume-json';
import { getPersona } from '@/studio/model/sample';
import type { ResumeTemplateDef } from '@/studio/templates/types';
import { saveResume } from '@/studio/storage/repo';
import { useWorkspace } from '@/studio/store/workspace';
import { getResumeTemplate } from '@/studio/templates/resume';
import { applyImport, type ImportChoice } from '../shared/JsonImportBox';
import { applyTemplateStyle } from './TemplateBrowser';
import { useProfileIsEmpty } from './useProfileIsEmpty';

export type CreateOptions = { name: string; templateId: string; kind?: 'resume' | 'cv'; sample?: boolean; personaId?: string; imported?: ImportChoice };

/** A resume laid out the way the template intends, with its style defaults applied. */
export function newResumeFor(t: ResumeTemplateDef, name: string, entries: Record<string, Array<Partial<LocalEntry>>>, kind?: 'resume' | 'cv'): ResumeDoc {
  const base = createResumeFromStarter(name, t.id, t.starter?.sections, entries, { kind: kind ?? (t.id === 'academic' ? 'cv' : 'resume') });
  base.style = { ...applyTemplateStyle(base.style, t), ...(t.defaults.photo ? { photo: t.defaults.photo } : {}) };
  if (base.kind === 'cv') base.style.pageLimit = 0;
  return base;
}

export { useProfileIsEmpty };

/**
 * Creates the resume, seeding the profile from a file or an example persona, and returns its id.
 * `empty`: the profile has no content yet, so example content may replace it.
 */
export async function createResumeFrom(opts: CreateOptions, empty: boolean): Promise<string> {
  const t = getResumeTemplate(opts.templateId);
  const ws = useWorkspace.getState();
  const { profile, library } = ws;
  let entries: ImportEntries = {};
  let lib = library;
  if (opts.imported) {
    const next = applyImport(profile, library, opts.imported);
    ws.setProfile(next.profile);
    ws.setLibrary(next.library);
    await ws.flush();
    entries = opts.imported.data.entries;
    lib = next.library;
  } else if (opts.sample && empty) {
    const persona = getPersona(opts.personaId ?? t.starter?.persona);
    ws.setProfile({ ...persona.profile(), ...(profile.profileImage ? { profileImage: profile.profileImage } : {}) });
    ws.setLibrary(persona.library());
    await ws.flush();
    entries = persona.entries;
  }
  let base = newResumeFor(t, opts.name, entries, opts.kind);
  if (opts.imported) base = ensureSectionsFor(base, lib, entries, (kind, title) => createResumeSection(kind, title ? { title } : {}));
  const saved = await saveResume(base);
  if (opts.imported) toast({ tone: 'success', title: 'Resume created from your file', description: `${opts.imported.fileName} · ${opts.imported.mode === 'replace' ? 'profile replaced' : 'merged into your profile'}` });
  return saved.id;
}

/** Creates the resume and opens it. */
export function useCreateResume(): (opts: CreateOptions) => Promise<void> {
  const navigate = useNavigate();
  const empty = useProfileIsEmpty();
  return async (opts) => {
    navigate(`/resume/${await createResumeFrom(opts, empty)}`);
  };
}
