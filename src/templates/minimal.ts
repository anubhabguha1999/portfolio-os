import type { PortfolioTemplate } from './types';
import { buildPortfolio, section, cta, job, work, skills, school, social } from './build';
import { cover, ogArt, paletteFor } from './art';

const THEME = 'minimal-developer';

/** Minimal — a quiet, content-first product engineer's page. */
export const minimalTemplate: PortfolioTemplate = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Quiet, precise and content-first. A single accent colour, generous whitespace and nothing to distract from the work.',
  audience: 'Product engineers & frontend developers',
  themeId: THEME,
  tags: ['Light', 'Sans-serif', 'Developer', 'Clean'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Maya Lindqvist';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Product Engineer`,
        description: 'Maya Lindqvist is a product engineer in Stockholm building fast, accessible interfaces for design tools and developer platforms.',
        keywords: ['product engineer', 'frontend', 'TypeScript', 'React', 'accessibility', 'design systems', 'Stockholm'],
        author: name,
        favicon: '◐',
        ogImage: ogArt(name, 'Product Engineer', pal, 'grid'),
      },
      navigation: { style: 'minimal', brand: 'Maya Lindqvist' },
      footer: { text: '© Maya Lindqvist. Built by hand, shipped as plain HTML.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Product Engineer · Stockholm',
            name,
            title: 'I build interfaces that feel obvious in hindsight.',
            description: 'Seven years turning messy product problems into calm, fast software. Currently leading the editor team at Fieldnote, a collaborative research tool used by 40,000 teams.',
            layout: 'minimal',
            background: 'none',
            availability: 'Open to staff-level roles from spring',
            ctas: [cta('Selected work', '#projects'), cta('Email me', 'mailto:maya@lindqvist.dev', 'ghost')],
          },
          { paddingY: 'xl', animation: { type: 'fade', duration: 600 } },
        ),
        section(
          'about',
          {
            heading: 'About',
            body: "I care about the parts of software people rarely notice: the 80 ms that makes a list feel instant, the focus ring that lands exactly where you expect, the empty state that tells you what to do next.\n\nBefore Fieldnote I spent four years at **Parcel Labs** building the dashboard that logistics teams live in all day. I studied interaction design, which mostly taught me to delete things.",
            layout: 'stacked',
            highlights: ['Accessibility is a feature, not a checklist', 'Performance budgets on every PR', 'Writes the docs before the code'],
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section(
          'projects',
          {
            heading: 'Selected work',
            intro: 'A few things I led end to end, from the first sketch to the release notes.',
            layout: 'minimal',
            items: [
              work({
                title: 'Fieldnote Editor 3.0',
                description: 'Rebuilt the collaborative document editor on a CRDT core. Typing latency dropped from 90 ms to 12 ms at the 99th percentile, and offline edits now merge without conflicts.',
                image: cover('minimal-editor', pal, 'grid', 'Abstract grid composition with a blue circle, representing the Fieldnote editor rebuild'),
                role: 'Tech lead',
                duration: '2023 — 2024',
                technologies: ['TypeScript', 'Yjs', 'ProseMirror', 'Web Workers'],
                live: 'https://fieldnote.app',
                featured: true,
              }),
              work({
                title: 'Parcel Labs Control Tower',
                description: 'A real-time operations dashboard tracking 2 million shipments a day. Introduced virtualised tables and a keyboard-first command bar that operators now use for 70% of actions.',
                image: cover('minimal-tower', pal, 'dashboard', 'Stylised dashboard with a line chart and three metric cards'),
                role: 'Senior frontend engineer',
                duration: '2020 — 2022',
                technologies: ['React', 'GraphQL', 'WebSockets', 'D3'],
              }),
              work({
                title: 'Quiet UI',
                description: 'An open-source set of 28 accessible React primitives with zero runtime styles. Adopted by a handful of Nordic public-sector teams for its WCAG 2.2 AA documentation.',
                image: cover('minimal-quiet', pal, 'orbit', 'Concentric rings with small coloured dots orbiting a centre point'),
                role: 'Author & maintainer',
                duration: 'Side project',
                technologies: ['React', 'ARIA', 'Storybook'],
                github: 'https://github.com/mayalindqvist/quiet-ui',
              }),
            ],
          },
          { animation: { type: 'slide', duration: 650 } },
        ),
        section(
          'experience',
          {
            heading: 'Experience',
            intro: '',
            style: 'compact',
            items: [
              job({
                company: 'Fieldnote',
                role: 'Staff Product Engineer',
                location: 'Stockholm',
                start: '2022-09',
                current: true,
                description: 'Leading a team of five across the editor, comments and offline sync.',
                achievements: ['Cut editor bundle size by 38% with route-level code splitting', 'Introduced accessibility review into the release process'],
                technologies: ['TypeScript', 'React', 'Yjs'],
              }),
              job({
                company: 'Parcel Labs',
                role: 'Senior Frontend Engineer',
                location: 'Gothenburg',
                start: '2018-06',
                end: '2022-08',
                description: 'Built and scaled the operator dashboard from a prototype to the core product.',
                achievements: ['Designed the internal component library used by four product teams', 'Mentored six engineers through their first year'],
                technologies: ['React', 'GraphQL', 'Node.js'],
              }),
              job({
                company: 'Studio Nordvind',
                role: 'Frontend Developer',
                location: 'Malmö',
                start: '2016-08',
                end: '2018-05',
                description: 'Websites and prototypes for cultural institutions and early-stage startups.',
                technologies: ['JavaScript', 'CSS', 'WordPress'],
              }),
            ],
          },
          { background: 'surface', animation: { type: 'fade' } },
        ),
        section(
          'skills',
          {
            heading: 'Toolbox',
            intro: '',
            display: 'grouped',
            items: [
              ...skills('Languages', [['TypeScript', 7], ['JavaScript', 9], ['CSS', 9], ['SQL', 4]]),
              ...skills('Frameworks', [['React', 7], ['Svelte', 2], ['Node.js', 5]]),
              ...skills('Practice', [['Accessibility (WCAG 2.2)', 6], ['Design systems', 5], ['Performance profiling', 5]]),
            ],
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'education',
          {
            heading: 'Education',
            items: [school({ institution: 'Umeå Institute of Design', degree: 'MFA', field: 'Interaction Design', location: 'Umeå', start: '2014-08', end: '2016-06', description: 'Thesis on keyboard-first interfaces for expert users.' })],
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section(
          'contact',
          {
            heading: 'Say hello',
            body: 'I read every email and reply within two working days. Best for roles, collaborations and conference talks.',
            email: 'maya@lindqvist.dev',
            location: 'Stockholm, Sweden',
            showForm: false,
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section('social', {
          heading: 'Elsewhere',
          style: 'list',
          items: [social('GitHub', 'https://github.com/mayalindqvist'), social('LinkedIn', 'https://www.linkedin.com/in/mayalindqvist'), social('Website', 'https://lindqvist.dev', 'lindqvist.dev')],
        }),
      ],
    });
  },
};
