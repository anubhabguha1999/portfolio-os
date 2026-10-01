import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileArchive, Package } from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select, Switch, TextInput } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import { listProjects, getProject, type ProjectSummary } from '@/lib/storage/projects';
import { exportHtml } from '@/lib/export';
import { getDocument, getResume, listDocuments, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { composeStudioDocument } from '@/studio/model/compose-document';
import { documentFileName, flowToDocx, flowToPdf, sanitizeFileName, zipFiles, DEFAULT_PDF_SETTINGS, type Progress } from '@/studio/export/pipeline';
import { useExportQueue } from '@/studio/export/queue';
import { composeResume } from '../resume/useResumeLayout';

interface PackOptions {
  resumeId: string;
  letterId: string;
  projectId: string;
  resumePdf: boolean;
  resumeDocx: boolean;
  letterPdf: boolean;
  letterDocx: boolean;
  portfolioHtml: boolean;
  name: string;
}

export async function buildApplicationPack(o: PackOptions, progress: Progress): Promise<{ blob: Blob; warnings: string[] }> {
  await ensureWorkspace();
  const { profile, library } = useWorkspace.getState();
  const person = o.name || profile.name;
  const files: Array<{ path: string; blob: Blob }> = [];
  const warnings: string[] = [];
  const steps = [o.resumeId && o.resumePdf, o.resumeId && o.resumeDocx, o.letterId && o.letterPdf, o.letterId && o.letterDocx, o.projectId && o.portfolioHtml].filter(Boolean).length || 1;
  let done = 0;
  const sub = (label: string): Progress => (stage, v) => progress(`${label}: ${stage}`, Math.min(0.9, (done + v) / steps) * 0.9);
  const step = () => {
    done++;
  };

  if (o.resumeId && (o.resumePdf || o.resumeDocx)) {
    const r = await getResume(o.resumeId);
    if (!r) throw new Error('The selected resume no longer exists.');
    const { flow } = composeResume(r, library, profile);
    const label = r.kind === 'cv' ? 'CV' : 'Resume';
    if (o.resumePdf) {
      const res = await flowToPdf(flow, DEFAULT_PDF_SETTINGS, sub(`${label}.pdf`));
      files.push({ path: documentFileName(person, label, 'pdf', r.fileName), blob: res.blob });
      warnings.push(...res.warnings);
      step();
    }
    if (o.resumeDocx) {
      const res = await flowToDocx(flow, { includeImages: true, quality: 'high' }, sub(`${label}.docx`));
      files.push({ path: documentFileName(person, label, 'docx', r.fileName), blob: res.blob });
      step();
    }
  }
  if (o.letterId && (o.letterPdf || o.letterDocx)) {
    const d = await getDocument(o.letterId);
    if (!d) throw new Error('The selected cover letter no longer exists.');
    const flow = composeStudioDocument(d, profile, library);
    if (o.letterPdf) {
      const res = await flowToPdf(flow, DEFAULT_PDF_SETTINGS, sub('Cover letter PDF'));
      files.push({ path: documentFileName(person, 'Cover_Letter', 'pdf', d.fileName), blob: res.blob });
      step();
    }
    if (o.letterDocx) {
      const res = await flowToDocx(flow, { includeImages: true, quality: 'high' }, sub('Cover letter DOCX'));
      files.push({ path: documentFileName(person, 'Cover_Letter', 'docx', d.fileName), blob: res.blob });
      step();
    }
  }
  if (o.projectId && o.portfolioHtml) {
    const rec = await getProject(o.projectId);
    if (!rec) throw new Error('The selected portfolio no longer exists.');
    progress('Portfolio.html: embedding images and fonts…', (done / steps) * 0.9);
    const res = await exportHtml(rec.portfolio, { fontDelivery: 'system', embedData: false });
    files.push({ path: documentFileName(person, 'Portfolio', 'html'), blob: res.blob });
    warnings.push(...res.warnings);
    step();
  }
  if (!files.length) throw new Error('Choose at least one document for the pack.');
  // Avoid duplicate names inside the archive.
  const seen = new Map<string, number>();
  for (const f of files) {
    const n = seen.get(f.path) ?? 0;
    seen.set(f.path, n + 1);
    if (n) f.path = f.path.replace(/(\.[a-z]+)$/i, `_${n + 1}$1`);
  }
  progress('Compressing application pack…', 0.93);
  const blob = await zipFiles(files, (s, v) => progress(s, 0.93 + v * 0.07));
  return { blob, warnings: [...new Set(warnings)] };
}

export function ApplicationPackDialog({ open, onClose, defaults = {} }: { open: boolean; onClose: () => void; defaults?: Partial<Pick<PackOptions, 'resumeId' | 'letterId' | 'projectId'>> }) {
  const profileName = useWorkspace((s) => s.profile.name);
  const enqueue = useExportQueue((s) => s.enqueue);
  const [resumes, setResumes] = useState<StudioSummary[]>([]);
  const [letters, setLetters] = useState<StudioSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [o, setO] = useState<PackOptions>({ resumeId: '', letterId: '', projectId: '', resumePdf: true, resumeDocx: true, letterPdf: true, letterDocx: true, portfolioHtml: true, name: '' });

  useEffect(() => {
    if (!open) return;
    void (async () => {
      await ensureWorkspace();
      const [r, d, p] = await Promise.all([listResumes(), listDocuments(), listProjects().catch(() => [])]);
      const ls = d.filter((x) => x.kind === 'cover-letter');
      setResumes(r);
      setLetters(ls);
      setProjects(p);
      setO((cur) => ({
        ...cur,
        resumeId: defaults.resumeId ?? (cur.resumeId || r[0]?.id || ''),
        letterId: defaults.letterId ?? (cur.letterId || ls[0]?.id || ''),
        projectId: defaults.projectId ?? (cur.projectId || p[0]?.id || ''),
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const person = o.name || profileName || 'My';
  const names = useMemo(() => {
    const out: string[] = [];
    if (o.resumeId && o.resumePdf) out.push(documentFileName(person, 'Resume', 'pdf'));
    if (o.resumeId && o.resumeDocx) out.push(documentFileName(person, 'Resume', 'docx'));
    if (o.letterId && o.letterPdf) out.push(documentFileName(person, 'Cover_Letter', 'pdf'));
    if (o.letterId && o.letterDocx) out.push(documentFileName(person, 'Cover_Letter', 'docx'));
    if (o.projectId && o.portfolioHtml) out.push(documentFileName(person, 'Portfolio', 'html'));
    return out;
  }, [o, person]);
  const zipName = `${sanitizeFileName(`${person} Application Pack`)}.zip`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export application pack"
      description="Resume, cover letter and portfolio in one ZIP — generated on this device, nothing uploaded."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Package className="size-4" />}
            disabled={!names.length}
            onClick={() => {
              void enqueue('Application pack', zipName, (progress) => buildApplicationPack({ ...o, name: person }, progress));
              onClose();
            }}
          >
            Build pack
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-5">
          <section className="space-y-2.5">
            <SectionLabel>Resume</SectionLabel>
            {resumes.length ? (
              <>
                <Select aria-label="Resume" value={o.resumeId} onChange={(e) => setO({ ...o, resumeId: e.target.value })} options={[{ value: '', label: 'No resume' }, ...resumes.map((r) => ({ value: r.id, label: r.name }))]} />
                <div className="flex gap-6">
                  <Switch label="PDF" checked={o.resumePdf} onChange={(v) => setO({ ...o, resumePdf: v })} />
                  <Switch label="DOCX" checked={o.resumeDocx} onChange={(v) => setO({ ...o, resumeDocx: v })} />
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-fg-muted">
                No resumes yet. <Link to="/resumes" className="text-accent hover:underline">Create one</Link>.
              </p>
            )}
          </section>
          <section className="space-y-2.5">
            <SectionLabel>Cover letter</SectionLabel>
            {letters.length ? (
              <>
                <Select aria-label="Cover letter" value={o.letterId} onChange={(e) => setO({ ...o, letterId: e.target.value })} options={[{ value: '', label: 'No cover letter' }, ...letters.map((r) => ({ value: r.id, label: r.name }))]} />
                <div className="flex gap-6">
                  <Switch label="PDF" checked={o.letterPdf} onChange={(v) => setO({ ...o, letterPdf: v })} />
                  <Switch label="DOCX" checked={o.letterDocx} onChange={(v) => setO({ ...o, letterDocx: v })} />
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-fg-muted">
                No cover letters yet. <Link to="/documents" className="text-accent hover:underline">Write one in Document Studio</Link>.
              </p>
            )}
          </section>
          <section className="space-y-2.5">
            <SectionLabel>Portfolio website</SectionLabel>
            {projects.length ? (
              <>
                <Select aria-label="Portfolio" value={o.projectId} onChange={(e) => setO({ ...o, projectId: e.target.value })} options={[{ value: '', label: 'No portfolio' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
                <Switch label="Standalone HTML" help="A single self-contained file that opens offline — no builder, server or storage needed." checked={o.portfolioHtml} onChange={(v) => setO({ ...o, portfolioHtml: v })} />
              </>
            ) : (
              <p className="text-[12.5px] text-fg-muted">
                No portfolios yet. <Link to="/new" className="text-accent hover:underline">Create one in Portfolio Studio</Link>.
              </p>
            )}
          </section>
          <TextInput label="Name used in file names" placeholder={profileName || 'Your name'} value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
        </div>
        <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-line bg-bg p-3.5">
          <p className="flex min-w-0 items-start gap-2 font-mono text-[12px] font-semibold">
            <FileArchive className="mt-px size-4 shrink-0 text-accent" />
            <Truncate style={{ display: 'block', minWidth: 0, maxWidth: '100%' }}>{zipName}</Truncate>
          </p>
          <ul className="mt-2 min-w-0 space-y-1 border-l border-line pl-3">
            {names.length ? (
              names.map((n) => (
                <li key={n} className="flex min-w-0 gap-1.5 font-mono text-[11.5px] leading-snug text-fg-muted">
                  <span aria-hidden className="shrink-0 text-fg-subtle">├</span>
                  <Truncate style={{ display: 'block', minWidth: 0, maxWidth: '100%' }}>{n}</Truncate>
                </li>
              ))
            ) : (
              <li className="text-[11.5px] text-fg-subtle">Nothing selected</li>
            )}
          </ul>
        </aside>
      </div>
    </Dialog>
  );
}
