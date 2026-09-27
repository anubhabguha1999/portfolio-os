import type { PortfolioTemplate } from './types';
import type { AchievementItem, CertificationItem, StatItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, job, school, quote, social, withIds } from './build';
import { ogArt, paletteFor, portrait } from './art';

const THEME = 'executive';

/** Executive — a boardroom-ready operator profile. */
export const executiveTemplate: PortfolioTemplate = {
  id: 'executive',
  name: 'Executive',
  description: 'Navy and slate with a refined serif, quantified results up front and endorsements from the board. Structured, calm and credible.',
  audience: 'Executives, operators & consultants',
  themeId: THEME,
  tags: ['Light', 'Serif', 'Leadership', 'Professional'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Evelyn Achterberg';
    const fade = { type: 'fade' as const, duration: 600 };
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — Chief Operating Officer`,
        description: 'Evelyn Achterberg is a COO who scales logistics and fintech companies from Series B to profitability across Europe and North America.',
        keywords: ['chief operating officer', 'COO', 'operations', 'scale-up', 'logistics', 'fintech', 'board advisor'],
        author: name,
        favicon: '◆',
        ogImage: ogArt(name, 'Chief Operating Officer', pal, 'dashboard'),
      },
      navigation: { style: 'bar', brand: 'Evelyn Achterberg' },
      footer: { text: '© Evelyn Achterberg. Speaking and board enquiries via the contact form.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Chief Operating Officer · Amsterdam',
            name,
            title: 'Operator for the stage where growth gets expensive.',
            description: 'Fifteen years building the operating systems behind high-growth companies — the teams, metrics and rhythms that turn momentum into margin. Currently COO at Freightline, the digital freight network for mid-market shippers.',
            image: portrait(name, pal, 'serif', 'Monogram portrait of Evelyn Achterberg in navy and slate'),
            layout: 'split',
            background: 'gradient',
            ctas: [cta('Track record', '#experience'), cta('Board & advisory', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { ...fade, trigger: 'load' } },
        ),
        section(
          'stats',
          {
            heading: 'At a glance',
            items: withIds<StatItem>('st', [
              { value: '€310', suffix: 'M', label: 'Annual revenue under operational leadership' },
              { value: '1,400', suffix: '', label: 'People across 9 countries' },
              { value: '+18', suffix: ' pts', label: 'EBITDA margin improvement at Freightline' },
              { value: '3', suffix: '', label: 'Companies taken to profitability' },
            ]),
          },
          { background: 'inverted', animation: fade },
        ),
        section(
          'about',
          {
            heading: 'How I lead',
            body: 'I joined my first scale-up as its 40th employee and its first operations hire. Since then I have learned that most growth problems are really **clarity** problems: nobody knows which three numbers matter this quarter, or who owns them.\n\nMy approach is simple and unglamorous — a small set of shared metrics, a weekly operating rhythm, and leaders trusted to make decisions close to the customer.',
            layout: 'split',
            highlights: ['Built four executive teams from scratch', 'Led two cross-border acquisitions and integrations', 'Non-executive director at a Nasdaq-listed payments company', 'Mentor with the Women in Operations Network'],
          },
          { animation: fade },
        ),
        section(
          'experience',
          {
            heading: 'Leadership experience',
            intro: 'Selected roles. Numbers are audited or taken from public filings.',
            style: 'cards',
            items: [
              job({ company: 'Freightline', role: 'Chief Operating Officer', location: 'Amsterdam', start: '2021-04', current: true, description: 'Responsible for operations, carrier network, customer success and people across 6 markets.', achievements: ['Grew revenue from €120M to €310M while reaching EBITDA break-even in 30 months', 'Reduced cost per shipment by 22% through network redesign and automation', 'Integrated the acquisition of Polish carrier platform Trasa within 5 months'] }),
              job({ company: 'Monetra', role: 'VP Operations', location: 'London', start: '2017-09', end: '2021-03', description: 'Ran payments operations, risk and support for a B2B fintech processing €14B a year.', achievements: ['Cut fraud losses by 41% while halving false positives', 'Scaled the operations team from 60 to 380 people across three hubs', 'Led regulatory licensing in four EU jurisdictions'] }),
              job({ company: 'Hollis & Grant', role: 'Engagement Manager', location: 'Rotterdam', start: '2013-01', end: '2017-08', description: 'Operations strategy consulting for logistics, retail and industrial clients.', achievements: ['Delivered a €60M working-capital programme for a European retailer', 'Promoted twice in four years'] }),
              job({ company: 'Kade Logistics', role: 'Operations Analyst → Head of Planning', location: 'Rotterdam', start: '2009-07', end: '2012-12', description: 'Warehouse and transport planning for a regional 3PL.', achievements: ['Introduced demand forecasting that improved on-time delivery from 86% to 97%'] }),
            ],
          },
          { background: 'surface', animation: fade },
        ),
        section(
          'achievements',
          {
            heading: 'Recognition',
            items: withIds<AchievementItem>('ach', [
              { title: 'Operations Leader of the Year', description: 'European Supply Chain Awards, for the Freightline network redesign.', date: '2024-10', url: '' },
              { title: 'Top 50 Women in Fintech', description: 'Named by the Payments Leadership Forum for work on fraud and compliance at Monetra.', date: '2020-03', url: '' },
              { title: 'Keynote, Future of Freight Summit', description: 'Spoke to 2,000 attendees on building profitable digital logistics networks.', date: '2023-06', url: '' },
              { title: 'Non-Executive Director, Clearwell Payments', description: 'Appointed to the board and audit committee of a listed payments company.', date: '2022-01', url: '' },
            ]),
          },
          { animation: fade },
        ),
        section(
          'testimonials',
          {
            heading: 'What colleagues say',
            layout: 'grid',
            items: [
              quote({ quote: 'Evelyn gave us an operating cadence the whole company could follow. Our board meetings went from reviewing problems to making decisions.', author: 'Pieter van Houten', role: 'CEO & co-founder', company: 'Freightline', avatar: portrait('Pieter van Houten', pal, 'serif', 'Monogram portrait of Pieter van Houten') }),
              quote({ quote: 'The rare operator who is equally credible with regulators, engineers and the front line. She makes hard trade-offs look calm.', author: 'Amara Osei', role: 'Chair of the Board', company: 'Monetra', avatar: portrait('Amara Osei', pal, 'serif', 'Monogram portrait of Amara Osei') }),
              quote({ quote: 'On our audit committee, Evelyn asks the question everyone else was circling around — and then helps answer it.', author: 'Lars Engström', role: 'Independent Director', company: 'Clearwell Payments', avatar: portrait('Lars Engström', pal, 'serif', 'Monogram portrait of Lars Engström') }),
            ],
          },
          { animation: fade },
        ),
        section(
          'education',
          {
            heading: 'Education',
            items: [
              school({ institution: 'INSEAD', degree: 'MBA', field: 'General Management', location: 'Fontainebleau', start: '2011-09', end: '2012-07', grade: "Dean's List", description: 'Focus on operations strategy and entrepreneurship.' }),
              school({ institution: 'Delft University of Technology', degree: 'MSc', field: 'Transport, Infrastructure & Logistics', location: 'Delft', start: '2005-09', end: '2009-06', grade: 'Cum laude', description: '' }),
            ],
          },
          { width: 'narrow', animation: fade },
        ),
        section(
          'certifications',
          {
            heading: 'Board credentials',
            items: withIds<CertificationItem>('crt', [
              { name: 'International Director Programme', issuer: 'INSEAD Corporate Governance Centre', date: '2021-11', credentialId: 'IDP-C 2021', url: '' },
              { name: 'Lean Six Sigma Black Belt', issuer: 'Institute of Operational Excellence', date: '2014-05', credentialId: 'LSSBB-88214', url: '' },
            ]),
          },
          { width: 'narrow', animation: fade },
        ),
        section(
          'contact',
          {
            heading: 'Board, advisory & speaking',
            body: 'I take on a limited number of advisory and non-executive roles each year, and speak on scaling operations. Please include some context about your company and timeline.',
            email: 'office@achterberg.nl',
            location: 'Amsterdam, the Netherlands',
            availability: 'Open to one additional board seat in 2026',
            showForm: true,
          },
          { background: 'surface', animation: fade },
        ),
        section('social', {
          heading: '',
          style: 'buttons',
          items: [social('LinkedIn', 'https://www.linkedin.com/in/evelynachterberg')],
        }),
      ],
    });
  },
};
