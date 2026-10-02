import type { PortfolioTemplate } from './types';
import { buildPortfolio, section, cta, job, work, school, quote, social, withIds } from './build';
import { cover, galleryArt, ogArt, paletteFor, portrait } from './art';
import type { ServiceItem } from '@/types/portfolio';

const THEME = 'monograph';

const WORDS = ['Brand identity', 'Art direction', 'Editorial design', 'Type systems', 'Packaging', 'Motion'];

/** Oversized marquee of disciplines. The second copy is decorative (hidden from screen readers) so the loop is seamless. */
const MARQUEE_HTML = `<div class="marquee">
  <p class="sr">${WORDS.join(', ')}</p>
  <div class="track" aria-hidden="true">${[0, 1]
    .map(() => WORDS.map((w) => `<span class="w">${w}</span><span class="star">✺</span>`).join(''))
    .join('')}</div>
</div>`;

const MARQUEE_CSS = `.custom-content { max-width: none; }
.marquee { overflow: hidden; border-block: 1px solid var(--c-text); padding-block: 18px; mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.track { display: flex; width: max-content; align-items: center; gap: 36px; animation: mono-marquee 38s linear infinite; }
.w { font-family: var(--font-heading); font-size: clamp(2.6rem, 8vw, 6.5rem); line-height: 1; letter-spacing: -0.03em; white-space: nowrap; color: var(--c-text); }
.w:nth-of-type(3n + 2) { font-style: italic; color: var(--c-primary); }
.star { font-size: clamp(1.4rem, 3vw, 2.4rem); color: var(--c-primary); }
@keyframes mono-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .track { animation: none; flex-wrap: wrap; width: auto; } }`;

/** Monograph — an editorial, type-led page for designers and art directors. */
export const monographTemplate: PortfolioTemplate = {
  id: 'monograph',
  name: 'Monograph',
  description: 'Warm paper, oversized serif display, a single signal red and a giant marquee — like a printed monograph of your work.',
  audience: 'Brand designers, art directors & illustrators',
  themeId: THEME,
  tags: ['Light', 'Serif', 'Editorial', 'Designer', 'Animated', 'Premium'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Noor Haddad';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Brand & Art Direction`,
        description: 'Noor Haddad is an independent brand designer and art director in Amsterdam, making identities, type systems and editorial work for cultural and consumer brands.',
        keywords: ['brand designer', 'art director', 'identity', 'typography', 'editorial design', 'Amsterdam'],
        author: name,
        favicon: '✺',
        ogImage: ogArt(name, 'Brand & Art Direction', pal, 'type'),
      },
      navigation: { style: 'minimal', brand: 'Noor Haddad' },
      footer: { text: '© {year} Noor Haddad Studio. Set in Playfair Display and Helvetica.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Independent studio · Amsterdam',
            name,
            title: 'Identities with a point of view, and the systems to keep them sharp.',
            description: 'Brand and art direction for cultural institutions, publishers and consumer brands that would rather be remembered than liked.',
            layout: 'bold',
            background: 'none',
            availability: 'Booking projects from November',
            ctas: [cta('Index of work', '#projects'), cta('Start a project', 'mailto:studio@noorhaddad.com', 'ghost')],
          },
          { paddingY: 'xl', animation: { type: 'reveal', duration: 900 } },
        ),
        section('custom', { heading: '', mode: 'html', content: MARQUEE_HTML, css: MARQUEE_CSS }, { width: 'full', paddingY: 'sm', showInNav: false, animation: { type: 'none' } }, 'Disciplines'),
        section(
          'projects',
          {
            heading: 'Index',
            intro: 'Selected commissions, 2019 — now.',
            layout: 'editorial',
            items: [
              work({ title: 'Rijksfoto Biennale', description: 'Identity, wayfinding and catalogue for a photography biennale across eleven venues. A variable typeface that bends with each exhibition theme.', image: cover('mono-biennale', pal, 'type', 'Oversized red letterforms on paper'), role: 'Creative direction', duration: '2024', technologies: ['Identity', 'Wayfinding', 'Print'], featured: true }),
              work({ title: 'Haven Coffee Roasters', description: 'Rebrand and 40-SKU packaging system. Sales up 27% in the first year in retail.', image: cover('mono-haven', pal, 'blocks', 'Stacked colour blocks like packaging'), role: 'Brand & packaging', duration: '2023', technologies: ['Identity', 'Packaging'] }),
              work({ title: 'Kanaal Magazine', description: 'Art direction and a modular grid for a quarterly architecture magazine, now in its twelfth issue.', image: cover('mono-kanaal', pal, 'stripes', 'Editorial stripes and columns'), role: 'Art direction', duration: '2021 — now', technologies: ['Editorial', 'Type'] }),
              work({ title: 'Ostra Seafood Bar', description: 'Naming, logo and interiors graphics for a Michelin Bib Gourmand restaurant.', image: cover('mono-ostra', pal, 'arches', 'Arched shapes in red and ink'), role: 'Brand', duration: '2022', technologies: ['Naming', 'Identity'] }),
            ],
          },
          { animation: { type: 'reveal', duration: 750 } },
        ),
        section(
          'about',
          {
            heading: 'Studio',
            body: '“Good identities are opinionated. Great ones are also **easy to use** on a Tuesday afternoon by someone who has never met you.”\n\nI run a small studio of three. Every project starts with a week of listening and ends with a system, not a logo: type, colour, grid and tone, documented so in-house teams can carry it forward.',
            image: portrait('Noor Haddad', pal, 'serif', 'Monogram portrait of Noor Haddad'),
            layout: 'quote',
            highlights: ['Clients in 9 countries', 'ADC & D&AD shortlisted', 'Guest lecturer, Rietveld Academie'],
          },
          { background: 'surface', animation: { type: 'fade' } },
        ),
        section(
          'services',
          {
            heading: 'What I do',
            intro: 'Fixed-scope engagements with a clear end, or a retainer when you need a creative director on call.',
            items: withIds<ServiceItem>('svc', [
              { title: 'Brand identity', description: 'Strategy, naming, logo, type and colour, delivered as a living guideline.', icon: 'pen', price: 'from €18k' },
              { title: 'Art direction', description: 'Campaigns, shoots and editorial direction with a consistent visual voice.', icon: 'camera', price: 'from €900 / day' },
              { title: 'Type systems', description: 'Custom lettering and variable fonts that stretch with your brand.', icon: 'layers', price: 'by scope' },
            ]),
          },
          { animation: { type: 'slide' } },
        ),
        section(
          'gallery',
          {
            heading: 'Studio wall',
            layout: 'masonry',
            items: withIds('gal', [
              { image: galleryArt('mono-g1', pal, 'type', 'Type specimen', true), caption: 'Biennale type specimen' },
              { image: galleryArt('mono-g2', pal, 'blocks', 'Packaging range'), caption: 'Haven packaging range' },
              { image: galleryArt('mono-g3', pal, 'stripes', 'Magazine spread', true), caption: 'Kanaal, issue 9' },
              { image: galleryArt('mono-g4', pal, 'arches', 'Restaurant signage'), caption: 'Ostra signage' },
            ]),
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'testimonials',
          { heading: 'Clients', layout: 'single', items: [quote({ quote: 'Noor gave us an identity our curators actually fight to use. Three biennales later, it still feels new.', author: 'Lotte de Vries', role: 'Director', company: 'Rijksfoto Biennale', avatar: portrait('Lotte de Vries', pal, 'serif') })] },
          { background: 'inverted', animation: { type: 'fade' } },
        ),
        section(
          'experience',
          {
            heading: 'Practice',
            intro: '',
            style: 'compact',
            items: [
              job({ company: 'Noor Haddad Studio', role: 'Founder & Creative Director', location: 'Amsterdam', start: '2020-01', current: true, description: 'Independent studio for identity and editorial work.' }),
              job({ company: 'Studio Dumbar', role: 'Senior Designer', location: 'Rotterdam', start: '2016-03', end: '2019-12', description: 'Identities for public institutions and cultural clients.' }),
            ],
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section('education', { heading: 'Education', items: [school({ institution: 'Gerrit Rietveld Academie', degree: 'BA', field: 'Graphic Design', location: 'Amsterdam', start: '2012-09', end: '2016-06' })] }, { width: 'narrow', animation: { type: 'fade' } }),
        section('contact', { heading: 'Have something to make?', body: 'Tell me about the brief, the timeline and what success looks like. I take on six projects a year.', email: 'studio@noorhaddad.com', location: 'Amsterdam, NL', availability: 'Booking from November', showForm: true }, { width: 'narrow', animation: { type: 'reveal' } }),
        section('social', { heading: 'Follow', style: 'list', items: [social('Instagram', 'https://instagram.com/noorhaddad.studio'), social('Behance', 'https://behance.net/noorhaddad'), social('LinkedIn', 'https://www.linkedin.com/in/noorhaddad')] }),
      ],
    });
  },
};
