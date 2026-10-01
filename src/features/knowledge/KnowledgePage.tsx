import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Copy,
  Download,
  FileDown,
  Folder,
  FolderPlus,
  HardDrive,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { ProgressBar } from '@/components/ui/misc';
import { toast } from '@/stores/ui';
import { storageEstimate } from '@/lib/storage/db';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { downloadBlob } from '@/utils/download';
import { formatBytes, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import { exportDocJson, exportDocText, importFile, refreshIndex, search, type ImportOutcome } from '@/knowledge/engine/service';
import { exportMarkdown, libraryZip, structuredSources } from '@/knowledge/export/formats';
import { currentExtraction, deleteAllKnowledge, deleteDoc, deleteOriginal, duplicateDoc, getOriginal, knowledgeUsage, listDocs, listFolders, recoverInterrupted, listTags, normalizeTag, patchDoc, putDoc, saveFolders, saveTags, sha256 } from '@/knowledge/storage/repo';
import { useKnowledgeJobs } from '@/knowledge/store/jobs';
import { DOCUMENT_TYPES, type DocumentType, type KnowledgeDoc, type SearchHit } from '@/knowledge/types';
import { CompareDialog } from './CompareDialog';
import { DocIcon, docTypeLabel, DropZone, ExtractionSettingsDialog, JobProgress, PasswordDialog, Pill, StatusBadge } from './shared';
import { pdfPageCount } from './pdf-utils';

type Pending = Extract<ImportOutcome, { status: 'new-version' }>;

export default function KnowledgePage() {
  const navigate = useNavigate();
  const jobs = useKnowledgeJobs((s) => s.jobs);
  const revision = useKnowledgeJobs((s) => s.revision);
  const extract = useKnowledgeJobs((s) => s.extract);
  const library = useWorkspace((s) => s.library);
  const profile = useWorkspace((s) => s.profile);

  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<DocumentType | null>(null);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [settingsFor, setSettingsFor] = useState<{ doc: KnowledgeDoc; pages: number } | null>(null);
  const [newVersion, setNewVersion] = useState<Pending | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [renaming, setRenaming] = useState<KnowledgeDoc | null>(null);
  const [tagging, setTagging] = useState<KnowledgeDoc | null>(null);
  const [moving, setMoving] = useState<KnowledgeDoc | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeDoc | null>(null);
  const [wipe, setWipe] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof knowledgeUsage>> | null>(null);
  const [manage, setManage] = useState(false);
  const [busyZip, setBusyZip] = useState(false);
  const [newFolder, setNewFolder] = useState(false);

  const reload = useCallback(async () => {
    const [d0, f, t, est, u] = await Promise.all([listDocs(), listFolders(), listTags(), storageEstimate(), knowledgeUsage()]);
    const d = await recoverInterrupted(d0, new Set(Object.keys(useKnowledgeJobs.getState().jobs)));
    setDocs(d);
    setFolders(f);
    setTags(t);
    setStorage(est);
    setUsage(u);
  }, []);

  useEffect(() => {
    void ensureWorkspace();
    void reload();
  }, [reload, revision]);

  useEffect(() => {
    if (!deferred.trim()) {
      setHits(null);
      return;
    }
    let live = true;
    void search(deferred).then((h) => live && setHits(h));
    return () => {
      live = false;
    };
  }, [deferred, revision, docs]);

  /* ------------------------------ import ----------------------------- */

  const startDefault = (doc: KnowledgeDoc) => void extract(doc.id).catch((err: unknown) => toast({ tone: 'error', title: `Unable to extract ${doc.name}`, description: err instanceof Error ? err.message : String(err) }));

  const onCreated = async (doc: KnowledgeDoc, single: boolean) => {
    if (single && doc.kind === 'pdf') {
      const blob = await getOriginal(doc.id);
      const pages = blob ? await pdfPageCount(await blob.arrayBuffer()).catch(() => 0) : 0;
      setSettingsFor({ doc, pages });
    } else startDefault(doc);
  };

  const onFiles = async (files: File[]) => {
    const single = files.length === 1;
    for (const file of files) {
      try {
        const res = await importFile(file);
        if (res.status === 'created') await onCreated(res.doc, single);
        else if (res.status === 'duplicate')
          toast({ tone: 'info', title: `${file.name} is already in the library`, description: `Same file as “${res.existing.name}”. It was not imported twice.` });
        else setNewVersion(res);
      } catch (err) {
        toast({ tone: 'error', title: `Unable to import ${file.name}`, description: err instanceof Error ? err.message : String(err) });
      }
    }
    await reload();
  };

  const resolveVersion = async (choice: 'compare' | 'replace' | 'keep') => {
    const p = newVersion;
    if (!p) return;
    setNewVersion(null);
    if (choice === 'replace') {
      // Same document, new file: older extractions stay in its version history.
      const db = (await import('@/lib/storage/db')).getDb;
      await (await db()).put('kblobs', { id: p.existing.id, blob: new Blob([p.bytes], { type: p.file.type || p.existing.mime }) });
      const doc = await putDoc({ ...p.existing, size: p.bytes.byteLength, hash: await sha256(p.bytes), hasOriginal: true, status: 'new' });
      await reload();
      startDefault(doc);
      toast({ tone: 'success', title: `${p.file.name} replaced`, description: 'Re-extracting. Earlier extractions are kept in the version history.' });
      return;
    }
    const res = await importFile(p.file, { force: true, previousOf: p.existing.id });
    if (res.status !== 'created') return;
    await reload();
    if (choice === 'compare') {
      const ok = await extract(res.doc.id).catch(() => false);
      if (ok) setCompare({ a: p.existing.id, b: res.doc.id });
    } else startDefault(res.doc);
  };

  /* ------------------------------ actions ---------------------------- */

  const exportOne = async (doc: KnowledgeDoc, kind: 'txt' | 'json' | 'md') => {
    try {
      const base = doc.name.replace(/\.[a-z0-9]+$/i, '');
      if (kind === 'txt') downloadBlob(await exportDocText(doc.id), `${base}.txt`);
      else if (kind === 'json') downloadBlob(await exportDocJson(doc.id), `${base}.json`);
      else {
        const ext = await currentExtraction(doc);
        if (!ext) throw new Error('Extract the document first.');
        downloadBlob(new Blob([exportMarkdown(ext)], { type: 'text/markdown' }), `${base}.md`);
      }
    } catch (err) {
      toast({ tone: 'error', title: 'Export failed', description: err instanceof Error ? err.message : String(err) });
    }
  };

  const exportLibrary = async () => {
    setBusyZip(true);
    try {
      const all = await listDocs();
      const entries = await Promise.all(all.map(async (doc) => ({ doc, extraction: await currentExtraction(doc), original: await getOriginal(doc.id) })));
      downloadBlob(await libraryZip(entries, useWorkspace.getState().profile, useWorkspace.getState().library), 'knowledge-library.zip');
    } finally {
      setBusyZip(false);
    }
  };

  const downloadSource = (name: string, data: unknown) => downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);

  const sources = useMemo(() => structuredSources(profile, library), [profile, library]);

  /* ------------------------------ filters ---------------------------- */

  const visible = useMemo(
    () => (docs ?? []).filter((d) => (!folder || d.folder === folder) && (!tagFilter || d.tags.includes(tagFilter)) && (!typeFilter || d.docType === typeFilter)),
    [docs, folder, tagFilter, typeFilter],
  );
  const recent = useMemo(() => (docs ?? []).filter((d) => d.currentVersion || d.status === 'failed').slice(0, 5), [docs]);
  const full = storage && storage.quota > 0 ? storage.usage / storage.quota : 0;

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">PDF → reusable data</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Extract <span className="font-display font-normal italic">your data</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Import PDFs and turn them into reusable structured data — profile, experience, projects, skills — for every portfolio, resume and document. Processed on this device only.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Archive className="size-4" />} loading={busyZip} disabled={!docs?.length} onClick={() => void exportLibrary()}>
              Export entire library
            </Button>
          </div>
        </header>

        <div className="mt-8">
          {docs && docs.length === 0 ? <DropZone onFiles={(f) => void onFiles(f)} /> : <DropZone compact onFiles={(f) => void onFiles(f)} />}
        </div>

        {Object.values(jobs).length > 0 && (
          <section className="mt-4 grid gap-2" aria-label="Processing">
            {Object.values(jobs).map((j) => (
              <div key={j.docId}>
                <p className="mb-1 text-[12px] text-fg-muted">{docs?.find((d) => d.id === j.docId)?.name ?? 'Document'}</p>
                <JobProgress job={j} />
              </div>
            ))}
          </section>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr_300px]">
          {/* ---------------------------- sidebar ---------------------------- */}
          <aside className="grid content-start gap-6">
            <nav aria-label="Folders">
              <h2 className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                My Data/
                <IconButton size="xs" label="New folder" onClick={() => setNewFolder(true)}>
                  <FolderPlus className="size-3.5" />
                </IconButton>
              </h2>
              <ul className="mt-2 grid gap-0.5 text-[13px]">
                {[null, ...folders].map((f) => (
                  <li key={f ?? '__all'}>
                    <button type="button" onClick={() => setFolder(f)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left', folder === f ? 'bg-hover text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg')}>
                      <Folder className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{f ?? 'All documents'}</span>
                      <span className="font-mono text-[11px] text-fg-subtle">{(docs ?? []).filter((d) => !f || d.folder === f).length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Tags</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Pill key={t} active={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                    #{t}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Type</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DOCUMENT_TYPES.filter((t) => docs?.some((d) => d.docType === t.id)).map((t) => (
                  <Pill key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(typeFilter === t.id ? null : t.id)}>
                    {t.label}
                  </Pill>
                ))}
              </div>
            </div>
          </aside>

          {/* ---------------------------- documents --------------------------- */}
          <section aria-label="Documents" className="min-w-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search names, text, JSON fields, metadata and #tags…"
                aria-label="Search the knowledge library"
                className="h-10 w-full rounded-xl border border-line bg-panel pl-9 pr-9 text-[13.5px] outline-none placeholder:text-fg-subtle focus:border-accent"
              />
              {query && (
                <IconButton size="xs" label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setQuery('')}>
                  <X className="size-3.5" />
                </IconButton>
              )}
            </div>

            {hits ? (
              <div className="mt-4">
                <p className="text-[12px] text-fg-subtle">{hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'No matches in any document.'}</p>
                <ul className="mt-2 grid gap-2">
                  {hits.map((h, i) => (
                    <li key={`${h.docId}-${h.blockId}-${i}`}>
                      <Link to={`/knowledge/${h.docId}?page=${h.page}${h.blockId ? `&block=${h.blockId}` : ''}`} className="block rounded-xl border border-line bg-panel px-4 py-3 hover:border-line-strong">
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                          {h.docName}
                          <span className="text-[11px] font-normal text-fg-subtle">
                            {h.field === 'text' ? `Page ${h.page}` : h.field === 'json' ? 'Structured data' : h.field === 'metadata' ? 'Metadata' : h.field === 'tag' ? 'Tags' : 'File name'}
                          </span>
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-relaxed text-fg-muted">“{h.snippet}”</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="mt-4 grid gap-2">
                {docs === null && <li className="h-16 animate-pulse rounded-xl bg-panel" />}
                {docs && visible.length === 0 && docs.length > 0 && <li className="rounded-xl border border-line px-4 py-6 text-center text-[13px] text-fg-muted">No documents match these filters.</li>}
                {visible.map((d) => (
                  <li key={d.id} className="rounded-xl border border-line bg-panel px-4 py-3 transition hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-elevated">
                        <DocIcon doc={d} />
                      </span>
                      <Link to={`/knowledge/${d.id}`} className="min-w-0 flex-1">
                        <Truncate disableClickExpand className="text-[13.5px] font-semibold" style={{ display: 'block', maxWidth: '100%' }}>
                          {d.name}
                        </Truncate>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-subtle">
                          <span>{docTypeLabel(d.docType)}</span>
                          {d.pageCount > 0 && <span>· {d.pageCount} page{d.pageCount === 1 ? '' : 's'}</span>}
                          <span>· {formatBytes(d.size)}</span>
                          <span>· {d.folder}</span>
                          {!d.hasOriginal && <span className="text-warn">· original deleted</span>}
                          {d.tags.map((t) => (
                            <span key={t} className="text-accent">
                              #{t}
                            </span>
                          ))}
                        </span>
                      </Link>
                      <StatusBadge status={jobs[d.id] ? 'processing' : d.status} />
                      <Menu
                        label={`Actions for ${d.name}`}
                        trigger={(p) => (
                          <IconButton {...p} size="sm" label="Document actions">
                            <MoreHorizontal className="size-4" />
                          </IconButton>
                        )}
                        items={[
                          { label: 'Open', icon: <FileDown className="size-3.5" />, onSelect: () => navigate(`/knowledge/${d.id}`) },
                          { label: 'Extract again…', icon: <RefreshCw className="size-3.5" />, disabled: !d.hasOriginal || !!jobs[d.id], onSelect: () => void onCreated(d, true) },
                          'separator',
                          { label: 'Rename', icon: <Pencil className="size-3.5" />, onSelect: () => setRenaming(d) },
                          { label: 'Duplicate', icon: <Copy className="size-3.5" />, onSelect: () => void duplicateDoc(d.id).then(reload) },
                          { label: 'Tags…', icon: <Tag className="size-3.5" />, onSelect: () => setTagging(d) },
                          { label: 'Move to folder…', icon: <Folder className="size-3.5" />, onSelect: () => setMoving(d) },
                          'separator',
                          { label: 'Download original', icon: <Download className="size-3.5" />, disabled: !d.hasOriginal, onSelect: () => void getOriginal(d.id).then((b) => b && downloadBlob(b, d.name)) },
                          { label: 'Export TXT', icon: <FileDown className="size-3.5" />, disabled: !d.currentVersion, onSelect: () => void exportOne(d, 'txt') },
                          { label: 'Export JSON', icon: <FileDown className="size-3.5" />, disabled: !d.currentVersion, onSelect: () => void exportOne(d, 'json') },
                          { label: 'Export Markdown', icon: <FileDown className="size-3.5" />, disabled: !d.currentVersion, onSelect: () => void exportOne(d, 'md') },
                          'separator',
                          { label: 'Delete original file', icon: <HardDrive className="size-3.5" />, disabled: !d.hasOriginal || !d.currentVersion, onSelect: () => void deleteOriginal(d.id).then(reload).then(() => toast({ tone: 'success', title: 'Original deleted', description: 'Extracted text and structured data were kept.' })) },
                          { label: 'Delete', icon: <Trash2 className="size-3.5" />, danger: true, onSelect: () => setDeleting(d) },
                        ]}
                      />
                    </div>
                    {jobs[d.id] && <JobProgress job={jobs[d.id]!} className="mt-3" />}
                    {d.status === 'failed' && d.error && (
                      <p className="mt-2 text-[12px] text-danger">
                        {d.error}{' '}
                        <button type="button" className="underline" onClick={() => startDefault(d)}>
                          Try again
                        </button>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ----------------------------- right ----------------------------- */}
          <aside className="grid content-start gap-5">
            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="text-[13.5px] font-semibold">Structured data</h2>
              <p className="mt-1 text-[11.5px] text-fg-subtle">Approved data shared by every studio.</p>
              <ul className="mt-3 grid gap-1 text-[12.5px]">
                {(
                  [
                    ['Profile', profile.name ? 1 : 0, 'profile.json'],
                    ['Experience', library.experience.length, 'experience.json'],
                    ['Projects', library.projects.length, 'projects.json'],
                    ['Skills', library.skills.length, 'skills.json'],
                    ['Education', library.education.length, 'education.json'],
                    ['Certifications', library.certifications.length, 'certifications.json'],
                  ] as const
                ).map(([label, n, file]) => (
                  <li key={label} className="flex items-center justify-between gap-2">
                    <span className="text-fg-muted">{label}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-[11.5px] tabular-nums">{n}</span>
                      <IconButton size="xs" label={`Download ${file}`} onClick={() => downloadSource(file.replace(/^./, (c) => c.toUpperCase()), sources[file])}>
                        <Download className="size-3" />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-3 w-full"
                size="sm"
                icon={<Download className="size-3.5" />}
                onClick={() => downloadSource('Resume.json', { format: 'portfolio-os-resume', version: 1, profile: (({ profileImage: _i, ...p }) => p)(profile), library })}
              >
                Resume.json
              </Button>
            </section>

            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="text-[13.5px] font-semibold">Recent extractions</h2>
              {recent.length ? (
                <ul className="mt-2 grid gap-2">
                  {recent.map((d) => (
                    <li key={d.id}>
                      <Link to={`/knowledge/${d.id}`} className="flex items-center gap-2 text-[12.5px] hover:text-fg">
                        <DocIcon doc={d} className="size-3.5" />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                        <StatusBadge status={d.status} />
                      </Link>
                      <p className="pl-[22px] text-[11px] text-fg-subtle">{timeAgo(d.updatedAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-fg-muted">Nothing extracted yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
                <HardDrive className="size-4 text-fg-muted" /> Local storage
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px]">
                <dt className="text-fg-muted">Used</dt>
                <dd className="text-right font-mono">{storage ? formatBytes(storage.usage) : '—'}</dd>
                <dt className="text-fg-muted">Available</dt>
                <dd className="text-right font-mono">{storage?.quota ? formatBytes(storage.quota) : 'Browser-dependent'}</dd>
                <dt className="text-fg-muted">Documents</dt>
                <dd className="text-right font-mono">{usage?.documents ?? 0}</dd>
                <dt className="text-fg-muted">Original files</dt>
                <dd className="text-right font-mono">{usage ? `${usage.originals} · ${formatBytes(usage.originalBytes)}` : '—'}</dd>
              </dl>
              {storage?.quota ? <ProgressBar value={Math.round(full * 100)} className="mt-3 h-1.5" label="Storage used" /> : null}
              {full > 0.8 && <p className="mt-2 text-[12px] text-warn">⚠ Local storage is getting full.</p>}
              <Button className="mt-3 w-full" size="sm" onClick={() => setManage(true)}>
                Manage storage
              </Button>
            </section>

            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
                <ShieldCheck className="size-4 text-ok" /> Privacy &amp; local data
              </h2>
              <p className="mt-1 text-[12px] text-fg-muted">Your documents are stored locally.</p>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-[12px]">
                {[
                  ['PDF processing', '✓ Local'],
                  ['OCR', '✓ Local'],
                  ['Structured extraction', '✓ Local'],
                  ['Search', '✓ Local'],
                  ['Cloud upload', 'None'],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="text-right font-medium text-ok">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 grid gap-2">
                <Button size="sm" icon={<Archive className="size-3.5" />} disabled={!docs?.length} onClick={() => void exportLibrary()}>
                  Export all data
                </Button>
                <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} disabled={!docs?.length} onClick={() => setWipe(true)}>
                  Delete all local knowledge data
                </Button>
                <Link to="/settings" className="text-center text-[11.5px] text-accent hover:underline">
                  All app data &amp; backups →
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <PasswordDialog />
      <ExtractionSettingsDialog
        open={!!settingsFor}
        onClose={() => {
          const d = settingsFor?.doc;
          setSettingsFor(null);
          if (d && d.status === 'new') startDefault(d);
        }}
        pageCount={settingsFor?.pages ?? 0}
        {...(settingsFor?.doc.docTypeLocked ? { docType: settingsFor.doc.docType } : {})}
        onStart={(o, forced) => {
          const d = settingsFor?.doc;
          setSettingsFor(null);
          if (!d) return;
          void (async () => {
            if (forced) await patchDoc(d.id, { docType: forced, docTypeLocked: true });
            await extract(d.id, o, forced ? { forcedType: forced } : {}).catch((err: unknown) => toast({ tone: 'error', title: `Unable to extract ${d.name}`, description: err instanceof Error ? err.message : String(err) }));
          })();
        }}
      />

      <Dialog
        open={!!newVersion}
        onClose={() => setNewVersion(null)}
        size="sm"
        title={newVersion?.file.name ?? ''}
        description="A document with this name is already in the library. New version detected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewVersion(null)}>
              Cancel
            </Button>
            <Button onClick={() => void resolveVersion('keep')}>Keep both</Button>
            <Button onClick={() => void resolveVersion('replace')}>Replace</Button>
            <Button variant="primary" onClick={() => void resolveVersion('compare')}>
              Compare
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12.5px]">
          <dt className="text-fg-muted">Previous version</dt>
          <dd>
            {newVersion && `${formatBytes(newVersion.existing.size)} · imported ${timeAgo(newVersion.existing.createdAt)}`}
          </dd>
          <dt className="text-fg-muted">New version</dt>
          <dd>{newVersion && formatBytes(newVersion.bytes.byteLength)}</dd>
        </dl>
      </Dialog>

      {compare && <CompareDialog open onClose={() => setCompare(null)} docA={compare.a} docB={compare.b} />}

      <NewFolderDialog open={newFolder} onClose={() => setNewFolder(false)} onCreate={(name) => void saveFolders([...folders, name]).then(reload)} />
      <RenameDialog doc={renaming} onClose={() => setRenaming(null)} onSaved={reload} />
      <TagDialog doc={tagging} tags={tags} onClose={() => setTagging(null)} onSaved={reload} />
      <FolderDialog doc={moving} folders={folders} onClose={() => setMoving(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="The original file and every extraction version are removed from this browser. Data you already imported into your profile or library stays."
        confirmLabel="Delete"
        onConfirm={() => deleting && void deleteDoc(deleting.id).then(reload).then(() => refreshIndex())}
      />
      <ConfirmDialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Delete all extracted data?"
        description="Every document, original file, extraction version and source record in Extract Your Data is deleted from this browser. Your profile, library, resumes and portfolios are not touched."
        confirmLabel="Delete everything here"
        onConfirm={() => void deleteAllKnowledge().then(reload).then(() => refreshIndex())}
      />
      <Dialog open={manage} onClose={() => setManage(false)} size="md" title="Manage storage" description="Delete original files to save space. Extracted text and structured data are kept.">
        <ul className="grid gap-2">
          {(docs ?? [])
            .filter((d) => d.hasOriginal)
            .sort((a, b) => b.size - a.size)
            .map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <DocIcon doc={d} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{d.name}</span>
                  <span className="text-[11.5px] text-fg-subtle">
                    Original: {formatBytes(d.size)} · Extracted data: {d.currentVersion ? 'kept' : 'none yet'}
                  </span>
                </span>
                <Button size="xs" variant="danger" disabled={!d.currentVersion} title={d.currentVersion ? undefined : 'Extract first so nothing is lost'} onClick={() => void deleteOriginal(d.id).then(reload)}>
                  Delete original
                </Button>
              </li>
            ))}
          {!(docs ?? []).some((d) => d.hasOriginal) && <li className="text-[13px] text-fg-muted">No original files are stored.</li>}
        </ul>
      </Dialog>
    </div>
  );
}

/* ------------------------------ small dialogs ------------------------ */

function NewFolderDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  useEffect(() => setName(''), [open]);
  const save = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="New folder"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <TextInput label="Folder name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Certificates" />
      </form>
    </Dialog>
  );
}

function RenameDialog({ doc, onClose, onSaved }: { doc: KnowledgeDoc | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  useEffect(() => setName(doc?.name ?? ''), [doc]);
  const save = async () => {
    if (!doc || !name.trim()) return;
    await patchDoc(doc.id, { name: name.trim() });
    onClose();
    await onSaved();
    void refreshIndex();
  };
  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      size="sm"
      title="Rename document"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), void save())}>
        <TextInput label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </form>
    </Dialog>
  );
}

function TagDialog({ doc, tags, onClose, onSaved }: { doc: KnowledgeDoc | null; tags: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [sel, setSel] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  useEffect(() => setSel(doc?.tags ?? []), [doc]);
  const all = [...new Set([...tags, ...sel])];
  const add = () => {
    const t = normalizeTag(custom);
    if (t && !sel.includes(t)) setSel([...sel, t]);
    setCustom('');
  };
  const save = async () => {
    if (!doc) return;
    await saveTags([...tags, ...sel]);
    await patchDoc(doc.id, { tags: sel });
    onClose();
    await onSaved();
    void refreshIndex();
  };
  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      size="sm"
      title="Tags"
      description={doc?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Save tags
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {all.map((t) => (
          <Pill key={t} active={sel.includes(t)} onClick={() => setSel(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t])}>
            #{t}
          </Pill>
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom tag" aria-label="Custom tag" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[13px]" />
        <Button size="sm" type="submit" disabled={!normalizeTag(custom)}>
          Add
        </Button>
      </form>
    </Dialog>
  );
}

function FolderDialog({ doc, folders, onClose, onSaved }: { doc: KnowledgeDoc | null; folders: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState('');
  useEffect(() => setValue(doc?.folder ?? ''), [doc]);
  const save = async () => {
    if (!doc || !value.trim()) return;
    if (!folders.includes(value.trim())) await saveFolders([...folders, value.trim()]);
    await patchDoc(doc.id, { folder: value.trim() });
    onClose();
    await onSaved();
  };
  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      size="sm"
      title="Move to folder"
      description={doc?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Move
          </Button>
        </>
      }
    >
      <div className="grid gap-1">
        {folders.map((f) => (
          <label key={f} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]', value === f ? 'border-accent bg-accent-soft' : 'border-line')}>
            <input type="radio" name="folder" checked={value === f} onChange={() => setValue(f)} />
            <Folder className="size-3.5" /> My Data/{f}
          </label>
        ))}
      </div>
      <TextInput className="mt-3" label="Or a new folder" value={folders.includes(value) ? '' : value} onChange={(e) => setValue(e.target.value)} />
    </Dialog>
  );
}
