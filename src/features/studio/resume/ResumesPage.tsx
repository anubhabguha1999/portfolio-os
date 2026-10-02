import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, FileText, MoreHorizontal, Package, Pencil, Plus, ShieldCheck, Sparkles, Trash2, Mail, Link2 } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { CardGridSkeleton } from '@/components/ui/Skeletons';
import { Truncate } from 'dead-lock-react-lib';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { Badge, EmptyState } from '@/components/ui/misc';
import { toast } from '@/stores/ui';
import { timeAgo } from '@/utils/format';
import type { Library, LocalEntry, Profile, ResumeDoc } from '@/studio/model/types';
import { createResumeFromStarter, createResumeSection } from '@/studio/model/defaults';
import { ensureSectionsFor, type ImportEntries } from '@/studio/import/resume-json';
import { applyImport, JsonImportBox, type ImportChoice } from '../shared/JsonImportBox';
import { getPersona, SAMPLE_PERSONAS } from '@/studio/model/sample';
import type { ResumeTemplateDef } from '@/studio/templates/types';
import { cn } from '@/utils/cn';
import { deleteResume, duplicateResume, getResume, listResumes, saveResume } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { RESUME_TEMPLATES, getResumeTemplate } from '@/studio/templates/resume';
import { ResumeThumb } from './ResumeThumb';
import { applyTemplateStyle } from './TemplateBrowser';
import { ApplicationPackDialog } from '../pack/ApplicationPackDialog';

type CreateOptions = { name: string; templateId: string; kind?: 'resume' | 'cv'; sample?: boolean; personaId?: string; imported?: ImportChoice };

const PRESET_NAMES = ['Software Developer Resume', 'Frontend Resume', 'Backend Resume', 'Full Stack Resume', 'Academic CV'];

export default function ResumesPage() {
  const navigate = useNavigate();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [resumes, setResumes] = useState<ResumeDoc[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [dup, setDup] = useState<ResumeDoc | null>(null);
  const [dupName, setDupName] = useState('');
  const [renaming, setRenaming] = useState<ResumeDoc | null>(null);
  const [deleting, setDeleting] = useState<ResumeDoc | null>(null);
  const [pack, setPack] = useState(false);

  const refresh = useCallback(async () => {
    await ensureWorkspace();
    const list = await listResumes();
    setResumes((await Promise.all(list.map((r) => getResume(r.id)))).filter((r): r is ResumeDoc => !!r));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const empty = !profile.name.trim() && !library.experience.length && !library.projects.length;

  const create = async (opts: CreateOptions) => {
    const t = getResumeTemplate(opts.templateId);
    const ws = useWorkspace.getState();
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
    navigate(`/resume/${saved.id}`);
  };

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Resume Studio</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Resumes <span className="font-display font-normal italic">&amp; CVs</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Every version uses your shared profile and library — tailor projects, emphasis, skills, summary and template per role without retyping.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Package className="size-4" />} onClick={() => setPack(true)}>
              Application pack
            </Button>
            <Link to="/documents" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <Mail className="size-4" /> Cover letters
            </Link>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New resume
            </Button>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-3 text-[12.5px] text-fg-muted">
          <Link2 className="size-4 text-accent" />
          Shared profile: <strong className="text-fg">{profile.name || 'not set yet'}</strong>
          <span className="text-fg-subtle">·</span> {library.experience.length} roles · {library.projects.length} projects · {library.skills.length} skills
          <Link to="/profile" className="ml-auto text-accent hover:underline">
            Edit profile →
          </Link>
        </div>

        {resumes === null ? (
          <CardGridSkeleton label="Loading resumes" count={4} className="mt-8 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]" />
        ) : resumes.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-3xl border border-dashed border-line py-16"
            icon={<FileText className="size-5" />}
            title="Create your first resume"
            description="Pick a template. Your content is stored once and can be reused across every resume, CV and your portfolio."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  New resume
                </Button>
                {empty && (
                  <Button icon={<Sparkles className="size-4" />} onClick={() => void create({ name: 'Sample Resume', templateId: 'slate-banner', sample: true })}>
                    Try with sample content
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-6">
            {resumes.map((r) => (
              <li key={r.id} className="group rounded-2xl border border-line bg-panel p-3 transition hover:border-line-strong">
                <Link to={`/resume/${r.id}`} className="grid place-items-center rounded-xl bg-canvas p-4" aria-label={`Open ${r.name}`}>
                  <ResumeThumb resume={r} library={library} profile={profile} width={180} className="transition group-hover:-translate-y-0.5" />
                </Link>
                <div className="mt-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/resume/${r.id}`} className="block min-w-0 text-[13.5px] font-semibold hover:underline">
                      <Truncate disableClickExpand style={{ display: 'block', maxWidth: '100%' }}>
                        {r.name}
                      </Truncate>
                    </Link>
                    <p className="mt-0.5 truncate text-[11.5px] text-fg-subtle">
                      {getResumeTemplate(r.templateId).name} · {timeAgo(r.updatedAt)}
                    </p>
                  </div>
                  {r.kind === 'cv' && <Badge>CV</Badge>}
                  <Menu
                    label={`${r.name} actions`}
                    trigger={(p) => (
                      <IconButton {...p} size="xs" label="Resume actions">
                        <MoreHorizontal className="size-3.5" />
                      </IconButton>
                    )}
                    items={[
                      { label: 'Open', icon: <FileText />, onSelect: () => navigate(`/resume/${r.id}`) },
                      {
                        label: 'Duplicate…',
                        icon: <Copy />,
                        onSelect: () => {
                          setDup(r);
                          setDupName(`${r.name} - Backend Focus`);
                        },
                      },
                      { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(r) },
                      'separator',
                      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setDeleting(r) },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <NewResumeDialog open={creating} onClose={() => setCreating(false)} onCreate={(o) => void create(o)} canUseSample={empty} profile={profile} library={library} />

      <Dialog
        open={!!dup}
        onClose={() => setDup(null)}
        title="Duplicate resume"
        description="The copy keeps using your shared library. Resume-only changes to the copy never affect the original."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDup(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!dup) return;
                const copy = await duplicateResume(dup.id, dupName);
                setDup(null);
                toast({ tone: 'success', title: 'Resume duplicated', description: copy.name });
                navigate(`/resume/${copy.id}`);
              }}
            >
              Duplicate
            </Button>
          </>
        }
      >
        <TextInput label="Name" value={dupName} onChange={(e) => setDupName(e.target.value)} autoFocus />
      </Dialog>

      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename resume"
        size="sm"
        footer={
          <Button
            variant="primary"
            onClick={async () => {
              const input = document.getElementById('rename-resume') as HTMLInputElement | null;
              if (renaming && input?.value.trim()) await saveResume({ ...renaming, name: input.value.trim() });
              setRenaming(null);
              void refresh();
            }}
          >
            Save
          </Button>
        }
      >
        {renaming && <TextInput id="rename-resume" label="Name" defaultValue={renaming.name} autoFocus />}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteResume(deleting.id);
          toast({ title: `Deleted “${deleting.name}”`, description: 'Your shared profile and library are unchanged.' });
          void refresh();
        }}
        title={`Delete “${deleting?.name}”?`}
        description="Only this resume version is removed. Your shared profile, library, portfolio and other resumes are not affected."
        confirmLabel="Delete resume"
      />
      <ApplicationPackDialog open={pack} onClose={() => setPack(false)} />
    </div>
  );
}

/** A resume laid out the way the template intends, with its style defaults applied. */
function newResumeFor(t: ResumeTemplateDef, name: string, entries: Record<string, Array<Partial<LocalEntry>>>, kind?: 'resume' | 'cv'): ResumeDoc {
  const base = createResumeFromStarter(name, t.id, t.starter?.sections, entries, { kind: kind ?? (t.id === 'academic' ? 'cv' : 'resume') });
  base.style = { ...applyTemplateStyle(base.style, t), ...(t.defaults.photo ? { photo: t.defaults.photo } : {}) };
  if (base.kind === 'cv') base.style.pageLimit = 0;
  return base;
}

const NEW_TEMPLATES = new Set(['slate-banner', 'navy-sidebar']);
const NEW_FILTERS = ['All', 'Premium', 'ATS', 'Two column', 'Photo', 'Serif'] as const;

function NewResumeDialog({ open, onClose, onCreate, canUseSample, profile, library }: { open: boolean; onClose: () => void; onCreate: (o: CreateOptions) => void; canUseSample: boolean; profile: Profile; library: Library }) {
  const [name, setName] = useState(PRESET_NAMES[0]!);
  const [templateId, setTemplateId] = useState(RESUME_TEMPLATES[0]!.id);
  const [sample, setSample] = useState(true);
  const [personaId, setPersonaId] = useState<string>('auto');
  const [filter, setFilter] = useState<(typeof NEW_FILTERS)[number]>('All');
  const [imported, setImported] = useState<ImportChoice | null>(null);
  const useSample = canUseSample && sample && !imported;

  const submit = (id = templateId) => onCreate({ name: name.trim() || 'My Resume', templateId: id, sample: useSample, ...(personaId !== 'auto' ? { personaId } : {}), ...(imported ? { imported } : {}) });
  const list = RESUME_TEMPLATES.filter((t) => {
    if (filter === 'All') return true;
    if (filter === 'ATS') return t.ats === 'high';
    if (filter === 'Two column') return t.columns === 2;
    if (filter === 'Photo') return t.supportsPhoto;
    return t.tags.includes(filter);
  });
  // Thumbnails show the user's own content, or each template's example persona when there is none yet.
  const previews = useMemo(() => {
    if (!open) return [];
    const fromFile = imported ? applyImport(profile, library, imported) : null;
    return RESUME_TEMPLATES.map((t) => {
      if (fromFile && imported) {
        const r = ensureSectionsFor(newResumeFor(t, 'Preview', imported.data.entries), fromFile.library, imported.data.entries, (kind, title) => createResumeSection(kind, title ? { title } : {}));
        return { t, resume: r, profile: fromFile.profile, library: fromFile.library };
      }
      const persona = getPersona(personaId === 'auto' ? t.starter?.persona : personaId);
      const demo = canUseSample;
      return { t, resume: newResumeFor(t, 'Preview', demo ? persona.entries : {}), profile: demo ? persona.profile() : profile, library: demo ? persona.library() : library };
    });
  }, [open, personaId, canUseSample, profile, library, imported]);
  const selected = getResumeTemplate(templateId);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New resume"
      description="Pick a template. You can switch at any time without losing content."
      size="xl"
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-fg-subtle sm:block">
            Template: <strong className="text-fg">{selected.name}</strong>
            {useSample && <> · with example content</>}
            {imported && <> · values from {imported.fileName}</>}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => submit()}>
            Create resume
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} list="resume-names" />
          {canUseSample && !imported && (
            <label className="block">
              <span className="app-label">Example content</span>
              <select className="app-input h-9 w-full" value={useSample ? personaId : 'none'} onChange={(e) => (e.target.value === 'none' ? setSample(false) : (setSample(true), setPersonaId(e.target.value)))}>
                <option value="auto">Matched to each template</option>
                {SAMPLE_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="none">Start empty</option>
              </select>
            </label>
          )}
        </div>
        <datalist id="resume-names">
          {PRESET_NAMES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <JsonImportBox
          value={imported}
          canReplace={!canUseSample}
          defaultMode={canUseSample ? 'replace' : 'merge'}
          samplePersona={getResumeTemplate(templateId).starter?.persona ?? 'engineer-lead'}
          onChange={(next) => {
            setImported(next);
            const n = next?.data.profile.name;
            if (n && (!name.trim() || PRESET_NAMES.includes(name))) setName(`${n} Resume`);
          }}
        />
        {canUseSample && useSample && (
          <p className="flex items-start gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[12px] text-fg-muted">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
            Your resume starts fully filled in with a fictional example: summary, roles, achievements, skills, education and languages. Click any part of the page to edit it. It all goes into your shared profile, so replace it with your own details.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter templates">
          {NEW_FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1 text-[12px]', filter === f ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg')}>
              {f}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-4" role="listbox" aria-label="Templates">
          {list.map((t) => {
            const p = previews.find((x) => x.t.id === t.id);
            const active = t.id === templateId;
            return (
              <li key={t.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  onDoubleClick={() => submit(t.id)}
                  className={cn('group w-full rounded-2xl border p-2.5 text-left transition', active ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-line bg-bg hover:border-line-strong')}
                >
                  <div className="relative grid place-items-center rounded-xl bg-canvas p-2.5">
                    {p ? <ResumeThumb resume={p.resume} library={p.library} profile={p.profile} width={150} className="transition group-hover:-translate-y-0.5" /> : <div className="aspect-[210/297] w-[150px] rounded bg-white" />}
                    {active && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-accent-fg">
                        <Check className="size-3" /> Selected
                      </span>
                    )}
                    {NEW_TEMPLATES.has(t.id) && !active && <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">New</span>}
                  </div>
                  <span className="mt-2 block text-[13px] font-semibold">{t.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-fg-subtle">{t.description}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {t.ats === 'high' && (
                      <Badge tone="ok">
                        <ShieldCheck className="size-3" /> ATS
                      </Badge>
                    )}
                    {t.columns === 2 && <Badge>Two column</Badge>}
                    {t.supportsPhoto && <Badge>Photo</Badge>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}

