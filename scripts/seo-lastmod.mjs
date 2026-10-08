/**
 * Per-URL "last modified" dates that only move when that page's own content changes.
 *
 * Google ignores sitemap <lastmod> once it learns the values are unreliable, and stamping every
 * URL with the build date on each deploy is exactly that. Each URL's date is pinned to a hash of
 * its source data in src/config/seo-lastmod.json; commit that file after a build that changed it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function createLastmod(file, today) {
  const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const next = {};
  return {
    /** Date (YYYY-MM-DD) the source of `path` last changed. */
    dateOf(path, source) {
      const hash = createHash('sha1').update(JSON.stringify(source)).digest('hex').slice(0, 12);
      const prev = stored[path];
      next[path] = prev?.hash === hash ? prev : { hash, date: today };
      return next[path].date;
    },
    save() {
      const out = `${JSON.stringify(Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])), null, 2)}\n`;
      if (!existsSync(file) || readFileSync(file, 'utf8') !== out) writeFileSync(file, out);
    },
  };
}
