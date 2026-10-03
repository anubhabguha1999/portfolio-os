import { t } from '@/i18n';
import type { SectionDefinition } from '../types';
import { langOf, esc, hasText, opts, headingField, introField, sectionHeader, tagList, bulletList, link, emptyImage, para, bullets, linkRuns } from '../helpers';
import { uid } from '@/utils/id';
import type { ProjectItem } from '@/types/portfolio';
import type { DocBlock } from '@/types/document';

export const createProjectItem = (): ProjectItem => ({
  id: uid('prj'),
  title: 'Project title',
  description: 'What it is, who it is for, and the outcome.',
  image: emptyImage(),
  gallery: [],
  technologies: [],
  github: '',
  live: '',
  caseStudy: '',
  role: '',
  duration: '',
  features: [],
  featured: false,
});

export const projectsSection: SectionDefinition<'projects'> = {
  type: 'projects',
  label: 'Projects',
  description: 'Selected work with links, stacks and case studies.',
  icon: 'FolderKanban',
  category: 'work',
  createData: () => ({ heading: 'Selected work', intro: '', layout: 'grid', items: [createProjectItem()] }),
  fields: [
    headingField,
    introField,
    {
      kind: 'select',
      key: 'layout',
      label: 'Layout',
      options: opts(['grid', 'Grid'], ['masonry', 'Masonry'], ['horizontal', 'Horizontal scroll'], ['featured', 'Featured'], ['minimal', 'Minimal list'], ['editorial', 'Editorial']),
    },
    {
      kind: 'list',
      key: 'items',
      label: 'Projects',
      itemLabel: 'Project',
      titleKey: 'title',
      subtitleKey: 'role',
      createItem: () => ({ ...createProjectItem() }),
      fields: [
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 3 },
        { kind: 'image', key: 'image', label: 'Cover image' },
        { kind: 'toggle', key: 'featured', label: 'Featured project' },
        { kind: 'text', key: 'role', label: 'Your role' },
        { kind: 'text', key: 'duration', label: 'Duration', placeholder: 'e.g. 6 months, 2024' },
        { kind: 'tags', key: 'technologies', label: 'Technologies' },
        { kind: 'stringList', key: 'features', label: 'Key features', itemLabel: 'Feature' },
        { kind: 'url', key: 'live', label: 'Live URL' },
        { kind: 'url', key: 'github', label: 'Source code URL' },
        { kind: 'markdown', key: 'caseStudy', label: 'Case study', help: 'Markdown. Shown as an expandable write-up.' },
        { kind: 'imageList', key: 'gallery', label: 'Gallery' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: (d) =>
    d.items.flatMap((p) => [
      { ref: p.image, label: `Project "${p.title}" cover` },
      ...p.gallery.map((g, i) => ({ ref: g, label: `Project "${p.title}" gallery image ${i + 1}` })),
    ]),
  links: (d) =>
    d.items.flatMap((p) => [
      ...(hasText(p.live) ? [{ url: p.live, label: `"${p.title}" live URL` }] : []),
      ...(hasText(p.github) ? [{ url: p.github, label: `"${p.title}" source URL` }] : []),
    ]),
  render(d, ctx) {
    const sorted = d.layout === 'featured' ? [...d.items].sort((a, b) => Number(b.featured) - Number(a.featured)) : d.items;
    const cards = sorted
      .map((p, index) => {
        const cover = ctx.image(p.image, { className: 'project-cover', width: 1200, height: 750 });
        const meta = [p.role, p.duration].filter(hasText).map(esc).join(' · ');
        const links = [
          hasText(p.live) ? link(p.live, `${ctx.icon('external')}<span>${esc(t(langOf(ctx), 'live'))}</span>`, 'project-link') : '',
          hasText(p.github) ? link(p.github, `${ctx.icon('github')}<span>${esc(t(langOf(ctx), 'source'))}</span>`, 'project-link') : '',
        ].join('');
        const gallery = p.gallery.filter((g) => g.src);
        const galleryHtml = gallery.length
          ? `<div class="project-gallery">${gallery.map((g) => `<button type="button" class="project-thumb" data-lightbox aria-label="Enlarge: ${esc(g.alt || p.title)}">${ctx.image(g, { width: 320, height: 200 })}</button>`).join('')}</div>`
          : '';
        const caseStudy = hasText(p.caseStudy)
          ? `<details class="case-study"><summary>${esc(t(langOf(ctx), 'readCaseStudy'))}</summary><div class="prose">${ctx.markdown(p.caseStudy)}</div></details>`
          : '';
        const big = d.layout === 'featured' && (p.featured || index === 0);
        return `<article class="project card${p.featured ? ' is-featured' : ''}${big ? ' is-large' : ''}" data-anim-child>
  ${cover ? `<div class="project-media">${cover}</div>` : d.layout === 'minimal' ? '' : `<div class="project-media project-media--empty" aria-hidden="true"><span>${esc(p.title.slice(0, 1))}</span></div>`}
  <div class="project-body">
    ${d.layout === 'editorial' ? `<span class="project-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>` : ''}
    ${meta ? `<p class="project-meta">${meta}</p>` : ''}
    <h3 class="project-title">${esc(p.title)}</h3>
    ${hasText(p.description) ? `<p class="project-desc">${esc(p.description)}</p>` : ''}
    ${bulletList(p.features, 'bullets project-features')}
    ${tagList(p.technologies)}
    ${links ? `<div class="project-links">${links}</div>` : ''}
    ${caseStudy}
    ${galleryHtml}
  </div>
</article>`;
      })
      .join('');
    return `${sectionHeader(d.heading, d.intro, ctx)}<div class="projects projects--${d.layout}"${d.layout === 'horizontal' ? ' tabindex="0" role="region" aria-label="Projects, scroll horizontally"' : ''}>${cards}</div>`;
  },
  toDocument: (d, ctx) => [
    ...ctx.markdownBlocks(d.intro),
    ...d.items.map((p): DocBlock => {
      const links = linkRuns([
        { label: t(langOf(ctx), 'live'), url: p.live },
        { label: t(langOf(ctx), 'source'), url: p.github },
      ]);
      return {
        kind: 'entry',
        title: p.title,
        subtitle: p.role,
        meta: p.duration,
        ...(hasText(p.live) ? { link: p.live } : {}),
        body: [
          ...(p.image.src ? [{ kind: 'image' as const, src: p.image.src, alt: p.image.alt, maxWidthRatio: 0.6 }] : []),
          ...para(p.description),
          ...bullets(p.features),
          ...(p.technologies.length ? [{ kind: 'tags' as const, label: 'Stack', items: p.technologies }] : []),
          ...(links.length ? [{ kind: 'paragraph' as const, runs: links, tone: 'small' as const }] : []),
          ...(hasText(p.caseStudy) ? [{ kind: 'heading' as const, level: 3 as const, text: 'Case study' }, ...ctx.markdownBlocks(p.caseStudy)] : []),
        ],
      };
    }),
  ],
};
