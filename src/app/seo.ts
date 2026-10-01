/**
 * Per-route head tags (title, description, canonical, robots, Open Graph, Twitter).
 * The same table drives the build-time prerender (scripts/prerender.mjs), so what a
 * crawler sees in the static HTML matches what the app sets after it loads.
 */
import config from '@/config/seo-routes.json';

export interface RouteSeo {
  path: string;
  title: string;
  description: string;
  index: boolean;
  prefix?: boolean;
  /** The page sets its own title (document or resume name), so only meta tags are managed. */
  dynamic?: boolean;
}

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || config.siteUrl).replace(/\/$/, '');
const ROUTES = config.routes as RouteSeo[];
const HOME = ROUTES[0]!;

export function seoFor(pathname: string): RouteSeo {
  const p = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((r) => (r.prefix ? p.startsWith(r.path) : r.path === p)) ?? { ...HOME, index: false };
}

function meta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function link(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function applySeo(pathname: string): void {
  if (typeof document === 'undefined') return;
  const r = seoFor(pathname);
  const url = `${SITE_URL}${r.prefix ? '/' : r.path === '/' ? '/' : r.path}`;
  if (!r.dynamic) document.title = r.title;
  meta('name', 'description', r.description);
  meta('name', 'robots', r.index ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, nofollow');
  // Private pages are noindex; a canonical there would send a conflicting signal.
  if (r.index) link('canonical', url);
  else document.head.querySelector('link[rel="canonical"]')?.remove();
  meta('property', 'og:title', r.title);
  meta('property', 'og:description', r.description);
  meta('property', 'og:url', r.index ? url : `${SITE_URL}/`);
  meta('name', 'twitter:title', r.title);
  meta('name', 'twitter:description', r.description);
}
