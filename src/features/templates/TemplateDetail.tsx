import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Monitor, Smartphone } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Field';
import type { PortfolioTemplate } from '@/templates/types';
import { getTheme } from '@/lib/theme/themes';
import { getDefinition } from '@/sections/registry';
import { toast } from '@/stores/ui';
import { createProjectFromTemplate } from '@/features/projects/actions';
import { TemplateLivePreview } from './TemplateThumb';

/** Starts a project from a template and opens it in the builder. */
export function useUseTemplate(): { busy: string | null; use: (t: PortfolioTemplate) => Promise<void> } {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const use = async (t: PortfolioTemplate) => {
    setBusy(t.id);
    try {
      const id = await createProjectFromTemplate(t);
      navigate(`/builder/${id}`);
    } catch (err) {
      toast({ title: 'Could not create the project', description: err instanceof Error ? err.message : 'Browser storage is unavailable.', tone: 'error' });
      setBusy(null);
    }
  };
  return { busy, use };
}

export function ThemeDots({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId);
  const p = theme.palettes[theme.defaultScheme];
  return (
    <span className="flex shrink-0 -space-x-1" title={`${theme.name} theme`} aria-label={`${theme.name} theme`}>
      {[p.background, p.primary, p.accent].map((c, i) => (
        <span key={i} className="size-3.5 rounded-full border border-line-strong" style={{ background: c }} />
      ))}
    </span>
  );
}

export function TemplateDetail({ template, busy, onUse, onClose }: { template: PortfolioTemplate; busy: boolean; onUse: () => void; onClose: () => void }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const sections = useMemo(
    () =>
      template
        .create()
        .sections.filter((s) => s.enabled)
        .map((s) => ({ id: s.id, label: getDefinition(s.type).label })),
    [template],
  );
  const theme = getTheme(template.themeId);
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={template.name}
      description={template.audience}
      bodyClassName="p-0"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" loading={busy} onClick={onUse} iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
            Use this template
          </Button>
        </>
      }
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="border-b border-line bg-canvas p-3 md:border-b-0 md:border-r">
          <div className="mb-3 flex justify-center">
            <Segmented
              value={device}
              onChange={setDevice}
              label="Preview size"
              options={[
                { value: 'desktop', label: <Monitor className="size-3.5" aria-label="Desktop" />, title: 'Desktop' },
                { value: 'mobile', label: <Smartphone className="size-3.5" aria-label="Mobile" />, title: 'Mobile' },
              ]}
            />
          </div>
          <TemplateLivePreview template={template} viewportWidth={device === 'desktop' ? 1280 : 390} className="h-[min(62vh,620px)] rounded-xl border border-line" />
        </div>
        <aside className="space-y-5 p-5">
          <p className="text-[13px] leading-relaxed text-fg-muted">{template.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <div>
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Theme</h3>
            <p className="mt-1.5 flex items-center gap-2 text-[13px]">
              <ThemeDots themeId={template.themeId} />
              {theme.name}
            </p>
          </div>
          <div>
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Sections, in order</h3>
            <ol className="mt-2 space-y-1 text-[13px] text-fg-muted">
              {sections.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-5 font-mono text-[11px] leading-5 text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                  {s.label}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
