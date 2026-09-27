import type { PortfolioTemplate } from './types';
import type { AchievementItem, GalleryItem, ServiceItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, work, quote, withIds } from './build';
import { cover, galleryArt, ogArt, paletteFor, portrait } from './art';

const THEME = 'luxury';

/** Luxury — an interior architecture atelier. Champagne on obsidian, slow reveals. */
export const luxuryTemplate: PortfolioTemplate = {
  id: 'luxury',
  name: 'Luxury',
  description: 'Champagne gold on obsidian, refined serif headlines and slow, deliberate reveals. Made for work that deserves a quiet room.',
  audience: 'Architects, interior designers & high-end studios',
  themeId: THEME,
  tags: ['Dark', 'Serif', 'Elegant', 'Gallery'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Isabelle Duarte-Vance';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: 'Atelier Duarte-Vance — Interior Architecture',
        description: 'Atelier Duarte-Vance designs hotels, private residences and restaurants where light, material and silence do most of the work.',
        keywords: ['interior architecture', 'hotel design', 'residential interiors', 'atelier', 'hospitality design', 'Lisbon', 'Paris'],
        author: name,
        favicon: '◇',
        ogImage: ogArt('Atelier Duarte-Vance', 'Interior Architecture', pal, 'arches'),
      },
      navigation: { style: 'minimal', brand: 'Duarte-Vance' },
      footer: { text: 'Atelier Duarte-Vance · Lisbon & Paris · By appointment' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Interior Architecture · Lisbon & Paris',
            name: 'Atelier Duarte-Vance',
            title: 'Rooms that ask you to slow down.',
            description: 'For fifteen years we have shaped hotels, private residences and restaurants around one conviction: that the finest luxury is calm.',
            layout: 'centered',
            background: 'spotlight',
            ctas: [cta('View commissions', '#projects'), cta('Arrange a consultation', '#contact', 'ghost')],
          },
          { paddingY: 'xl', align: 'center', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out', trigger: 'load' } },
        ),
        section(
          'about',
          {
            heading: 'The atelier',
            body: 'Isabelle Duarte-Vance founded the atelier in 2010 after a decade restoring historic interiors in Bordeaux. Today a studio of eleven architects, craftspeople and one very patient archivist works from a former cork warehouse in Lisbon.\n\nWe accept few commissions each year, and we see every one through personally — from the first survey drawing to the placement of the last vase.',
            image: portrait(name, pal, 'serif', 'Monogram portrait of Isabelle Duarte-Vance in champagne and charcoal tones'),
            layout: 'split',
            highlights: ['Six to eight commissions a year', 'Every material sampled on site', 'Furniture made by artisans within 300 km'],
          },
          { width: 'narrow', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'gallery',
          {
            heading: 'Studies in light',
            layout: 'grid',
            items: withIds<GalleryItem>('gal', [
              { image: galleryArt('lux-g1', pal, 'arches', 'Three gilded arches receding into shadow beneath a low sun'), caption: 'Colonnade, Hotel Almada — Lisbon' },
              { image: galleryArt('lux-g2', pal, 'contours', 'Concentric gold contour lines like travertine veining'), caption: 'Travertine study for the Quinta residence' },
              { image: galleryArt('lux-g3', pal, 'type', 'An oversized italic letter set against a champagne panel'), caption: 'Signage for Maison Orée restaurant' },
              { image: galleryArt('lux-g4', pal, 'arches', 'Tall arched niches outlined in thin gold rules'), caption: 'Library niches, Rue de Varenne apartment' },
              { image: galleryArt('lux-g5', pal, 'contours', 'Soft rippled gold lines on obsidian, suggesting water'), caption: 'Spa pool, Hotel Almada' },
              { image: galleryArt('lux-g6', pal, 'mesh', 'Warm blurred amber light pooling across a dark surface'), caption: 'Evening light study, Sintra villa' },
            ]),
          },
          { width: 'wide', align: 'center', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'projects',
          {
            heading: 'Commissions',
            intro: 'Three recent works, each a collaboration with owners who were willing to wait for the right thing.',
            layout: 'editorial',
            items: [
              work({
                title: 'Hotel Almada',
                description: 'A 42-key boutique hotel inside an eighteenth-century merchant house on the Tagus. Original azulejos were restored tile by tile; everything new was made to recede.',
                image: cover('lux-almada', pal, 'arches', 'Gold arches framing a low sun, evoking the colonnade of Hotel Almada'),
                role: 'Interior architecture & FF&E',
                duration: '2021 — 2023',
                technologies: ['Hospitality', 'Heritage restoration', 'Bespoke furniture'],
                caseStudy: '### The brief\nThe owners wanted a hotel that felt like the house of a well-travelled aunt — not a hotel at all.\n\n### The approach\nWe kept the plan almost untouched and concentrated the budget on light: hand-blown glass sconces, limewash walls that change colour through the day, and linen curtains dyed in the Alentejo.\n\n### The result\nNamed one of the *Condé Traveller Hot List* openings of 2023; occupancy has held above 88% since launch.',
                features: ['1,200 azulejos restored in place', 'Furniture by nine Portuguese workshops', 'Zero-VOC lime and clay finishes'],
                featured: true,
              }),
              work({
                title: 'Rue de Varenne apartment',
                description: 'A 280 m² Haussmann apartment for a collector of Japanese ceramics. Oak joinery, library niches and lighting designed around 60 individual objects.',
                image: cover('lux-varenne', pal, 'contours', 'Flowing gold contour lines, like the grain of fumed oak'),
                role: 'Architecture & interiors',
                duration: '2022 — 2024',
                technologies: ['Residential', 'Joinery', 'Museum lighting'],
                caseStudy: '### A home built around a collection\nEvery niche was dimensioned to a specific piece, then lit at 2700 K with glare-free optics adapted from museum practice.\n\n### Materials\nFumed oak, Pierre de Bourgogne limestone and hand-troweled tadelakt in the bathrooms.',
              }),
              work({
                title: 'Maison Orée',
                description: 'A 34-cover tasting-menu restaurant in Porto. Dark walnut, brass and a single ribbon of light above the pass that guests remember more than the view.',
                image: cover('lux-oree', pal, 'type', 'An elegant italic initial on a split champagne and charcoal panel'),
                role: 'Interior architecture & identity',
                duration: '2023',
                technologies: ['Restaurant', 'Lighting design', 'Brass metalwork'],
                caseStudy: '### Designing for four hours\nA tasting menu lasts an evening, so we designed for acoustics first: absorbent wool panels are hidden behind walnut slats, keeping conversation below 55 dB at a full room.\n\n### Recognition\nAwarded its first Michelin star eleven months after opening.',
              }),
            ],
          },
          { animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'services',
          {
            heading: 'How we work',
            intro: 'Every commission begins with a site visit and a conversation, never with a mood board.',
            items: withIds<ServiceItem>('svc', [
              { title: 'Hospitality', description: 'Hotels, restaurants and members’ clubs, from concept and brand narrative to opening-day styling.', icon: 'star', price: 'By proposal' },
              { title: 'Private residences', description: 'Apartments, townhouses and country homes, including joinery, lighting and curated art placement.', icon: 'heart', price: 'By proposal' },
              { title: 'Heritage restoration', description: 'Sensitive interventions in listed buildings, working alongside conservation authorities.', icon: 'shield', price: 'By proposal' },
            ]),
          },
          { background: 'surface', align: 'center', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'testimonials',
          {
            heading: 'In their words',
            layout: 'single',
            items: [
              quote({
                quote: 'Isabelle heard what we could not quite say. Guests arrive at Almada and lower their voices without being asked — that is the atelier’s gift.',
                author: 'Duarte Albuquerque',
                role: 'Owner',
                company: 'Hotel Almada',
                avatar: portrait('Duarte Albuquerque', pal, 'serif', 'Monogram portrait of Duarte Albuquerque'),
              }),
            ],
          },
          { width: 'narrow', align: 'center', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'achievements',
          {
            heading: 'Press & recognition',
            items: withIds<AchievementItem>('ach', [
              { title: 'Condé Traveller Hot List', description: 'Hotel Almada named among the best new hotels in the world.', date: '2023-05', url: '' },
              { title: 'Prix Versailles — Interiors, Europe', description: 'Shortlisted for Maison Orée in the restaurants category.', date: '2024-03', url: '' },
              { title: 'Architectural Review Portugal', description: 'Twelve-page feature on the atelier’s approach to heritage.', date: '2022-10', url: '' },
              { title: 'Michelin star, Maison Orée', description: 'Awarded to the restaurant eleven months after opening.', date: '2024-02', url: '' },
            ]),
          },
          { animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
        section(
          'contact',
          {
            heading: 'Arrange a consultation',
            body: 'We take on a small number of commissions each year. Share a little about your project and timeline, and Isabelle will reply personally.',
            email: 'studio@duarte-vance.com',
            phone: '+351 21 000 4812',
            location: 'Rua da Boavista 84, Lisbon',
            availability: 'Accepting commissions for 2026',
            showForm: true,
          },
          { width: 'narrow', align: 'center', animation: { type: 'reveal', duration: 1100, easing: 'ease-in-out' } },
        ),
      ],
    });
  },
};
