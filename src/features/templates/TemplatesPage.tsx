import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { TEMPLATES, getTemplate, templateTags } from '@/templates';
import type { PortfolioTemplate } from '@/templates/types';
import { MarketingFooter } from '@/features/landing/MarketingFooter';
import { TemplateThumb } from './TemplateThumb';
import { TemplateDetail, ThemeDots, useUseTemplate } from './TemplateDetail';
import { cn } from '@/utils/cn';

export default function TemplatesPage() {
  const [params, setParams] = useSearchParams();
  const [tag, setTag] = useState<string>('All');
  const tags = useMemo(() => ['All', ...templateTags()], []);
  const selected = getTemplate(params.get('t') ?? '');
  const { busy, use } = useUseTemplate();

  const visible = tag === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.tags.includes(tag));

  const open = (t: PortfolioTemplate | null) => {
    const next = new URLSearchParams(params);
    if (t) next.set('t', t.id);
    else next.delete('t');
    setParams(next, { replace: !t });
  };

  return (
    <div className="min-h-full bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <header className="max-w-2xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">Templates</p>
          <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            Designed starting points, <span className="font-display font-normal italic">not cages.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
            Every template is a complete portfolio with realistic sample content. Pick one, then change anything — theme, layout, sections or words. These previews are the real exported pages.
          </p>
        </header>

        <div role="group" aria-label="Filter templates by tag" className="-mx-4 mt-10 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors',
                tag === t ? 'border-fg bg-fg text-bg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {visible.length} templates shown
        </p>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <li key={t.id}>
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-strong">
                <button type="button" onClick={() => open(t)} className="relative block text-left" aria-label={`Preview ${t.name} template`}>
                  <TemplateThumb template={t} className="transition-transform duration-700 group-hover:scale-[1.02]" />
                  <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </button>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[15px] font-semibold tracking-tight">{t.name}</h2>
                    <ThemeDots themeId={t.themeId} />
                  </div>
                  <p className="mt-1 text-[12px] text-fg-subtle">{t.audience}</p>
                  <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">{t.description}</p>
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Button size="sm" variant="primary" loading={busy === t.id} onClick={() => void use(t)}>
                      Use template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => open(t)}>
                      Preview
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <MarketingFooter />
      {selected && <TemplateDetail template={selected} busy={busy === selected.id} onUse={() => void use(selected)} onClose={() => open(null)} />}
    </div>
  );
}
