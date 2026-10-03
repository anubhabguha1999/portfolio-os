import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, FileText, MoreHorizontal, Package, Pencil, Plus, Sparkles, Trash2, Mail, Link2 } from 'lucide-react';
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
import type { ResumeDoc } from '@/studio/model/types';
import { deleteResume, duplicateResume, getResume, listResumes, saveResume } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { useProfileIsEmpty } from './useProfileIsEmpty';
import type { CreateOptions } from './useCreateResume';

// Heavy code (layout engine + jsPDF for thumbnails, the export pipeline for the pack) loads only when used.
const ResumeThumb = lazy(() => import('./ResumeThumb').then((m) => ({ default: m.ResumeThumb })));
const ApplicationPackDialog = lazy(() => import('../pack/ApplicationPackDialog').then((m) => ({ default: m.ApplicationPackDialog })));

/** Template id → name, loaded with the template registry once there are resumes to label. */
function useTemplateNames(needed: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void import('@/studio/templates/resume').then((m) => alive && setNames(Object.fromEntries(m.RESUME_TEMPLATES.map((t) => [t.id, t.name]))));
    return () => {
      alive = false;
    };
  }, [needed]);
  return names;
}

export default function ResumesPage() {
  const navigate = useNavigate();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [resumes, setResumes] = useState<ResumeDoc[] | null>(null);
  const templateNames = useTemplateNames(!!resumes?.length);
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

  const empty = useProfileIsEmpty();
  const create = async (opts: CreateOptions) => {
    const { createResumeFrom } = await import('./useCreateResume');
    navigate(`/resume/${await createResumeFrom(opts, empty)}`);
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
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate('/resumes/new')}>
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
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate('/resumes/new')}>
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
                  <Suspense fallback={<div className="aspect-[210/297] w-[180px] rounded bg-white/90" aria-hidden="true" />}>
                    <ResumeThumb resume={r} library={library} profile={profile} width={180} className="transition group-hover:-translate-y-0.5" />
                  </Suspense>
                </Link>
                <div className="mt-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/resume/${r.id}`} className="block min-w-0 text-[13.5px] font-semibold hover:underline">
                      <Truncate disableClickExpand style={{ display: 'block', maxWidth: '100%' }}>
                        {r.name}
                      </Truncate>
                    </Link>
                    <p className="mt-0.5 truncate text-[11.5px] text-fg-subtle">
                      {templateNames[r.templateId] ? `${templateNames[r.templateId]} · ` : ''}
                      {timeAgo(r.updatedAt)}
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
      {pack && (
        <Suspense fallback={null}>
          <ApplicationPackDialog open onClose={() => setPack(false)} />
        </Suspense>
      )}
    </div>
  );
}
