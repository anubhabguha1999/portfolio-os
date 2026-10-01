import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createPortfolio } from '@/lib/portfolio-factory';
import { createSection } from '@/sections/registry';
import type { Portfolio, SectionType } from '@/types/portfolio';
import { buildSiteData } from '@/lib/codegen/site-model';
import { createContext } from '@/lib/codegen/context';
import { libraryFiles } from '@/lib/codegen/library';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions, type GeneratedFile, type Styling } from '@/lib/codegen/types';

const PNG = new Uint8Array(readFileSync(join(__dirname, '../../public/icon-192.png')));

const ALL: SectionType[] = ['hero', 'about', 'experience', 'education', 'projects', 'skills', 'services', 'achievements', 'certifications', 'testimonials', 'blog', 'contact', 'social', 'stats', 'timeline', 'gallery', 'custom'];

export function samplePortfolio(): Portfolio {
  const p = createPortfolio({ title: 'Alex Morgan' });
  for (const t of ALL) if (!p.sections.some((s) => s.type === t)) p.sections.push(createSection(t, {}, p.sections));
  p.sections = p.sections.map((s, i) => ({ ...s, order: i, enabled: true }));
  for (const s of p.sections) {
    if (s.type === 'hero') {
      s.data.image = { src: 'asset:img_profile', alt: 'Alex Morgan' };
      s.data.typingEnabled = true;
      s.data.typingPhrases = ['I build web apps', 'I design systems'];
    }
    if (s.type === 'projects') {
      s.data.items = s.data.items.map((it, i) => ({ ...it, title: `Project ${i + 1}`, image: { src: 'asset:img_project', alt: 'Screenshot' }, caseStudy: i === 0 ? '## Problem\n\nIt was **slow**.' : '', live: 'https://example.com', github: 'javascript:alert(1)' }));
    }
    if (s.type === 'gallery') s.data.items = [{ id: 'g1', image: { src: 'asset:img_project', alt: 'Shot' }, caption: 'Caption' }];
    if (s.type === 'testimonials') s.data.layout = 'carousel';
    if (s.type === 'contact') {
      s.data.email = 'alex@example.com';
      s.data.showForm = true;
    }
    if (s.type === 'social') s.data.items = [{ id: 's1', platform: 'GitHub', url: 'https://github.com/alex', label: 'GitHub' }];
    if (s.type === 'custom') s.data.css = '.box { color: red; }';
  }
  p.settings.showThemeToggle = true;
  return p;
}

const loader = async (_pid: string, id: string) => ({ id, blob: new Blob([PNG], { type: 'image/png' }), mime: 'image/png', name: id });

async function files(o: Partial<ExportOptions>, p = samplePortfolio()): Promise<GeneratedFile[]> {
  const options = { ...DEFAULT_EXPORT_OPTIONS, ...o };
  const build = await buildSiteData(p, { structure: options.structure, siteUrl: '', loader, fetcher: async () => null });
  return libraryFiles(createContext(p, options, build));
}

const get = (fs: GeneratedFile[], path: string) => fs.find((f) => f.path === path);
const src = (fs: GeneratedFile[], path: string) => String(get(fs, path)?.content ?? '');

const COMBOS: Array<Partial<ExportOptions>> = [];
for (const framework of ['nextjs', 'react-vite'] as const)
  for (const styling of ['tailwind', 'css-modules', 'css'] as Styling[])
    for (const animations of [true, false]) for (const images of ['optimized', 'img'] as const) COMBOS.push({ framework, styling, animations, images, structure: framework === 'nextjs' ? 'multi' : 'single' });

describe('component library', () => {
  it.each(COMBOS)('emits a consistent library %o', async (o) => {
    const fs = await files(o);
    const paths = fs.map((f) => f.path);
    // One section component per section type present.
    for (const name of ['Hero', 'About', 'Experience', 'Projects', 'Skills', 'Contact', 'Gallery', 'Custom', 'Testimonials']) expect(paths).toContain(`src/sections/${name}.tsx`);
    // Client boundaries: never on sections.
    for (const f of fs.filter((x) => x.path.startsWith('src/sections/'))) expect(String(f.content)).not.toContain("'use client'");
    const clients = fs.filter((f) => String(f.content).startsWith("'use client'")).map((f) => f.path.split('/').pop());
    if (o.framework === 'nextjs') expect(clients.sort()).toEqual(['Carousel.tsx', 'ContactForm.tsx', 'Navbar.tsx', ...(o.animations ? ['Reveal.tsx'] : []), 'ThemeToggle.tsx', 'TypingText.tsx'].sort());
    else expect(clients).toEqual([]);
    // Animations
    const allText = fs.filter((f) => f.type === 'text').map((f) => String(f.content)).join('\n');
    expect(allText.includes("from 'motion/react'")).toBe(!!o.animations);
    expect(paths.includes('src/components/Reveal.tsx')).toBe(!!o.animations);
    // Framework imports
    expect(allText.includes("from 'next/")).toBe(o.framework === 'nextjs');
    expect(allText.includes("from 'next/image'")).toBe(o.framework === 'nextjs' && o.images === 'optimized');
    // Styling
    if (o.styling === 'css-modules') {
      for (const f of fs.filter((x) => x.path.endsWith('.tsx') && String(x.content).includes('.module.css'))) {
        const mod = src(fs, f.path.replace(/\.tsx$/, '.module.css'));
        expect(mod, f.path).not.toBe('');
        for (const m of String(f.content).matchAll(/styles(?:\.(\w+)|\["([\w-]+)"\])/g)) expect(mod, `${f.path} ${m[1] ?? m[2]}`).toContain(`.${m[1] ?? m[2]} {`);
      }
    }
    if (o.styling === 'css') {
      expect(src(fs, 'src/styles/components.css')).toContain('.hero-root {');
      expect(allText).not.toContain('.module.css');
    }
    if (o.styling === 'tailwind') {
      expect(src(fs, o.framework === 'nextjs' ? 'src/app/globals.css' : 'src/styles/globals.css')).toContain('@import "tailwindcss"');
      expect(src(fs, 'src/sections/Hero.tsx')).toMatch(/className="[^"]*font-heading/);
    }
    // Assets
    expect(paths.some((p) => p.startsWith('public/images/') && p.endsWith('.png'))).toBe(true);
    expect(paths).toContain('public/favicon.svg');
    // Self-contained
    expect(allText).not.toMatch(/\bblob:|asset:img_|indexedDB/);
    // Data file is valid JSON after the declaration
    const data = src(fs, 'src/data/portfolio.ts');
    const json = data.slice(data.indexOf('= ') + 2).trim().replace(/;$/, '');
    const parsed = JSON.parse(json);
    expect(parsed.projects[0].hasPage).toBe(true);
    expect(parsed.projects[0].github).toBe('');
  });

  it('only generates components for present sections', async () => {
    const p = samplePortfolio();
    p.sections = p.sections.filter((s) => s.type === 'hero' || s.type === 'about');
    const fs = await files({ framework: 'react-vite', styling: 'css' }, p);
    const sections = fs.filter((f) => f.path.startsWith('src/sections/')).map((f) => f.path);
    expect(sections.sort()).toEqual(['src/sections/About.tsx', 'src/sections/Hero.tsx']);
    expect(src(fs, 'src/components/SectionRenderer.tsx')).not.toContain('Projects');
    expect(fs.some((f) => f.path.endsWith('ProjectDetail.tsx'))).toBe(false);
  });

  it.skipIf(!process.env.LIB_OUT)('writes variants to disk for type-checking', async () => {
    for (const [i, o] of COMBOS.entries()) {
      const dir = join(process.env.LIB_OUT!, `v${i}-${o.framework}-${o.styling}-${o.animations ? 'anim' : 'static'}-${o.images}`);
      rmSync(dir, { recursive: true, force: true });
      for (const f of await files(o)) {
        mkdirSync(dirname(join(dir, f.path)), { recursive: true });
        writeFileSync(join(dir, f.path), f.content);
      }
    }
  });
});
