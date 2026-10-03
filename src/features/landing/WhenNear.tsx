import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders `children` (usually a lazy component) only once the spot is near the viewport, so
 * below-the-fold code (layout engine, template renderer) stays off the first screen's
 * critical path. The fallback must have the final size so nothing shifts when it swaps.
 */
export function WhenNear({ children, fallback, margin = '800px' }: { children: ReactNode; fallback: ReactNode; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return void setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: `${margin} 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return <div ref={ref}>{near ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}</div>;
}
