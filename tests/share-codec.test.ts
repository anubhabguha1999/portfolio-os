import { describe, it, expect } from 'vitest';
import { buildShareUrl, buildSharePayload, decodeShare, ShareDecodeError, containsContactInfo } from '@/features/share/share-codec';
import { createPortfolio } from '@/lib/portfolio-factory';
import { createSection } from '@/sections/registry';
import { renderPortfolio } from '@/lib/engine/render';
import { generateTheme } from '@/lib/theme/randomizer';
import type { Portfolio } from '@/types/portfolio';

const payloadOf = (url: string) => {
  const m = /\/view#p=([A-Za-z0-9_-]+)$/.exec(url);
  if (!m) throw new Error(`bad url ${url}`);
  return m[1]!;
};

function sample(): Portfolio {
  const p = createPortfolio();
  const hero = p.sections.find((s) => s.type === 'hero')!;
  if (hero.type === 'hero') {
    hero.data.name = 'Linus Example';
    hero.data.image = { src: 'asset:img_1', alt: 'Linus' };
  }
  const projects = p.sections.find((s) => s.type === 'projects')!;
  if (projects.type === 'projects') projects.data.items[0]!.image = { src: 'https://cdn.example.org/cover.png', alt: 'Cover' };
  p.sections.push(createSection('custom', { heading: 'Notes', content: '# Hi\n\nSome *markdown*.' }, p.sections));
  const hidden = createSection('blog', {}, p.sections);
  hidden.enabled = false;
  p.sections.push(hidden);
  p.metadata.customFonts = [{ id: 'f', family: 'Brand', assetId: 'font_1', format: 'woff2', weight: '400', style: 'normal' }];
  return p;
}

describe('share links', () => {
  it('puts the payload in the URL fragment and round-trips the visible portfolio', async () => {
    const p = sample();
    const res = await buildShareUrl(p, { includeImages: false });
    expect(res.url).toContain('/view#p=');
    expect(res.url.split('#')[0]).not.toContain('p=');
    expect(res.removedImages).toBe(1);
    expect(res.bytes).toBe(payloadOf(res.url).length);
    const back = decodeShare(payloadOf(res.url));
    // Hidden sections and uploaded assets are left out; everything visible renders identically.
    expect(back.sections.map((s) => s.type)).toEqual(p.sections.filter((s) => s.enabled).map((s) => s.type));
    expect(back.metadata.customFonts).toEqual([]);
    const strip = (x: Portfolio): Portfolio => {
      const c = structuredClone(x);
      c.sections = c.sections.filter((s) => s.enabled);
      const h = c.sections.find((s) => s.type === 'hero');
      if (h && h.type === 'hero') h.data.image = { src: '', alt: 'Linus' };
      c.metadata.customFonts = [];
      return c;
    };
    expect(renderPortfolio(back, { mode: 'export' }).body).toBe(renderPortfolio(strip(p), { mode: 'export' }).body);
    expect(back.theme).toEqual(p.theme);
  });

  it('keeps custom themes and settings', async () => {
    const p = sample();
    p.theme = generateTheme(p.theme, 5);
    p.settings.colorScheme = 'dark';
    p.settings.navigation.style = 'floating';
    const back = decodeShare(payloadOf((await buildShareUrl(p, { includeImages: false })).url));
    expect(back.theme).toEqual(p.theme);
    expect(back.settings).toEqual(p.settings);
  });

  it('strips defaults so links stay short', async () => {
    const p = sample();
    const { payload } = await buildSharePayload(p, { includeImages: false });
    const json = JSON.stringify(payload);
    expect(json).not.toContain('"createdAt"');
    expect(json).not.toContain('minimal-developer","name"'); // built-in theme is sent by id only
    expect(json.length).toBeLessThan(JSON.stringify(p).length / 2);
  });

  it('drops images when includeImages is on but no canvas is available', async () => {
    const res = await buildShareUrl(sample(), { includeImages: true, assetBlobs: { img_1: new Blob(['x'], { type: 'image/png' }) } });
    expect(res.removedImages).toBe(1);
  });

  it('flags contact details', async () => {
    const p = sample();
    expect(containsContactInfo(p)).toBe(true);
    expect((await buildShareUrl(p, { includeImages: false })).containsContactInfo).toBe(true);
    const c = p.sections.find((s) => s.type === 'contact')!;
    if (c.type === 'contact') c.data.email = '';
    expect(containsContactInfo(p)).toBe(false);
  });

  it('rejects corrupted payloads with a friendly error', () => {
    expect(() => decodeShare('not-a-real-payload')).toThrow(ShareDecodeError);
    expect(() => decodeShare('')).toThrow(/does not contain/);
  });
});
