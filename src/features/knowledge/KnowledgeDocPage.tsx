import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, FileDown, History, ImageIcon, Link2, Pencil, RefreshCw, RotateCcw, ScanText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { Badge } from '@/components/ui/misc';
import { toast } from '@/stores/ui';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { downloadBlob } from '@/utils/download';
import { formatBytes, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import { exportDocJson, exportDocRawJson, exportDocText, saveCorrections } from '@/knowledge/engine/service';
import { exportMarkdown } from '@/knowledge/export/formats';
import { getDoc, getExtraction, getOriginal, listExtractions, patchDoc, recoverInterrupted, setCurrentVersion } from '@/knowledge/storage/repo';
import { useKnowledgeJobs } from '@/knowledge/store/jobs';
import { DOCUMENT_TYPES, type DocumentType, type Extraction, type ExtractedBlock, type KnowledgeDoc, type Provenance } from '@/knowledge/types';
import { CompareDialog } from './CompareDialog';
import { PdfPreview, type Highlight } from './PdfPreview';
import { ReviewPanel } from './ReviewPanel';
import { ConfidenceBadge, DocIcon, ExtractionSettingsDialog, JobProgress, PasswordDialog, StatusBadge } from './shared';

type Tab = 'content' | 'review' | 'data' | 'ocr' | 'versions';

export default function KnowledgeDocPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const job = useKnowledgeJobs((s) => s.jobs[id]);
  const revision = useKnowledgeJobs((s) => s.revision);
  const extract = useKnowledgeJobs((s) => s.extract);
  const ocr = useKnowledgeJobs((s) => s.ocr);
  const wsLoaded = useWorkspace((s) => s.loaded);

  const [doc, setDoc] = useState<KnowledgeDoc | null | undefined>(undefined);
  const [ext, setExt] = useState<Extraction | null>(null);
  const [versions, setVersions] = useState<Extraction[]>([]);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('content');
  const [selected, setSelected] = useState<string | null>(params.get('block'));
  const [focusPage, setFocusPage] = useState<number | null>(params.get('page') ? Number(params.get('page')) : null);
  const [settings, setSettings] = useState(false);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [pageBreaks, setPageBreaks] = useState(true);

  const load = useCallback(async () => {
    const found = await getDoc(id);
    const d = found ? (await recoverInterrupted([found], new Set(Object.keys(useKnowledgeJobs.getState().jobs))))[0] : undefined;
    setDoc(d ?? null);
    if (!d) return;
    const [e, v, blob] = await Promise.all([d.currentVersion ? getExtraction(d.currentVersion) : Promise.resolve(undefined), listExtractions(d.id), getOriginal(d.id)]);
    setExt(e ?? null);
    setVersions(v);
    if (blob) {
      const buf = await blob.arrayBuffer();
      if (d.kind === 'pdf') setBytes((prev) => (prev && prev.byteLength === buf.byteLength ? prev : buf));
      else setOriginalText(new TextDecoder().decode(buf));
    } else {
      setBytes(null);
      setOriginalText(null);
    }
  }, [id]);

  useEffect(() => {
    void ensureWorkspace();
    void load();
  }, [load, revision]);

  // First visit of a resume that needs review → open the review tab.
  useEffect(() => {
    if (doc?.status === 'needs-review' && ext?.semantic.resume && !params.get('block')) setTab('review');
  }, [doc?.status, ext?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = useMemo(() => ext?.pages.flatMap((p) => p.blocks) ?? [], [ext]);
  const sel = blocks.find((b) => b.id === selected) ?? null;
  const highlights = useMemo<Highlight[]>(() => {
    const out: Highlight[] = [];
    if (sel && sel.width > 0) out.push({ page: sel.page, x: sel.x, y: sel.y, width: sel.width, height: sel.height, tone: 'select' });
    if (tab === 'ocr' && ext) for (const p of ext.pages) for (const b of p.blocks) for (const l of b.lines) for (const w of l.words ?? []) if (w.confidence !== undefined && w.confidence < 0.7) out.push({ page: p.page, x: w.x, y: w.y, width: w.width, height: w.height, tone: 'warn' });
    return out;
  }, [sel, tab, ext]);

  const select = (b: ExtractedBlock) => {
    setSelected(b.id);
    setFocusPage(null);
    setParams((p) => {
      p.set('page', String(b.page));
      p.set('block', b.id);
      return p;
    }, { replace: true });
  };
  const showSource = (s: Provenance) => {
    if (s.blockId) {
      const b = blocks.find((x) => x.id === s.blockId);
      if (b) return select(b);
    }
    setFocusPage(s.page);
  };
  const onPageClick = (page: number, x: number, y: number) => {
    const hit = blocks.find((b) => b.page === page && b.type !== 'image' && x >= b.x - 2 && x <= b.x + b.width + 2 && y >= b.y - 2 && y <= b.y + b.height + 2);
    if (hit) {
      select(hit);
      setTab('content');
      requestAnimationFrame(() => document.getElementById(`blk-${hit.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
  };

  const runExtract = (o?: Parameters<typeof extract>[1], forced?: DocumentType | null) =>
    void extract(id, o, forced ? { forcedType: forced } : {}).catch((err: unknown) => toast({ tone: 'error', title: 'Extraction failed', description: err instanceof Error ? err.message : String(err) }));
  const scanned = (ext?.warnings ?? []).find((w) => /scanned/i.test(w));
  const scannedPages = useMemo(() => {
    if (!ext) return [];
    return ext.pages.filter((p) => !p.ocr && !p.blocks.some((b) => b.type !== 'image' && b.text.trim().length > 0)).map((p) => p.page);
  }, [ext]);
  const runOcr = (pages: number[]) =>
    void ocr(id, pages, ext?.options).then((ok) => ok && setTab('ocr')).catch((err: unknown) => toast({ tone: 'error', title: 'OCR failed', description: err instanceof Error ? err.message : String(err) }));

  const saveDrafts = async () => {
    if (!ext || !Object.keys(drafts).length) return;
    const next: Extraction = structuredClone(ext);
    for (const p of next.pages)
      for (const b of p.blocks) {
        const t = drafts[b.id];
        if (t === undefined) continue;
        b.text = t;
        if (b.type === 'list') b.items = t.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean);
        else if (b.type === 'table') b.rows = t.split('\n').map((r) => r.split('|').map((c) => c.trim()));
        b.lines = t.split('\n').map((l, i) => ({ ...(b.lines[i] ?? { x: b.x, y: b.y, width: b.width, height: b.height, fontSize: 10, bold: false }), text: l, confidence: 1, words: [] }));
        delete b.confidence;
      }
    await saveCorrections(id, next);
    setDrafts({});
    setEditing(null);
    toast({ tone: 'success', title: 'Corrections saved as a new version', description: 'The original file is unchanged. Earlier versions can be restored.' });
    await load();
  };

  const exportAs = async (kind: 'txt' | 'raw' | 'structured' | 'semantic' | 'md') => {
    if (!doc) return;
    const base = doc.name.replace(/\.[a-z0-9]+$/i, '');
    try {
      if (kind === 'txt') downloadBlob(await exportDocText(id, { pageBreaks }), `${base}.txt`);
      else if (kind === 'raw') downloadBlob(await exportDocRawJson(id, ext?.options), `${base}.raw.json`);
      else if (kind === 'structured') downloadBlob(await exportDocJson(id, 'structured'), `${base}.json`);
      else if (kind === 'semantic') downloadBlob(await exportDocJson(id, 'semantic'), `${base}.semantic.json`);
      else if (ext) downloadBlob(new Blob([exportMarkdown(ext)], { type: 'text/markdown' }), `${base}.md`);
    } catch (err) {
      toast({ tone: 'error', title: 'Export failed', description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (doc === null)
    return (
      <div className="grid min-h-full place-items-center bg-bg p-8 text-center text-fg">
        <div>
          <p className="text-[15px] font-semibold">Document not found</p>
          <Link to="/knowledge" className="mt-3 inline-block text-[13px] text-accent">
            ← Back to Extract Your Data
          </Link>
        </div>
      </div>
    );

  const tabs: Array<[Tab, string, boolean]> = [
    ['content', 'Extracted content', true],
    ['review', 'Review & import', !!ext?.semantic.resume],
    ['data', 'Document information', true],
    ['ocr', 'OCR', !!ext?.ocr],
    ['versions', `Versions (${versions.length})`, true],
  ];

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      {/* --------------------------- top bar --------------------------- */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-3 py-2 sm:px-4">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => navigate('/knowledge')}>
          <span className="hidden sm:inline">Extract Your Data</span>
        </Button>
        {doc && (
          <>
            <DocIcon doc={doc} />
            <h1 className="min-w-0 max-w-[40vw] truncate text-[14px] font-semibold">{doc.name}</h1>
            <StatusBadge status={job ? 'processing' : doc.status} />
            <select
              aria-label="Document type"
              className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]"
              value={doc.docType}
              onChange={(e) => {
                const t = e.target.value as DocumentType;
                void patchDoc(id, { docType: t, docTypeLocked: true }).then(() => {
                  if (doc.hasOriginal) runExtract(ext?.options, t);
                  else void load();
                });
              }}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {ext && !doc.docTypeLocked && <span className="hidden text-[11px] text-fg-subtle md:inline">detected · {Math.round(ext.semantic.docTypeConfidence * 100)}%</span>}
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {doc?.kind === 'pdf' && (
            <Button size="sm" icon={<ScanText className="size-3.5" />} disabled={!!job || !doc.hasOriginal} onClick={() => runOcr(scannedPages)}>
              Run OCR
            </Button>
          )}
          <Button size="sm" icon={<RefreshCw className="size-3.5" />} disabled={!!job || !doc?.hasOriginal} onClick={() => setSettings(true)}>
            Extract again
          </Button>
          <Menu
            label="Export"
            header={
              <label className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-fg-muted">
                <input type="checkbox" checked={pageBreaks} onChange={(e) => setPageBreaks(e.target.checked)} /> Preserve page breaks in TXT
              </label>
            }
            trigger={(p) => (
              <Button {...p} size="sm" variant="primary" icon={<Download className="size-3.5" />} disabled={!ext}>
                Export
              </Button>
            )}
            items={[
              { label: 'Export TXT', icon: <FileDown className="size-3.5" />, hint: 'document.txt', onSelect: () => void exportAs('txt') },
              { label: 'Export Markdown', icon: <FileDown className="size-3.5" />, onSelect: () => void exportAs('md') },
              'separator',
              { label: 'JSON — Structured', icon: <FileDown className="size-3.5" />, hint: 'pages, blocks', onSelect: () => void exportAs('structured') },
              { label: 'JSON — Semantic', icon: <FileDown className="size-3.5" />, disabled: !ext?.semantic.resume, hint: 'profile, skills…', onSelect: () => void exportAs('semantic') },
              { label: 'JSON — Raw parser data', icon: <FileDown className="size-3.5" />, disabled: !doc?.hasOriginal, hint: 'runs, fonts, coords', onSelect: () => void exportAs('raw') },
              'separator',
              { label: 'Download original', icon: <Download className="size-3.5" />, disabled: !doc?.hasOriginal, onSelect: () => void getOriginal(id).then((b) => b && doc && downloadBlob(b, doc.name)) },
            ]}
          />
        </div>
      </header>

      {job && <JobProgress job={job} className="mx-3 mt-2 sm:mx-4" />}
      {doc?.status === 'failed' && !job && (
        <div className="mx-3 mt-2 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] sm:mx-4" role="alert">
          <p className="font-semibold text-danger">Unable to extract this {doc.kind === 'pdf' ? 'PDF' : 'file'}.</p>
          {doc.error && <p className="mt-0.5 text-fg-muted">{doc.error}</p>}
          <p className="mt-1 text-fg-muted">Possible reasons: encrypted document · unsupported structure · corrupted PDF · scanned document.</p>
          <div className="mt-2 flex gap-2">
            {doc.kind === 'pdf' && (
              <Button size="sm" icon={<ScanText className="size-3.5" />} onClick={() => runOcr([])}>
                Try OCR
              </Button>
            )}
            <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => runExtract()}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {doc?.status === 'new' && !job && !ext && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-[13px] sm:mx-4">
          <span className="flex-1">This document has not been extracted yet.</span>
          <Button size="sm" variant="primary" onClick={() => setSettings(true)}>
            Extract…
          </Button>
        </div>
      )}
      {scanned && !job && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-[13px] sm:mx-4">
          <AlertTriangle className="size-4 text-warn" />
          <span className="min-w-0 flex-1">This PDF appears to contain scanned pages{scannedPages.length ? ` (${scannedPages.join(', ')})` : ''}.</span>
          <Button size="sm" variant="primary" icon={<ScanText className="size-3.5" />} disabled={!doc?.hasOriginal} onClick={() => runOcr(scannedPages)}>
            Run OCR
          </Button>
        </div>
      )}

      {/* ---------------------------- split ---------------------------- */}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(240px,40%)_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1">
        <section aria-label="Preview" className="min-h-0 overflow-auto border-b border-line bg-[#e9e7e2] dark:bg-[#1a1920] lg:border-b-0 lg:border-r">
          {doc?.kind === 'pdf' && bytes ? (
            <PdfPreview data={bytes} pages={ext?.pages ?? []} highlights={highlights} focusPage={focusPage} onPageClick={onPageClick} />
          ) : originalText !== null ? (
            <pre className="m-4 whitespace-pre-wrap rounded-md bg-white p-6 font-mono text-[12px] leading-relaxed text-[#222] shadow">{originalText.slice(0, 400_000)}</pre>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-[13px] text-fg-muted">
              <p>
                The original file was deleted to save space.
                <br />
                Extracted text and structured data are still available.
              </p>
            </div>
          )}
        </section>

        <section aria-label="Extracted content" className="flex min-h-0 flex-col">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-1.5" role="tablist">
            {tabs
              .filter(([, , show]) => show)
              .map(([t, label]) => (
                <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn('h-8 shrink-0 rounded-lg px-3 text-[12.5px] font-medium', tab === t ? 'bg-hover text-fg' : 'text-fg-muted hover:text-fg')}>
                  {label}
                </button>
              ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            {!ext ? (
              <p className="text-[13px] text-fg-muted">{job ? 'Extracting…' : 'No extraction yet.'}</p>
            ) : tab === 'content' ? (
              <ContentView ext={ext} selected={selected} onSelect={select} editing={editing} setEditing={setEditing} drafts={drafts} setDraft={(bid, t) => setDrafts((d) => ({ ...d, [bid]: t }))} onSave={() => void saveDrafts()} onDiscard={() => (setDrafts({}), setEditing(null))} />
            ) : tab === 'review' && ext.semantic.resume ? (
              wsLoaded ? <ReviewPanel key={ext.id} semantic={ext.semantic.resume} docId={id} docName={doc?.name ?? ''} onShowSource={showSource} /> : null
            ) : tab === 'data' ? (
              <DataView doc={doc!} ext={ext} onSelect={select} />
            ) : tab === 'ocr' && ext.ocr ? (
              <OcrView ext={ext} onSelect={(blockId) => {
                const b = blocks.find((x) => x.id === blockId);
                if (b) select(b);
              }} onFix={(blockId) => {
                const b = blocks.find((x) => x.id === blockId);
                if (!b) return;
                setTab('content');
                select(b);
                setEditing(b.id);
              }} />
            ) : (
              <VersionsView versions={versions} current={doc?.currentVersion ?? null} onRestore={(v) => void setCurrentVersion(id, v.id).then(load).then(() => toast({ tone: 'success', title: `Restored v${v.version}`, description: v.label }))} onCompare={(v) => doc?.currentVersion && setCompare({ a: `v:${v.id}`, b: `v:${doc.currentVersion}` })} />
            )}
          </div>
        </section>
      </div>

      <PasswordDialog />
      <ExtractionSettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        pageCount={doc?.kind === 'pdf' ? doc.pageCount : 0}
        {...(doc?.docTypeLocked ? { docType: doc.docType } : {})}
        {...(ext ? { initial: { ...ext.options, password: undefined } } : {})}
        onStart={(o, forced) => {
          setSettings(false);
          void (async () => {
            if (forced) await patchDoc(id, { docType: forced, docTypeLocked: true });
            runExtract(o, forced);
          })();
        }}
      />
      {compare && <CompareDialog open onClose={() => setCompare(null)} docA={compare.a} docB={compare.b} />}
    </div>
  );
}

/* ------------------------------ content view ------------------------- */

function ContentView({ ext, selected, onSelect, editing, setEditing, drafts, setDraft, onSave, onDiscard }: { ext: Extraction; selected: string | null; onSelect: (b: ExtractedBlock) => void; editing: string | null; setEditing: (id: string | null) => void; drafts: Record<string, string>; setDraft: (id: string, t: string) => void; onSave: () => void; onDiscard: () => void }) {
  const dirty = Object.keys(drafts).length;
  useEffect(() => {
    if (selected) document.getElementById(`blk-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  return (
    <div className="grid gap-6">
      {ext.warnings.filter((w) => !/scanned/i.test(w)).map((w) => (
        <p key={w} className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
        </p>
      ))}
      {ext.pages.map((p) => (
        <section key={p.page} aria-label={`Page ${p.page}`}>
          <h2 className="flex items-center gap-2 border-b border-line pb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            Page {p.page} {p.ocr && <Badge tone="warn">OCR</Badge>}
          </h2>
          <div className="mt-2 grid gap-1">
            {p.blocks.length === 0 && <p className="text-[12.5px] text-fg-subtle">No content on this page.</p>}
            {p.blocks.map((b) => (
              <BlockView key={b.id} b={b} active={selected === b.id} onSelect={() => onSelect(b)} editing={editing === b.id} onEdit={() => setEditing(editing === b.id ? null : b.id)} draft={drafts[b.id]} setDraft={(t) => setDraft(b.id, t)} />
            ))}
          </div>
        </section>
      ))}
      {dirty > 0 && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur">
          <span className="flex-1 text-[12.5px] text-fg-muted">
            {dirty} block{dirty === 1 ? '' : 's'} modified locally. Saving keeps the original file and earlier versions.
          </span>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={onSave}>
            Save corrections
          </Button>
        </div>
      )}
    </div>
  );
}

function Words({ b }: { b: ExtractedBlock }) {
  // OCR text: underline words the engine was unsure about.
  if (b.confidence === undefined || b.confidence >= 0.7) return <>{b.text}</>;
  return (
    <>
      {b.lines.map((l, i) => (
        <span key={i} className="block">
          {(l.words ?? [{ text: l.text, confidence: l.confidence }]).map((w, j) => (
            <span key={j}>
              {j > 0 && ' '}
              {w.confidence !== undefined && w.confidence < 0.7 ? (
                <mark className="rounded-sm bg-warn/20 px-0.5 text-fg underline decoration-warn decoration-wavy" title={`Possible OCR issue · confidence ${Math.round(w.confidence * 100)}%`}>
                  {w.text}
                </mark>
              ) : (
                w.text
              )}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

function BlockView({ b, active, onSelect, editing, onEdit, draft, setDraft }: { b: ExtractedBlock; active: boolean; onSelect: () => void; editing: boolean; onEdit: () => void; draft: string | undefined; setDraft: (t: string) => void }) {
  const text = draft ?? (b.type === 'list' ? (b.items ?? []).map((i) => `• ${i}`).join('\n') : b.type === 'table' ? (b.rows ?? []).map((r) => r.join(' | ')).join('\n') : b.text);
  const label = b.type === 'subheading' ? 'Subheading' : b.type[0]!.toUpperCase() + b.type.slice(1);
  return (
    <div id={`blk-${b.id}`} className={cn('group relative rounded-lg border px-3 py-2 transition-colors', active ? 'border-accent bg-accent-soft/40' : 'border-transparent hover:border-line hover:bg-panel', (b.type === 'header' || b.type === 'footer') && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left" aria-label={`${label} on page ${b.page}`}>
          <span className="sr-only">{label}: </span>
          {editing ? null : b.type === 'image' ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle">
              <ImageIcon className="size-3.5" /> Image · {Math.round(b.width)}×{Math.round(b.height)} pt
            </span>
          ) : b.type === 'title' ? (
            <span className="block text-[20px] font-semibold leading-tight">{draft ?? <Words b={b} />}</span>
          ) : b.type === 'heading' ? (
            <span className="block text-[15px] font-semibold">{draft ?? <Words b={b} />}</span>
          ) : b.type === 'subheading' ? (
            <span className="block text-[13.5px] font-semibold">{draft ?? <Words b={b} />}</span>
          ) : b.type === 'list' ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-fg-muted">{(draft ? draft.split('\n').map((l) => l.replace(/^•\s*/, '')) : b.items ?? []).map((i, k) => <li key={k}>{i}</li>)}</ul>
          ) : b.type === 'table' ? (
            <span className="block">
              {b.uncertain && <span className="mb-1 block text-[11.5px] text-warn">⚠ Table structure may require verification</span>}
              <span className="block overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <tbody>
                    {(draft ? draft.split('\n').map((r) => r.split('|').map((c) => c.trim())) : b.rows ?? []).map((r, i) => (
                      <tr key={i} className={cn(i === 0 && 'font-semibold')}>
                        {r.map((c, j) => (
                          <td key={j} className="border border-line px-2 py-1 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </span>
            </span>
          ) : (
            <span className={cn('block whitespace-pre-line text-[13px] leading-relaxed', b.type === 'paragraph' ? 'text-fg-muted' : 'text-[11.5px] text-fg-subtle')}>{draft ?? <Words b={b} />}</span>
          )}
        </button>
        {b.type !== 'image' && (
          <button type="button" onClick={onEdit} className={cn('shrink-0 rounded-md p-1 text-fg-subtle hover:bg-hover hover:text-fg', !editing && 'opacity-0 focus:opacity-100 group-hover:opacity-100')} aria-label="Edit block text">
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {editing && <textarea autoFocus value={text} onChange={(e) => setDraft(e.target.value)} className="mt-1 h-32 w-full rounded-md border border-line bg-bg p-2 font-mono text-[12px] outline-none focus:border-accent" aria-label="Corrected text" />}
      {draft !== undefined && !editing && <span className="mt-1 block text-[10.5px] font-medium uppercase tracking-wide text-accent">Modified locally</span>}
      {b.confidence !== undefined && !editing && <ConfidenceBadge value={b.confidence} className="mt-1" />}
    </div>
  );
}

/* ------------------------------- data view --------------------------- */

function DataView({ doc, ext, onSelect }: { doc: KnowledgeDoc; ext: Extraction; onSelect: (b: ExtractedBlock) => void }) {
  const m = ext.metadata;
  const tables = ext.pages.flatMap((p) => p.blocks.filter((b) => b.type === 'table'));
  const date = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Document information</h2>
        <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          {(
            [
              ['File', `${doc.name} · ${formatBytes(doc.size)}`],
              ['Title', m?.title],
              ['Author', m?.author],
              ['Subject', m?.subject],
              ['Keywords', m?.keywords],
              ['Creator', m?.creator],
              ['Producer', m?.producer],
              ['Creation date', m ? date(m.creationDate) : null],
              ['Modification date', m ? date(m.modificationDate) : null],
              ['Page count', String(m?.pageCount ?? ext.stats.pages)],
              ['PDF version', m?.pdfVersion],
              ['Encrypted', m ? (m.encrypted ? 'Yes' : 'No') : null],
              ['SHA-256', doc.hash.slice(0, 16) + '…'],
            ] as Array<[string, string | null | undefined]>
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Extraction</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          {Object.entries(ext.stats).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line py-2">
              <dt className="text-[10.5px] capitalize text-fg-subtle">{k}</dt>
              <dd className="text-[15px] font-semibold tabular-nums">{v.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          <Link2 className="size-3.5" /> Links ({ext.links.length})
        </h2>
        {ext.links.length ? (
          <ul className="mt-2 grid gap-1 text-[12.5px]">
            {ext.links.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{l.text}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent hover:underline">
                  {l.url}
                </a>
                <span className="text-[11px] text-fg-subtle">
                  p.{l.page} · {l.origin === 'annotation' ? 'PDF link' : 'in text'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-fg-muted">No links found. Unsafe protocols (javascript:, data:, file:) are always dropped.</p>
        )}
      </section>
      <section>
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          <Table2 className="size-3.5" /> Tables ({tables.length})
        </h2>
        {tables.length ? (
          <ul className="mt-2 grid gap-1.5 text-[12.5px]">
            {tables.map((t) => (
              <li key={t.id}>
                <button type="button" className="text-left hover:text-accent" onClick={() => onSelect(t)}>
                  Page {t.page} · {t.rows?.length ?? 0} rows × {t.rows?.[0]?.length ?? 0} columns {t.uncertain && <span className="text-warn">· ⚠ verify structure</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-fg-muted">No tables detected.</p>
        )}
      </section>
    </div>
  );
}

/* -------------------------------- OCR view --------------------------- */

function OcrView({ ext, onSelect, onFix }: { ext: Extraction; onSelect: (blockId: string) => void; onFix: (blockId: string) => void }) {
  const o = ext.ocr!;
  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-[13.5px] font-semibold">OCR result</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-[11px] text-fg-subtle">Confidence</dt>
            <dd className={cn('text-[20px] font-semibold tabular-nums', o.confidence < 0.75 && 'text-warn')}>{Math.round(o.confidence * 100)}%</dd>
          </div>
          <div>
            <dt className="text-[11px] text-fg-subtle">Pages</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{o.pages}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-fg-subtle">Words</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{o.words.toLocaleString()}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-fg-muted">OCR is never perfect. Words the engine was unsure about are highlighted on the page and listed below — fix them in Extracted content.</p>
      </section>
      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Possible OCR issues ({o.uncertain.length})</h2>
        {o.uncertain.length ? (
          <ul className="mt-2 grid gap-1">
            {o.uncertain.map((u, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-1.5 text-[12.5px]">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(u.blockId)}>
                  “<span className="font-mono">{u.text}</span>” <span className="text-[11px] text-fg-subtle">· page {u.page}</span>
                </button>
                <span className="font-mono text-[11px] text-warn">confidence: {Math.round(u.confidence * 100)}%</span>
                <Button size="xs" variant="ghost" onClick={() => onFix(u.blockId)}>
                  Correct
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-fg-muted">No low-confidence words.</p>
        )}
      </section>
    </div>
  );
}

/* ----------------------------- versions view ------------------------- */

function VersionsView({ versions, current, onRestore, onCompare }: { versions: Extraction[]; current: string | null; onRestore: (v: Extraction) => void; onCompare: (v: Extraction) => void }) {
  return (
    <div>
      <p className="text-[12.5px] text-fg-muted">Original file → extraction versions → your corrections. The original file is never modified; restore any version.</p>
      <ol className="mt-3 grid gap-2">
        {versions.map((v) => (
          <li key={v.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5', v.id === current ? 'border-accent bg-accent-soft/40' : 'border-line')}>
            <History className="size-4 text-fg-subtle" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">
                v{v.version} · {v.label} {v.id === current && <Badge tone="accent">Current</Badge>}
              </span>
              <span className="text-[11.5px] text-fg-subtle">
                {timeAgo(v.createdAt)} · {v.stats.words.toLocaleString()} words · {v.origin === 'corrections' ? 'user corrections' : v.semantic.docType}
              </span>
            </span>
            {v.id !== current && (
              <>
                <Button size="xs" variant="ghost" onClick={() => onCompare(v)}>
                  Compare
                </Button>
                <Button size="xs" onClick={() => onRestore(v)}>
                  Restore
                </Button>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
