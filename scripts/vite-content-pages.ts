/**
 * Dev server only: serves the static content pages (resume examples, portfolio examples,
 * guides) that prerender.mjs writes at build time. Without this, `vite dev` hands those URLs to
 * the React app, whose catch-all route sends them back to "/".
 *
 * Pages are regenerated on each request into node_modules/.cache, so edits to
 * scripts/seo-content/*.mjs show up on reload.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

export function contentPagesDev(root: string): Plugin {
  const out = join(root, 'node_modules/.cache/content-pages');
  return {
    name: 'portfolio-os:content-pages-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const path = decodeURIComponent((req.url ?? '').split('?')[0]!).replace(/\/(index\.html)?$/, '') || '/';
        try {
          // Fresh import each time so content edits apply without restarting the server.
          const mod = (await import(`${pathToFileURL(join(root, 'scripts/content-pages.mjs')).href}?t=${Date.now()}`)) as {
            CONTENT_PREFIXES: string[];
            buildContentPages: (o: { SITE: string; cfg: unknown; dist: string; today: string }) => unknown;
          };
          if (!mod.CONTENT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return next();
          const cfg = JSON.parse(readFileSync(join(root, 'src/config/seo-routes.json'), 'utf8')) as { siteUrl: string };
          mod.buildContentPages({ SITE: cfg.siteUrl.replace(/\/$/, ''), cfg, dist: out, today: new Date().toISOString().slice(0, 10) });
          const file = join(out, path.slice(1), 'index.html');
          if (!existsSync(file)) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readFileSync(file));
        } catch (err) {
          next(err as Error);
        }
      });
    },
  };
}
