import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reset scroll on every route (pathname) change. Query-only changes such as
 * `?format=pdf` or `?t=template` keep the current position.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // App pages with their own scroll containers opt in via data-scroll-reset.
    document.querySelectorAll<HTMLElement>('[data-scroll-reset]').forEach((el) => el.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  }, [pathname]);
  return null;
}
