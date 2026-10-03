import { useMemo, useState } from 'react';
import { Check, Eye, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/misc';
import type { ResumeDoc, ResumeStyle } from '@/studio/model/types';
import { RESUME_TEMPLATES } from '@/studio/templates/resume';
import type { ResumeTemplateDef } from '@/studio/templates/types';
import { useWorkspace } from '@/studio/store/workspace';
import { useImageUrls } from '@/studio/images/service';
import { ResumeThumb } from './ResumeThumb';
import { layoutResume } from './useResumeLayout';
import { PrintPreviewDialog } from '../shared/PrintPreviewDialog';
import { cn } from '@/utils/cn';

/** Switching templates changes presentation only: content, photo choice and page settings are kept. */
export function applyTemplateStyle(style: ResumeStyle, t: ResumeTemplateDef): ResumeStyle {
  const d = { ...t.defaults };
  delete d.photo;
  return { ...style, ...d, paper: style.paper, pageLimit: style.pageLimit, atsSafe: style.atsSafe, photo: style.photo, fit: null };
}

export function previewResume(resume: ResumeDoc, t: ResumeTemplateDef): ResumeDoc {
  return { ...resume, templateId: t.id, style: applyTemplateStyle(resume.style, t) };
}

const FILTERS = ['All', 'ATS', 'Two column', 'Serif', 'Photo', 'Technical'] as const;

function PreviewOf({ resume, onClose, onUse }: { resume: ResumeDoc; onClose: () => void; onUse: () => void }) {
  const library = useWorkspace((s) => s.library);
  const profile = useWorkspace((s) => s.profile);
  const layout = useMemo(() => layoutResume(resume, library, profile), [resume, library, profile]);
  const imageUrl = useImageUrls(layout.imageKeys);
  return (
    <PrintPreviewDialog
      laid={layout.laid}
      imageUrl={imageUrl}
      onClose={onClose}
      title={`${layout.template.name} — preview with your content`}
      actions={
        <Button variant="primary" size="sm" onClick={onUse}>
          Use template
        </Button>
      }
    />
  );
}

export function TemplateBrowser({ open, onClose, resume, onUse }: { open: boolean; onClose: () => void; resume: ResumeDoc; onUse: (t: ResumeTemplateDef) => void }) {
  const library = useWorkspace((s) => s.library);
  const profile = useWorkspace((s) => s.profile);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [previewing, setPreviewing] = useState<ResumeTemplateDef | null>(null);
  const list = RESUME_TEMPLATES.filter((t) => {
    if (filter === 'All') return true;
    if (filter === 'ATS') return t.ats === 'high';
    if (filter === 'Two column') return t.columns === 2;
    if (filter === 'Serif') return t.tags.includes('Serif');
    if (filter === 'Photo') return t.supportsPhoto;
    return t.tags.some((x) => x === 'Technical' || x === 'Engineering' || x === 'Monospace');
  });
  return (
    <>
      <Dialog open={open && !previewing} onClose={onClose} title="Resume templates" description="Every template uses the same content. Switching never changes or deletes what you wrote." size="xl">
        <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter templates">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1 text-[12px]', filter === f ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg')}>
              {f}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
          {list.map((t) => {
            const active = t.id === resume.templateId;
            return (
              <li key={t.id} className={cn('group rounded-2xl border p-3 transition', active ? 'border-accent bg-accent-soft/40' : 'border-line bg-bg hover:border-line-strong')}>
                <div className="relative grid place-items-center rounded-xl bg-canvas p-3">
                  {open && <ResumeThumb resume={previewResume(resume, t)} library={library} profile={profile} width={170} />}
                  {active && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-accent-fg">
                      <Check className="size-3" /> Current
                    </span>
                  )}
                  {t.isNew && <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">New</span>}
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-semibold">{t.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-fg-subtle">{t.description}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.ats === 'high' && (
                    <Badge tone="ok">
                      <ShieldCheck className="size-3" /> ATS friendly
                    </Badge>
                  )}
                  {t.columns === 2 && <Badge>Two column</Badge>}
                  {t.supportsPhoto && <Badge>Photo optional</Badge>}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" variant={active ? 'secondary' : 'primary'} className="flex-1" disabled={active} onClick={() => onUse(t)}>
                    {active ? 'In use' : 'Use Template'}
                  </Button>
                  <Button size="sm" icon={<Eye className="size-3.5" />} onClick={() => setPreviewing(t)}>
                    Preview
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Dialog>
      {previewing && (
        <PreviewOf
          resume={previewResume(resume, previewing)}
          onClose={() => setPreviewing(null)}
          onUse={() => {
            onUse(previewing);
            setPreviewing(null);
          }}
        />
      )}
    </>
  );
}
