import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, FileText, FileType2, KeyRound, Lock, UploadCloud, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented, Switch, TextInput } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import { useKnowledgeJobs, type Job } from '@/knowledge/store/jobs';
import { REVIEW_THRESHOLD } from '@/knowledge/import/review';
import { DEFAULT_EXTRACTION_OPTIONS, DOCUMENT_TYPES, type DocStatus, type DocumentType, type ExtractionOptions, type KnowledgeDoc } from '@/knowledge/types';

export const ACCEPT = '.pdf,.txt,.md,.markdown,.json,application/pdf,text/plain,text/markdown,application/json';

export function DocIcon({ doc, className }: { doc: Pick<KnowledgeDoc, 'kind'>; className?: string }) {
  const Icon = doc.kind === 'pdf' ? FileType2 : doc.kind === 'json' ? FileJson : FileText;
  return <Icon className={cn('size-4', doc.kind === 'pdf' ? 'text-[#ff6b6b]' : doc.kind === 'json' ? 'text-[#f5b455]' : 'text-[#5ab0ff]', className)} aria-hidden="true" />;
}

const STATUS: Record<DocStatus, { label: string; tone: string }> = {
  new: { label: 'Not extracted', tone: 'text-fg-subtle border-line' },
  processing: { label: 'Processing', tone: 'text-accent border-accent/40' },
  'needs-ocr': { label: 'Needs OCR', tone: 'text-warn border-warn/40' },
  'needs-review': { label: 'Needs review', tone: 'text-warn border-warn/40' },
  completed: { label: 'Completed', tone: 'text-ok border-ok/40' },
  failed: { label: 'Failed', tone: 'text-danger border-danger/40' },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const s = STATUS[status];
  return <span className={cn('inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium', s.tone)}>{s.label}</span>;
}

/** "✓ High confidence" / "⚠ Needs review" with the percentage. */
export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  if (value >= 0.85)
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-ok', className)} title={`${pct}% confidence`}>
        <CheckCircle2 className="size-3" aria-hidden="true" /> High confidence
      </span>
    );
  if (value >= REVIEW_THRESHOLD)
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-fg-muted', className)} title={`${pct}% confidence`}>
        <CheckCircle2 className="size-3" aria-hidden="true" /> {pct}%
      </span>
    );
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] text-warn', className)} title={`${pct}% confidence`}>
      <AlertTriangle className="size-3" aria-hidden="true" /> Needs review{value > 0 ? ` · ${pct}%` : ''}
    </span>
  );
}

export function docTypeLabel(t: DocumentType): string {
  return DOCUMENT_TYPES.find((d) => d.id === t)?.label ?? 'Other';
}

/* ------------------------------ drop zone ---------------------------- */

export function DropZone({ onFiles, compact, children }: { onFiles: (files: File[]) => void; compact?: boolean; children?: ReactNode }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={cn('relative rounded-3xl border-2 border-dashed transition-colors', over ? 'border-accent bg-accent-soft/40' : 'border-line-strong bg-panel/60', compact ? 'px-4 py-4' : 'px-6 py-10 text-center')}
    >
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Choose files to import" onChange={(e) => (onFiles(Array.from(e.target.files ?? [])), (e.target.value = ''))} />
      {compact ? (
        <div className="flex flex-wrap items-center gap-3">
          <UploadCloud className="size-5 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg-muted">
            <span className="font-medium text-fg">Drop PDF, TXT, Markdown or JSON files</span> — processed on this device.
          </p>
          <Button size="sm" variant="primary" icon={<UploadCloud className="size-3.5" />} onClick={() => input.current?.click()}>
            Upload files
          </Button>
        </div>
      ) : (
        <>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-elevated text-accent">
            <UploadCloud className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Drag &amp; drop PDF files here</p>
          <p className="mt-1 text-[13px] text-fg-muted">Resumes, CVs, certificates, reports, case studies… Also .txt, .md and .json. Multiple files at once.</p>
          <div className="mt-5 flex justify-center">
            <Button variant="primary" icon={<UploadCloud className="size-4" />} onClick={() => input.current?.click()}>
              Upload PDF
            </Button>
          </div>
          <p className="mx-auto mt-4 flex max-w-full flex-wrap items-center justify-center gap-1.5 text-[11.5px] text-fg-subtle">
            <Lock className="size-3" aria-hidden="true" /> Nothing is uploaded. PDF parsing and OCR run in this browser.
          </p>
          {children}
        </>
      )}
    </div>
  );
}

/* ----------------------------- job progress -------------------------- */

export function JobProgress({ job, className }: { job: Job; className?: string }) {
  const cancel = useKnowledgeJobs((s) => s.cancel);
  const p = job.progress;
  const pct = Math.round(p.value * 100);
  return (
    <div className={cn('rounded-xl border border-line bg-bg px-3 py-2.5', className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="min-w-0 flex-1 truncate font-medium">
          {p.stage}
          {p.page && p.total ? (
            <span className="font-normal text-fg-muted">
              {' '}
              · Page {p.page} / {p.total}
            </span>
          ) : null}
        </span>
        <span className="font-mono text-[11px] text-fg-subtle">{pct}%</span>
        <Button size="xs" variant="ghost" onClick={() => cancel(job.docId)}>
          Cancel
        </Button>
      </div>
      <ProgressBar value={pct} className="mt-2 h-1.5" label={p.stage} />
    </div>
  );
}

/* ------------------------------- password ---------------------------- */

export function PasswordDialog() {
  const req = useKnowledgeJobs((s) => s.password);
  const dismiss = useKnowledgeJobs((s) => s.dismissPassword);
  const [value, setValue] = useState('');
  useEffect(() => setValue(''), [req]);
  return (
    <Dialog
      open={!!req}
      onClose={dismiss}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-accent" /> Password protected
        </span>
      }
      description="This PDF is password protected. Enter the password locally to attempt processing."
      footer={
        <>
          <Button variant="ghost" onClick={dismiss}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!value} onClick={() => req?.retry(value)}>
            Unlock &amp; extract
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) req?.retry(value);
        }}
      >
        <TextInput type="password" autoFocus autoComplete="off" label="PDF password" value={value} onChange={(e) => setValue(e.target.value)} error={req?.incorrect ? 'That password did not work. Try again.' : undefined} />
        <p className="mt-2 text-[11.5px] text-fg-subtle">The password is used only in this browser for this extraction. It is not stored or sent anywhere.</p>
      </form>
    </Dialog>
  );
}

/* --------------------------- extraction settings --------------------- */

/** "1-3, 5" → [1, 2, 3, 5], clamped to the document; null when nothing valid was typed. */
export function parsePages(input: string, max: number): number[] | null {
  const s = input.trim();
  if (!s) return null;
  const out = new Set<number>();
  for (const part of s.split(/[,\s]+/)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= max; i++) if (i >= 1) out.add(i);
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

export function ExtractionSettingsDialog({
  open,
  onClose,
  onStart,
  pageCount,
  docType,
  initial = DEFAULT_EXTRACTION_OPTIONS,
  title = 'Extraction settings',
}: {
  open: boolean;
  onClose: () => void;
  onStart: (o: ExtractionOptions, forcedType: DocumentType | null) => void;
  pageCount: number;
  docType?: DocumentType;
  initial?: ExtractionOptions;
  title?: string;
}) {
  const [o, setO] = useState<ExtractionOptions>(initial);
  const [type, setType] = useState<DocumentType | 'auto'>('auto');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [range, setRange] = useState('');
  useEffect(() => {
    if (!open) return;
    setO({ ...initial, password: undefined });
    setType(docType ?? 'auto');
    setSelected(new Set(initial.pages ?? Array.from({ length: pageCount }, (_, i) => i + 1)));
  }, [open, initial, pageCount, docType]);
  const set = (k: keyof ExtractionOptions) => (v: boolean) => setO((x) => ({ ...x, [k]: v }));
  const all = pageCount > 0 && selected.size === pageCount;
  const toggle = (n: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={pageCount > 0 && selected.size === 0}
            onClick={() => onStart({ ...o, pages: pageCount > 0 && !all ? [...selected].sort((a, b) => a - b) : null }, type === 'auto' ? null : type)}
          >
            {pageCount > 0 && !all ? `Extract ${selected.size} selected page${selected.size === 1 ? '' : 's'}` : 'Start extraction'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <p className="-mb-2 text-[12px] text-fg-subtle">Text is always extracted. Choose what else to include:</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Switch checked={o.metadata} onChange={set('metadata')} label="Metadata" />
          <Switch checked={o.links} onChange={set('links')} label="Links" />
          <Switch checked={o.tables} onChange={set('tables')} label="Tables" />
          <Switch checked={o.images} onChange={set('images')} label="Images" help="Positions of embedded images" />
          <Switch checked={o.structure} onChange={set('structure')} label="Structure" help="Headings, lists, paragraphs" />
        </div>
        <Segmented
          label="OCR"
          value={o.ocr}
          onChange={(v) => setO((x) => ({ ...x, ocr: v }))}
          options={[
            { value: 'auto', label: 'Auto', title: 'Run OCR when the selected pages have no selectable text. In a partly scanned file, the scanned pages are offered for OCR afterwards.' },
            { value: 'always', label: 'Always' },
            { value: 'never', label: 'Never' },
          ]}
        />
        <Segmented
          label="Semantic extraction"
          value={o.semantic}
          onChange={(v) => setO((x) => ({ ...x, semantic: v }))}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'resume', label: 'Resume' },
            { value: 'portfolio', label: 'Portfolio' },
            { value: 'generic', label: 'Generic' },
          ]}
        />
        <label className="grid gap-1.5 text-[12.5px]">
          <span className="font-medium text-fg">Document type</span>
          <select className="h-9 rounded-lg border border-line bg-bg px-2.5 text-[13px]" value={type} onChange={(e) => setType(e.target.value as DocumentType | 'auto')}>
            <option value="auto">Detect automatically</option>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {pageCount > 1 && (
          <fieldset>
            <legend className="flex w-full items-center justify-between text-[12.5px] font-medium">
              Import pages
              <span className="flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => (setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i + 1))), setRange(''))}>
                  All
                </Button>
                <Button size="xs" variant="ghost" onClick={() => (setSelected(new Set()), setRange(''))}>
                  None
                </Button>
              </span>
            </legend>
            <input
              className="app-input mt-2 !h-8 !text-[12.5px]"
              placeholder={`Type pages, e.g. 1-3, ${Math.min(pageCount, 5)}`}
              aria-label="Pages to import"
              value={range}
              onChange={(e) => {
                setRange(e.target.value);
                const pages = parsePages(e.target.value, pageCount);
                if (pages) setSelected(new Set(pages));
              }}
            />
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <label key={n} className={cn('inline-flex h-8 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 text-[12px] tabular-nums', selected.has(n) ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted')}>
                  <input type="checkbox" className="sr-only" checked={selected.has(n)} onChange={() => toggle(n)} />
                  {selected.has(n) ? '☑' : '☐'} {n}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}

export function Pill({ children, onRemove, active, onClick }: { children: ReactNode; onRemove?: () => void; active?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cn('inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11.5px]', active ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted', onClick && 'hover:border-line-strong')}>
      {children}
      {onRemove && (
        <IconButton size="xs" label="Remove" onClick={onRemove} className="-mr-1 size-4">
          <X className="size-3" />
        </IconButton>
      )}
    </Tag>
  );
}
