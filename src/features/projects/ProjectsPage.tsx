import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, Eye, HardDrive, Pencil, Plus, Search, Share, Trash2, Upload } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { CardGridSkeleton } from '@/components/ui/Skeletons';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/misc';
import { ImportDialog } from '@/features/importers/ImportDialog';
import { MarketingFooter } from '@/features/landing/MarketingFooter';
import { buildBackup, deleteProject, duplicateProject, getProject, listProjects, renameProject, type ProjectSummary } from '@/lib/storage/projects';
import { storageEstimate } from '@/lib/storage/db';
import { BRAND } from '@/config/brand';
import { toast } from '@/stores/ui';
import { downloadBlob } from '@/utils/download';
import { fileSafeName, formatBytes, timeAgo } from '@/utils/format';

const SEARCH_THRESHOLD = 6;

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
      setError(null);
      if (list.length === 0) navigate('/new', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Browser storage is unavailable.');
      setProjects([]);
    }
    setUsage(await storageEstimate());
  }, [navigate]);

  useEffect(() => {
    document.title = `My Portfolios — ${BRAND.name}`;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const sorted = useMemo(() => [...(projects ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => `${p.name} ${p.headline} ${p.themeName}`.toLowerCase().includes(q));
  }, [sorted, query]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast({ title: `${label} failed`, description: err instanceof Error ? err.message : undefined, tone: 'error' });
    }
  };

  const onDuplicate = (p: ProjectSummary) =>
    run('Duplicate', async () => {
      const copy = await duplicateProject(p.id);
      toast({ title: 'Portfolio duplicated', description: copy.name, tone: 'success' });
    });

  const onBackup = (p: ProjectSummary) =>
    run('Backup', async () => {
      const rec = await getProject(p.id);
      if (!rec) throw new Error('Project not found.');
      const backup = await buildBackup(rec.portfolio);
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `${fileSafeName(p.name)}${BRAND.fileExtension}`);
      toast({ title: 'Backup downloaded', description: 'Keep it somewhere safe — it restores this portfolio with all images.', tone: 'success' });
    });

  const onDelete = (p: ProjectSummary) =>
    run('Delete', async () => {
      await deleteProject(p.id);
      toast({ title: `Deleted “${p.name}”` });
    });

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              My <span className="font-display font-normal italic">Portfolios</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-fg-muted">
              {projects === null ? 'Loading…' : `${projects.length} ${projects.length === 1 ? 'portfolio' : 'portfolios'} · sorted by last edited`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button icon={<Upload className="size-4" aria-hidden="true" />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/new')}>
              New portfolio
            </Button>
          </div>
        </header>

        {sorted.length > SEARCH_THRESHOLD && (
          <div className="relative mt-8 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <label htmlFor="project-search" className="sr-only">
              Search portfolios
            </label>
            <input id="project-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search portfolios…" className="app-input h-10 pl-9" />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-8 rounded-xl border border-danger/30 bg-danger/10 p-4 text-[13px] text-danger">
            Could not read your portfolios: {error}
          </p>
        )}

        {projects === null ? (
          <CardGridSkeleton label="Loading portfolios" count={3} thumb="aspect-[16/10]" className="mt-8 gap-5 sm:grid-cols-2 lg:grid-cols-3" />
        ) : (
          <>
            {query && filtered.length === 0 && <p className="mt-10 text-[14px] text-fg-muted">No portfolios match “{query}”.</p>}
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} now={now} onRename={() => setRenaming(p)} onDuplicate={() => void onDuplicate(p)} onBackup={() => void onBackup(p)} onDelete={() => setDeleting(p)} />
              ))}
            </ul>
          </>
        )}

        <section aria-labelledby="storage-title" className="mt-14 grid gap-4 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6">
          <span className="grid size-10 place-items-center rounded-xl border border-line bg-elevated text-fg-muted">
            <HardDrive className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="storage-title" className="text-[14px] font-semibold">
              Stored in this browser only
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
              Nothing is uploaded. Clearing site data or switching browsers means starting over — download a JSON backup of anything you care about.
            </p>
            {usage && usage.quota > 0 && (
              <div className="mt-3 max-w-md">
                <ProgressBar value={(usage.usage / usage.quota) * 100} label="Local storage used" />
                <p className="mt-1.5 text-[12px] text-fg-subtle">
                  {formatBytes(usage.usage)} used of {formatBytes(usage.quota)} available
                </p>
              </div>
            )}
          </div>
          <Link to="/settings" className="text-[13px] font-medium text-fg-muted hover:text-fg">
            Storage settings
          </Link>
        </section>
      </main>
      <MarketingFooter />

      <ImportDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void refresh();
        }}
        initialTab="json"
      />
      {renaming && (
        <RenameDialog
          project={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name) =>
            void run('Rename', async () => {
              await renameProject(renaming.id, name);
              setRenaming(null);
            })
          }
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void onDelete(deleting);
        }}
        title="Delete this portfolio?"
        description={
          <>
            <strong className="text-fg">{deleting?.name}</strong>, its images and its version history will be permanently removed from this browser. Download a JSON backup first if you might want it back.
          </>
        }
        confirmLabel="Delete portfolio"
      />
    </div>
  );
}

function ProjectCard({
  project: p,
  now,
  onRename,
  onDuplicate,
  onBackup,
  onDelete,
}: {
  project: ProjectSummary;
  now: number;
  onRename: () => void;
  onDuplicate: () => void;
  onBackup: () => void;
  onDelete: () => void;
}) {
  const [bg, primary, accent] = p.colors;
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-strong">
      <Link to={`/builder/${p.id}`} className="relative block h-32 overflow-hidden" style={{ background: bg }} tabIndex={-1} aria-hidden="true">
        <span className="absolute left-5 top-6 h-2 w-24 rounded-full opacity-90" style={{ background: primary }} />
        <span className="absolute left-5 top-11 h-1.5 w-36 rounded-full opacity-25" style={{ background: primary }} />
        <span className="absolute left-5 top-14 h-1.5 w-28 rounded-full opacity-25" style={{ background: primary }} />
        <span className="absolute -bottom-10 -right-6 size-32 rounded-full opacity-80 blur-[2px] transition-transform duration-700 group-hover:scale-110" style={{ background: accent }} />
        <span className="absolute -bottom-6 right-20 size-16 rounded-full opacity-70" style={{ background: primary }} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[15px] font-semibold tracking-tight">
            <Link to={`/builder/${p.id}`} className="block truncate hover:underline">
              {p.name}
            </Link>
          </h2>
          <span className="flex shrink-0 -space-x-1" aria-label={`Theme colours for ${p.themeName}`} role="img">
            {p.colors.map((c, i) => (
              <span key={i} className="size-3.5 rounded-full border border-line-strong" style={{ background: c }} />
            ))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-fg-muted">{p.headline || 'No headline yet'}</p>
        <p className="mt-3 flex flex-wrap gap-x-2 text-[12px] text-fg-subtle">
          <span>
            {p.sectionCount} {p.sectionCount === 1 ? 'section' : 'sections'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{p.themeName}</span>
          <span aria-hidden="true">·</span>
          <span>
            Last edited <time dateTime={p.updatedAt}>{timeAgo(p.updatedAt, now)}</time>
          </span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
          <Link to={`/builder/${p.id}`} className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg hover:bg-accent-strong">
            Open
          </Link>
          <Link to={`/preview/${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-fg-muted hover:bg-hover hover:text-fg">
            <Eye className="size-3.5" aria-hidden="true" />
            Preview
          </Link>
          <Link to={`/export/${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-fg-muted hover:bg-hover hover:text-fg">
            <Share className="size-3.5" aria-hidden="true" />
            Export
          </Link>
          <span className="ml-auto flex">
            <IconButton label={`Rename ${p.name}`} title="Rename" onClick={onRename}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton label={`Duplicate ${p.name}`} title="Duplicate" onClick={onDuplicate}>
              <Copy className="size-3.5" />
            </IconButton>
            <IconButton label={`Download JSON backup of ${p.name}`} title="Download JSON backup" onClick={onBackup}>
              <Download className="size-3.5" />
            </IconButton>
            <IconButton label={`Delete ${p.name}`} title="Delete" onClick={onDelete} className="hover:!text-danger">
              <Trash2 className="size-3.5" />
            </IconButton>
          </span>
        </div>
      </div>
    </li>
  );
}

function RenameDialog({ project, onClose, onSave }: { project: ProjectSummary; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(project.name);
  const valid = name.trim().length > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onSave(name.trim());
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Rename portfolio"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="rename-form" disabled={!valid}>
            Save
          </Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit}>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} onFocus={(e) => e.currentTarget.select()} />
      </form>
    </Dialog>
  );
}
