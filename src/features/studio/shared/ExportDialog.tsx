import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, FileText, FileType2, Sparkles, XCircle, Download } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Segmented, Switch, TextInput } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import type { FlowDoc, LaidDocument } from '@/studio/engine/flow';
import type { DocumentMeta, MarginPreset, PaperSize } from '@/studio/model/types';
import { printCheck } from '@/studio/analysis/print-check';
import { documentFileName, flowToDocx, flowToPdf, flowToText, jsonFile, sanitizeFileName, type PdfExportSettings } from '@/studio/export/pipeline';
import { useExportQueue } from '@/studio/export/queue';
import { cn } from '@/utils/cn';

export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'json';

export interface PageOptions {
  paper: PaperSize;
  orientation?: 'portrait' | 'landscape';
  margins: MarginPreset;
  pageNumbers: boolean;
}

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** File label, e.g. "Resume", "Cover_Letter". */
  label: string;
  personName: string;
  fileName: string;
  onFileName: (v: string) => void;
  page: PageOptions;
  onPage: (patch: Partial<PageOptions>) => void;
  allowOrientation?: boolean;
  meta: DocumentMeta;
  metaDefaults: FlowDoc['meta'];
  onMeta: (patch: Partial<DocumentMeta>) => void;
  hasPhoto: boolean;
  laid: LaidDocument;
  getFlow: () => FlowDoc;
  getJson?: () => unknown;
  formats: ExportFormat[];
  pageLimit?: number;
  onFix?: () => void;
  extra?: ReactNode;
}

const FORMAT_INFO: Record<ExportFormat, { label: string; icon: ReactNode; ext: string; note: string }> = {
  pdf: { label: 'PDF', icon: <FileText className="size-4" />, ext: 'pdf', note: 'Vector text, clickable links, embedded images.' },
  docx: { label: 'Word (DOCX)', icon: <FileType2 className="size-4" />, ext: 'docx', note: 'Editable text, real headings and lists.' },
  txt: { label: 'Plain text', icon: <FileText className="size-4" />, ext: 'txt', note: 'What a parser is likely to read.' },
  json: { label: 'JSON', icon: <FileJson className="size-4" />, ext: 'json', note: 'Structured data backup.' },
};

export function ExportDialog(p: ExportDialogProps) {
  const [quality, setQuality] = useState<PdfExportSettings['quality']>('high');
  const [links, setLinks] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const [photo, setPhoto] = useState(true);
  const [showMeta, setShowMeta] = useState(false);
  const enqueue = useExportQueue((s) => s.enqueue);
  const check = printCheck(p.laid, { ...(p.pageLimit ? { pageLimit: p.pageLimit } : {}) });
  const nameFor = (f: ExportFormat) => documentFileName(p.personName, p.label, FORMAT_INFO[f].ext, p.fileName);

  const withMeta = (flow: FlowDoc): FlowDoc => ({
    ...flow,
    meta: {
      ...flow.meta,
      author: p.meta.author.trim() || p.metaDefaults.author,
      title: p.meta.title.trim() || p.metaDefaults.title,
      subject: p.meta.subject.trim() || p.metaDefaults.subject,
      keywords: p.meta.keywords.length ? p.meta.keywords : p.metaDefaults.keywords,
      creator: p.meta.creator.trim() || p.metaDefaults.creator,
    },
  });

  const run = (f: ExportFormat) => {
    const flow = withMeta(p.getFlow());
    const settings: PdfExportSettings = { quality, links, metadata, includeImages: photo || !p.hasPhoto };
    void enqueue(FORMAT_INFO[f].label, nameFor(f), async (progress) => {
      if (f === 'pdf') return flowToPdf(flow, settings, progress);
      if (f === 'docx') return flowToDocx(flow, settings, progress);
      if (f === 'txt') return flowToText(flow);
      return jsonFile(p.getJson?.() ?? flow);
    });
  };

  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      title={p.title}
      description="Generated entirely on this device. Files work offline and never depend on this app."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={p.onClose}>
            Close
          </Button>
          {p.formats.length > 1 && (
            <Button icon={<Download className="size-4" />} onClick={() => p.formats.forEach(run)}>
              Export all
            </Button>
          )}
          <Button variant="primary" icon={<Download className="size-4" />} onClick={() => run(p.formats[0]!)}>
            Export {FORMAT_INFO[p.formats[0]!].label}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <section className="space-y-3">
            <SectionLabel>Page</SectionLabel>
            <Segmented label="Paper" value={p.page.paper} onChange={(v) => p.onPage({ paper: v })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }]} />
            {p.allowOrientation && p.page.orientation && (
              <Segmented label="Orientation" value={p.page.orientation} onChange={(v) => p.onPage({ orientation: v })} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
            )}
            <Segmented label="Margins" value={p.page.margins} onChange={(v) => p.onPage({ margins: v })} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Wide' }]} />
            <Segmented label="Quality" value={quality} onChange={setQuality} options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }]} />
          </section>
          <section className="space-y-2.5">
            <SectionLabel>Include</SectionLabel>
            <Switch label="Page numbers" checked={p.page.pageNumbers} onChange={(v) => p.onPage({ pageNumbers: v })} />
            <Switch label="Clickable links" checked={links} onChange={setLinks} />
            {p.hasPhoto && <Switch label="Profile image" checked={photo} onChange={setPhoto} />}
            <Switch label="Document metadata" help="Author, title, subject and keywords embedded in PDF and DOCX." checked={metadata} onChange={setMetadata} />
          </section>
          <section className="space-y-2.5">
            <SectionLabel
              action={
                <button type="button" className="text-[11.5px] text-accent hover:underline" onClick={() => setShowMeta((v) => !v)}>
                  {showMeta ? 'Hide' : 'Edit'}
                </button>
              }
            >
              Metadata
            </SectionLabel>
            {showMeta ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TextInput label="Author" placeholder={p.metaDefaults.author} value={p.meta.author} onChange={(e) => p.onMeta({ author: e.target.value })} />
                <TextInput label="Title" placeholder={p.metaDefaults.title} value={p.meta.title} onChange={(e) => p.onMeta({ title: e.target.value })} />
                <TextInput label="Subject" placeholder={p.metaDefaults.subject} value={p.meta.subject} onChange={(e) => p.onMeta({ subject: e.target.value })} />
                <TextInput label="Creator" placeholder={p.metaDefaults.creator} value={p.meta.creator} onChange={(e) => p.onMeta({ creator: e.target.value })} />
                <TextInput
                  className="sm:col-span-2"
                  label="Keywords"
                  help="Comma separated."
                  placeholder={p.metaDefaults.keywords.slice(0, 6).join(', ')}
                  value={p.meta.keywords.join(', ')}
                  onChange={(e) => p.onMeta({ keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                />
              </div>
            ) : (
              <p className="text-[12px] leading-relaxed text-fg-muted">
                {p.meta.title || p.metaDefaults.title} · {p.meta.author || p.metaDefaults.author}
              </p>
            )}
          </section>
          <section className="space-y-2.5">
            <SectionLabel>File name</SectionLabel>
            <TextInput aria-label="File name" placeholder={sanitizeFileName(`${p.personName} ${p.label}`)} value={p.fileName} onChange={(e) => p.onFileName(e.target.value)} help="Leave empty for an automatic name. Unsafe characters are removed." />
            <ul className="grid gap-1.5">
              {p.formats.map((f) => (
                <li key={f} className="flex items-center gap-2.5 rounded-lg border border-line bg-bg px-2.5 py-2">
                  <span className="text-fg-subtle">{FORMAT_INFO[f].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px]">{nameFor(f)}</p>
                    <p className="text-[11px] text-fg-subtle">{FORMAT_INFO[f].note}</p>
                  </div>
                  <Button size="xs" onClick={() => run(f)}>
                    {FORMAT_INFO[f].label}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="space-y-3">
          <div className="rounded-xl border border-line bg-bg p-3.5">
            <SectionLabel>Document check</SectionLabel>
            <ul className="mt-2.5 space-y-2">
              {check.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  {it.level === 'ok' ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-ok" /> : it.level === 'warn' ? <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" /> : <XCircle className="mt-px size-3.5 shrink-0 text-danger" />}
                  <div>
                    <p className={cn(it.level === 'ok' ? 'text-fg-muted' : 'text-fg')}>{it.label}</p>
                    {it.detail && <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{it.detail}</p>}
                    {it.fixable && p.onFix && (
                      <button type="button" onClick={p.onFix} className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline">
                        <Sparkles className="size-3" /> Fix automatically
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className={cn('mt-3 border-t border-line pt-2.5 text-[12px] font-semibold', check.ready ? 'text-ok' : 'text-warn')}>{check.ready ? '✓ Ready for export' : 'Review the issues above'}</p>
          </div>
          {p.extra}
        </aside>
      </div>
    </Dialog>
  );
}
