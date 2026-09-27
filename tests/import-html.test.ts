import { describe, it, expect } from 'vitest';
import { importHtmlDocument, classifyHeading } from '@/lib/import/html';
import { createPortfolio } from '@/lib/portfolio-factory';
import { renderPortfolio } from '@/lib/engine/render';
import { createSection } from '@/sections/registry';
import type { Portfolio, SectionType, SectionOf } from '@/types/portfolio';

const get = <K extends SectionType>(p: Portfolio, type: K): SectionOf<K> => {
  const s = p.sections.find((x) => x.type === type);
  if (!s) throw new Error(`missing ${type}`);
  return s as SectionOf<K>;
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('HTML import — own exports', () => {
  it('restores a Portfolio OS export exactly, with its images', async () => {
    const p = createPortfolio();
    const hero = get(p, 'hero');
    hero.data.name = 'Grace Hopper';
    hero.data.image = { src: 'asset:img_face', alt: 'Grace' };
    p.sections.push(createSection('custom', { mode: 'html', content: '<p>Hi <strong>there</strong></p>' }, p.sections));
    p.metadata.description = 'Rear admiral & compiler pioneer — "Amazing Grace" <3';
    const { html } = renderPortfolio(p, { mode: 'export', embedData: true, assetUrl: (id) => (id === 'img_face' ? PNG : null) });
    const res = await importHtmlDocument(html);
    expect(res.exact).toBe(true);
    expect(res.portfolio.sections).toEqual(p.sections);
    expect(res.portfolio.theme).toEqual(p.theme);
    expect(res.portfolio.settings).toEqual(p.settings);
    expect(res.portfolio.metadata).toEqual(p.metadata);
    expect(res.assets).toEqual([{ id: 'img_face', dataUrl: PNG, name: 'Grace' }]);
    expect(res.warnings).toEqual([]);
  });

  it('warns when referenced assets were not embedded', async () => {
    const p = createPortfolio();
    get(p, 'hero').data.image = { src: 'asset:img_gone', alt: 'x' };
    const { html } = renderPortfolio(p, { mode: 'export', embedData: true, assetUrl: () => 'assets/img_gone.png' });
    const res = await importHtmlDocument(html);
    expect(res.exact).toBe(true);
    expect(res.assets).toEqual([]);
    expect(res.warnings.join(' ')).toMatch(/could not be restored/);
  });

  it('rejects corrupted embedded data', async () => {
    await expect(importHtmlDocument('<html><body><script type="application/json" id="pos-data">{nope</script></body></html>')).rejects.toThrow(/corrupted/);
  });
});

const GENERIC = `<!doctype html>
<html lang="en-GB">
<head>
  <title>Sam Carter | Product Engineer</title>
  <meta name="description" content="Sam Carter is a product engineer building tools for designers and developers.">
  <meta name="keywords" content="react, design systems, typescript">
  <script>window.evil = true</script>
</head>
<body onload="steal()">
  <nav><a href="#about">About</a><a href="https://github.com/samcarter">GitHub</a></nav>
  <header class="hero">
    <img src="${PNG}" alt="Sam smiling" width="400" height="400">
    <h1>Sam Carter</h1>
    <p>Product engineer in London</p>
    <p>I build fast, accessible interfaces for teams that care about craft.</p>
  </header>
  <section id="about"><h2>About me</h2><p>I have worked on design tools for nine years.</p><p>I love <a href="https://example.org/typography">typography</a>.</p></section>
  <section><h2>Work Experience</h2>
    <article><h3>Senior Engineer at Linear</h3><p>Jan 2022 – Present</p><ul><li>Built the command menu</li><li>Cut bundle size by 30%</li></ul></article>
    <article><h3>Engineer, Figma</h3><p>2018 - 2021</p><p>Worked on the plugin API.</p></article>
  </section>
  <section><h2>Selected Projects</h2>
    <div class="card"><h3>Palette</h3><p>A colour tool for accessible palettes.</p><a href="https://github.com/samcarter/palette">Source</a><a href="https://palette.dev">Live</a><img src="https://cdn.palette.dev/cover.png" alt="Palette UI"></div>
    <div class="card"><h3>Tiny Charts</h3><p>Sparkline library.</p><ul><li>SVG</li><li>TypeScript</li></ul><img src="img/local.png" alt="local"></div>
  </section>
  <section><h2>Skills</h2><ul><li>TypeScript</li><li>React</li><li>Rust</li></ul></section>
  <section><h2>Now reading</h2><p>Books about <em>typography</em> and gardens.</p><button onclick="x()">Click</button></section>
  <section><h2>Contact</h2><p>Say hi any time.</p><p><a href="mailto:sam@carter.dev">sam@carter.dev</a></p></section>
  <footer><a href="https://www.linkedin.com/in/samcarter">LinkedIn</a><a href="javascript:alert(1)">bad</a></footer>
</body></html>`;

describe('HTML import — generic pages', () => {
  it('classifies headings by keyword', () => {
    expect(classifyHeading('Work Experience')).toBe('experience');
    expect(classifyHeading('Selected Projects')).toBe('projects');
    expect(classifyHeading('Case Studies')).toBe('projects');
    expect(classifyHeading('Tools & Stack')).toBe('skills');
    expect(classifyHeading('Get in touch')).toBe('contact');
    expect(classifyHeading('Writing')).toBe('blog');
    expect(classifyHeading('Awards')).toBe('achievements');
    expect(classifyHeading('Now reading')).toBeNull();
  });

  it('maps a hand-written portfolio page heuristically and safely', async () => {
    const res = await importHtmlDocument(GENERIC);
    const p = res.portfolio;
    expect(res.exact).toBe(false);
    expect(p.metadata.title).toBe('Sam Carter | Product Engineer');
    expect(p.metadata.description).toContain('product engineer');
    expect(p.metadata.keywords).toEqual(['react', 'design systems', 'typescript']);
    expect(p.metadata.language).toBe('en-GB');

    const hero = get(p, 'hero').data;
    expect(hero.name).toBe('Sam Carter');
    expect(hero.title).toBe('Product engineer in London');
    expect(hero.description).toBe('I build fast, accessible interfaces for teams that care about craft.');
    expect(hero.image.src).toMatch(/^asset:/);
    expect(hero.image.alt).toBe('Sam smiling');
    expect(res.assets).toHaveLength(1);
    expect(`asset:${res.assets[0]!.id}`).toBe(hero.image.src);

    expect(get(p, 'about').data.body).toContain('[typography](https://example.org/typography)');

    const xp = get(p, 'experience').data.items;
    expect(xp.map((x) => [x.role, x.company, x.start, x.current])).toEqual([
      ['Senior Engineer', 'Linear', '2022-01', true],
      ['Engineer', 'Figma', '2018', false],
    ]);
    expect(xp[0]!.achievements).toEqual(['Built the command menu', 'Cut bundle size by 30%']);
    expect(xp[1]!.description).toBe('Worked on the plugin API.');

    const projects = get(p, 'projects').data.items;
    expect(projects[0]).toMatchObject({ title: 'Palette', github: 'https://github.com/samcarter/palette', live: 'https://palette.dev/', image: { src: 'https://cdn.palette.dev/cover.png', alt: 'Palette UI' } });
    expect(projects[1]).toMatchObject({ title: 'Tiny Charts', technologies: ['SVG', 'TypeScript'] });

    expect(get(p, 'skills').data.items.map((s) => s.name)).toEqual(['TypeScript', 'React', 'Rust']);
    const custom = get(p, 'custom').data;
    expect(custom.heading).toBe('Now reading');
    expect(custom.content).toContain('*typography*');
    expect(get(p, 'contact').data.email).toBe('sam@carter.dev');
    expect(get(p, 'social').data.items.map((s) => s.platform)).toEqual(['GitHub', 'LinkedIn']);

    expect(hero.ctas.map((c) => c.url)).toEqual(['#projects', '#contact']);
    const json = JSON.stringify(p);
    expect(json).not.toContain('javascript:');
    expect(json).not.toContain('steal');
    expect(json).not.toContain('evil');
    expect(res.warnings[0]).toMatch(/^Detected: name "Sam Carter"/);
    expect(res.warnings.join(' ')).toMatch(/1 image with relative/);
    expect(res.warnings.join(' ')).toMatch(/Scripts, embeds and event handlers were removed/);
    expect(res.warnings.join(' ')).toMatch(/1 block could not be classified/);
  });

  it('splits by h2 when a page has no section elements', async () => {
    const res = await importHtmlDocument(`<html><head><title>Lee</title></head><body><h1>Lee Park</h1><p>Designer</p>
      <h2>Education</h2><h3>BA in Graphic Design</h3><p>Royal College of Art</p><p>2014 - 2017</p>
      <h2>Testimonials</h2><blockquote><p>Lee is wonderful to work with.</p></blockquote><cite>Kim Lee, Director at Studio K</cite></body></html>`);
    const edu = get(res.portfolio, 'education').data.items[0]!;
    expect(edu).toMatchObject({ degree: 'BA in Graphic Design', institution: 'Royal College of Art', start: '2014', end: '2017' });
    const t = get(res.portfolio, 'testimonials').data.items[0]!;
    expect(t).toMatchObject({ quote: 'Lee is wonderful to work with.', author: 'Kim Lee', role: 'Director', company: 'Studio K' });
  });

  it('rejects empty files', async () => {
    await expect(importHtmlDocument('<html><body>   </body></html>')).rejects.toThrow(/no readable content/);
  });
});
