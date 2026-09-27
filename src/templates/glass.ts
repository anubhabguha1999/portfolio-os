import type { PortfolioTemplate } from './types';
import type { ServiceItem, StatItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, job, work, skills, quote, withIds } from './build';
import { cover, ogArt, paletteFor, portrait } from './art';

const THEME = 'glass';

/** Glass — a product designer for AI-assisted tools. Frosted panels over an aurora. */
export const glassTemplate: PortfolioTemplate = {
  id: 'glass',
  name: 'Glass',
  description: 'Frosted translucent cards floating over soft aurora colour. Futuristic without being noisy — ideal for product and AI design work.',
  audience: 'Product designers & design engineers',
  themeId: THEME,
  tags: ['Dark', 'Animated', 'Designer', 'Glass'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Priya Ramanathan';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: `${name} — Product Designer, AI Tools`,
        description: 'Priya Ramanathan designs AI-assisted tools that keep people in control: clear intent, honest uncertainty and fast recovery from mistakes.',
        keywords: ['product design', 'AI UX', 'interaction design', 'design systems', 'prototyping', 'human-AI interaction'],
        author: name,
        favicon: '✧',
        ogImage: ogArt(name, 'Product Designer, AI Tools', pal, 'glass'),
      },
      navigation: { style: 'floating', brand: 'Priya R.' },
      footer: { text: '© Priya Ramanathan. Designed in Figma, exported without a single server.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Principal Product Designer at Lumen Labs',
            name,
            title: 'Designing AI tools people actually trust.',
            description: 'I help teams turn powerful models into products that explain themselves, admit uncertainty and make undo effortless. Nine years in product, four of them shipping AI features to millions.',
            image: portrait(name, pal, 'sans', 'Monogram portrait of Priya Ramanathan over violet and cyan light'),
            layout: 'split',
            background: 'aurora',
            availability: 'Taking advisory work',
            magneticButtons: true,
            ctas: [cta('See case studies', '#projects'), cta('Work with me', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { type: 'scale', duration: 700, trigger: 'load' } },
        ),
        section(
          'projects',
          {
            heading: 'Case studies',
            intro: 'Each project started with a model that could do something impressive, and a user who had no reason to believe it.',
            layout: 'grid',
            items: [
              work({
                title: 'Lumen Draft',
                description: 'An AI writing partner for legal teams that cites every suggestion back to the source clause. Suggestion acceptance rose from 18% to 61% after we made confidence visible.',
                image: cover('glass-draft', pal, 'glass', 'Frosted glass card floating over violet and pink light, representing Lumen Draft'),
                role: 'Design lead',
                duration: '2023 — 2024',
                technologies: ['Figma', 'Prompt design', 'Usability research'],
                featured: true,
              }),
              work({
                title: 'Semantic search for Orbitdocs',
                description: 'Replaced keyword search with natural-language answers across 12 million help articles, with a one-tap path back to the classic results.',
                image: cover('glass-search', pal, 'mesh', 'Soft blurred mesh of cyan and violet colour fields'),
                role: 'Senior product designer',
                duration: '2022',
                technologies: ['Figma', 'ProtoPie', 'A/B testing'],
              }),
              work({
                title: 'Undo for agents',
                description: 'A reversible action timeline for an autonomous scheduling assistant. Every action the agent takes can be previewed, paused or rolled back in one gesture.',
                image: cover('glass-undo', pal, 'glass', 'Translucent panel with a round control over pink and cyan blobs'),
                role: 'Concept & interaction design',
                duration: '2024',
                technologies: ['Framer', 'Motion design', 'Agent UX'],
              }),
              work({
                title: 'Clarity kit',
                description: 'An open design kit of 40 patterns for AI interfaces — streaming states, citations, confidence, feedback — downloaded by 9,000 designers.',
                image: cover('glass-kit', pal, 'mesh', 'Glowing gradient mesh with a thin frame, cover for the Clarity kit'),
                role: 'Author',
                duration: 'Ongoing',
                technologies: ['Figma', 'Design tokens', 'Documentation'],
                live: 'https://claritykit.design',
              }),
            ],
          },
          { width: 'wide', animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'services',
          {
            heading: 'How I can help',
            intro: '',
            items: withIds<ServiceItem>('svc', [
              { title: 'AI product audits', description: 'A two-week review of your AI feature: where trust breaks, where users stall, and what to fix first.', icon: 'sparkles', price: 'From $12k' },
              { title: 'Design sprints', description: 'From model capability to tested prototype in five days, with your engineers in the room.', icon: 'zap', price: 'From $18k' },
              { title: 'Team advisory', description: 'A monthly retainer for design leaders building their first AI-native product team.', icon: 'users', price: 'Monthly' },
            ]),
          },
          { background: 'gradient', animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'experience',
          {
            heading: 'Experience',
            intro: '',
            style: 'cards',
            items: [
              job({
                company: 'Lumen Labs',
                role: 'Principal Product Designer',
                location: 'San Francisco · Remote',
                start: '2022-11',
                current: true,
                description: 'Leading design for the Draft and Review products, and the design system behind them.',
                achievements: ['Grew design team from 3 to 11', 'Defined the company-wide AI interaction guidelines'],
                technologies: ['Figma', 'Framer', 'Research'],
              }),
              job({
                company: 'Orbitdocs',
                role: 'Senior Product Designer',
                location: 'Toronto',
                start: '2019-04',
                end: '2022-10',
                description: 'Owned search and self-serve support across the help centre.',
                achievements: ['Ticket volume down 23% after search relaunch', 'Shipped the first semantic search in the category'],
                technologies: ['Figma', 'ProtoPie', 'Amplitude'],
              }),
              job({
                company: 'Brightloop',
                role: 'Product Designer',
                location: 'Bangalore',
                start: '2016-01',
                end: '2019-03',
                description: 'Designed onboarding and payments for a fintech app with 4 million users.',
                technologies: ['Sketch', 'Principle'],
              }),
            ],
          },
          { animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'skills',
          {
            heading: 'Craft',
            intro: '',
            display: 'tags',
            items: [
              ...skills('Design', [['Interaction design'], ['Prototyping'], ['Design systems'], ['Motion design']]),
              ...skills('AI', [['Prompt design'], ['Evaluation design'], ['Agent UX'], ['Conversational UI']]),
              ...skills('Tools', [['Figma'], ['Framer'], ['ProtoPie'], ['SwiftUI previews']]),
            ],
          },
          { animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'testimonials',
          {
            heading: 'Kind words',
            layout: 'carousel',
            items: [
              quote({
                quote: 'Priya has a rare ability to make a model’s limitations feel like a feature. Our enterprise customers started trusting Draft the week her confidence indicators shipped.',
                author: 'Marcus Ellery',
                role: 'CEO',
                company: 'Lumen Labs',
                avatar: portrait('Marcus Ellery', pal, 'sans', 'Monogram portrait of Marcus Ellery'),
              }),
              quote({
                quote: 'She is the designer engineers want in the room. Her prototypes answer questions before we have finished asking them.',
                author: 'Hana Takeda',
                role: 'Staff Engineer',
                company: 'Orbitdocs',
                avatar: portrait('Hana Takeda', pal, 'sans', 'Monogram portrait of Hana Takeda'),
              }),
              quote({
                quote: 'Our audit with Priya reshaped the roadmap. Two weeks of work saved us two quarters of building the wrong thing.',
                author: 'Tomás Rivera',
                role: 'VP Product',
                company: 'Northwind Health',
                avatar: portrait('Tomás Rivera', pal, 'sans', 'Monogram portrait of Tomás Rivera'),
              }),
            ],
          },
          { background: 'gradient', animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'stats',
          {
            heading: '',
            items: withIds<StatItem>('st', [
              { value: '9', suffix: ' yrs', label: 'Designing products' },
              { value: '14', suffix: 'M', label: 'People using features I shipped' },
              { value: '40', suffix: '', label: 'Open AI design patterns' },
            ]),
          },
          { animation: { type: 'scale', duration: 700 } },
        ),
        section(
          'contact',
          {
            heading: 'Let’s build something trustworthy',
            body: 'Advisory, audits or a full-time conversation — tell me about the model and the people who will use it.',
            email: 'hello@priyaramanathan.design',
            location: 'San Francisco · Remote',
            showForm: true,
          },
          { width: 'narrow', align: 'center', animation: { type: 'scale', duration: 700 } },
        ),
      ],
    });
  },
};
