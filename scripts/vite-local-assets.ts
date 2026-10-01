/**
 * Serves (dev) and emits (build) the runtime files PDF.js and Tesseract.js fetch at run time,
 * from this origin, so PDF parsing and OCR never reach a CDN:
 *
 *   /pdfjs/cmaps/*            character maps for CJK and other CID fonts
 *   /pdfjs/standard_fonts/*   the 14 standard PDF fonts
 *   /pdfjs/wasm/*             JPEG 2000 / JBIG2 / colour decoders
 *   /ocr/worker.min.js        Tesseract worker
 *   /ocr/core/*               Tesseract WASM core (LSTM builds only)
 *   /ocr/lang/eng.traineddata.gz   English model (best_int, ~3 MB)
 *
 * None of these are precached by the service worker: they download on first use.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

interface Mapping {
  url: string;
  file: string;
}

function walk(dir: string, base: string, filter: (name: string) => boolean = () => true): Mapping[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, `${base}/${name}`, filter);
    return filter(name) ? [{ url: `${base}/${name}`, file: full }] : [];
  });
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
};

export function localRuntimeAssets(root: string): Plugin {
  const nm = join(root, 'node_modules');
  const mappings = (): Mapping[] => [
    ...walk(join(nm, 'pdfjs-dist/cmaps'), '/pdfjs/cmaps'),
    ...walk(join(nm, 'pdfjs-dist/standard_fonts'), '/pdfjs/standard_fonts'),
    ...walk(join(nm, 'pdfjs-dist/wasm'), '/pdfjs/wasm', (n) => !n.startsWith('LICENSE')),
    { url: '/ocr/worker.min.js', file: join(nm, 'tesseract.js/dist/worker.min.js') },
    ...walk(join(nm, 'tesseract.js-core'), '/ocr/core', (n) => /lstm\.wasm\.js$/.test(n)),
    { url: '/ocr/lang/eng.traineddata.gz', file: join(nm, '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz') },
  ];

  return {
    name: 'local-runtime-assets',
    configureServer(server) {
      const byUrl = new Map(mappings().map((m) => [m.url, m.file]));
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]!;
        const file = byUrl.get(path);
        if (!file) return next();
        const ext = /\.[a-z0-9]+$/i.exec(path)?.[0] ?? '';
        res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const m of mappings()) this.emitFile({ type: 'asset', fileName: m.url.slice(1), source: readFileSync(m.file) });
    },
  };
}
