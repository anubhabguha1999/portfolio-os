import { describe, it, expect } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import { createSection } from '@/sections/registry';
import { runAccessibilityAudit, runPerformanceAudit, runContentAudit, runHealthCheck, computeAnalytics, analyzePortfolio } from '@/lib/analysis';
import { renderPortfolio } from '@/lib/engine/render';
import type { AssetMeta } from '@/stores/assets';
import type { Portfolio, PortfolioSection, SectionType, SectionOf } from '@/types/portfolio';

function section<K extends SectionType>(p: Portfolio, type: K): SectionOf<K> {
  const s = p.sections.find((x): x is PortfolioSection => x.type === type);
  if (!s) throw new Error(`no ${type}`);
  return s as SectionOf<K>;
}

function check(report: { checks: Array<{ id: string; status: string }> }, id: string) {
  const c = report.checks.find((x) => x.id === id);
  if (!c) throw new Error(`missing check ${id}`);
  return c;
}

/** A realistic, finished portfolio that should pass nearly everything. */
function goodPortfolio(): Portfolio {
  const p = createPortfolio({ sections: ['hero', 'about', 'experience', 'projects', 'contact', 'social'] });
  p.metadata.title = 'Ada Lovelace — Analytical Engineer';
  p.metadata.description = 'Ada Lovelace builds reliable data systems and writes about computation, notation and the future of machines.';
  const hero = section(p, 'hero');
  hero.data.name = 'Ada Lovelace';
  hero.data.title = 'Analytical engineer';
  hero.data.description = 'I design programs for machines that do not exist yet.';
  hero.data.image = { src: 'asset:img_hero', alt: 'Portrait of Ada Lovelace' };
  const about = section(p, 'about');
  about.data.body = 'I have spent my career translating mathematics into instructions for machines. I work closely with engineers and enjoy explaining complex ideas in simple words for any audience.';
  const xp = section(p, 'experience');
  xp.data.items[0]!.company = 'Analytical Engine Co.';
  xp.data.items[0]!.role = 'Lead Programmer';
  const pr = section(p, 'projects');
  pr.data.items[0]!.title = 'Bernoulli numbers';
  pr.data.items[0]!.description = 'The first published algorithm intended for a machine, with a full derivation.';
  pr.data.items[0]!.live = 'https://ada.dev/bernoulli';
  pr.data.items[0]!.image = { src: 'asset:img_cover', alt: 'Diagram of the algorithm' };
  const contact = section(p, 'contact');
  contact.data.email = 'ada@lovelace.dev';
  contact.data.body = 'Write to me about engines.';
  contact.data.heading = 'Contact';
  const social = section(p, 'social');
  social.data.items = [{ id: 'soc1', platform: 'GitHub', url: 'https://github.com/ada', label: 'GitHub' }];
  return p;
}

const assets: Record<string, AssetMeta> = {
  img_hero: { id: 'img_hero', name: 'hero.jpg', mime: 'image/jpeg', size: 120_000, width: 800, height: 800 },
  img_cover: { id: 'img_cover', name: 'cover.jpg', mime: 'image/jpeg', size: 200_000, width: 1600, height: 1000 },
};

describe('accessibility audit', () => {
  it('passes a good, finished portfolio', () => {
    const r = runAccessibilityAudit(goodPortfolio(), assets);
    for (const c of r.checks) expect([c.id, c.status]).not.toEqual([c.id, 'fail']);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(check(r, 'a11y-contrast').status).toBe('pass');
    expect(check(r, 'a11y-keyboard').status).toBe('pass');
    expect(check(r, 'a11y-headings').status).toBe('pass');
  });

  it('detects missing alt text and names the section', () => {
    const p = goodPortfolio();
    section(p, 'projects').data.items[0]!.image.alt = '';
    const r = runAccessibilityAudit(p, assets);
    const alt = r.checks.find((c) => c.id === 'a11y-alt')!;
    expect(alt.status).toBe('fail');
    expect(alt.items?.[0]?.message).toContain('Bernoulli numbers');
    expect(alt.sectionId).toBe(section(p, 'projects').id);
  });

  it('detects low contrast in the palette a visitor can see', () => {
    const p = goodPortfolio();
    p.settings.colorScheme = 'light';
    p.settings.showThemeToggle = false;
    p.theme.palettes.light.text = '#bbbbbb';
    p.theme.palettes.light.background = '#ffffff';
    const r = runAccessibilityAudit(p, assets);
    const c = check(r, 'a11y-contrast');
    expect(c.status).toBe('fail');
    // Only the light palette is checked when no toggle is shown.
    expect((c as { items?: Array<{ message: string }> }).items?.every((i) => i.message.startsWith('Light'))).toBe(true);
  });

  it('checks both palettes when a theme toggle is enabled', () => {
    const p = goodPortfolio();
    p.settings.colorScheme = 'light';
    p.settings.showThemeToggle = true;
    p.theme.palettes.dark.muted = '#333333';
    const c = check(runAccessibilityAudit(p, assets), 'a11y-contrast') as { status: string; items?: Array<{ message: string }> };
    expect(c.status).not.toBe('pass');
    expect(c.items?.some((i) => i.message.startsWith('Dark: Muted'))).toBe(true);
  });

  it('flags duplicate h1s and skipped heading levels from custom HTML', () => {
    const p = goodPortfolio();
    p.sections.push(createSection('custom', { mode: 'html', content: '<h1>Another title</h1><h4>Deep</h4>' }, p.sections));
    const h = check(runAccessibilityAudit(p, assets), 'a11y-headings');
    expect(h.status).toBe('fail');
  });

  it('flags a missing page language', () => {
    const p = goodPortfolio();
    p.metadata.language = 'not a lang!';
    expect(check(runAccessibilityAudit(p, assets), 'a11y-lang').status).toBe('warn');
  });
});

describe('performance audit', () => {
  it('estimates the standalone HTML size from markup + base64 assets', () => {
    const p = goodPortfolio();
    const a = computeAnalytics(p, assets);
    const { html } = renderPortfolio(p, { mode: 'export', assetUrl: () => '' });
    // Hero (120 KB) + cover (200 KB) inlined as base64 ≈ 4/3 of their size.
    const base64 = Math.ceil(120_000 / 3) * 4 + Math.ceil(200_000 / 3) * 4;
    expect(a.estimatedHtmlBytes).toBeGreaterThan(base64);
    expect(a.estimatedHtmlBytes).toBeLessThan(base64 + html.length * 1.2);
    expect(a.projects).toBe(1);
    expect(a.experience).toBe(1);
    expect(a.images).toBe(2);
    expect(a.words).toBeGreaterThan(30);
  });

  it('warns and fails on heavy images', () => {
    const p = goodPortfolio();
    const heavy: Record<string, AssetMeta> = {
      img_hero: { ...assets.img_hero!, size: 2 * 1024 * 1024, width: 4000, height: 4000 },
      img_cover: { ...assets.img_cover!, size: 700 * 1024 },
    };
    const r = runPerformanceAudit(p, heavy);
    expect(check(r, 'perf-images').status).toBe('fail');
    expect(check(r, 'perf-first-render').status).toBe('fail');
    expect(r.score).toBeLessThan(runPerformanceAudit(p, assets).score);
  });

  it('reports unused custom fonts and network dependencies', () => {
    const p = goodPortfolio();
    p.metadata.customFonts = [{ id: 'f1', family: 'Brand Sans', assetId: 'font1', format: 'woff2', weight: '400', style: 'normal' }];
    const hero = section(p, 'hero');
    hero.data.background = 'video';
    hero.data.videoUrl = 'https://cdn.example.org/loop.mp4';
    const r = runPerformanceAudit(p, assets);
    expect(check(r, 'perf-fonts').status).toBe('warn');
    expect(check(r, 'perf-offline').status).toBe('warn');
  });
});

describe('content audit', () => {
  it('flags starter placeholders in a fresh portfolio', () => {
    const r = runContentAudit(createPortfolio());
    const ph = r.checks.find((c) => c.id === 'content-placeholders')!;
    expect(ph.status).toBe('fail');
    const messages = ph.items!.map((i) => i.message).join('\n');
    expect(messages).toContain('Your Name');
    expect(messages).toContain('Project title');
    expect(check(r, 'content-seo').status).toBe('warn');
  });

  it('passes the finished portfolio on key rules', () => {
    const r = runContentAudit(goodPortfolio());
    expect(check(r, 'content-placeholders').status).toBe('pass');
    expect(check(r, 'content-contact').status).toBe('pass');
    expect(check(r, 'content-social').status).toBe('pass');
    expect(check(r, 'content-seo').status).toBe('pass');
  });

  it('detects missing contact, long hero text and projects without descriptions or links', () => {
    const p = goodPortfolio();
    section(p, 'contact').data.email = '';
    section(p, 'hero').data.description = 'x'.repeat(400);
    const pr = section(p, 'projects').data.items[0]!;
    pr.description = '';
    pr.live = '';
    const r = runContentAudit(p);
    expect(check(r, 'content-contact').status).toBe('fail');
    expect(check(r, 'content-hero-length').status).toBe('warn');
    expect(check(r, 'content-project-desc').status).toBe('warn');
    expect(check(r, 'content-project-links').status).toBe('warn');
  });

  it('flags missing About and broken-looking URLs', () => {
    const p = goodPortfolio();
    p.sections = p.sections.filter((s) => s.type !== 'about');
    section(p, 'projects').data.items[0]!.github = 'http://localhost:3000/repo';
    const r = runContentAudit(p);
    expect(check(r, 'content-about').status).toBe('warn');
    expect(check(r, 'content-urls').status).toBe('warn');
  });
});

describe('health check', () => {
  it('passes the finished portfolio without blocking failures', () => {
    const r = runHealthCheck(goodPortfolio(), assets);
    expect(r.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('fails on a broken anchor link', () => {
    const p = goodPortfolio();
    section(p, 'hero').data.ctas[0]!.url = '#nowhere';
    const c = check(runHealthCheck(p, assets), 'health-links') as { status: string; sectionId?: string | null };
    expect(c.status).toBe('fail');
    expect(c.sectionId).toBe(section(p, 'hero').id);
  });

  it('fails on unsafe protocols', () => {
    const p = goodPortfolio();
    section(p, 'projects').data.items[0]!.live = 'javascript:alert(1)';
    expect(check(runHealthCheck(p, assets), 'health-links').status).toBe('fail');
  });

  it('fails when an uploaded image is missing', () => {
    const p = goodPortfolio();
    const r = runHealthCheck(p, { img_hero: assets.img_hero! });
    expect(check(r, 'health-assets').status).toBe('fail');
  });

  it('fails when the hero has no name', () => {
    const p = goodPortfolio();
    section(p, 'hero').data.name = '';
    expect(check(runHealthCheck(p, assets), 'health-sections').status).toBe('fail');
  });

  it('warns when the sanitizer removed markup from custom HTML', () => {
    const p = goodPortfolio();
    p.sections.push(createSection('custom', { mode: 'html', content: '<p onclick="steal()">Hi</p><script>alert(1)</script>' }, p.sections));
    const c = check(runHealthCheck(p, assets), 'health-compat') as { status: string; items?: Array<{ message: string }> };
    expect(c.status).toBe('warn');
    expect(c.items?.[0]?.message).toContain('<script>');
    expect(c.items?.[0]?.message).toContain('onclick handler');
  });

  it('warns about fixed-width custom CSS', () => {
    const p = goodPortfolio();
    p.sections.push(createSection('custom', { css: '.box { width: 900px }' }, p.sections));
    expect(check(runHealthCheck(p, assets), 'health-responsive').status).toBe('warn');
  });

  it('memoises per portfolio snapshot', () => {
    const p = goodPortfolio();
    expect(analyzePortfolio(p, assets).accessibility).toBe(analyzePortfolio(p, assets).accessibility);
  });
});
