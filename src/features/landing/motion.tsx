import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Landing-page motion primitives. These only attach class names: the motion itself is
 * CSS scroll-driven animation (`animation-timeline: view()`, see index.css), which runs
 * on the compositor with no scroll listeners or per-frame JS. Browsers without support,
 * or with reduced motion, render the static page.
 */

/** Fades and lifts its content as it scrolls into view. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('scene-reveal', className)}>{children}</div>;
}

/** A list whose direct children cascade in as it scrolls into view. */
export function Stagger({ children, className, as: Tag = 'ul' }: { children: ReactNode; className?: string; as?: 'ul' | 'ol' | 'div' }) {
  return <Tag className={cn('scene-stagger', className)}>{children}</Tag>;
}

export function StaggerItem({ children, className, as: Tag = 'li' }: { children: ReactNode; className?: string; as?: 'li' | 'div' }) {
  return <Tag className={className}>{children}</Tag>;
}

/** Thin accent bar pinned to the top of the viewport, tracking page scroll. */
export function ScrollProgress() {
  return <div aria-hidden="true" className="scene-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[linear-gradient(90deg,var(--app-accent),#e9a6ff,var(--app-ok))]" />;
}
