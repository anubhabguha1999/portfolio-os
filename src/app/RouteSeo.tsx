import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo } from './seo';

/**
 * Updates head tags on every navigation. A layout effect runs before the pages' own
 * effects, so pages with a dynamic title (a resume or document name) still win.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  useLayoutEffect(() => applySeo(pathname), [pathname]);
  return null;
}
