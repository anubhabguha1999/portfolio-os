import type { PortfolioTemplate } from './types';
import type { ServiceItem, TimelineItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, work, skills, social, withIds } from './build';
import { cover, ogArt, paletteFor } from './art';

const THEME = 'brutalist';

/** Brutalist — a one-person type foundry that also builds websites. Loud, blunt, gridded. */
export const brutalistTemplate: PortfolioTemplate = {
  id: 'brutalist',
  name: 'Brutalist',
  description: 'Heavy borders, hard shadows and shouty uppercase type. Work first, prices up front, zero ornament.',
  audience: 'Type designers, indie studios & web developers with opinions',
  themeId: THEME,
  tags: ['Light', 'Bold', 'Studio', 'Grid'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Otto Brandvold';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Type & Web, Foundry Brandvold`,
        description: 'Otto Brandvold draws typefaces and builds fast, uncompromising websites at Foundry Brandvold, a one-person studio in Bergen.',
        keywords: ['type design', 'typeface', 'font foundry', 'web development', 'variable fonts', 'brutalist web design', 'Bergen'],
        author: name,
        favicon: '■',
        ogImage: ogArt(name, 'Type & Web — Foundry Brandvold', pal, 'stripes'),
      },
      navigation: { style: 'bar', brand: 'FOUNDRY BRANDVOLD' },
      footer: { text: '© Foundry Brandvold. Set in Brandvold Grotesk. No cookies, no trackers, no nonsense.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'FOUNDRY BRANDVOLD — EST. 2017',
            name: 'TYPE THAT SHOUTS. SITES THAT LOAD.',
            title: 'I draw typefaces and build websites. One person, two crafts, no account managers.',
            description: 'Retail fonts used by 1,400 studios. Custom type for brands that are tired of looking like everyone else. Websites that weigh less than your logo file.',
            layout: 'bold',
            background: 'none',
            availability: 'BOOKING Q3 — TWO SLOTS LEFT',
            ctas: [cta('SEE THE WORK', '#projects'), cta('GET A QUOTE', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { type: 'slide', duration: 450, easing: 'linear', trigger: 'load' } },
        ),
        section(
          'projects',
          {
            heading: 'WORK',
            intro: 'Four recent jobs. Real clients, real deadlines, real kerning tables.',
            layout: 'featured',
            items: [
              work({
                title: 'Brandvold Grotesk',
                description: 'A nine-weight variable grotesque with ink traps that survive 6 pt newsprint and 600 pt billboards. 1,100 glyphs, Latin Extended, Greek and Cyrillic. Best-selling family in the foundry.',
                image: cover('brut-grotesk', pal, 'type', 'Giant italic letterform on a split yellow and white field, cover for Brandvold Grotesk'),
                role: 'Type designer',
                duration: '3 years, 2019 — 2022',
                technologies: ['Glyphs 3', 'Variable fonts', 'OpenType features'],
                live: 'https://brandvold.foundry/grotesk',
                features: ['Weight axis 100–900', 'Tabular and old-style figures', 'Stylistic set for single-storey a'],
                featured: true,
              }),
              work({
                title: 'Hordaland Transit wayfinding',
                description: 'Custom signage typeface and a static site for the regional ferry network. Legibility tested at 40 m in sideways rain. The timetable site ships 14 KB of JavaScript.',
                image: cover('brut-transit', pal, 'stripes', 'Diagonal black, yellow and orange bands with a bold sign panel in the foreground'),
                role: 'Type design & frontend',
                duration: '8 months, 2023',
                technologies: ['Glyphs 3', 'Astro', 'Web fonts subsetting'],
              }),
              work({
                title: 'Kvart Records',
                description: 'Identity type and an unapologetically loud storefront for an independent vinyl label. Every release page is generated from a single spreadsheet.',
                image: cover('brut-kvart', pal, 'blocks', 'Bauhaus-style grid of squares, circles and triangles in black, yellow and orange'),
                role: 'Designer & developer',
                duration: '3 months, 2024',
                technologies: ['Eleventy', 'CSS Grid', 'Snipcart'],
                live: 'https://kvartrecords.no',
              }),
              work({
                title: 'Specimen Machine',
                description: 'An open-source tool that turns a font file into a printable, browsable type specimen in one command. Used by six independent foundries.',
                image: cover('brut-specimen', pal, 'grid', 'Line grid with a circle, square and dashed construction line, like a type drawing'),
                role: 'Author',
                duration: 'Side project',
                technologies: ['TypeScript', 'opentype.js', 'Paged.js'],
                github: 'https://github.com/brandvold/specimen-machine',
              }),
            ],
          },
          { width: 'wide', animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section(
          'services',
          {
            heading: 'WHAT I SELL',
            intro: 'Fixed prices. Written scope. You get the source files.',
            items: withIds<ServiceItem>('svc', [
              { title: 'CUSTOM TYPEFACE', description: 'A display or text family drawn for your brand, with full language support and a licence you never renew.', icon: 'pen', price: 'FROM €18,000' },
              { title: 'WEBSITE', description: 'Design and build of a fast static site. Hand-written CSS, no page builder, Lighthouse 100 or I fix it free.', icon: 'code', price: 'FROM €9,500' },
              { title: 'TYPE AUDIT', description: 'Two days with your brand guidelines and product UI. You get a ruthless report and a better type scale.', icon: 'zap', price: '€2,400 FLAT' },
            ]),
          },
          { background: 'primary', animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section(
          'skills',
          {
            heading: 'TOOLS',
            intro: '',
            display: 'grid',
            items: [
              ...skills('Type', [['Glyphs 3', 8, 0, 'pen'], ['Variable fonts', 6, 0, 'layers'], ['OpenType feature code', 7, 0, 'code']]),
              ...skills('Web', [['HTML & CSS', 12, 0, 'code'], ['TypeScript', 6, 0, 'terminal'], ['Astro & Eleventy', 5, 0, 'rocket']]),
              ...skills('Print', [['Specimen design', 8, 0, 'book'], ['Offset & Risograph', 5, 0, 'layers']]),
            ],
          },
          { animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section(
          'about',
          {
            heading: 'WHY',
            body: '> Most websites look the same because most websites are made the same way. I would rather make fewer things, make them by hand, and make them unmistakable.\n\nI trained as a letterpress printer, taught myself to code, and started the foundry in a converted boathouse in 2017. I still answer every email myself.',
            layout: 'quote',
            highlights: [],
          },
          { background: 'inverted', animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section(
          'timeline',
          {
            heading: 'HOW WE GOT HERE',
            items: withIds<TimelineItem>('tl', [
              { date: '2012', title: 'LETTERPRESS APPRENTICE', description: 'Four years setting metal type by hand at Trykkeriet in Bergen.' },
              { date: '2016', title: 'FIRST FONT RELEASED', description: 'Fjell Mono, a free coding font. 40,000 downloads in the first year.' },
              { date: '2017', title: 'FOUNDRY BRANDVOLD OPENS', description: 'One desk, one boathouse, one very stubborn business plan.' },
              { date: '2022', title: 'BRANDVOLD GROTESK SHIPS', description: 'Three years of drawing. Now licensed by more than 1,400 studios.' },
              { date: '2024', title: 'TYPE DIRECTORS CLUB', description: 'Certificate of Excellence for the Hordaland Transit signage face.' },
            ]),
          },
          { background: 'surface', animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section(
          'contact',
          {
            heading: 'START A JOB',
            body: 'Tell me what you need, your deadline and your budget. I reply within 48 hours with a yes, a no, or a better idea.',
            email: 'otto@brandvold.foundry',
            location: 'Bergen, Norway',
            availability: 'Next opening: September',
            showForm: true,
          },
          { animation: { type: 'slide', duration: 450, easing: 'linear' } },
        ),
        section('social', {
          heading: 'ELSEWHERE',
          style: 'buttons',
          items: [
            social('Instagram', 'https://www.instagram.com/foundrybrandvold', 'INSTAGRAM'),
            social('GitHub', 'https://github.com/brandvold', 'GITHUB'),
            social('Website', 'https://brandvold.foundry', 'SHOP FONTS'),
          ],
        }),
      ],
    });
  },
};
