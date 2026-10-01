import { useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Eye, FileJson, LayoutTemplate, SquarePen } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { ImportDialog } from '@/features/importers/ImportDialog';
import { TEMPLATES } from '@/templates';
import type { PortfolioTemplate } from '@/templates/types';
import { TemplateThumb } from '@/features/templates/TemplateThumb';
import { TemplateDetail, useUseTemplate } from '@/features/templates/TemplateDetail';
import { BRAND } from '@/config/brand';
import { toast } from '@/stores/ui';
import { createBlankProject } from './actions';
import { cn } from '@/utils/cn';

type Choice = 'scratch' | 'template' | 'import';

const CHOICES: Array<{ id: Choice; title: string; body: string; icon: typeof SquarePen; hint: string }> = [
  { id: 'scratch', title: 'Start from scratch', body: 'A clean starter with the essential sections — hero, about, experience, projects, skills and contact.', icon: SquarePen, hint: 'Opens the builder' },
  { id: 'template', title: 'Use a template', body: `Choose one of ${TEMPLATES.length} designed portfolios with realistic sample content, then make it yours.`, icon: LayoutTemplate, hint: 'Pick below' },
  { id: 'import', title: 'Import JSON', body: `Restore a ${BRAND.fileExtension} backup or any portfolio JSON exported from ${BRAND.name}.`, icon: FileJson, hint: 'From a file' },
];

export default function NewProjectPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;
  const [mode, setMode] = useState<Choice | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [picked, setPicked] = useState<PortfolioTemplate>(TEMPLATES[0]!);
  const [previewing, setPreviewing] = useState<PortfolioTemplate | null>(null);
  const { busy, use } = useUseTemplate();
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  const choose = async (c: Choice) => {
    setMode(c);
    if (c === 'scratch') {
      setCreating(true);
      try {
        const id = await createBlankProject();
        navigate(`/builder/${id}`);
      } catch (err) {
        toast({ title: 'Could not create the project', description: err instanceof Error ? err.message : 'Browser storage is unavailable.', tone: 'error' });
        setCreating(false);
      }
    } else if (c === 'import') {
      setImportOpen(true);
    } else {
      window.requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
    }
  };

  const onCardKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    cardRefs.current[(i + delta + CHOICES.length) % CHOICES.length]?.focus();
  };

  return (
    <div className="min-h-full bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="relative mx-auto max-w-6xl px-4 pb-32 pt-12 sm:px-6 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,var(--app-accent-soft),transparent)]" />
        <header className="relative text-center">
          <h1 className="text-[clamp(2.1rem,5.4vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            Create your <span className="font-display font-normal italic">portfolio</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">Three ways to begin. Whatever you pick, everything stays in this browser — and you can change your mind later.</p>
        </header>

        <div role="group" aria-label="How do you want to start?" className="relative mt-12 grid gap-4 md:grid-cols-3">
          {CHOICES.map((c, i) => {
            const active = mode === c.id;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                type="button"
                aria-pressed={c.id === 'template' ? active : undefined}
                aria-busy={c.id === 'scratch' && creating ? true : undefined}
                disabled={creating}
                onClick={() => void choose(c.id)}
                onKeyDown={(e) => onCardKey(e, i)}
                className={cn(
                  'group relative flex min-h-[220px] flex-col rounded-2xl border bg-panel p-6 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong focus-visible:-translate-y-0.5',
                  active ? 'border-accent shadow-[0_0_0_1px_var(--app-accent),0_20px_50px_-24px_var(--app-accent)]' : 'border-line',
                )}
              >
                <span className={cn('grid size-11 place-items-center rounded-xl border transition-colors', active ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-elevated text-fg-muted group-hover:text-fg')}>
                  <c.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="mt-6 text-[18px] font-semibold tracking-tight">{c.title}</span>
                <span className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">{c.body}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-5 text-[12px] font-medium text-fg-subtle group-hover:text-fg">
                  {c.id === 'scratch' && creating ? 'Creating…' : c.hint}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {mode === 'template' && (
            <motion.section
              ref={pickerRef}
              aria-labelledby="picker-title"
              className="mt-16 scroll-mt-20"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="picker-title" className="text-[22px] font-semibold tracking-tight">
                    Choose a template
                  </h2>
                  <p className="mt-1 text-[13px] text-fg-muted">Live previews of the real exported page. Select one, then create.</p>
                </div>
              </div>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Templates">
                {TEMPLATES.map((t) => {
                  const on = picked.id === t.id;
                  return (
                    <li key={t.id} className={cn('relative overflow-hidden rounded-2xl border bg-panel transition-colors', on ? 'border-accent shadow-[0_0_0_1px_var(--app-accent)]' : 'border-line hover:border-line-strong')}>
                      <button type="button" aria-pressed={on} onClick={() => setPicked(t)} onDoubleClick={() => void use(t)} className="block w-full text-left">
                        <TemplateThumb template={t} />
                        <span className="flex items-center justify-between gap-2 p-3.5 pr-12">
                          <span className="min-w-0">
                            <span className="block text-[14px] font-medium">{t.name}</span>
                            <span className="block truncate text-[12px] text-fg-subtle">{t.audience}</span>
                          </span>
                          {on && (
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
                              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewing(t)}
                        className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg"
                        aria-label={`Preview ${t.name} template`}
                        title="Preview"
                      >
                        <Eye className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="sticky bottom-4 z-10 mt-8 flex justify-center">
                <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-elevated/90 p-2 pl-4 shadow-float backdrop-blur-xl">
                  <span className="min-w-0 truncate text-[13px] text-fg-muted">
                    Selected: <span className="font-medium text-fg">{picked.name}</span>
                  </span>
                  <Button variant="primary" loading={busy === picked.id} onClick={() => void use(picked)} iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
                    Create portfolio
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <ImportDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setMode(null);
        }}
        initialTab="json"
      />
      {previewing && (
        <TemplateDetail
          template={previewing}
          busy={busy === previewing.id}
          onUse={() => void use(previewing)}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
