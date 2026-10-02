/**
 * The site's base path: "/" on Vercel and the custom domain, "/portfolio-os/" on GitHub Pages
 * (set at build time with BASE_PATH). Use for URLs the router does not handle: runtime asset
 * folders, links to the static content pages, share links.
 */
export const BASE_URL: string = import.meta.env.BASE_URL || '/';

/** "/pdfjs/cmaps/" → "/portfolio-os/pdfjs/cmaps/" under a sub-path; unchanged at the root. */
export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${BASE_URL.replace(/\/$/, '')}${path}`;
}

/** Router basename: undefined at the root. */
export const ROUTER_BASENAME: string | undefined = BASE_URL === '/' ? undefined : BASE_URL.replace(/\/$/, '');
