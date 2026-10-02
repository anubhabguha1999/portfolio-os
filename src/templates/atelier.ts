import type { PortfolioTemplate } from './types';
import { buildPortfolio, section, cta, job, work, school, quote, social, withIds } from './build';
import { cover, galleryArt, ogArt, paletteFor } from './art';
import type { ServiceItem, TimelineItem } from '@/types/portfolio';

const THEME = 'atelier';

const INDEX: Array<[string, string, string, string]> = [
  ['Casa Laje', 'Private house', 'Comporta, PT', '2024'],
  ['Mercado Norte', 'Market hall renovation', 'Porto, PT', '2023'],
  ['Atlas Library', 'Public library', 'Évora, PT', '2022'],
  ['Pátio Studios', 'Workspace, 4,200 m²', 'Lisbon, PT', '2021'],
  ['Quinta do Vale', 'Winery & visitor centre', 'Douro, PT', '2019'],
];

/** Project index on a blueprint grid: a real table, so it reads well and stays accessible. */
const INDEX_HTML = `<div class="sheet">
  <p class="stamp">Drawing no. A-001 · Project index</p>
  <table>
    <thead><tr><th scope="col">No.</th><th scope="col">Project</th><th scope="col">Programme</th><th scope="col">Place</th><th scope="col">Year</th></tr></thead>
    <tbody>${INDEX.map(([p, t, place, y], i) => `<tr><td class="n">${String(i + 1).padStart(2, '0')}</td><td class="p">${p}</td><td>${t}</td><td>${place}</td><td class="y">${y}</td></tr>`).join('')}</tbody>
  </table>
</div>`;

const INDEX_CSS = `.custom-content { max-width: none; }
.sheet { position: relative; padding: clamp(18px, 4vw, 40px); border: 1px solid color-mix(in srgb, var(--c-accent) 45%, var(--c-border)); background-color: color-mix(in srgb, var(--c-accent) 5%, var(--c-bg)); background-image: linear-gradient(color-mix(in srgb, var(--c-accent) 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--c-accent) 14%, transparent) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--c-accent) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--c-accent) 7%, transparent) 1px, transparent 1px); background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px; }
.stamp { margin: 0 0 18px; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-accent); }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th { text-align: left; font-weight: 500; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-muted); padding: 0 12px 12px 0; border-bottom: 1px solid var(--c-text); }
td { padding: 16px 12px 16px 0; border-bottom: 1px solid color-mix(in srgb, var(--c-text) 18%, transparent); color: var(--c-muted); vertical-align: baseline; }
td.p { font-family: var(--font-heading); font-size: clamp(1.25rem, 2.6vw, 1.75rem); color: var(--c-text); }
td.n, td.y { font-family: var(--font-mono); font-size: 0.82rem; color: var(--c-accent); white-space: nowrap; }
tbody tr { transition: background 0.3s ease; }
tbody tr:hover { background: color-mix(in srgb, var(--c-primary) 7%, transparent); }
@media (max-width: 640px) { th:nth-child(3), td:nth-child(3) { display: none; } }`;

/** Atelier — a calm, architectural page for spatial designers. */
export const atelierTemplate: PortfolioTemplate = {
  id: 'atelier',
  name: 'Atelier',
  description: 'Stone and terracotta with a fine serif, arched imagery and a blueprint-grid project index — built for spatial work.',
  audience: 'Architects, interior & landscape designers',
  themeId: THEME,
  tags: ['Light', 'Serif', 'Architecture', 'Elegant', 'Premium'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Clara Moniz';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Architect`,
        description: 'Clara Moniz is an architect in Lisbon designing houses, public buildings and adaptive reuse with light, local material and restraint.',
        keywords: ['architect', 'architecture portfolio', 'adaptive reuse', 'residential', 'Lisbon', 'Portugal'],
        author: name,
        favicon: '◠',
        ogImage: ogArt(name, 'Architect', pal, 'arches'),
      },
      navigation: { style: 'minimal', brand: 'Clara Moniz Arquitetura' },
      footer: { text: '© {year} Clara Moniz Arquitetura, Lisbon.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Architecture · Lisbon',
            name,
            title: 'Buildings shaped by light, local stone and a little silence.',
            description: 'Houses, public buildings and careful renovations across Portugal, from first sketch to the last door handle.',
            layout: 'split',
            background: 'none',
            image: cover('atelier-hero', pal, 'arches', 'Arched forms in stone and terracotta tones'),
            ctas: [cta('Project index', '#index'), cta('Contact the studio', 'mailto:studio@claramoniz.pt', 'ghost')],
          },
          { paddingY: 'xl', animation: { type: 'fade', duration: 1000 } },
        ),
        section('custom', { heading: 'Project index', mode: 'html', content: INDEX_HTML, css: INDEX_CSS }, { anchor: 'index', animation: { type: 'fade' } }, 'Project index'),
        section(
          'projects',
          {
            heading: 'Selected projects',
            intro: '',
            layout: 'masonry',
            items: [
              work({ title: 'Casa Laje', description: 'A low limestone house in the dunes, organised around a shaded courtyard. Passive cooling keeps it below 26 °C without air conditioning.', image: cover('atelier-laje', pal, 'arches', 'Arched courtyard abstraction'), role: 'Lead architect', duration: '2022 — 2024', technologies: ['Residential', 'Limestone', 'Passive design'], featured: true }),
              work({ title: 'Mercado Norte', description: 'Renovation of a 1930s market hall: the original concrete vaults restored, a new timber mezzanine and 40 market stalls.', image: cover('atelier-mercado', pal, 'contours', 'Vault contours'), role: 'Project architect', duration: '2021 — 2023', technologies: ['Adaptive reuse', 'Timber'] }),
              work({ title: 'Atlas Library', description: 'A public library cut into a hillside, with reading rooms lit from above. Shortlisted for the FAD Award.', image: cover('atelier-atlas', pal, 'blocks', 'Stepped blocks into a hillside'), role: 'Design lead', duration: '2019 — 2022', technologies: ['Civic', 'Concrete'] }),
            ],
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'about',
          {
            heading: 'The studio',
            body: 'We are a studio of seven architects. We design slowly, build carefully and stay with each project until the first winter has passed.\n\nEvery building starts on site: the path of the sun, the stone in the nearest quarry, the craftspeople within an hour’s drive.',
            highlights: ['28 buildings completed', 'FAD Award shortlist 2023', 'Teaching at FAUL, Lisbon'],
            layout: 'split',
            image: galleryArt('atelier-studio', pal, 'arches', 'Studio drawing table abstraction', true),
          },
          { background: 'surface', animation: { type: 'fade' } },
        ),
        section(
          'gallery',
          {
            heading: 'Details',
            layout: 'strip',
            items: withIds('gal', [
              { image: galleryArt('atelier-g1', pal, 'arches', 'Arched window', true), caption: 'Casa Laje, west window' },
              { image: galleryArt('atelier-g2', pal, 'contours', 'Vault detail', true), caption: 'Mercado Norte, restored vault' },
              { image: galleryArt('atelier-g3', pal, 'blocks', 'Stair detail', true), caption: 'Atlas Library, reading stair' },
              { image: galleryArt('atelier-g4', pal, 'stripes', 'Timber screen', true), caption: 'Pátio Studios, timber screen' },
            ]),
          },
          { width: 'full', animation: { type: 'fade' } },
        ),
        section(
          'services',
          {
            heading: 'How we work',
            intro: '',
            items: withIds<ServiceItem>('svc', [
              { title: 'Concept & feasibility', description: 'Site study, brief, massing options and an honest budget before anyone commits.', icon: 'map-pin', price: '' },
              { title: 'Design & licensing', description: 'Full architectural design, consultants and planning approval.', icon: 'pen', price: '' },
              { title: 'Construction', description: 'Tender, site supervision and every detail through to handover.', icon: 'layers', price: '' },
            ]),
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'timeline',
          {
            heading: 'Milestones',
            items: withIds<TimelineItem>('tl', [
              { date: '2016', title: 'Studio founded', description: 'After eight years at Aires Mateus.' },
              { date: '2019', title: 'Quinta do Vale opens', description: 'First winery; Douro architecture prize.' },
              { date: '2023', title: 'FAD Award shortlist', description: 'For the Atlas Library.' },
            ]),
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section('testimonials', { heading: 'Clients', layout: 'single', items: [quote({ quote: 'Clara listened for months before drawing a line. The house feels like it has always been there.', author: 'Rita & João Lopes', role: 'Clients', company: 'Casa Laje' })] }, { background: 'surface', animation: { type: 'fade' } }),
        section(
          'experience',
          {
            heading: 'Practice',
            intro: '',
            style: 'compact',
            items: [
              job({ company: 'Clara Moniz Arquitetura', role: 'Founder & Principal', location: 'Lisbon', start: '2016-01', current: true, description: 'Residential, civic and adaptive-reuse projects.' }),
              job({ company: 'Aires Mateus', role: 'Senior Architect', location: 'Lisbon', start: '2008-02', end: '2015-12', description: 'Houses and cultural buildings in Portugal and France.' }),
            ],
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section('education', { heading: 'Education', items: [school({ institution: 'Faculdade de Arquitetura, Universidade de Lisboa', degree: 'MArch', field: 'Architecture', location: 'Lisbon', start: '2002-09', end: '2008-01' })] }, { width: 'narrow', animation: { type: 'fade' } }),
        section('contact', { heading: 'Begin with a conversation', body: 'Tell us about your site and what you hope to build. We take on four new projects a year.', email: 'studio@claramoniz.pt', phone: '+351 21 000 0000', location: 'Rua das Flores 12, Lisbon', showForm: true }, { width: 'narrow', animation: { type: 'fade' } }),
        section('social', { heading: 'Follow the studio', style: 'list', items: [social('Instagram', 'https://instagram.com/claramoniz.arq'), social('LinkedIn', 'https://www.linkedin.com/in/claramoniz')] }),
      ],
    });
  },
};
