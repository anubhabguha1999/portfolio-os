/**
 * Everything on the landing page that needs the portfolio template registry and renderer.
 * It is its own chunk, loaded only when these pieces get near the viewport.
 */
import { Link } from 'react-router-dom';
import { TEMPLATES } from '@/templates';
import { THEMES } from '@/lib/theme/themes';
import { TemplateThumb } from '@/features/templates/TemplateThumb';
import { StaggerItem } from './motion';

/** Live miniature of the n-th template. */
export function TemplateThumbAt({ index }: { index: number }) {
  const t = TEMPLATES[index] ?? TEMPLATES[0];
  return t ? <TemplateThumb template={t} /> : null;
}

/** The template reel's cards (rendered inside the reel's list). */
export function TemplateCards() {
  return (
    <>
      {TEMPLATES.map((t) => (
        <StaggerItem key={t.id} className="w-[min(78vw,340px)] shrink-0 snap-start">
          <Link to={`/templates?t=${t.id}`} className="group block rounded-2xl border border-line bg-panel p-2 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1.5 hover:border-line-strong">
            <div className="overflow-hidden rounded-xl">
              <TemplateThumb template={t} className="transition-transform duration-700 group-hover:scale-[1.03]" />
            </div>
            <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
              <span className="text-[14px] font-medium">{t.name}</span>
              <span className="truncate text-[12px] text-fg-subtle">{t.audience}</span>
            </div>
          </Link>
        </StaggerItem>
      ))}
    </>
  );
}

/** Three-colour swatch per theme (background, primary, accent). */
export function ThemeSwatches() {
  return (
    <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
      {THEMES.map((t) => {
        const p = t.palettes[t.defaultScheme];
        return (
          <span key={t.id} className="flex h-8 overflow-hidden rounded-lg border border-line" title={t.name}>
            <span className="w-4 sm:w-5" style={{ background: p.background }} />
            <span className="w-4 sm:w-5" style={{ background: p.primary }} />
            <span className="w-4 sm:w-5" style={{ background: p.accent }} />
          </span>
        );
      })}
    </div>
  );
}
