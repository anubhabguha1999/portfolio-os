import type { PortfolioTemplate } from './types';
import type { AchievementItem, BlogItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, job, work, quote, social, withIds } from './build';
import { cover, ogArt, paletteFor, portrait } from './art';

const THEME = 'editorial';

/** Editorial — a features editor's portfolio set like a magazine. */
export const editorialTemplate: PortfolioTemplate = {
  id: 'editorial',
  name: 'Editorial',
  description: 'Magazine typography with high-contrast serif headlines, a long reading measure and pull quotes. Built for people whose work is words.',
  audience: 'Writers, journalists & editors',
  themeId: THEME,
  tags: ['Light', 'Serif', 'Writing', 'Magazine'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Clara Moreau-Hughes';
    const reveal = { type: 'reveal' as const, duration: 900, easing: 'ease-in-out' as const };
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Features Editor & Design Writer`,
        description: 'Clara Moreau-Hughes writes long-form features on architecture, cities and the people who build them. Features editor at Plinth Quarterly.',
        keywords: ['design journalism', 'architecture writing', 'features editor', 'long-form', 'urbanism', 'essays'],
        author: name,
        favicon: '❦',
        ogImage: ogArt(name, 'Features Editor & Design Writer', pal, 'type'),
      },
      navigation: { style: 'bar', brand: 'C. Moreau-Hughes' },
      footer: { text: '© Clara Moreau-Hughes. All essays remain the property of their original publishers.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Features Editor, Plinth Quarterly',
            name,
            title: 'I write about buildings, and the quiet arguments hidden inside them.',
            description: 'Twelve years reporting on architecture, housing and public space for magazines in London, Lyon and Lisbon. My work asks who a building is really for — and who was left out of the room when it was drawn.',
            layout: 'bold',
            background: 'none',
            showSocial: false,
            ctas: [cta('Read the features', '#projects'), cta('Commission a piece', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { ...reveal, trigger: 'load' } },
        ),
        section(
          'about',
          {
            heading: 'A note on method',
            body: '"A building is the longest sentence a city ever writes. My job is to read it slowly, out loud, and to ask the people living in its margins what they think it means."\n\nI trained as an architect before I trained as a reporter, which means I can read a section drawing and a council budget with equal suspicion. I spend weeks on site, I pay for my own train tickets, and I never accept press trips.',
            layout: 'quote',
            highlights: [],
          },
          { width: 'narrow', align: 'center', animation: reveal },
        ),
        section(
          'projects',
          {
            heading: 'Features & essays',
            intro: 'Long-form reporting, commissioned and edited over months rather than days.',
            layout: 'editorial',
            items: [
              work({
                title: 'The Staircase That Saved an Estate',
                description: 'How residents of a condemned 1970s housing estate in south London used a single listed stairwell to halt a demolition — and redesign their own regeneration.',
                image: cover('ed-staircase', pal, 'arches', 'Repeating arches drawn in thin red lines, evoking a brutalist stairwell'),
                role: 'Writer · 9,400 words',
                duration: 'Plinth Quarterly, No. 38',
                technologies: ['Housing', 'Heritage', 'Community'],
                live: 'https://plinthquarterly.com/features/the-staircase',
                featured: true,
              }),
              work({
                title: 'Concrete Has a Memory',
                description: 'An essay on the carbon cost of demolition, told through three buildings in Lyon that were taken apart piece by piece and rebuilt elsewhere.',
                image: cover('ed-concrete', pal, 'contours', 'Topographic contour lines in red and ochre on warm paper'),
                role: 'Essayist',
                duration: 'Revue Béton, 2024',
                technologies: ['Reuse', 'Climate', 'Materials'],
              }),
              work({
                title: 'The Last Kiosk on Avenida Almirante',
                description: 'A portrait of Lisbon’s disappearing street kiosks and the families who have run them for four generations, photographed over one summer.',
                image: cover('ed-kiosk', pal, 'type', 'An oversized italic serif letter beside a block of red, like a magazine opener'),
                role: 'Writer & editor',
                duration: 'Atlas of Small Places, 2023',
                technologies: ['Street life', 'Portraiture'],
              }),
              work({
                title: 'Drawing the Line',
                description: 'A six-part series on planning inspectors — the unelected officials who quietly decide the shape of English towns.',
                image: cover('ed-line', pal, 'grid', 'A faint grid with a single dashed line connecting a square to a circle'),
                role: 'Series editor',
                duration: 'The Civic Review, 2022',
                technologies: ['Planning', 'Policy', 'Series'],
              }),
            ],
          },
          { width: 'wide', animation: reveal },
        ),
        section(
          'blog',
          {
            heading: 'Recent columns',
            intro: 'Shorter pieces from my fortnightly column, *Elevations*.',
            items: withIds<BlogItem>('blg', [
              { title: 'In praise of the boring façade', excerpt: 'Not every building needs to be a conversation piece. Some of the best ones simply hold the street together.', date: '2025-05', url: 'https://plinthquarterly.com/elevations/boring-facade', tags: ['Streetscape'] },
              { title: 'What the library knew', excerpt: 'Public libraries are the last indoor spaces where nobody expects you to buy anything. Architects should study them harder.', date: '2025-04', url: 'https://plinthquarterly.com/elevations/library', tags: ['Civic', 'Public space'] },
              { title: 'The tyranny of the render', excerpt: 'Glossy visualisations sell buildings before they exist. They also hide the parts that will age badly.', date: '2025-03', url: 'https://plinthquarterly.com/elevations/render', tags: ['Practice'] },
              { title: 'A bench is a policy decision', excerpt: 'Where a city lets you sit tells you exactly who it wants to stay.', date: '2025-02', url: 'https://plinthquarterly.com/elevations/bench', tags: ['Urbanism'] },
              { title: 'Notes from a retrofit', excerpt: 'Six months following a small team turning a 1960s office block into forty flats — without knocking anything down.', date: '2025-01', url: 'https://plinthquarterly.com/elevations/retrofit', tags: ['Reuse', 'Housing'] },
            ]),
          },
          { background: 'surface', animation: reveal },
        ),
        section(
          'testimonials',
          {
            heading: 'From the editors',
            layout: 'single',
            items: [
              quote({
                quote: 'Clara files the piece nobody else thought to pitch, reports it more thoroughly than anyone asked, and still hits the deadline with a sentence you want to underline.',
                author: 'Tomasz Wierzbicki',
                role: 'Editor-in-chief',
                company: 'The Civic Review',
                avatar: portrait('Tomasz Wierzbicki', pal, 'serif', 'Monogram portrait of Tomasz Wierzbicki'),
              }),
            ],
          },
          { background: 'inverted', width: 'narrow', align: 'center', animation: reveal },
        ),
        section(
          'experience',
          {
            heading: 'Mastheads',
            intro: '',
            style: 'alternating',
            items: [
              job({ company: 'Plinth Quarterly', role: 'Features Editor', location: 'London', start: '2021-01', current: true, description: 'Commissioning and editing the long-form section of an independent architecture quarterly.', achievements: ['Grew the features section from four to nine pieces per issue', 'Launched the reader-funded reporting fund, now backing six investigations a year'] }),
              job({ company: 'The Civic Review', role: 'Senior Writer', location: 'London', start: '2017-03', end: '2020-12', description: 'Reporting on planning, housing and local government across England.', achievements: ['Series “Drawing the Line” cited in a parliamentary select committee report'] }),
              job({ company: 'Revue Béton', role: 'Correspondent', location: 'Lyon', start: '2014-09', end: '2017-02', description: 'Bilingual coverage of French and Swiss architecture for a trade monthly.' }),
              job({ company: 'Atelier Rousset', role: 'Architectural Assistant', location: 'Lyon', start: '2012-06', end: '2014-08', description: 'Housing and school projects, from competition drawings to site visits.' }),
            ],
          },
          { animation: reveal },
        ),
        section(
          'achievements',
          {
            heading: 'Recognition',
            items: withIds<AchievementItem>('ach', [
              { title: 'Architecture Writer of the Year', description: 'Awarded by the Society of Built Environment Journalists for “The Staircase That Saved an Estate”.', date: '2024-11', url: '' },
              { title: 'Shortlisted, European Essay Prize', description: 'For “Concrete Has a Memory”, one of five essays shortlisted from 640 entries.', date: '2024-06', url: '' },
              { title: 'Fellow, Loomis Foundation for Urban Writing', description: 'A year-long fellowship funding reporting on post-industrial towns.', date: '2022-09', url: '' },
            ]),
          },
          { width: 'narrow', animation: reveal },
        ),
        section(
          'contact',
          {
            heading: 'Commissions & correspondence',
            body: 'I take on two or three commissioned features a year, plus the occasional talk or jury. Tips about buildings in trouble are always welcome — I protect my sources.',
            email: 'clara@moreauhughes.com',
            location: 'London & Lyon',
            availability: 'Accepting commissions for autumn issues',
            showForm: false,
          },
          { width: 'narrow', animation: reveal },
        ),
        section('social', {
          heading: 'Also found at',
          style: 'list',
          items: [social('Substack', 'https://elevations.substack.com', 'Elevations newsletter'), social('LinkedIn', 'https://www.linkedin.com/in/claramoreauhughes'), social('Instagram', 'https://www.instagram.com/clara.elevations')],
        }),
      ],
    });
  },
};
