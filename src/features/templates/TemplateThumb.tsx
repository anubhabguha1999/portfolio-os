import { useEffect, useRef, useState } from 'react';
import type { PortfolioTemplate } from '@/templates/types';
import { renderPortfolio } from '@/lib/engine/render';
import { cn } from '@/utils/cn';

/** Rendered template HTML, computed once per template per session. */
const htmlCache = new Map<string, string>();

export function templateHtml(template: PortfolioTemplate): string {
  let html = htmlCache.get(template.id);
  if (!html) {
    // Thumbnails are static (sandbox=""): drop the runtime script, keep JSON data blocks.
    html = renderPortfolio(template.create(), { mode: 'export' }).html.replace(/<script>[\s\S]*?<\/script>/g, '');
    htmlCache.set(template.id, html);
  }
  return html;
}

export interface TemplateThumbProps {
  template: PortfolioTemplate;
  /** Virtual viewport the page is laid out at before being scaled down. */
  viewport?: { width: number; height: number };
  className?: string;
  /** Render immediately instead of waiting until scrolled into view. */
  eager?: boolean;
}

/**
 * A live, non-interactive miniature of a template. The real exported document is
 * rendered into a fully sandboxed iframe (no scripts, no navigation) and scaled
 * with a CSS transform, so what you see is exactly what the export produces.
 */
export function TemplateThumb({ template, viewport = { width: 1280, height: 800 }, className, eager = false }: TemplateThumbProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [scale, setScale] = useState(0.25);
  const [loaded, setLoaded] = useState(false);
  const [html, setHtml] = useState<string | null>(() => (eager ? templateHtml(template) : (htmlCache.get(template.id) ?? null)));

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / viewport.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewport.width]);

  useEffect(() => {
    if (visible) return;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || html) return;
    // Defer rendering to an idle-ish moment so scrolling stays smooth.
    const id = window.setTimeout(() => setHtml(templateHtml(template)), 16);
    return () => window.clearTimeout(id);
  }, [visible, html, template]);

  return (
    <div
      ref={boxRef}
      className={cn('relative w-full overflow-hidden bg-canvas', className)}
      style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}
    >
      {html && (
        <iframe
          title={`${template.name} template preview`}
          sandbox=""
          srcDoc={html}
          tabIndex={-1}
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn('pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }}
        />
      )}
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-elevated to-canvas" aria-hidden="true" />}
    </div>
  );
}

/**
 * A larger, scrollable preview: the page is laid out at `viewportWidth` and scaled
 * to fit the container width, while the iframe keeps its own scrollbar.
 */
export function TemplateLivePreview({ template, viewportWidth = 1280, className }: { template: PortfolioTemplate; viewportWidth?: number; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [html, setHtml] = useState<string | null>(() => htmlCache.get(template.id) ?? null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setHtml(templateHtml(template)), 0);
    return () => window.clearTimeout(id);
  }, [template]);

  const scale = size.w ? Math.min(1, size.w / viewportWidth) : 0;
  const frameWidth = Math.min(viewportWidth, size.w / (scale || 1));
  return (
    <div ref={boxRef} className={cn('relative overflow-hidden bg-canvas', className)}>
      {html && scale > 0 && (
        <iframe
          key={`${template.id}-${viewportWidth}`}
          title={`${template.name} template, full preview`}
          sandbox=""
          srcDoc={html}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-1/2 top-0 origin-top border-0 bg-white"
          style={{ width: frameWidth, height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      )}
    </div>
  );
}
