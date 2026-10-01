import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPortfolio } from '@/lib/portfolio-factory';
import type { Portfolio, SectionType } from '@/types/portfolio';
import type { AssetLoader } from '@/lib/export/assets';

export const ALL_TYPES: SectionType[] = ['hero', 'about', 'stats', 'experience', 'education', 'projects', 'skills', 'services', 'achievements', 'certifications', 'testimonials', 'blog', 'timeline', 'gallery', 'custom', 'contact', 'social'];

const PNG = new Uint8Array(readFileSync(join(process.cwd(), 'public/icon-192.png')));

/** Every asset id resolves to the same small PNG. */
export const fakeLoader: AssetLoader = async (_p, id) => ({ id, blob: new Blob([PNG], { type: 'image/png' }), mime: 'image/png', name: `${id}.png` });
export const noFetch = async () => null;

/** A portfolio that exercises every section type, images, case studies, links and custom CSS. */
export function richPortfolio(): Portfolio {
  const p = createPortfolio({ title: 'Alex Morgan — Portfolio', sections: ALL_TYPES });
  p.metadata = { ...p.metadata, description: 'Full-stack engineer building reliable web platforms.', keywords: ['react', 'next.js', 'typescript'], author: 'Alex Morgan', twitterHandle: 'alexmorgan', favicon: '🚀' };
  p.settings.showThemeToggle = true;
  for (const s of p.sections) {
    s.style.showInNav = s.type !== 'hero';
    switch (s.type) {
      case 'hero':
        s.data = { ...s.data, name: 'Alex Morgan', title: 'Senior Full-Stack Engineer', description: 'I build fast, accessible products.', image: { src: 'asset:profile', alt: 'Alex Morgan smiling' }, typingEnabled: true, typingPhrases: ['React', 'Next.js'] };
        break;
      case 'about':
        s.data = { ...s.data, body: 'Hello **there**. I like [TypeScript](https://www.typescriptlang.org).', image: { src: 'asset:about', alt: 'Workspace' }, highlights: ['8 years', 'Remote'] };
        break;
      case 'projects':
        s.data.items = [
          { ...s.data.items[0]!, id: 'p1', title: 'DHMS Platform', description: 'Health monitoring.', image: { src: 'asset:p1', alt: 'DHMS dashboard' }, gallery: [{ src: 'asset:p1g', alt: 'Detail' }], technologies: ['Go', 'React'], live: 'https://example.org/dhms', github: 'https://github.com/example/dhms', caseStudy: '## Problem\nSlow dashboards.\n\n## Outcome\n3× faster.', features: ['Realtime'], featured: true, role: 'Lead', duration: '2024' },
          { ...s.data.items[0]!, id: 'p2', title: 'Typeset', description: 'Markdown to PDF.', image: { src: '', alt: '' }, gallery: [], caseStudy: '', technologies: ['TS'] },
        ];
        break;
      case 'gallery':
        s.data.items = [{ id: 'g1', image: { src: 'asset:g1', alt: 'Sketch' }, caption: 'Early sketch' }];
        break;
      case 'testimonials':
        s.data.items = s.data.items.map((t) => ({ ...t, avatar: { src: 'asset:av', alt: t.author } }));
        break;
      case 'contact':
        s.data = { ...s.data, email: 'alex@example.com', phone: '+1 555 0100', location: 'Berlin', showForm: true };
        break;
      case 'social':
        s.data.items = [
          { id: 's1', platform: 'GitHub', url: 'https://github.com/example', label: 'GitHub' },
          { id: 's2', platform: 'LinkedIn', url: 'https://linkedin.com/in/example', label: 'LinkedIn' },
        ];
        break;
      case 'custom':
        s.data = { ...s.data, mode: 'markdown', content: 'Custom **content**.', css: '.note { color: red; }' };
        break;
      default:
        break;
    }
  }
  return p;
}
