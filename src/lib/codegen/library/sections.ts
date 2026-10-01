/**
 * Section components (Server Components). Only sections present in the portfolio
 * are generated. Variants are expressed with data-* attributes so Tailwind, CSS
 * Modules and plain CSS all style them statically.
 */
import type { SectionType } from '../site-types';
import type { LibOut } from './emit';
import { bullets, card, chip, chipList, grid, h3, LG, MD, media, meta, muted, r, small, textLink } from './rules';

const TYPE_NAME: Record<SectionType, string> = {
  hero: 'HeroSection',
  about: 'AboutSection',
  experience: 'ExperienceSection',
  education: 'EducationSection',
  projects: 'ProjectsSection',
  skills: 'SkillsSection',
  services: 'ServicesSection',
  achievements: 'AchievementsSection',
  certifications: 'CertificationsSection',
  testimonials: 'TestimonialsSection',
  blog: 'BlogSection',
  contact: 'ContactSection',
  social: 'SocialSection',
  stats: 'StatsSection',
  timeline: 'TimelineSection',
  gallery: 'GallerySection',
  custom: 'CustomSection',
};

export const COMPONENT_NAME: Record<SectionType, string> = {
  hero: 'Hero',
  about: 'About',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  services: 'Services',
  achievements: 'Achievements',
  certifications: 'Certifications',
  testimonials: 'Testimonials',
  blog: 'Blog',
  contact: 'Contact',
  social: 'Social',
  stats: 'Stats',
  timeline: 'Timeline',
  gallery: 'Gallery',
  custom: 'Custom',
};

const shell = (type: SectionType, inner: string) => `
export function ${COMPONENT_NAME[type]}({ section }: { section: ${TYPE_NAME[type]} }) {
  return (
    <SectionShell section={section}>
      <SectionHeading section={section} />
${inner
  .trim()
  .split('\n')
  .map((l) => (l ? `      ${l}` : l))
  .join('\n')}
    </SectionShell>
  );
}
`;

const baseImports = (type: SectionType, extra: string[] = []) => [
  `import type { ${TYPE_NAME[type]} } from '@/types/portfolio';`,
  `import { SectionHeading } from '@/components/SectionHeading';`,
  `import { SectionShell } from '@/components/SectionShell';`,
  ...extra,
];

const cardAttr = `data-card={portfolio.theme.cardStyle}`;
const PORTFOLIO = `import { portfolio } from '@/data/portfolio';`;

/* ------------------------------------------------------------------ */

function hero(out: LibOut): void {
  const { ctx } = out;
  const data = ctx.data.sections.find((s) => s.type === 'hero');
  const typing = !!(data && data.type === 'hero' && data.typingPhrases.length);
  const s = out.sheet('Hero', {
    root: r(
      `relative isolate overflow-hidden py-[calc(var(--section-y)*1.4)] text-text
       data-[layout=bold]:py-[calc(var(--section-y)*1.8)] data-[layout=minimal]:py-(--section-y)
       max-md:data-[hide-mobile]:hidden md:max-lg:data-[hide-tablet]:hidden lg:data-[hide-desktop]:hidden`,
      `position: relative;
isolation: isolate;
overflow: hidden;
padding-block: calc(var(--section-y) * 1.4);
color: var(--c-text);
&[data-layout="bold"] { padding-block: calc(var(--section-y) * 1.8); }
&[data-layout="minimal"] { padding-block: var(--section-y); }
@media (max-width: 767px) { &[data-hide-mobile] { display: none; } }
@media (min-width: 768px) and (max-width: 1023px) { &[data-hide-tablet] { display: none; } }
${LG} { &[data-hide-desktop] { display: none; } }`,
    ),
    backdrop: r(
      `pointer-events-none absolute inset-0 -z-10
       data-[backdrop=gradient]:bg-(image:--gradient-soft)
       data-[backdrop=grid]:bg-[linear-gradient(var(--c-border)_1px,transparent_1px),linear-gradient(90deg,var(--c-border)_1px,transparent_1px)] data-[backdrop=grid]:bg-size-[48px_48px] data-[backdrop=grid]:[mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]
       data-[backdrop=spotlight]:bg-[radial-gradient(60%_50%_at_50%_0%,var(--c-primary-soft),transparent)]
       data-[backdrop=aurora]:bg-[radial-gradient(40%_40%_at_20%_20%,var(--c-primary-soft),transparent),radial-gradient(40%_40%_at_80%_30%,var(--c-accent-soft),transparent)]`,
      `position: absolute;
inset: 0;
z-index: -1;
pointer-events: none;
&[data-backdrop="gradient"] { background-image: var(--gradient-soft); }
&[data-backdrop="grid"] {
  background-image: linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black, transparent 75%);
}
&[data-backdrop="spotlight"] { background: radial-gradient(60% 50% at 50% 0%, var(--c-primary-soft), transparent); }
&[data-backdrop="aurora"] { background: radial-gradient(40% 40% at 20% 20%, var(--c-primary-soft), transparent), radial-gradient(40% 40% at 80% 30%, var(--c-accent-soft), transparent); }`,
    ),
    backdropImage: r('size-full object-cover', 'width: 100%;\nheight: 100%;\nobject-fit: cover;'),
    overlay: r('absolute inset-0 bg-bg', 'position: absolute;\ninset: 0;\nbackground: var(--c-bg);'),
    inner: r(
      `mx-auto grid w-full max-w-(--max-w) items-center gap-10 px-(--pad-x)
       data-[layout=centered]:justify-items-center data-[layout=centered]:text-center
       md:data-[layout=split]:grid-cols-[1.25fr_1fr] md:data-[layout=split]:gap-16`,
      `margin-inline: auto;
display: grid;
align-items: center;
gap: 2.5rem;
width: 100%;
max-width: var(--max-w);
padding-inline: var(--pad-x);
&[data-layout="centered"] { justify-items: center; text-align: center; }
${MD} { &[data-layout="split"] { grid-template-columns: 1.25fr 1fr; gap: 4rem; } }`,
    ),
    copy: r('grid max-w-3xl gap-5 data-[layout=centered]:justify-items-center', 'display: grid;\nmax-width: 48rem;\ngap: 1.25rem;\n&[data-layout="centered"] { justify-items: center; }'),
    eyebrow: r('m-0 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-muted', 'margin: 0;\ndisplay: inline-flex;\nalign-items: center;\ngap: 0.5rem;\nborder-radius: 999px;\nborder: 1px solid var(--c-border);\nbackground: var(--c-surface);\npadding: 0.25rem 0.75rem;\nfont-size: var(--fs-sm);\nfont-weight: 500;\ncolor: var(--c-muted);'),
    dot: r('size-2 rounded-full bg-success', 'width: 0.5rem;\nheight: 0.5rem;\nborder-radius: 999px;\nbackground: var(--c-success);'),
    name: r(
      `m-0 font-heading text-5xl [font-weight:var(--fw-heading)] leading-(--lh-heading) tracking-(--ls-heading) [text-transform:var(--tt-heading)] text-balance
       data-[layout=bold]:text-[clamp(3rem,9vw,7rem)] data-[layout=bold]:leading-[0.95] data-[layout=minimal]:text-4xl`,
      `margin: 0;
font-family: var(--font-heading);
font-size: var(--fs-5xl);
font-weight: var(--fw-heading);
line-height: var(--lh-heading);
letter-spacing: var(--ls-heading);
text-transform: var(--tt-heading);
text-wrap: balance;
&[data-layout="bold"] { font-size: clamp(3rem, 9vw, 7rem); line-height: 0.95; }
&[data-layout="minimal"] { font-size: var(--fs-4xl); }`,
    ),
    title: r('m-0 font-heading text-2xl font-medium text-primary', 'margin: 0;\nfont-family: var(--font-heading);\nfont-size: var(--fs-2xl);\nfont-weight: 500;\ncolor: var(--c-primary);'),
    desc: r('m-0 max-w-2xl text-lg text-muted', 'margin: 0;\nmax-width: 42rem;\nfont-size: var(--fs-lg);\ncolor: var(--c-muted);'),
    ctas: r('flex flex-wrap gap-3 data-[layout=centered]:justify-center', 'display: flex;\nflex-wrap: wrap;\ngap: 0.75rem;\n&[data-layout="centered"] { justify-content: center; }'),
    image: r(
      `${media.tw} aspect-square max-w-[420px] shadow-lg data-[layout=centered]:order-first data-[layout=centered]:size-36 data-[layout=centered]:rounded-full data-[layout=minimal]:hidden`,
      `${media.css}
aspect-ratio: 1;
max-width: 420px;
box-shadow: var(--shadow-lg);
&[data-layout="centered"] { order: -1; width: 9rem; height: 9rem; border-radius: 999px; }
&[data-layout="minimal"] { display: none; }`,
    ),
  });
  const reveal = ctx.animations;
  const body = `
export function Hero({ section }: { section: HeroSection }) {
  const { layout } = section;
  const content = (
    <div ${s.c('copy')} data-layout={layout}>
      {(section.eyebrow || section.availability) && (
        <p ${s.c('eyebrow')}>
          {section.availability && <span ${s.c('dot')} aria-hidden="true" />}
          {section.availability || section.eyebrow}
        </p>
      )}
      <h1 id={\`\${section.anchor}-title\`} ${s.c('name')} data-layout={layout}>
        {section.name}
      </h1>
      {(section.title || section.typingPhrases.length > 0) && (
        <p ${s.c('title')}>${typing ? `{section.typingPhrases.length > 0 ? <TypingText phrases={section.typingPhrases} /> : section.title}` : '{section.title}'}</p>
      )}
      {section.description && <p ${s.c('desc')}>{section.description}</p>}
      {section.ctas.length > 0 && (
        <div ${s.c('ctas')} data-layout={layout}>
          {section.ctas.map((cta) => (
            <Button key={cta.href + cta.label} href={cta.href} variant={cta.variant}>
              {cta.label}
            </Button>
          ))}
        </div>
      )}
      {section.showSocial && <SocialLinks align={layout === 'centered' ? 'center' : 'left'} />}
    </div>
  );
  return (
    <section
      id={section.anchor}
      data-section={section.id}
      data-layout={layout}
      data-hide-mobile={section.hideOn.mobile || undefined}
      data-hide-tablet={section.hideOn.tablet || undefined}
      data-hide-desktop={section.hideOn.desktop || undefined}
      aria-labelledby={\`\${section.anchor}-title\`}
      ${s.c('root')}
    >
      {section.backdrop !== 'none' && (
        <div ${s.c('backdrop')} data-backdrop={section.backdrop} aria-hidden="true">
          {section.backdrop === 'image' && section.backdropImage && (
            <>
              <Img image={section.backdropImage} alt="" className={${s.x('backdropImage')}} sizes="100vw" priority />
              <div ${s.c('overlay')} style={{ opacity: section.overlayOpacity }} />
            </>
          )}
        </div>
      )}
      <div ${s.c('inner')} data-layout={layout}>
        ${reveal ? '<Reveal animation={section.animation}>{content}</Reveal>' : '{content}'}
        {section.image && <Img image={section.image} className={${s.x('image')}} sizes="(min-width: 768px) 420px, 60vw" priority />}
      </div>
    </section>
  );
}
`;
  out.component('sections', 'Hero', s, body, {
    imports: [
      `import type { HeroSection } from '@/types/portfolio';`,
      `import { Button } from '@/components/Button';`,
      `import { Img } from '@/components/Img';`,
      reveal ? `import { Reveal } from '@/components/Reveal';` : '',
      `import { SocialLinks } from '@/components/SocialLinks';`,
      typing ? `import { TypingText } from '@/components/TypingText';` : '',
    ],
  });
}

function about(out: LibOut): void {
  const s = out.sheet('About', {
    layout: r('grid items-start gap-10 md:data-[layout=split]:grid-cols-[1fr_1.4fr]', `display: grid;\nalign-items: start;\ngap: 2.5rem;\n${MD} { &[data-layout="split"] { grid-template-columns: 1fr 1.4fr; } }`),
    image: r(`${media.tw} aspect-[4/5] data-[layout=stacked]:aspect-video`, `${media.css}\naspect-ratio: 4 / 5;\n&[data-layout="stacked"] { aspect-ratio: 16 / 9; }`),
    body: r('grid gap-6', 'display: grid;\ngap: 1.5rem;'),
    prose: r('prose data-[layout=quote]:font-heading data-[layout=quote]:text-2xl data-[layout=quote]:italic', '&[data-layout="quote"] { font-family: var(--font-heading); font-size: var(--fs-2xl); font-style: italic; }'),
    list: chipList,
    chip,
  });
  out.component(
    'sections',
    'About',
    s,
    shell(
      'about',
      `
<div ${s.c('layout')} data-layout={section.layout}>
  {section.image && section.layout !== 'quote' && <Img image={section.image} className={${s.x('image')}} sizes="(min-width: 768px) 40vw, 100vw" />}
  <div ${s.c('body')}>
    {/* Rendered from Markdown and sanitised at export time. */}
    <div className={cx('prose', ${s.x('prose')})} data-layout={section.layout} dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
    {section.highlights.length > 0 && (
      <ul ${s.c('list')} aria-label="Highlights">
        {section.highlights.map((item) => (
          <li key={item} ${s.c('chip')}>
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
</div>
`,
    ),
    { imports: baseImports('about', [`import { Img } from '@/components/Img';`, `import { cx } from '@/lib/utils';`]) },
  );
}

function experience(out: LibOut): void {
  const s = out.sheet('Experience', {
    list: r(
      `m-0 grid list-none gap-8 p-0
       data-[style=timeline]:border-l-2 data-[style=timeline]:border-border data-[style=timeline]:pl-8
       data-[style=cards]:gap-(--gap) md:data-[style=cards]:grid-cols-2
       data-[style=compact]:gap-0
       md:data-[style=alternating]:border-l-0`,
      `margin: 0;
padding: 0;
list-style: none;
display: grid;
gap: 2rem;
&[data-style="timeline"] { border-left: 2px solid var(--c-border); padding-left: 2rem; }
&[data-style="cards"] { gap: var(--gap); }
&[data-style="compact"] { gap: 0; }
${MD} { &[data-style="cards"] { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`,
    ),
    item: r(
      `relative grid gap-3 text-left
       data-[style=timeline]:before:absolute data-[style=timeline]:before:top-1.5 data-[style=timeline]:before:-left-[calc(2rem+7px)] data-[style=timeline]:before:size-3 data-[style=timeline]:before:rounded-full data-[style=timeline]:before:bg-primary data-[style=timeline]:before:content-['']
       data-[style=cards]:rounded-card data-[style=cards]:border data-[style=cards]:border-border data-[style=cards]:bg-surface data-[style=cards]:p-6
       data-[style=compact]:border-b data-[style=compact]:border-border data-[style=compact]:py-5
       data-[style=alternating]:rounded-card data-[style=alternating]:bg-surface data-[style=alternating]:p-6 md:data-[style=alternating]:w-[calc(50%-1.5rem)] md:data-[style=alternating]:even:justify-self-end`,
      `position: relative;
display: grid;
gap: 0.75rem;
text-align: left;
&[data-style="timeline"]::before { content: ""; position: absolute; top: 0.375rem; left: calc(-2rem - 7px); width: 0.75rem; height: 0.75rem; border-radius: 999px; background: var(--c-primary); }
&[data-style="cards"] { border-radius: var(--radius-card); border: 1px solid var(--c-border); background: var(--c-surface); padding: 1.5rem; }
&[data-style="compact"] { border-bottom: 1px solid var(--c-border); padding-block: 1.25rem; }
&[data-style="alternating"] { border-radius: var(--radius-card); background: var(--c-surface); padding: 1.5rem; }
${MD} { &[data-style="alternating"] { width: calc(50% - 1.5rem); } &[data-style="alternating"]:nth-child(even) { justify-self: end; } }`,
    ),
    head: r('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1', 'display: flex;\nflex-wrap: wrap;\nalign-items: baseline;\njustify-content: space-between;\ncolumn-gap: 1rem;\nrow-gap: 0.25rem;'),
    role: h3,
    company: r('m-0 font-medium text-primary', 'margin: 0;\nfont-weight: 500;\ncolor: var(--c-primary);'),
    companyLink: r('text-inherit underline-offset-4 hover:underline', 'color: inherit;\ntext-decoration: none;\ntext-underline-offset: 4px;\n&:hover { text-decoration: underline; }'),
    period: meta,
    desc: muted,
    bullets,
  });
  out.component(
    'sections',
    'Experience',
    s,
    shell(
      'experience',
      `
<ol ${s.c('list')} data-style={section.style}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('item')} data-style={section.style}>
      <div ${s.c('head')}>
        <h3 ${s.c('role')}>{item.role}</h3>
        {item.period && <p ${s.c('period')}>{item.period}</p>}
      </div>
      <p ${s.c('company')}>
        {item.url ? (
          <SmartLink href={item.url} className={${s.x('companyLink')}}>
            {item.company}
          </SmartLink>
        ) : (
          item.company
        )}
        {item.location && <span> · {item.location}</span>}
      </p>
      {item.description && <p ${s.c('desc')}>{item.description}</p>}
      {item.achievements.length > 0 && (
        <ul ${s.c('bullets')}>
          {item.achievements.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <Tags items={item.technologies} label={\`Technologies at \${item.company}\`} />
    </li>
  ))}
</ol>
`,
    ),
    { imports: baseImports('experience', [`import { SmartLink } from '@/components/SmartLink';`, `import { Tags } from '@/components/Tags';`]) },
  );
}

function education(out: LibOut): void {
  const s = out.sheet('Education', { list: r(`${grid(2).tw} m-0 list-none p-0`, `${grid(2).css}\nmargin: 0;\npadding: 0;\nlist-style: none;`), card: r(`${card.tw} grid gap-2 text-left`, `${card.css}\ndisplay: grid;\ngap: 0.5rem;\ntext-align: left;`), title: h3, school: r('m-0 font-medium text-primary', 'margin: 0;\nfont-weight: 500;\ncolor: var(--c-primary);'), meta, desc: muted });
  out.component(
    'sections',
    'Education',
    s,
    shell(
      'education',
      `
<ul ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('card')} ${cardAttr}>
      <h3 ${s.c('title')}>{[item.degree, item.field].filter(Boolean).join(', ')}</h3>
      <p ${s.c('school')}>{item.institution}</p>
      <p ${s.c('meta')}>{[item.period, item.location, item.grade].filter(Boolean).join(' · ')}</p>
      {item.description && <p ${s.c('desc')}>{item.description}</p>}
    </li>
  ))}
</ul>
`,
    ),
    { imports: baseImports('education', [PORTFOLIO]) },
  );
}

function projects(out: LibOut): void {
  const s = out.sheet('Projects', {
    list: r(
      `grid gap-(--gap) sm:grid-cols-2 lg:grid-cols-3
       data-[layout=masonry]:block data-[layout=masonry]:columns-1 sm:data-[layout=masonry]:columns-2 lg:data-[layout=masonry]:columns-3
       data-[layout=horizontal]:flex data-[layout=horizontal]:snap-x data-[layout=horizontal]:snap-mandatory data-[layout=horizontal]:overflow-x-auto data-[layout=horizontal]:pb-4
       data-[layout=minimal]:grid-cols-1 sm:data-[layout=minimal]:grid-cols-1 lg:data-[layout=minimal]:grid-cols-1 data-[layout=minimal]:gap-0
       data-[layout=editorial]:grid-cols-1 sm:data-[layout=editorial]:grid-cols-1 lg:data-[layout=editorial]:grid-cols-1 data-[layout=editorial]:gap-16
       lg:data-[layout=featured]:grid-cols-2`,
      `display: grid;
gap: var(--gap);
@media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
${LG} { grid-template-columns: repeat(3, minmax(0, 1fr)); }
&[data-layout="masonry"] { display: block; columns: 1; column-gap: var(--gap); }
@media (min-width: 640px) { &[data-layout="masonry"] { columns: 2; } }
${LG} { &[data-layout="masonry"] { columns: 3; } &[data-layout="featured"] { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
&[data-layout="horizontal"] { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 1rem; }
&[data-layout="minimal"], &[data-layout="editorial"] { grid-template-columns: 1fr; }
&[data-layout="minimal"] { gap: 0; }
&[data-layout="editorial"] { gap: 4rem; }`,
    ),
  });
  out.component(
    'sections',
    'Projects',
    s,
    shell(
      'projects',
      `
<div ${s.c('list')} data-layout={section.layout}>
  {projectsForSection(section).map((project) => (
    <ProjectCard key={project.slug} project={project} layout={section.layout} />
  ))}
</div>
`,
    ),
    { imports: baseImports('projects', [`import { ProjectCard } from '@/components/ProjectCard';`, `import { projectsForSection } from '@/lib/content';`]) },
  );
}

function skills(out: LibOut): void {
  const s = out.sheet('Skills', {
    tags: chipList,
    tag: r(`${chip.tw} px-4 py-1.5 text-sm text-text`, `${chip.css}\npadding: 0.375rem 1rem;\nfont-size: var(--fs-sm);\ncolor: var(--c-text);`),
    groups: r(`${grid(3).tw} text-left`, `${grid(3).css}\ntext-align: left;`),
    group: r(`${card.tw} grid content-start gap-3`, `${card.css}\ndisplay: grid;\nalign-content: start;\ngap: 0.75rem;`),
    groupTitle: h3,
    bars: r('m-0 grid list-none gap-4 p-0 text-left md:grid-cols-2 md:gap-x-10', `margin: 0;\npadding: 0;\nlist-style: none;\ndisplay: grid;\ngap: 1rem;\ntext-align: left;\n${MD} { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 2.5rem; }`),
    bar: r('grid gap-1.5', 'display: grid;\ngap: 0.375rem;'),
    barHead: r('flex justify-between text-sm font-medium', 'display: flex;\njustify-content: space-between;\nfont-size: var(--fs-sm);\nfont-weight: 500;'),
    track: r('h-2 overflow-hidden rounded-full bg-surface-2', 'height: 0.5rem;\noverflow: hidden;\nborder-radius: 999px;\nbackground: var(--c-surface-2);'),
    fill: r('block h-full rounded-full bg-primary', 'display: block;\nheight: 100%;\nborder-radius: 999px;\nbackground: var(--c-primary);'),
    level: small,
    tiles: r('m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4', `margin: 0;\npadding: 0;\nlist-style: none;\ndisplay: grid;\ngrid-template-columns: repeat(2, minmax(0, 1fr));\ngap: 0.75rem;\n@media (min-width: 640px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n${LG} { grid-template-columns: repeat(4, minmax(0, 1fr)); }`),
    tile: r(`${card.tw} grid gap-1 p-4 text-center`, `${card.css}\ndisplay: grid;\ngap: 0.25rem;\npadding: 1rem;\ntext-align: center;`),
    tileName: r('font-semibold', 'font-weight: 600;'),
  });
  out.component(
    'sections',
    'Skills',
    s,
    `
function groupSkills(items: SkillEntry[]): Array<[string, SkillEntry[]]> {
  const groups = new Map<string, SkillEntry[]>();
  for (const item of items) {
    const key = item.category.trim() || 'Other';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

export function Skills({ section }: { section: SkillsSection }) {
  const display = section.display === 'orbit' ? 'grid' : section.display === 'stack' ? 'grouped' : section.display;
  const hasLevels = section.items.some((item) => item.level > 0);
  return (
    <SectionShell section={section}>
      <SectionHeading section={section} />
      {display === 'tags' && (
        <ul ${s.c('tags')} aria-label="Skills">
          {section.items.map((item) => (
            <li key={item.id} ${s.c('tag')}>
              {item.name}
            </li>
          ))}
        </ul>
      )}
      {display === 'grouped' && (
        <div ${s.c('groups')}>
          {groupSkills(section.items).map(([category, items]) => (
            <div key={category} ${s.c('group')} ${cardAttr}>
              <h3 ${s.c('groupTitle')}>{category}</h3>
              <ul ${s.c('tags')}>
                {items.map((item) => (
                  <li key={item.id} ${s.c('tag')}>
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {display === 'bars' && (
        <ul ${s.c('bars')}>
          {section.items.map((item) => (
            <li key={item.id} ${s.c('bar')}>
              <div ${s.c('barHead')}>
                <span>{item.name}</span>
                {item.level > 0 && <span ${s.c('level')}>{item.level}/5</span>}
              </div>
              {hasLevels && item.level > 0 && (
                <span ${s.c('track')} role="img" aria-label={\`\${item.name}: level \${item.level} of 5\`}>
                  <span ${s.c('fill')} style={{ width: \`\${(item.level / 5) * 100}%\` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {display === 'grid' && (
        <ul ${s.c('tiles')}>
          {section.items.map((item) => (
            <li key={item.id} ${s.c('tile')} ${cardAttr}>
              <span ${s.c('tileName')}>{item.name}</span>
              {item.category && <span ${s.c('level')}>{item.category}</span>}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
`,
    { imports: [`import type { SkillEntry, SkillsSection } from '@/types/portfolio';`, PORTFOLIO, `import { SectionHeading } from '@/components/SectionHeading';`, `import { SectionShell } from '@/components/SectionShell';`] },
  );
}

function services(out: LibOut): void {
  const sec = out.ctx.data.sections.find((x) => x.type === 'services');
  if (sec?.type === 'services') for (const i of sec.items) out.icon(i.icon || 'sparkles');
  out.icon('sparkles');
  const s = out.sheet('Services', {
    list: r(`${grid(3).tw} m-0 list-none p-0`, `${grid(3).css}\nmargin: 0;\npadding: 0;\nlist-style: none;`),
    card: r(`${card.tw} grid content-start gap-3 text-left`, `${card.css}\ndisplay: grid;\nalign-content: start;\ngap: 0.75rem;\ntext-align: left;`),
    icon: r('inline-grid size-11 place-items-center rounded-card bg-primary-soft text-xl text-primary', 'display: inline-grid;\nplace-items: center;\nwidth: 2.75rem;\nheight: 2.75rem;\nborder-radius: var(--radius-card);\nbackground: var(--c-primary-soft);\nfont-size: var(--fs-xl);\ncolor: var(--c-primary);'),
    title: h3,
    desc: muted,
    price: r('m-0 font-semibold text-primary', 'margin: 0;\nfont-weight: 600;\ncolor: var(--c-primary);'),
  });
  out.component(
    'sections',
    'Services',
    s,
    shell(
      'services',
      `
<ul ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('card')} ${cardAttr}>
      <span ${s.c('icon')}>
        <Icon name={item.icon || 'sparkles'} />
      </span>
      <h3 ${s.c('title')}>{item.title}</h3>
      {item.description && <p ${s.c('desc')}>{item.description}</p>}
      {item.price && <p ${s.c('price')}>{item.price}</p>}
    </li>
  ))}
</ul>
`,
    ),
    { imports: baseImports('services', [PORTFOLIO, `import { Icon } from '@/components/Icon';`]) },
  );
}

/** Simple item list shared by achievements / certifications / blog. */
function itemList(out: LibOut, type: 'achievements' | 'certifications' | 'blog'): void {
  const name = type === 'achievements' ? 'Achievements' : type === 'certifications' ? 'Certifications' : 'Blog';
  const s = out.sheet(name, {
    list: r(`${grid(type === 'achievements' ? 2 : 3).tw} m-0 list-none p-0`, `${grid(type === 'achievements' ? 2 : 3).css}\nmargin: 0;\npadding: 0;\nlist-style: none;`),
    card: r(`${card.tw} grid content-start gap-2 text-left`, `${card.css}\ndisplay: grid;\nalign-content: start;\ngap: 0.5rem;\ntext-align: left;`),
    title: h3,
    titleLink: r('text-inherit no-underline hover:text-primary', 'color: inherit;\ntext-decoration: none;\n&:hover { color: var(--c-primary); }'),
    meta,
    desc: muted,
    link: r(`${textLink.tw} text-sm`, `${textLink.css}\nfont-size: var(--fs-sm);`),
  });
  const titleOf = (field: string, url: string) => `{item.${url} ? (
        <SmartLink href={item.${url}} className={${s.x('titleLink')}}>
          {item.${field}}
        </SmartLink>
      ) : (
        item.${field}
      )}`;
  let inner = '';
  if (type === 'achievements')
    inner = `
<ul ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('card')} ${cardAttr}>
      {item.date && <p ${s.c('meta')}>{item.date}</p>}
      <h3 ${s.c('title')}>
        ${titleOf('title', 'url')}
      </h3>
      {item.description && <p ${s.c('desc')}>{item.description}</p>}
    </li>
  ))}
</ul>`;
  else if (type === 'certifications')
    inner = `
<ul ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('card')} ${cardAttr}>
      <h3 ${s.c('title')}>{item.name}</h3>
      <p ${s.c('desc')}>{[item.issuer, item.date].filter(Boolean).join(' · ')}</p>
      {item.credentialId && <p ${s.c('meta')}>ID {item.credentialId}</p>}
      {item.url && (
        <SmartLink href={item.url} className={${s.x('link')}}>
          Verify credential
        </SmartLink>
      )}
    </li>
  ))}
</ul>`;
  else
    inner = `
<ul ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('card')} ${cardAttr}>
      {item.date && <p ${s.c('meta')}>{item.date}</p>}
      <h3 ${s.c('title')}>
        ${titleOf('title', 'url')}
      </h3>
      {item.excerpt && <p ${s.c('desc')}>{item.excerpt}</p>}
      <Tags items={item.tags} label="Tags" />
    </li>
  ))}
</ul>`;
  const needsLink = type !== 'certifications' || true;
  out.component('sections', name, s, shell(type, inner), {
    imports: baseImports(type, [PORTFOLIO, needsLink ? `import { SmartLink } from '@/components/SmartLink';` : '', type === 'blog' ? `import { Tags } from '@/components/Tags';` : '']),
  });
}

function testimonials(out: LibOut): void {
  const carousel = out.ctx.data.sections.some((x) => x.type === 'testimonials' && x.layout === 'carousel');
  const s = out.sheet('Testimonials', {
    list: r(`${grid(2).tw} m-0 list-none p-0 data-[layout=single]:max-w-3xl data-[layout=single]:grid-cols-1 md:data-[layout=single]:grid-cols-1 data-[layout=single]:mx-auto`, `${grid(2).css}\nmargin: 0;\npadding: 0;\nlist-style: none;\n&[data-layout="single"] { max-width: 48rem; margin-inline: auto; grid-template-columns: 1fr; }`),
    card: r(`${card.tw} m-0 grid content-start gap-4 text-left`, `${card.css}\nmargin: 0;\ndisplay: grid;\nalign-content: start;\ngap: 1rem;\ntext-align: left;`),
    quote: r('m-0 text-lg leading-relaxed text-text', 'margin: 0;\nfont-size: var(--fs-lg);\nline-height: 1.7;\ncolor: var(--c-text);'),
    person: r('flex items-center gap-3', 'display: flex;\nalign-items: center;\ngap: 0.75rem;'),
    avatar: r('size-11 rounded-full object-cover', 'width: 2.75rem;\nheight: 2.75rem;\nborder-radius: 999px;\nobject-fit: cover;'),
    author: r('block font-semibold not-italic', 'display: block;\nfont-weight: 600;\nfont-style: normal;'),
    role: small,
  });
  out.component(
    'sections',
    'Testimonials',
    s,
    `
export function Testimonials({ section }: { section: TestimonialsSection }) {
  return (
    <SectionShell section={section}>
      <SectionHeading section={section} />
${carousel ? `      {section.layout === 'carousel' ? (
        <Carousel slides={section.items} label={section.heading || 'Testimonials'} />
      ) : (` : '      {('}
        <ul ${s.c('list')} data-layout={section.layout}>
          {(section.layout === 'single' ? section.items.slice(0, 1) : section.items).map((item) => (
            <li key={item.id}>
              <figure ${s.c('card')} ${cardAttr}>
                <blockquote ${s.c('quote')}>“{item.quote}”</blockquote>
                <figcaption ${s.c('person')}>
                  {item.avatar && <Img image={item.avatar} alt="" className={${s.x('avatar')}} sizes="44px" />}
                  <span>
                    <cite ${s.c('author')}>{item.author}</cite>
                    <span ${s.c('role')}>{[item.role, item.company].filter(Boolean).join(', ')}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
`,
    { imports: baseImports('testimonials', [PORTFOLIO, `import { Img } from '@/components/Img';`, carousel ? `import { Carousel } from '@/components/Carousel';` : '']) },
  );
}

function contact(out: LibOut): void {
  const form = out.ctx.data.sections.some((x) => x.type === 'contact' && x.showForm);
  out.icon('mail');
  out.icon('phone');
  out.icon('map-pin');
  const s = out.sheet('Contact', {
    layout: r('grid items-start gap-10 text-left md:grid-cols-2', `display: grid;\nalign-items: start;\ngap: 2.5rem;\ntext-align: left;\n${MD} { grid-template-columns: repeat(2, minmax(0, 1fr)); }`),
    info: r('grid gap-5', 'display: grid;\ngap: 1.25rem;'),
    body: r('m-0 text-lg text-muted', 'margin: 0;\nfont-size: var(--fs-lg);\ncolor: var(--c-muted);'),
    list: r('m-0 grid list-none gap-3 p-0', 'margin: 0;\npadding: 0;\nlist-style: none;\ndisplay: grid;\ngap: 0.75rem;'),
    row: r('flex items-center gap-3', 'display: flex;\nalign-items: center;\ngap: 0.75rem;'),
    link: r(`${textLink.tw} text-lg`, `${textLink.css}\nfont-size: var(--fs-lg);`),
    badge: r('m-0 inline-flex w-fit items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium', 'margin: 0;\ndisplay: inline-flex;\nwidth: fit-content;\nalign-items: center;\ngap: 0.5rem;\nborder-radius: 999px;\nbackground: var(--c-accent-soft);\npadding: 0.25rem 0.75rem;\nfont-size: var(--fs-sm);\nfont-weight: 500;'),
    formCard: r(card.tw, card.css),
  });
  out.component(
    'sections',
    'Contact',
    s,
    shell(
      'contact',
      `
<div ${s.c('layout')}>
  <div ${s.c('info')}>
    {section.availability && <p ${s.c('badge')}>{section.availability}</p>}
    {section.body && <p ${s.c('body')}>{section.body}</p>}
    <ul ${s.c('list')}>
      {section.email && (
        <li ${s.c('row')}>
          <Icon name="mail" />
          <SmartLink href={\`mailto:\${section.email}\`} className={${s.x('link')}}>
            {section.email}
          </SmartLink>
        </li>
      )}
      {section.phone && (
        <li ${s.c('row')}>
          <Icon name="phone" />
          <SmartLink href={\`tel:\${section.phone.replace(/[^\\d+]/g, '')}\`} className={${s.x('link')}}>
            {section.phone}
          </SmartLink>
        </li>
      )}
      {section.location && (
        <li ${s.c('row')}>
          <Icon name="map-pin" />
          <span>{section.location}</span>
        </li>
      )}
    </ul>
    <SocialLinks style="list" />
  </div>
${form ? `  {section.showForm && section.email && (
    <div ${s.c('formCard')} ${cardAttr}>
      <ContactForm to={section.email} />
    </div>
  )}` : ''}
</div>
`,
    ),
    { imports: baseImports('contact', [form ? PORTFOLIO : '', form ? `import { ContactForm } from '@/components/ContactForm';` : '', `import { Icon } from '@/components/Icon';`, `import { SmartLink } from '@/components/SmartLink';`, `import { SocialLinks } from '@/components/SocialLinks';`]) },
  );
}

function social(out: LibOut): void {
  out.component(
    'sections',
    'Social',
    null,
    shell('social', `<SocialLinks style={section.style === 'icons' ? 'icons' : 'list'} align={section.align} />`),
    { imports: baseImports('social', [`import { SocialLinks } from '@/components/SocialLinks';`]) },
  );
}

function stats(out: LibOut): void {
  const s = out.sheet('Stats', {
    list: r('m-0 grid list-none grid-cols-2 gap-(--gap) p-0 md:grid-cols-4', `margin: 0;\npadding: 0;\nlist-style: none;\ndisplay: grid;\ngrid-template-columns: repeat(2, minmax(0, 1fr));\ngap: var(--gap);\n${MD} { grid-template-columns: repeat(4, minmax(0, 1fr)); }`),
    item: r(`${card.tw} grid gap-1 text-center`, `${card.css}\ndisplay: grid;\ngap: 0.25rem;\ntext-align: center;`),
    value: r('font-heading text-4xl font-bold text-primary tabular-nums', 'font-family: var(--font-heading);\nfont-size: var(--fs-4xl);\nfont-weight: 700;\ncolor: var(--c-primary);\nfont-variant-numeric: tabular-nums;'),
    label: small,
  });
  out.component(
    'sections',
    'Stats',
    s,
    shell(
      'stats',
      `
<dl ${s.c('list')}>
  {section.items.map((item) => (
    <div key={item.id} ${s.c('item')} ${cardAttr}>
      <dt ${s.c('label')}>{item.label}</dt>
      <dd ${s.c('value')} style={{ margin: 0, order: -1 }}>
        {item.value}
        {item.suffix}
      </dd>
    </div>
  ))}
</dl>
`,
    ),
    { imports: baseImports('stats', [PORTFOLIO]) },
  );
}

function timeline(out: LibOut): void {
  const s = out.sheet('Timeline', {
    list: r('m-0 grid list-none gap-8 border-l-2 border-border p-0 pl-8 text-left', 'margin: 0;\npadding: 0 0 0 2rem;\nlist-style: none;\ndisplay: grid;\ngap: 2rem;\nborder-left: 2px solid var(--c-border);\ntext-align: left;'),
    item: r(
      "relative grid gap-1.5 before:absolute before:top-1.5 before:-left-[calc(2rem+7px)] before:size-3 before:rounded-full before:bg-primary before:content-['']",
      'position: relative;\ndisplay: grid;\ngap: 0.375rem;\n&::before { content: ""; position: absolute; top: 0.375rem; left: calc(-2rem - 7px); width: 0.75rem; height: 0.75rem; border-radius: 999px; background: var(--c-primary); }',
    ),
    date: meta,
    title: h3,
    desc: muted,
  });
  out.component(
    'sections',
    'Timeline',
    s,
    shell(
      'timeline',
      `
<ol ${s.c('list')}>
  {section.items.map((item) => (
    <li key={item.id} ${s.c('item')}>
      {item.date && <p ${s.c('date')}>{item.date}</p>}
      <h3 ${s.c('title')}>{item.title}</h3>
      {item.description && <p ${s.c('desc')}>{item.description}</p>}
    </li>
  ))}
</ol>
`,
    ),
    { imports: baseImports('timeline') },
  );
}

function gallery(out: LibOut): void {
  const s = out.sheet('Gallery', {
    list: r(
      `m-0 grid list-none gap-(--gap) p-0 sm:grid-cols-2 lg:grid-cols-3
       data-[layout=masonry]:block data-[layout=masonry]:columns-1 sm:data-[layout=masonry]:columns-2 lg:data-[layout=masonry]:columns-3
       data-[layout=strip]:flex data-[layout=strip]:snap-x data-[layout=strip]:overflow-x-auto data-[layout=strip]:pb-4`,
      `margin: 0;
padding: 0;
list-style: none;
display: grid;
gap: var(--gap);
@media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
${LG} { grid-template-columns: repeat(3, minmax(0, 1fr)); }
&[data-layout="masonry"] { display: block; columns: 1; column-gap: var(--gap); }
@media (min-width: 640px) { &[data-layout="masonry"] { columns: 2; } }
${LG} { &[data-layout="masonry"] { columns: 3; } }
&[data-layout="strip"] { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 1rem; }`,
    ),
    item: r(
      'm-0 grid gap-2 data-[layout=masonry]:mb-(--gap) data-[layout=masonry]:break-inside-avoid data-[layout=strip]:w-[min(80vw,420px)] data-[layout=strip]:shrink-0 data-[layout=strip]:snap-start',
      'margin: 0;\ndisplay: grid;\ngap: 0.5rem;\n&[data-layout="masonry"] { margin-bottom: var(--gap); break-inside: avoid; }\n&[data-layout="strip"] { width: min(80vw, 420px); flex-shrink: 0; scroll-snap-align: start; }',
    ),
    img: media,
    caption: small,
  });
  out.component(
    'sections',
    'Gallery',
    s,
    shell(
      'gallery',
      `
<ul ${s.c('list')} data-layout={section.layout}>
  {section.items.map((item) => (
    <li key={item.id}>
      <figure ${s.c('item')} data-layout={section.layout}>
        <Img image={item.image} className={${s.x('img')}} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        {item.caption && <figcaption ${s.c('caption')}>{item.caption}</figcaption>}
      </figure>
    </li>
  ))}
</ul>
`,
    ),
    { imports: baseImports('gallery', [`import { Img } from '@/components/Img';`]) },
  );
}

function custom(out: LibOut): void {
  out.component(
    'sections',
    'Custom',
    null,
    shell(
      'custom',
      `
{/* Custom content was sanitised at export; its scoped CSS lives in the global stylesheet. */}
<div className="prose" dangerouslySetInnerHTML={{ __html: section.html }} />
`,
    ),
    { imports: baseImports('custom') },
  );
}

export function emitSections(out: LibOut): void {
  const t = out.ctx.sectionTypes;
  if (t.has('hero')) hero(out);
  if (t.has('about')) about(out);
  if (t.has('experience')) experience(out);
  if (t.has('education')) education(out);
  if (t.has('projects')) projects(out);
  if (t.has('skills')) skills(out);
  if (t.has('services')) services(out);
  if (t.has('achievements')) itemList(out, 'achievements');
  if (t.has('certifications')) itemList(out, 'certifications');
  if (t.has('testimonials')) testimonials(out);
  if (t.has('blog')) itemList(out, 'blog');
  if (t.has('contact')) contact(out);
  if (t.has('social')) social(out);
  if (t.has('stats')) stats(out);
  if (t.has('timeline')) timeline(out);
  if (t.has('gallery')) gallery(out);
  if (t.has('custom')) custom(out);

  const order: SectionType[] = ['hero', 'about', 'experience', 'education', 'projects', 'skills', 'services', 'achievements', 'certifications', 'testimonials', 'blog', 'contact', 'social', 'stats', 'timeline', 'gallery', 'custom'];
  const present = order.filter((x) => t.has(x));
  out.component(
    'components',
    'SectionRenderer',
    null,
    `
/** Renders a list of sections in order. Edit src/data/portfolio.ts to change content. */
export function SectionRenderer({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
${present.map((x) => `          case '${x}':\n            return <${COMPONENT_NAME[x]} key={section.id} section={section} />;`).join('\n')}
          default:
            return null;
        }
      })}
    </>
  );
}
`,
    { imports: [`import type { Section } from '@/types/portfolio';`, ...present.map((x) => `import { ${COMPONENT_NAME[x]} } from '@/sections/${COMPONENT_NAME[x]}';`)] },
  );
}
