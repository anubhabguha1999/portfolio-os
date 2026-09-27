import type { PortfolioTemplate } from './types';
import type { GalleryItem, ServiceItem, StatItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, work, quote, social, withIds } from './build';
import { cover, galleryArt, ogArt, paletteFor, portrait } from './art';

const THEME = 'creative-studio';

/** Creative — a two-person illustration and branding studio. */
export const creativeTemplate: PortfolioTemplate = {
  id: 'creative',
  name: 'Creative',
  description: 'Bold colour blocking, a playful display face, an aurora hero and a masonry wall of work. Confident, warm and a little bit loud.',
  audience: 'Illustrators, brand designers & studios',
  themeId: THEME,
  tags: ['Light', 'Colourful', 'Design', 'Animated'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Noa Ferreira';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: 'Noa Ferreira — Illustration & Brand Studio',
        description: 'Noa Ferreira runs Studio Pomelo, a two-person illustration and brand identity studio in Porto working with food, culture and climate brands.',
        keywords: ['illustration', 'brand identity', 'design studio', 'packaging', 'Porto', 'editorial illustration'],
        author: name,
        favicon: '🍊',
        ogImage: ogArt('Studio Pomelo', 'Illustration & Brand Identity', pal, 'blocks'),
      },
      navigation: { style: 'floating', brand: 'Studio Pomelo' },
      footer: { text: '© Studio Pomelo, Porto. Drawn with too much coffee.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Studio Pomelo · Porto',
            name: 'Noa Ferreira',
            title: 'Brands with a pulse, drawn by hand.',
            description: 'I’m an illustrator and brand designer. Together with my partner Rui, we make identities, packaging and murals for companies that would rather be loved than merely recognised.',
            layout: 'bold',
            background: 'aurora',
            magneticButtons: true,
            availability: 'Booking projects from September',
            ctas: [cta('See the work', '#projects'), cta('Start a project', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { type: 'scale', duration: 650, easing: 'spring', trigger: 'load' } },
        ),
        section(
          'services',
          {
            heading: 'What we make',
            intro: 'Small studio, full attention. Every project is led by the two people you meet on the first call.',
            items: withIds<ServiceItem>('svc', [
              { title: 'Brand identity', description: 'Naming support, logo systems, colour, type and the guidelines to keep it all consistent.', icon: 'palette', price: 'From €9k' },
              { title: 'Illustration systems', description: 'A library of drawings, patterns and characters your team can reuse for years.', icon: 'pen', price: 'From €6k' },
              { title: 'Packaging', description: 'Labels, boxes and shelf presence — designed with the printer in the room from day one.', icon: 'layers', price: 'From €4k per SKU range' },
              { title: 'Murals & spaces', description: 'Large-format painted and printed walls for restaurants, offices and public buildings.', icon: 'sparkles', price: 'Quoted per wall' },
            ]),
          },
          { background: 'gradient', animation: { type: 'stagger', duration: 650, easing: 'spring' } },
        ),
        section(
          'projects',
          {
            heading: 'Recent work',
            intro: '',
            layout: 'masonry',
            items: [
              work({ title: 'Mercado Sol', description: 'Identity and 40 hand-drawn produce illustrations for a covered food market reopening after a decade-long restoration.', image: cover('cr-mercado', pal, 'blocks', 'Bold geometric composition of coral, blue and green shapes'), role: 'Identity & illustration', duration: '2025', technologies: ['Identity', 'Signage', 'Illustration'], featured: true }),
              work({ title: 'Kelp & Co. Seaweed Snacks', description: 'Packaging for a regenerative seaweed farm. Sales tripled in the first year on shelves across Iberia.', image: cover('cr-kelp', pal, 'waves', 'Layered wave shapes in coral, blue and green'), role: 'Packaging', duration: '2024', technologies: ['Packaging', 'Character design'] }),
              work({ title: 'Festival Ruído', description: 'A shape-shifting visual system for an experimental music festival: 60 posters, one grid, zero repeats.', image: cover('cr-ruido', pal, 'mesh', 'Soft blurred colour fields of coral and violet'), role: 'Art direction', duration: '2024', technologies: ['Posters', 'Motion'] }),
              work({ title: 'Casa Lume Bakery', description: 'A warm, crumb-covered identity for a neighbourhood bakery, from the paper bags to the neon sign.', image: cover('cr-lume', pal, 'blocks', 'Grid of semicircles and triangles in warm tones'), role: 'Identity', duration: '2023', technologies: ['Identity', 'Print'] }),
              work({ title: 'Tide Tables Picture Book', description: 'Forty-eight illustrated pages about a lighthouse keeper’s daughter, published in four languages.', image: cover('cr-tide', pal, 'waves', 'Rolling layered waves suggesting the sea'), role: 'Illustrator', duration: '2023', technologies: ['Editorial', "Children's books"] }),
              work({ title: 'Verde Transit Mural', description: 'A 34-metre mural inside Porto’s newest metro interchange, painted over eleven nights.', image: cover('cr-verde', pal, 'mesh', 'Blurred green and blue gradient field'), role: 'Muralist', duration: '2022', technologies: ['Mural', 'Public art'] }),
            ],
          },
          { width: 'wide', animation: { type: 'magnetic', duration: 650 } },
        ),
        section(
          'gallery',
          {
            heading: 'From the sketchbook',
            layout: 'masonry',
            items: withIds<GalleryItem>('gal', [
              { image: galleryArt('cr-g1', pal, 'blocks', 'Sketchbook study of stacked geometric fruit shapes', true), caption: 'Fruit studies for Mercado Sol' },
              { image: galleryArt('cr-g2', pal, 'waves', 'Colour test of layered waves in coral and blue'), caption: 'Colour tests, Kelp & Co.' },
              { image: galleryArt('cr-g3', pal, 'mesh', 'Blurred gradient study in warm tones'), caption: 'Poster gradients, Ruído' },
              { image: galleryArt('cr-g4', pal, 'contours', 'Contour drawing of concentric wobbly rings', true), caption: 'Lighthouse beam sketches' },
              { image: galleryArt('cr-g5', pal, 'blocks', 'Bauhaus-style pattern of circles and triangles'), caption: 'Pattern library, Casa Lume' },
              { image: galleryArt('cr-g6', pal, 'orbit', 'Orbiting coloured dots around a coral centre'), caption: 'Motion keyframes for the festival app' },
            ]),
          },
          { background: 'surface', animation: { type: 'stagger', duration: 600 } },
        ),
        section(
          'about',
          {
            heading: 'Hi, I’m Noa',
            body: 'I grew up drawing on the backs of my grandmother’s fish-market receipts, and I still think the best brands feel like they were made by someone who cares about you.\n\nStudio Pomelo started in 2019 in a converted cork warehouse in Porto. It is just two of us, on purpose: **Rui** handles strategy and type, I handle drawing and colour, and we argue lovingly about everything else.',
            image: portrait(name, pal, 'serif', 'Monogram portrait of Noa Ferreira in coral and blue'),
            layout: 'split',
            highlights: ['Two designers, no account managers', 'Every drawing made by hand first', 'B Corp–certified clients get 10% off'],
          },
          { animation: { type: 'slide', duration: 650, easing: 'spring' } },
        ),
        section(
          'testimonials',
          {
            heading: 'Kind words',
            layout: 'carousel',
            items: [
              quote({ quote: 'Noa and Rui gave the market its personality back. Vendors ask for the fruit stickers by name.', author: 'Helena Marques', role: 'Director', company: 'Mercado Sol', avatar: portrait('Helena Marques', pal, 'sans', 'Monogram portrait of Helena Marques') }),
              quote({ quote: 'They understood seaweed better than our own marketing team. The packaging does the selling for us.', author: 'Jonas Albrecht', role: 'Co-founder', company: 'Kelp & Co.', avatar: portrait('Jonas Albrecht', pal, 'sans', 'Monogram portrait of Jonas Albrecht') }),
              quote({ quote: 'Sixty posters, every one of them a surprise, and every one delivered to the printer on time.', author: 'Inês Carvalho', role: 'Festival producer', company: 'Festival Ruído', avatar: portrait('Inês Carvalho', pal, 'sans', 'Monogram portrait of Inês Carvalho') }),
            ],
          },
          { animation: { type: 'scale', duration: 600 } },
        ),
        section(
          'stats',
          {
            heading: '',
            items: withIds<StatItem>('st', [
              { value: '70', suffix: '+', label: 'Brands drawn since 2019' },
              { value: '12', suffix: '', label: 'Murals painted' },
              { value: '4', suffix: '', label: 'Picture books published' },
              { value: '2', suffix: '', label: 'People, no exceptions' },
            ]),
          },
          { background: 'primary', paddingY: 'sm', animation: { type: 'stagger' } },
        ),
        section(
          'contact',
          {
            heading: 'Got a brand that needs a pulse?',
            body: 'Tell us about your project, timeline and budget range. We reply to every enquiry within three working days.',
            email: 'ola@studiopomelo.pt',
            location: 'Rua do Bonjardim, Porto',
            availability: 'Two slots open for autumn',
            showForm: true,
          },
          { animation: { type: 'scale', duration: 600 } },
        ),
        section('social', {
          heading: 'Follow along',
          style: 'buttons',
          items: [social('Instagram', 'https://www.instagram.com/studiopomelo'), social('Dribbble', 'https://dribbble.com/studiopomelo'), social('Behance', 'https://www.behance.net/studiopomelo')],
        }),
      ],
    });
  },
};
