import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Copy, FilePlus2, FileSearch, FileSignature, FolderKanban, Mail, MoreHorizontal, Pencil, Plus, Presentation, Trash2, UserSquare, FileText } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { CardGridSkeleton } from '@/components/ui/Skeletons';
import { Truncate } from 'dead-lock-react-lib';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { EmptyState } from '@/components/ui/misc';
import { BRAND } from '@/config/brand';
import { DOCUMENT_KINDS } from '@/studio/model/defaults';
import type { DocumentKind, StudioDocument } from '@/studio/model/types';
import { deleteDocument, duplicateDocument, getDocument, listDocuments, saveDocument } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { newStudioDocument } from '@/studio/templates/document/starters';
import { getDocTemplate, kindLabel } from '@/studio/templates/document';
import { getLetterTemplate } from '@/studio/templates/letter';
import { toast } from '@/stores/ui';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import { DocThumb } from './DocThumb';

export const KIND_ICONS: Record<DocumentKind, ReactNode> = {
  'cover-letter': <Mail className="size-4" />,
  portfolio: <FolderKanban className="size-4" />,
  'case-study': <FileSearch className="size-4" />,
  proposal: <FileSignature className="size-4" />,
  profile: <UserSquare className="size-4" />,
  report: <BarChart3 className="size-4" />,
  presentation: <Presentation className="size-4" />,
  custom: <FilePlus2 className="size-4" />,
  resume: <FileText className="size-4" />,
  cv: <FileText className="size-4" />,
};

type Filter = 'all' | 'letters' | 'documents';

export function templateName(doc: Pick<StudioDocument, 'kind' | 'templateId'>): string {
  return doc.kind === 'cover-letter' ? getLetterTemplate(doc.templateId).name : getDocTemplate(doc.templateId).name;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<StudioDocument[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<StudioDocument | null>(null);
  const [deleting, setDeleting] = useState<StudioDocument | null>(null);

  const refresh = useCallback(async () => {
    try {
      await ensureWorkspace();
      const list = await listDocuments();
      const full = (await Promise.all(list.map((s) => getDocument(s.id)))).filter((d): d is StudioDocument => !!d);
      setDocs(full);
    } catch (err) {
      toast({ tone: 'error', title: 'Could not load documents', description: err instanceof Error ? err.message : undefined });
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    document.title = `Document Studio — ${BRAND.name}`;
    void refresh();
  }, [refresh]);

  const shown = useMemo(() => (docs ?? []).filter((d) => (filter === 'all' ? true : filter === 'letters' ? d.kind === 'cover-letter' : d.kind !== 'cover-letter')), [docs, filter]);

  const create = async (kind: DocumentKind) => {
    await ensureWorkspace();
    const { profile, library } = useWorkspace.getState();
    const doc = await saveDocument(newStudioDocument(kind, profile, library));
    navigate(`/document/${doc.id}`);
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast({ tone: 'error', title: `${label} failed`, description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-fg-subtle">
              <Link to="/studio" className="hover:text-fg">
                Dashboard
              </Link>{' '}
              / Document Studio
            </p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Document <span className="font-display font-normal italic">Studio</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Cover letters, case studies, proposals and printable documents — built from blocks, paginated like paper, exported as real PDF and Word files.</p>
          </div>
          <div className="flex gap-2">
            <Button icon={<Mail className="size-4" />} onClick={() => void create('cover-letter')}>
              Cover letter
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New document
            </Button>
          </div>
        </header>

        <div role="tablist" aria-label="Filter documents" className="mt-8 flex gap-1 border-b border-line">
          {(
            [
              ['all', 'All'],
              ['documents', 'Documents'],
              ['letters', 'Cover letters'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)} className={cn('-mb-px border-b-2 px-3 py-2 text-[13px]', filter === v ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>

        {docs === null ? (
          <CardGridSkeleton label="Loading documents" count={5} className="mt-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5" />
        ) : shown.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-2xl border border-dashed border-line-strong"
            icon={<FilePlus2 className="size-5" />}
            title={docs.length ? 'Nothing in this view' : 'No documents yet'}
            description="Start from a document type — each one comes with sensible starter blocks you can rearrange."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                New document
              </Button>
            }
          />
        ) : (
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
            {shown.map((d) => (
              <li key={d.id} className="group relative">
                <Link to={`/document/${d.id}`} className="block overflow-hidden rounded-xl border border-line bg-canvas p-3 transition-colors hover:border-line-strong">
                  <div className="overflow-hidden rounded-[2px] bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,.5)] ring-1 ring-black/5">
                    <DocThumb doc={d} />
                  </div>
                </Link>
                <div className="mt-2.5 flex items-start gap-2 px-0.5">
                  <span className="mt-0.5 text-fg-subtle">{KIND_ICONS[d.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <Truncate className="text-[13px] font-medium" style={{ display: 'block', maxWidth: '100%' }}>
                      {d.name}
                    </Truncate>
                    <p className="truncate text-[11.5px] text-fg-subtle">
                      {kindLabel(d.kind)} · {templateName(d)} · {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                  <Menu
                    label={`${d.name} actions`}
                    trigger={(p) => (
                      <IconButton {...p} label="Document actions" size="xs">
                        <MoreHorizontal className="size-3.5" />
                      </IconButton>
                    )}
                    items={[
                      { label: 'Open', icon: <FileText />, onSelect: () => navigate(`/document/${d.id}`) },
                      { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(d) },
                      { label: 'Duplicate', icon: <Copy />, onSelect: () => void run('Duplicate', () => duplicateDocument(d.id)) },
                      'separator',
                      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setDeleting(d) },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={creating} onClose={() => setCreating(false)} title="New document" description="Pick a type. You can change the template, page size and every block afterwards." size="lg">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {DOCUMENT_KINDS.map((k) => (
            <li key={k.kind}>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  void create(k.kind);
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-line bg-bg p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-accent">{KIND_ICONS[k.kind]}</span>
                <span>
                  <span className="block text-[13px] font-semibold">{k.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{k.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <RenameDialog doc={renaming} onClose={() => setRenaming(null)} onSave={(name) => renaming && void run('Rename', () => saveDocument({ ...renaming, name }))} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void run('Delete', () => deleteDocument(deleting.id))}
        title="Delete document?"
        description={`“${deleting?.name ?? ''}” will be removed from this device. Your shared profile and library are not affected.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function RenameDialog({ doc, onClose, onSave }: { doc: StudioDocument | null; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  useEffect(() => setName(doc?.name ?? ''), [doc]);
  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      title="Rename document"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              onSave(name.trim());
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <TextInput label="Name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
    </Dialog>
  );
}
