import type { PortfolioTemplate } from './types';
import { buildPortfolio, section, cta, job, work, skills, school, quote, social, withIds } from './build';
import { cover, ogArt, paletteFor, portrait } from './art';
import type { CertificationItem, StatItem } from '@/types/portfolio';

const THEME = 'signal';

const BARS = [38, 44, 41, 52, 49, 58, 63, 61, 70, 74, 81, 88];

/** A KPI panel in plain HTML + inline SVG: numbers stay real text, colours come from the theme. */
const DASH_HTML = `<div class="dash">
  <div class="kpis">
    <div class="kpi"><p class="l">Forecast accuracy</p><p class="v">94.2<span>%</span></p><p class="d up">▲ 6.1 pts YoY</p></div>
    <div class="kpi"><p class="l">Churn, enterprise</p><p class="v">2.8<span>%</span></p><p class="d up">▼ 1.9 pts</p></div>
    <div class="kpi"><p class="l">Revenue influenced</p><p class="v">$14.6<span>M</span></p><p class="d">from 9 shipped models</p></div>
    <div class="kpi"><p class="l">Dashboards in use</p><p class="v">312</p><p class="d">across 14 teams</p></div>
  </div>
  <div class="panel chart">
    <p class="l">Weekly active customers · last 12 weeks (thousands)</p>
    <div class="bars">${BARS.map((h, i) => `<span style="--h:${h}%;--i:${i}" title="Week ${i + 1}: ${h}k"></span>`).join('')}</div>
  </div>
  <div class="panel spark">
    <p class="l">Model precision after retraining</p>
    <svg viewBox="0 0 240 70" role="img" aria-label="Line rising from 0.71 to 0.93 over eight releases"><polyline fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="4,58 36,52 68,54 100,40 132,36 164,28 196,18 236,8"></polyline><circle cx="236" cy="8" r="4"></circle></svg>
    <p class="v sm">0.71 → 0.93</p>
  </div>
</div>`;

const DASH_CSS = `.custom-content { max-width: none; }
.dash { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.kpis { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi, .panel { border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface); padding: 18px 18px 16px; }
.l { margin: 0; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-muted); }
.v { margin: 8px 0 4px; font-family: var(--font-mono); font-size: clamp(1.7rem, 3.6vw, 2.4rem); font-weight: 600; letter-spacing: -0.02em; color: var(--c-text); font-variant-numeric: tabular-nums; }
.v span { font-size: 0.55em; color: var(--c-muted); margin-left: 2px; }
.v.sm { font-size: 1.15rem; margin-top: 6px; }
.d { margin: 0; font-size: 0.8rem; color: var(--c-muted); }
.d.up { color: var(--c-primary); }
.chart { grid-column: span 2; }
.bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; align-items: end; height: 150px; margin-top: 16px; padding-bottom: 4px; border-bottom: 1px solid var(--c-border); background-image: linear-gradient(var(--c-border) 1px, transparent 1px); background-size: 100% 25%; }
.bars span { height: var(--h); border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 35%, transparent)); transform-origin: bottom; animation: sig-grow 0.9s cubic-bezier(.2,.8,.2,1) both; }
.bars span { animation-delay: calc(var(--i) * 45ms); }
.bars span:last-child { background: linear-gradient(180deg, var(--c-accent), color-mix(in srgb, var(--c-accent) 35%, transparent)); }
.spark svg { display: block; width: 100%; height: auto; margin-top: 14px; color: var(--c-secondary); }
.spark polyline { stroke: var(--c-secondary); }
.spark circle { fill: var(--c-accent); }
@keyframes sig-grow { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
@media (max-width: 860px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dash { grid-template-columns: 1fr; } .chart { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) { .bars span { animation: none; } }`;

/** Signal — a dashboard-styled page for data analysts and data scientists. */
export const signalTemplate: PortfolioTemplate = {
  id: 'signal',
  name: 'Signal',
  description: 'Deep navy dashboards with mono figures, a live-looking KPI panel and charts that grow in — your impact, in numbers.',
  audience: 'Data analysts, data scientists & analytics engineers',
  themeId: THEME,
  tags: ['Dark', 'Data', 'Mono', 'Animated', 'Premium'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Arjun Mehta';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: `${name} — Data Scientist`,
        description: 'Arjun Mehta is a data scientist in Bengaluru who builds forecasting and churn models and the dashboards teams use to act on them.',
        keywords: ['data scientist', 'analytics', 'forecasting', 'machine learning', 'SQL', 'Python', 'dbt', 'Bengaluru'],
        author: name,
        favicon: '◆',
        ogImage: ogArt(name, 'Data Scientist', pal, 'dashboard'),
      },
      navigation: { style: 'bar', brand: 'arjun.mehta', sticky: true },
      footer: { text: '© {year} Arjun Mehta. Built by hand, shipped as one HTML file.' },
      settings: { showThemeToggle: true },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Data scientist · Bengaluru',
            name,
            title: 'Models that move metrics, and dashboards people actually open.',
            description: 'Six years turning messy product data into forecasts, experiments and decisions. Currently leading growth analytics at Kirana Cloud.',
            layout: 'split',
            background: 'grid',
            image: portrait('Arjun Mehta', pal, 'mono', 'Monogram portrait of Arjun Mehta'),
            availability: 'Open to senior / lead roles',
            ctas: [cta('View case studies', '#projects'), cta('Download CV', 'mailto:arjun@mehta.dev', 'ghost')],
          },
          { paddingY: 'lg', animation: { type: 'fade', duration: 700 } },
        ),
        section('custom', { heading: 'By the numbers', mode: 'html', content: DASH_HTML, css: DASH_CSS }, { animation: { type: 'slide', duration: 650 } }, 'Dashboard'),
        section(
          'projects',
          {
            heading: 'Case studies',
            intro: 'Problem, approach, result — each with the metric it moved.',
            layout: 'grid',
            items: [
              work({ title: 'Demand forecasting for 4,000 stores', description: 'Hierarchical gradient-boosted forecasts with weather and festival features. MAPE fell from 18% to 6%, cutting stock-outs by a third.', image: cover('sig-forecast', pal, 'dashboard', 'Forecast chart abstraction'), role: 'Lead', duration: '2024', technologies: ['Python', 'LightGBM', 'dbt', 'BigQuery'], featured: true }),
              work({ title: 'Enterprise churn early-warning', description: 'A survival model flags at-risk accounts 60 days ahead; customer success saves 41% of them.', image: cover('sig-churn', pal, 'contours', 'Contour lines like a risk map'), role: 'Data scientist', duration: '2023', technologies: ['Python', 'scikit-survival', 'Looker'] }),
              work({ title: 'Experimentation platform', description: 'CUPED-adjusted A/B testing with automatic guardrails, now running 120 experiments a quarter.', image: cover('sig-exp', pal, 'grid', 'Grid of test cells'), role: 'Analytics engineer', duration: '2022', technologies: ['SQL', 'dbt', 'Python', 'Streamlit'] }),
            ],
          },
          { animation: { type: 'slide' } },
        ),
        section(
          'stats',
          {
            heading: 'Track record',
            items: withIds<StatItem>('stat', [
              { value: '9', suffix: '', label: 'models in production' },
              { value: '120', suffix: '/qtr', label: 'experiments analysed' },
              { value: '33', suffix: '%', label: 'fewer stock-outs' },
              { value: '6', suffix: ' yrs', label: 'in analytics & ML' },
            ]),
          },
          { background: 'surface', animation: { type: 'scale' } },
        ),
        section(
          'experience',
          {
            heading: 'Experience',
            intro: '',
            style: 'cards',
            items: [
              job({ company: 'Kirana Cloud', role: 'Lead Data Scientist, Growth', location: 'Bengaluru', start: '2022-07', current: true, description: 'Lead a team of four analysts and two ML engineers.', achievements: ['Forecasting platform used by supply chain daily', 'Introduced the metrics layer in dbt'], technologies: ['Python', 'dbt', 'BigQuery'] }),
              job({ company: 'PaySetu', role: 'Data Scientist', location: 'Mumbai', start: '2019-06', end: '2022-06', description: 'Risk and churn models for a payments app with 20M users.', achievements: ['Fraud model reduced chargebacks 22%'], technologies: ['Python', 'Spark', 'Airflow'] }),
              job({ company: 'Zentrix Analytics', role: 'Analyst', location: 'Pune', start: '2018-01', end: '2019-05', description: 'Dashboards and reporting for retail clients.', technologies: ['SQL', 'Tableau'] }),
            ],
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'skills',
          {
            heading: 'Stack',
            intro: 'Years of hands-on use.',
            display: 'bars',
            items: [...skills('', [['SQL', 7], ['Python', 6], ['dbt', 3], ['BigQuery', 4], ['Spark', 3], ['Looker / Tableau', 5], ['Statistics & experimentation', 6]])],
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'certifications',
          {
            heading: 'Certifications',
            items: withIds<CertificationItem>('crt', [
              { name: 'Google Cloud Professional Data Engineer', issuer: 'Google Cloud', date: '2024-03', credentialId: '', url: '' },
              { name: 'dbt Analytics Engineering', issuer: 'dbt Labs', date: '2023-08', credentialId: '', url: '' },
            ]),
          },
          { width: 'narrow', animation: { type: 'fade' } },
        ),
        section('testimonials', { heading: 'Colleagues', layout: 'grid', items: [quote({ quote: 'Arjun’s forecasts became the number the whole company plans around.', author: 'Meghna Rao', role: 'COO', company: 'Kirana Cloud', avatar: portrait('Meghna Rao', pal, 'mono') }), quote({ quote: 'He explains models so clearly that sales leaders ask for more of them.', author: 'Daniel Fernandes', role: 'Head of Sales Ops', company: 'PaySetu', avatar: portrait('Daniel Fernandes', pal, 'mono') })] }, { background: 'surface', animation: { type: 'fade' } }),
        section('education', { heading: 'Education', items: [school({ institution: 'Indian Statistical Institute', degree: 'M.Stat', field: 'Statistics', location: 'Kolkata', start: '2015-07', end: '2017-06' })] }, { width: 'narrow', animation: { type: 'fade' } }),
        section('contact', { heading: 'Got data and a decision to make?', body: 'Open to lead data science and analytics roles. Happy to walk through any case study in detail.', email: 'arjun@mehta.dev', location: 'Bengaluru, India', showForm: true }, { width: 'narrow', animation: { type: 'fade' } }),
        section('social', { heading: 'Elsewhere', style: 'icons', items: [social('GitHub', 'https://github.com/arjunmehta'), social('LinkedIn', 'https://www.linkedin.com/in/arjunmehta'), social('Kaggle', 'https://kaggle.com/arjunmehta')] }),
      ],
    });
  },
};
