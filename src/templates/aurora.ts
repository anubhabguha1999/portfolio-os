import type { PortfolioTemplate } from './types';
import { buildPortfolio, section, cta, job, work, skills, school, quote, social, withIds } from './build';
import { cover, ogArt, paletteFor, portrait } from './art';
import type { StatItem } from '@/types/portfolio';

const THEME = 'aurora';

/** Bento grid: glass tiles built from the theme's own colours, so they follow light/dark and edits. */
const BENTO_HTML = `<div class="bento">
  <article class="tile t-now">
    <p class="k">Now</p>
    <h3>Building the evaluation platform and copilot at <strong>Lumen Labs</strong></h3>
    <p>Used by 30,000 analysts every week. I own the agent runtime, the eval harness and the latency budget.</p>
  </article>
  <article class="tile t-status">
    <p class="live"><span class="dot" aria-hidden="true"></span> Open to staff roles from September</p>
  </article>
  <article class="tile t-num">
    <p class="big">38<span>ms</span></p>
    <p>p95 retrieval latency after the vector-store rewrite</p>
  </article>
  <article class="tile t-stack">
    <p class="k">Daily stack</p>
    <ul>
      <li>TypeScript</li><li>Python</li><li>Rust</li><li>Postgres + pgvector</li><li>Temporal</li><li>Next.js</li>
    </ul>
  </article>
  <article class="tile t-loc">
    <p class="k">Based in</p>
    <h3>Lisbon</h3>
    <p>UTC+0 · happy across European and US hours</p>
  </article>
  <article class="tile t-quote">
    <p>“Inés turns vague AI ideas into systems you can measure, ship and trust.”</p>
    <p class="who">Priya Natarajan, VP Engineering, Lumen Labs</p>
  </article>
</div>`;

const BENTO_CSS = `.custom-content { max-width: none; }
.bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.tile { position: relative; overflow: hidden; padding: 22px; border-radius: var(--radius-card); border: 1px solid var(--c-border); background: color-mix(in srgb, var(--c-surface) 72%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.tile h3 { margin: 6px 0 8px; font-family: var(--font-heading); font-size: clamp(1.15rem, 2vw, 1.5rem); line-height: 1.2; letter-spacing: -0.02em; }
.tile p { margin: 0; color: var(--c-muted); font-size: 0.95rem; line-height: 1.55; }
.k { font-family: var(--font-mono); font-size: 0.72rem !important; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-primary) !important; }
.t-now { grid-column: span 2; grid-row: span 2; background: radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--c-primary) 30%, transparent), transparent 60%), radial-gradient(90% 80% at 100% 100%, color-mix(in srgb, var(--c-secondary) 22%, transparent), transparent 60%), color-mix(in srgb, var(--c-surface) 72%, transparent); }
.t-now h3 { font-size: clamp(1.4rem, 3vw, 2.1rem); margin-top: 14px; }
.t-now strong { color: var(--c-primary); font-weight: 600; }
.t-status { grid-column: span 2; display: flex; align-items: center; }
.live { display: flex; align-items: center; gap: 10px; color: var(--c-text) !important; font-weight: 500; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c-primary); box-shadow: 0 0 0 0 color-mix(in srgb, var(--c-primary) 60%, transparent); animation: bento-pulse 2.2s ease-out infinite; }
@keyframes bento-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c-primary) 55%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }
.big { font-family: var(--font-heading); font-size: clamp(2.6rem, 6vw, 4rem) !important; line-height: 1 !important; letter-spacing: -0.04em; color: var(--c-text) !important; margin-bottom: 8px !important; }
.big span { font-size: 0.45em; margin-left: 4px; color: var(--c-secondary); }
.t-stack ul { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; padding: 0; }
.t-stack li { padding: 5px 10px; border-radius: 999px; border: 1px solid var(--c-border); font-size: 0.82rem; color: var(--c-text); background: color-mix(in srgb, var(--c-bg) 50%, transparent); }
.t-loc h3 { font-size: clamp(1.6rem, 3vw, 2.2rem); }
.t-quote { grid-column: span 3; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; }
.t-quote p:first-child { color: var(--c-text); font-family: var(--font-heading); font-size: clamp(1.05rem, 2vw, 1.3rem); line-height: 1.4; }
.who { font-size: 0.82rem !important; }
@media (max-width: 860px) { .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); } .t-now, .t-status, .t-quote { grid-column: span 2; } .t-now { grid-row: auto; } }
@media (max-width: 520px) { .bento { grid-template-columns: 1fr; } .t-now, .t-status, .t-quote { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }`;

/** Aurora Bento — a dark, glassy page for AI and platform engineers. */
export const auroraTemplate: PortfolioTemplate = {
  id: 'aurora-bento',
  name: 'Aurora Bento',
  description: 'Near-black canvas with aurora light, frosted glass cards and a bento grid that tells your story at a glance.',
  audience: 'AI, platform & full-stack engineers',
  themeId: THEME,
  tags: ['Dark', 'Glass', 'Animated', 'Developer', 'Premium'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Inés Duarte';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: `${name} — AI Platform Engineer`,
        description: 'Inés Duarte is an AI platform engineer in Lisbon building evaluation pipelines, agent runtimes and fast retrieval for production LLM products.',
        keywords: ['AI engineer', 'LLM', 'platform engineering', 'TypeScript', 'Python', 'Rust', 'Lisbon'],
        author: name,
        favicon: '✦',
        ogImage: ogArt(name, 'AI Platform Engineer', pal, 'mesh'),
      },
      navigation: { style: 'floating', brand: 'Inés Duarte' },
      footer: { text: '© {year} Inés Duarte. Designed in the dark, shipped as plain HTML.' },
      settings: { showThemeToggle: true },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'AI platform engineer · Lisbon',
            name,
            title: 'I make AI products fast, measurable and boringly reliable.',
            description: 'Eight years across infrastructure and product. Today I lead the agent runtime and evaluation platform behind Lumen, an analytics copilot.',
            layout: 'centered',
            background: 'aurora',
            availability: 'Open to staff roles',
            typingEnabled: true,
            typingPhrases: ['Agent runtimes', 'Evaluation pipelines', 'Sub-50 ms retrieval'],
            ctas: [cta('See the work', '#projects'), cta('Book a call', 'mailto:ines@duarte.dev', 'ghost')],
          },
          { paddingY: 'xl', animation: { type: 'blur', duration: 900 } },
        ),
        section('custom', { heading: 'At a glance', mode: 'html', content: BENTO_HTML, css: BENTO_CSS }, { animation: { type: 'slide', duration: 700 } }, 'At a glance'),
        section(
          'projects',
          {
            heading: 'Selected work',
            intro: 'Systems I designed and led, with the numbers that mattered.',
            layout: 'featured',
            items: [
              work({
                title: 'Lumen Copilot evaluation harness',
                description: 'An offline + online eval platform scoring 1.2M agent traces a day. Regressions are caught before release, and answer quality rose 31% over two quarters.',
                image: cover('aurora-eval', pal, 'dashboard', 'Dashboard-style abstract art with charts in violet and cyan'),
                role: 'Tech lead',
                duration: '2024 — now',
                technologies: ['Python', 'Temporal', 'ClickHouse', 'TypeScript'],
                featured: true,
                live: 'https://lumen.example.com',
              }),
              work({
                title: 'pgvector retrieval rewrite',
                description: 'Moved semantic search from a hosted vector DB to Postgres with HNSW indexes and a Rust re-ranker: p95 fell from 210 ms to 38 ms and costs dropped 64%.',
                image: cover('aurora-vector', pal, 'orbit', 'Orbiting points around a glowing centre'),
                role: 'Architect',
                duration: '2023',
                technologies: ['Rust', 'Postgres', 'pgvector'],
              }),
              work({
                title: 'tracekit',
                description: 'An open-source OpenTelemetry toolkit for LLM apps: token, cost and latency spans with a local viewer. 4.1k GitHub stars.',
                image: cover('aurora-tracekit', pal, 'glass', 'Layered translucent panels'),
                role: 'Author',
                duration: 'Open source',
                technologies: ['TypeScript', 'OpenTelemetry'],
                github: 'https://github.com/inesduarte/tracekit',
              }),
            ],
          },
          { animation: { type: 'slide', duration: 650 } },
        ),
        section(
          'stats',
          {
            heading: 'Impact',
            items: withIds<StatItem>('stat', [
              { value: '1.2', suffix: 'M', label: 'agent traces evaluated daily' },
              { value: '64', suffix: '%', label: 'lower retrieval cost' },
              { value: '4.1', suffix: 'k', label: 'GitHub stars on tracekit' },
              { value: '8', suffix: ' yrs', label: 'shipping production systems' },
            ]),
          },
          { background: 'surface', animation: { type: 'scale' } },
        ),
        section(
          'experience',
          {
            heading: 'Experience',
            intro: '',
            style: 'timeline',
            items: [
              job({ company: 'Lumen Labs', role: 'Staff AI Platform Engineer', location: 'Lisbon / remote', start: '2023-02', current: true, description: 'Lead a team of six on the agent runtime, evaluation and retrieval.', achievements: ['Designed the eval harness used by every product team', 'Cut LLM spend 41% with routing and caching'], technologies: ['Python', 'Rust', 'TypeScript'] }),
              job({ company: 'Northwind Cloud', role: 'Senior Platform Engineer', location: 'Porto', start: '2019-04', end: '2023-01', description: 'Built the internal developer platform for 300 engineers.', achievements: ['Golden-path templates adopted by 90% of services', 'Halved deploy times with build caching'], technologies: ['Go', 'Kubernetes', 'Terraform'] }),
              job({ company: 'Fintra', role: 'Software Engineer', location: 'Lisbon', start: '2017-01', end: '2019-03', description: 'Payments APIs and fraud scoring.', technologies: ['Node.js', 'Postgres'] }),
            ],
          },
          { animation: { type: 'fade' } },
        ),
        section(
          'skills',
          {
            heading: 'Toolbox',
            intro: '',
            display: 'orbit',
            items: [...skills('AI', [['LLM evaluation', 3], ['RAG', 3], ['Agents', 2]]), ...skills('Languages', [['TypeScript', 7], ['Python', 8], ['Rust', 3]]), ...skills('Infra', [['Postgres', 8], ['Kubernetes', 5], ['Temporal', 3]])],
          },
          { animation: { type: 'scale' } },
        ),
        section(
          'testimonials',
          {
            heading: 'Kind words',
            layout: 'carousel',
            items: [
              quote({ quote: 'The most rigorous engineer I have worked with on AI quality. Our launch went from guesswork to a dashboard.', author: 'Priya Natarajan', role: 'VP Engineering', company: 'Lumen Labs', avatar: portrait('Priya Natarajan', pal) }),
              quote({ quote: 'Inés makes complicated systems feel calm. Teams copy her designs because they simply work.', author: 'Tomás Reis', role: 'CTO', company: 'Northwind Cloud', avatar: portrait('Tomás Reis', pal) }),
            ],
          },
          { background: 'surface', animation: { type: 'fade' } },
        ),
        section('education', { heading: 'Education', items: [school({ institution: 'Instituto Superior Técnico', degree: 'MSc', field: 'Computer Science', location: 'Lisbon', start: '2012-09', end: '2016-07' })] }, { width: 'narrow', animation: { type: 'fade' } }),
        section(
          'contact',
          { heading: 'Let’s build something measurable', body: 'Hiring for AI platform or applied ML infrastructure? I reply within two working days.', email: 'ines@duarte.dev', location: 'Lisbon, Portugal', availability: 'Open to staff roles from September', showForm: true },
          { width: 'narrow', animation: { type: 'blur' } },
        ),
        section('social', { heading: 'Elsewhere', style: 'buttons', items: [social('GitHub', 'https://github.com/inesduarte'), social('LinkedIn', 'https://www.linkedin.com/in/inesduarte'), social('X', 'https://x.com/inesduarte')] }),
      ],
    });
  },
};
