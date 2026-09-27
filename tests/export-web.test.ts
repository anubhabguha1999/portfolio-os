import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { createPortfolio } from '@/lib/portfolio-factory';
import { useAssets } from '@/stores/assets';
import { exportHtml, exportZip, exportProjectJson } from '@/lib/export';
import type { Portfolio } from '@/types/portfolio';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBlob = () => new Blob([Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0))], { type: 'image/png' });
const noNetwork = async () => null;

function fixture(): Portfolio {
  const p = createPortfolio({ title: 'Ada Portfolio', sections: ['hero', 'about', 'projects', 'contact', 'social'] });
  for (const s of p.sections) {
    if (s.type === 'hero') {
      s.data.name = 'Ada Lovelace';
      s.data.title = 'Analyst & Engineer';
      s.data.image = { src: 'asset:img_1', alt: 'Portrait of Ada' };
    }
    if (s.type === 'about') s.data.body = 'I write <script>alert(1)</script> **notes** on engines.';
    if (s.type === 'projects') {
      const item = s.data.items[0];
      if (item) {
        item.title = 'Analytical Engine';
        item.live = 'https://example.com/engine';
        item.image = { src: 'asset:img_1', alt: 'Engine' };
      }
    }
  }
  return p;
}

function loadAssets(p: Portfolio) {
  useAssets.setState({
    projectId: p.id,
    blobs: { img_1: pngBlob() },
    meta: { img_1: { id: 'img_1', name: 'ada.png', mime: 'image/png', size: 68, width: 1, height: 1 } },
    urls: {},
    loaded: true,
  });
}

beforeEach(() => useAssets.setState({ projectId: null, blobs: {}, meta: {}, urls: {}, loaded: false }));

describe('HTML export', () => {
  it('produces a standalone file with inline assets and no external loads (system fonts)', async () => {
    const p = fixture();
    loadAssets(p);
    const res = await exportHtml(p, { fontDelivery: 'system', embedData: false }, undefined, { fetcher: noNetwork });
    const html = await res.blob.text();
    expect(res.filename).toBe('ada-portfolio.html');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain(`src="data:image/png;base64,${PNG_B64}"`);
    expect(html).not.toContain('asset:img_1');
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/\ssrc="https?:/);
    expect(html).not.toMatch(/url\(['"]?https?:/);
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('id="pos-data"');
    expect(html).toContain('<style id="pos-style">');
    expect(res.warnings).toEqual([]);
  });

  it('escapes user content', async () => {
    const p = fixture();
    const hero = p.sections.find((s) => s.type === 'hero');
    if (hero?.type === 'hero') hero.data.name = 'Ada <b onclick="x()">&</b>';
    loadAssets(p);
    const html = await (await exportHtml(p, { fontDelivery: 'system', embedData: false }, undefined, { fetcher: noNetwork })).blob.text();
    expect(html).not.toContain('<b onclick');
    expect(html).toContain('Ada &lt;b onclick=');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('embeds the original portfolio JSON when asked', async () => {
    const p = fixture();
    loadAssets(p);
    const html = await (await exportHtml(p, { fontDelivery: 'system', embedData: true })).blob.text();
    const m = /<script type="application\/json" id="pos-data">([\s\S]*?)<\/script>/.exec(html);
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]!) as Portfolio;
    expect(data.id).toBe(p.id);
    // Asset references stay references (the images are already inline in the page).
    expect(JSON.stringify(data)).toContain('asset:img_1');
    expect(m![1]).not.toContain('<');
  });

  it('warns about missing assets instead of failing', async () => {
    const p = fixture();
    const res = await exportHtml(p, { fontDelivery: 'system', embedData: false });
    expect(res.warnings.join(' ')).toMatch(/missing/);
    expect(await res.blob.text()).toContain('Ada Lovelace');
  });

  it('inlines external images when they can be fetched, warns when not', async () => {
    const p = fixture();
    loadAssets(p);
    const hero = p.sections.find((s) => s.type === 'hero');
    if (hero?.type === 'hero') hero.data.image = { src: 'https://cdn.example.com/me.png', alt: 'Me' };
    const ok = await exportHtml(p, { fontDelivery: 'system', embedData: false }, undefined, { fetcher: async () => pngBlob() });
    const okHtml = await ok.blob.text();
    expect(okHtml).not.toContain('https://cdn.example.com/me.png');
    const failed = await exportHtml(p, { fontDelivery: 'system', embedData: false }, undefined, { fetcher: noNetwork });
    expect(failed.warnings.join(' ')).toMatch(/external image/);
  });

  it('links Google Fonts only in CDN mode', async () => {
    const p = fixture();
    p.theme.typography.headingFont = 'inter';
    p.theme.typography.bodyFont = 'inter';
    loadAssets(p);
    const cdn = await (await exportHtml(p, { fontDelivery: 'cdn', embedData: false }, undefined, { fetcher: noNetwork })).blob.text();
    const sys = await (await exportHtml(p, { fontDelivery: 'system', embedData: false }, undefined, { fetcher: noNetwork })).blob.text();
    expect(sys).not.toContain('fonts.googleapis.com');
    if (cdn.includes('fonts.googleapis.com')) expect(cdn).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com/);
  });
});

describe('ZIP export', () => {
  it('contains the exact website tree with relative paths', async () => {
    const p = fixture();
    loadAssets(p);
    const res = await exportZip(p, { fontDelivery: 'system', embedData: false, includeProjectJson: true }, undefined, { fetcher: noNetwork });
    expect(res.filename).toBe('ada-portfolio-website.zip');
    const zip = await JSZip.loadAsync(await res.blob.arrayBuffer());
    const files = Object.values(zip.files)
      .filter((f) => !f.dir)
      .map((f) => f.name)
      .sort();
    expect(files).toEqual(
      [
        'portfolio/.nojekyll',
        'portfolio/404.html',
        'portfolio/README.md',
        'portfolio/assets/icons/favicon.svg',
        'portfolio/assets/images/img_1.png',
        'portfolio/css/styles.css',
        'portfolio/index.html',
        'portfolio/js/app.js',
        'portfolio/portfolio.json',
        'portfolio/robots.txt',
      ].sort(),
    );
    const dirs = Object.values(zip.files)
      .filter((f) => f.dir)
      .map((f) => f.name);
    expect(dirs).toEqual(expect.arrayContaining(['portfolio/assets/fonts/', 'portfolio/assets/images/', 'portfolio/assets/icons/']));

    const index = await zip.file('portfolio/index.html')!.async('string');
    expect(index).toContain('<link rel="stylesheet" href="css/styles.css">');
    expect(index).toContain('<script src="js/app.js" defer></script>');
    expect(index).toContain('src="assets/images/img_1.png"');
    expect(index).toContain('href="assets/icons/favicon.svg"');
    expect(index).not.toMatch(/(src|href)="\/(?!\/)/);
    expect(index).not.toContain('<style id="pos-style">');

    const png = await zip.file('portfolio/assets/images/img_1.png')!.async('uint8array');
    expect(png[0]).toBe(0x89);
    const css = await zip.file('portfolio/css/styles.css')!.async('string');
    expect(css.length).toBeGreaterThan(1000);
    const readme = await zip.file('portfolio/README.md')!.async('string');
    for (const host of ['Netlify', 'Vercel', 'GitHub Pages', 'Cloudflare Pages']) expect(readme).toContain(host);
    const backup = JSON.parse(await zip.file('portfolio/portfolio.json')!.async('string')) as { format: string; portfolio: Portfolio };
    expect(backup.format).toBe('portfolio-os-project');
    expect(backup.portfolio.id).toBe(p.id);

    // Reported sizes are the real ones.
    const reported = new Map(res.files!.map((f) => [f.path, f.size]));
    expect(reported.get('portfolio/index.html')).toBe(new TextEncoder().encode(index).byteLength);
    expect(reported.get('portfolio/assets/images/img_1.png')).toBe(png.byteLength);
  });

  it('adds sitemap.xml only when a site URL is set, and packs custom fonts', async () => {
    const p = fixture();
    p.metadata.siteUrl = 'https://ada.dev';
    p.metadata.customFonts = [{ id: 'f1', family: 'Ada Sans', assetId: 'font_1', format: 'woff2', weight: '400', style: 'normal' }];
    loadAssets(p);
    useAssets.setState((s) => ({ blobs: { ...s.blobs, font_1: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'font/woff2' }) }, meta: { ...s.meta, font_1: { id: 'font_1', name: 'ada.woff2', mime: 'font/woff2', size: 4, width: 0, height: 0 } } }));
    const res = await exportZip(p, { fontDelivery: 'system', embedData: false, includeProjectJson: false }, undefined, { fetcher: noNetwork });
    const zip = await JSZip.loadAsync(await res.blob.arrayBuffer());
    const sitemap = await zip.file('portfolio/sitemap.xml')?.async('string');
    expect(sitemap).toContain('<loc>https://ada.dev/</loc>');
    expect(await zip.file('portfolio/robots.txt')!.async('string')).toContain('Sitemap: https://ada.dev/sitemap.xml');
    expect(zip.file('portfolio/assets/fonts/font_1.woff2')).not.toBeNull();
    expect(await zip.file('portfolio/css/styles.css')!.async('string')).toContain('url("../assets/fonts/font_1.woff2")');
    expect(zip.file('portfolio/portfolio.json')).toBeNull();

    const noSite = fixture();
    loadAssets(noSite);
    const zip2 = await JSZip.loadAsync(await (await exportZip(noSite, { fontDelivery: 'system', embedData: false, includeProjectJson: false }, undefined, { fetcher: noNetwork })).blob.arrayBuffer());
    expect(zip2.file('portfolio/sitemap.xml')).toBeNull();
  });
});

describe('JSON backup', () => {
  it('writes a re-importable backup', async () => {
    const p = fixture();
    const res = await exportProjectJson(p, 'Ada — Main');
    expect(res.filename).toBe('ada-main.portfolio.json');
    const text = await res.blob.text();
    expect(text).toContain('\n  "format": "portfolio-os-project"');
    expect((JSON.parse(text) as { portfolio: Portfolio }).portfolio.id).toBe(p.id);
  });
});
