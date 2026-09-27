import { useCallback } from 'react';
import { Lock, MousePointerClick, Unlock } from 'lucide-react';
import { useEditor, selectSelected } from '@/stores/editor';
import { useUI, type InspectorTab } from '@/stores/ui';
import { getDefinition } from '@/sections/registry';
import { FieldRenderer } from './fields/FieldRenderer';
import { SectionStylePanel } from './panels/SectionStylePanel';
import { ThemePanel } from './panels/ThemePanel';
import { SeoPanel } from './panels/SeoPanel';
import { SiteSettingsPanel } from './panels/SiteSettingsPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EmptyState } from '@/components/ui/misc';
import { SectionIcon } from './SectionIcon';
import { cn } from '@/utils/cn';
import type { PathKey } from '@/utils/path';

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'content', label: 'Content' },
  { id: 'style', label: 'Style' },
  { id: 'theme', label: 'Theme' },
  { id: 'seo', label: 'SEO' },
  { id: 'settings', label: 'Site' },
];

export function Inspector() {
  const tab = useUI((s) => s.inspectorTab);
  const setTab = useUI((s) => s.setInspectorTab);
  const section = useEditor(selectSelected);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Inspector" className="flex shrink-0 gap-0.5 border-b border-line px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`insp-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`insp-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length]!.id);
              if (e.key === 'ArrowLeft') setTab(TABS[(i - 1 + TABS.length) % TABS.length]!.id);
            }}
            className={cn('relative -mb-px rounded-t-lg px-2.5 pb-2 pt-1.5 text-[12.5px] font-medium transition-colors', tab === t.id ? 'text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-fg-subtle hover:text-fg-muted')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`insp-panel-${tab}`} role="tabpanel" aria-labelledby={`insp-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ErrorBoundary area="Inspector" compact resetKeys={[tab, section?.id]}>
          {tab === 'content' || tab === 'style' ? (
            section ? (
              tab === 'content' ? <ContentPanel key={section.id} /> : <SectionStylePanel key={section.id} section={section} />
            ) : (
              <EmptyState icon={<MousePointerClick className="size-5" />} title="Select a section" description="Click a section in the canvas or the layers list to edit its content and style." />
            )
          ) : tab === 'theme' ? (
            <ThemePanel />
          ) : tab === 'seo' ? (
            <SeoPanel />
          ) : (
            <SiteSettingsPanel />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ContentPanel() {
  const section = useEditor(selectSelected)!;
  const update = useEditor((s) => s.updateSectionData);
  const toggleLocked = useEditor((s) => s.toggleLocked);
  const def = getDefinition(section.type);
  const onChange = useCallback((path: PathKey[], value: unknown) => update(section.id, path, value), [section.id, update]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-elevated text-accent">
          <SectionIcon name={def.icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{section.name}</p>
          <p className="text-[11.5px] leading-snug text-fg-subtle">{def.description}</p>
        </div>
      </div>
      {section.locked && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-[12px] text-warn">
          <Lock className="size-3.5" />
          <span className="flex-1">This section is locked.</span>
          <button className="inline-flex items-center gap-1 font-semibold hover:underline" onClick={() => toggleLocked(section.id)}>
            <Unlock className="size-3" /> Unlock
          </button>
        </div>
      )}
      <FieldRenderer fields={def.fields} value={section.data as unknown as Record<string, unknown>} basePath={[]} onChange={onChange} disabled={section.locked} />
    </div>
  );
}
