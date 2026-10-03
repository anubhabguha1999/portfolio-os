import type { SectionDefinition } from '../types';
import { langOf, esc, hasText, headingField, introField, sectionHeader, link, tagList, para, opts, emptyImage } from '../helpers';
import { uid } from '@/utils/id';
import { formatMonth } from '@/utils/format';
import { safeHref } from '@/utils/url';
import { socialIconFor as socialIconForPlatform } from '../icons';

/* -------------------------------- Services ------------------------------- */

export const servicesSection: SectionDefinition<'services'> = {
  type: 'services',
  label: 'Services',
  description: 'What clients can hire you for.',
  icon: 'Handshake',
  category: 'credibility',
  createData: () => ({
    heading: 'Services',
    intro: '',
    items: [{ id: uid('svc'), title: 'Service', description: 'What you deliver and the outcome for the client.', icon: 'sparkles', price: '' }],
  }),
  fields: [
    headingField,
    introField,
    {
      kind: 'list',
      key: 'items',
      label: 'Services',
      itemLabel: 'Service',
      titleKey: 'title',
      createItem: () => ({ id: uid('svc'), title: 'New service', description: '', icon: 'sparkles', price: '' }),
      fields: [
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 3 },
        { kind: 'icon', key: 'icon', label: 'Icon' },
        { kind: 'text', key: 'price', label: 'Price / engagement', placeholder: 'e.g. From $4k' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: () => [],
  render: (d, ctx) =>
    `${sectionHeader(d.heading, d.intro, ctx)}<ul class="services" role="list">${d.items
      .map(
        (s) => `<li class="service card" data-anim-child><span class="service-icon" aria-hidden="true">${ctx.icon(s.icon || 'sparkles')}</span><h3 class="service-title">${esc(s.title)}</h3>${
          hasText(s.description) ? `<p class="service-desc">${esc(s.description)}</p>` : ''
        }${hasText(s.price) ? `<p class="service-price">${esc(s.price)}</p>` : ''}</li>`,
      )
      .join('')}</ul>`,
  toDocument: (d, ctx) => [
    ...ctx.markdownBlocks(d.intro),
    ...d.items.map((s) => ({ kind: 'entry' as const, title: s.title, meta: s.price, body: para(s.description) })),
  ],
};

/* ------------------------------ Achievements ----------------------------- */

export const achievementsSection: SectionDefinition<'achievements'> = {
  type: 'achievements',
  label: 'Achievements',
  description: 'Awards, talks, publications and milestones.',
  icon: 'Trophy',
  category: 'credibility',
  createData: () => ({ heading: 'Achievements', items: [{ id: uid('ach'), title: 'Achievement', description: '', date: '', url: '' }] }),
  fields: [
    headingField,
    {
      kind: 'list',
      key: 'items',
      label: 'Achievements',
      itemLabel: 'Achievement',
      titleKey: 'title',
      subtitleKey: 'date',
      createItem: () => ({ id: uid('ach'), title: 'New achievement', description: '', date: '', url: '' }),
      fields: [
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 2 },
        { kind: 'month', key: 'date', label: 'Date' },
        { kind: 'url', key: 'url', label: 'Link' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: (d) => d.items.filter((i) => hasText(i.url)).map((i) => ({ url: i.url, label: `Achievement "${i.title}"` })),
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<ul class="achievements" role="list">${d.items
      .map(
        (a) => `<li class="achievement card" data-anim-child><span class="achievement-icon" aria-hidden="true">${ctx.icon('award')}</span><div><h3 class="achievement-title">${
          hasText(a.url) ? link(a.url, esc(a.title)) : esc(a.title)
        }</h3>${hasText(a.description) ? `<p>${esc(a.description)}</p>` : ''}</div>${hasText(a.date) ? `<span class="date-range">${esc(formatMonth(a.date, langOf(ctx)))}</span>` : ''}</li>`,
      )
      .join('')}</ul>`,
  toDocument: (d, ctx) => d.items.map((a) => ({ kind: 'entry' as const, title: a.title, meta: formatMonth(a.date, langOf(ctx)), ...(hasText(a.url) ? { link: a.url } : {}), body: para(a.description) })),
};

/* ----------------------------- Certifications ---------------------------- */

export const certificationsSection: SectionDefinition<'certifications'> = {
  type: 'certifications',
  label: 'Certifications',
  description: 'Credentials with issuers and verification links.',
  icon: 'BadgeCheck',
  category: 'credibility',
  createData: () => ({ heading: 'Certifications', items: [{ id: uid('crt'), name: 'Certification', issuer: 'Issuer', date: '', credentialId: '', url: '' }] }),
  fields: [
    headingField,
    {
      kind: 'list',
      key: 'items',
      label: 'Certifications',
      itemLabel: 'Certification',
      titleKey: 'name',
      subtitleKey: 'issuer',
      createItem: () => ({ id: uid('crt'), name: 'New certification', issuer: '', date: '', credentialId: '', url: '' }),
      fields: [
        { kind: 'text', key: 'name', label: 'Name' },
        { kind: 'text', key: 'issuer', label: 'Issuer' },
        { kind: 'month', key: 'date', label: 'Issued' },
        { kind: 'text', key: 'credentialId', label: 'Credential ID' },
        { kind: 'url', key: 'url', label: 'Verification URL' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: (d) => d.items.filter((i) => hasText(i.url)).map((i) => ({ url: i.url, label: `Certification "${i.name}"` })),
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<ul class="certs" role="list">${d.items
      .map(
        (c) => `<li class="cert card" data-anim-child><span class="cert-icon" aria-hidden="true">${ctx.icon('shield')}</span><div class="cert-body"><h3 class="cert-name">${esc(c.name)}</h3><p class="cert-issuer">${esc(c.issuer)}${
          hasText(c.date) ? ` · ${esc(formatMonth(c.date, langOf(ctx)))}` : ''
        }</p>${hasText(c.credentialId) ? `<p class="cert-id">ID ${esc(c.credentialId)}</p>` : ''}${hasText(c.url) ? link(c.url, `Verify ${ctx.icon('external')}`, 'cert-link') : ''}</div></li>`,
      )
      .join('')}</ul>`,
  toDocument: (d, ctx) => [
    {
      kind: 'table',
      header: ['Certification', 'Issuer', 'Date'],
      rows: d.items.map((c) => [c.name, c.issuer, formatMonth(c.date, langOf(ctx))]),
    },
  ],
};

/* ------------------------------ Testimonials ----------------------------- */

export const testimonialsSection: SectionDefinition<'testimonials'> = {
  type: 'testimonials',
  label: 'Testimonials',
  description: 'Words from clients and colleagues.',
  icon: 'Quote',
  category: 'credibility',
  createData: () => ({
    heading: 'Kind words',
    layout: 'grid',
    items: [{ id: uid('tst'), quote: 'A short, specific quote about working with you.', author: 'Name', role: 'Role', company: 'Company', avatar: emptyImage() }],
  }),
  fields: [
    headingField,
    { kind: 'segmented', key: 'layout', label: 'Layout', options: opts(['grid', 'Grid'], ['carousel', 'Carousel'], ['single', 'Spotlight']) },
    {
      kind: 'list',
      key: 'items',
      label: 'Testimonials',
      itemLabel: 'Testimonial',
      titleKey: 'author',
      subtitleKey: 'company',
      createItem: () => ({ id: uid('tst'), quote: '', author: 'Name', role: '', company: '', avatar: emptyImage() }),
      fields: [
        { kind: 'textarea', key: 'quote', label: 'Quote', rows: 4 },
        { kind: 'text', key: 'author', label: 'Author' },
        { kind: 'text', key: 'role', label: 'Role' },
        { kind: 'text', key: 'company', label: 'Company' },
        { kind: 'image', key: 'avatar', label: 'Avatar' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: (d) => d.items.map((t) => ({ ref: t.avatar, label: `Avatar for ${t.author}` })),
  links: () => [],
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<div class="testimonials testimonials--${d.layout}"${d.layout === 'carousel' ? ' tabindex="0" role="region" aria-label="Testimonials, scroll horizontally"' : ''}>${d.items
      .map((t) => {
        const avatar = ctx.image(t.avatar, { className: 'testimonial-avatar', width: 48, height: 48 });
        const who = [t.role, t.company].filter(hasText).map(esc).join(', ');
        return `<figure class="testimonial card" data-anim-child><span class="testimonial-mark" aria-hidden="true">${ctx.icon('quote')}</span><blockquote><p>${esc(t.quote)}</p></blockquote><figcaption>${avatar}<span><strong>${esc(
          t.author,
        )}</strong>${who ? `<span>${who}</span>` : ''}</span></figcaption></figure>`;
      })
      .join('')}</div>`,
  toDocument: (d) => d.items.map((t) => ({ kind: 'quote' as const, text: t.quote, cite: [t.author, t.role, t.company].filter(hasText).join(', ') })),
};

/* ---------------------------------- Blog --------------------------------- */

export const blogSection: SectionDefinition<'blog'> = {
  type: 'blog',
  label: 'Blog / Writing',
  description: 'Articles and posts, linking to where they live.',
  icon: 'Newspaper',
  category: 'content',
  createData: () => ({ heading: 'Writing', intro: '', items: [{ id: uid('blg'), title: 'Article title', excerpt: '', date: '', url: '', tags: [] }] }),
  fields: [
    headingField,
    introField,
    {
      kind: 'list',
      key: 'items',
      label: 'Posts',
      itemLabel: 'Post',
      titleKey: 'title',
      subtitleKey: 'date',
      createItem: () => ({ id: uid('blg'), title: 'New post', excerpt: '', date: '', url: '', tags: [] }),
      fields: [
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'textarea', key: 'excerpt', label: 'Excerpt', rows: 3 },
        { kind: 'month', key: 'date', label: 'Published' },
        { kind: 'url', key: 'url', label: 'URL' },
        { kind: 'tags', key: 'tags', label: 'Tags' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: (d) => d.items.filter((i) => hasText(i.url)).map((i) => ({ url: i.url, label: `Post "${i.title}"` })),
  render: (d, ctx) =>
    `${sectionHeader(d.heading, d.intro, ctx)}<ul class="posts" role="list">${d.items
      .map(
        (p) => `<li class="post" data-anim-child>${hasText(p.date) ? `<span class="post-date">${esc(formatMonth(p.date, langOf(ctx)))}</span>` : ''}<div class="post-body"><h3 class="post-title">${
          hasText(p.url) ? link(p.url, `${esc(p.title)} ${ctx.icon('arrow-right')}`) : esc(p.title)
        }</h3>${hasText(p.excerpt) ? `<p class="post-excerpt">${esc(p.excerpt)}</p>` : ''}${tagList(p.tags)}</div></li>`,
      )
      .join('')}</ul>`,
  toDocument: (d, ctx) => d.items.map((p) => ({ kind: 'entry' as const, title: p.title, meta: formatMonth(p.date, langOf(ctx)), ...(hasText(p.url) ? { link: p.url } : {}), body: para(p.excerpt) })),
};

/* --------------------------------- Social -------------------------------- */

export const socialSection: SectionDefinition<'social'> = {
  type: 'social',
  label: 'Social Links',
  description: 'Profiles across the web. Also used by the hero and footer.',
  icon: 'AtSign',
  category: 'essentials',
  singleton: true,
  createData: () => ({
    heading: 'Elsewhere',
    style: 'buttons',
    items: [
      { id: uid('soc'), platform: 'GitHub', url: 'https://github.com/', label: 'GitHub' },
      { id: uid('soc'), platform: 'LinkedIn', url: 'https://www.linkedin.com/', label: 'LinkedIn' },
    ],
  }),
  fields: [
    headingField,
    { kind: 'segmented', key: 'style', label: 'Style', options: opts(['icons', 'Icons'], ['buttons', 'Buttons'], ['list', 'List']) },
    {
      kind: 'list',
      key: 'items',
      label: 'Profiles',
      itemLabel: 'Profile',
      titleKey: 'platform',
      subtitleKey: 'url',
      createItem: () => ({ id: uid('soc'), platform: 'Website', url: 'https://', label: '' }),
      fields: [
        { kind: 'text', key: 'platform', label: 'Platform', placeholder: 'GitHub, LinkedIn, X, Dribbble…' },
        { kind: 'url', key: 'url', label: 'URL' },
        { kind: 'text', key: 'label', label: 'Label (optional)' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: (d) => d.items.map((i) => ({ url: i.url, label: `${i.platform} profile` })),
  render: (d, ctx) => {
    const items = d.items.filter((s) => safeHref(s.url));
    return `${sectionHeader(d.heading, '', ctx)}<ul class="social social--${d.style}" role="list">${items
      .map((s) => {
        const icon = ctx.icon(socialIconForPlatform(s.platform, s.url));
        const label = s.label || s.platform;
        return `<li data-anim-child>${link(s.url, d.style === 'icons' ? icon : `${icon}<span>${esc(label)}</span>`, 'social-link', d.style === 'icons' ? `aria-label="${esc(label)}"` : '')}</li>`;
      })
      .join('')}</ul>`;
  },
  toDocument: (d) => [{ kind: 'contact', items: d.items.flatMap((s, i) => [...(i ? [{ text: '  ·  ' }] : []), { text: s.label || s.platform, link: safeHref(s.url) || undefined }]) }],
};

/* --------------------------------- Stats --------------------------------- */

export const statsSection: SectionDefinition<'stats'> = {
  type: 'stats',
  label: 'Stats',
  description: 'Headline numbers that summarise your impact.',
  icon: 'ChartNoAxesColumn',
  category: 'credibility',
  createData: () => ({
    heading: '',
    items: [
      { id: uid('st'), value: '8', suffix: '+', label: 'Years of experience' },
      { id: uid('st'), value: '40', suffix: '+', label: 'Projects shipped' },
    ],
  }),
  fields: [
    headingField,
    {
      kind: 'list',
      key: 'items',
      label: 'Stats',
      itemLabel: 'Stat',
      titleKey: 'label',
      subtitleKey: 'value',
      createItem: () => ({ id: uid('st'), value: '0', suffix: '', label: 'Label' }),
      fields: [
        { kind: 'text', key: 'value', label: 'Value' },
        { kind: 'text', key: 'suffix', label: 'Suffix', placeholder: '+, %, k…' },
        { kind: 'text', key: 'label', label: 'Label' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: () => [],
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<dl class="stats">${d.items
      .map((s) => {
        const numeric = /^\d+(\.\d+)?$/.test(s.value.trim());
        return `<div class="stat" data-anim-child><dt class="stat-label">${esc(s.label)}</dt><dd class="stat-value"><span${numeric ? ` data-count="${esc(s.value.trim())}"` : ''}>${esc(s.value)}</span>${esc(s.suffix)}</dd></div>`;
      })
      .join('')}</dl>`,
  toDocument: (d) => [{ kind: 'table', header: [], rows: d.items.map((s) => [`${s.value}${s.suffix}`, s.label]) }],
};

/* -------------------------------- Timeline ------------------------------- */

export const timelineSection: SectionDefinition<'timeline'> = {
  type: 'timeline',
  label: 'Timeline',
  description: 'A chronological journey of milestones.',
  icon: 'GitCommitVertical',
  category: 'content',
  createData: () => ({ heading: 'Journey', items: [{ id: uid('tl'), date: '2024', title: 'Milestone', description: '' }] }),
  fields: [
    headingField,
    {
      kind: 'list',
      key: 'items',
      label: 'Milestones',
      itemLabel: 'Milestone',
      titleKey: 'title',
      subtitleKey: 'date',
      createItem: () => ({ id: uid('tl'), date: '', title: 'New milestone', description: '' }),
      fields: [
        { kind: 'text', key: 'date', label: 'Date' },
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 2 },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: () => [],
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<ol class="timeline" role="list">${d.items
      .map((t) => `<li class="timeline-item" data-anim-child><span class="timeline-date">${esc(formatMonth(t.date, langOf(ctx)))}</span><div class="timeline-body"><h3>${esc(t.title)}</h3>${hasText(t.description) ? `<p>${esc(t.description)}</p>` : ''}</div></li>`)
      .join('')}</ol>`,
  toDocument: (d, ctx) => d.items.map((t) => ({ kind: 'entry' as const, title: t.title, meta: formatMonth(t.date, langOf(ctx)), body: para(t.description) })),
};

/* -------------------------------- Gallery -------------------------------- */

export const gallerySection: SectionDefinition<'gallery'> = {
  type: 'gallery',
  label: 'Gallery',
  description: 'A grid of images — photography, shots, artwork.',
  icon: 'Images',
  category: 'content',
  createData: () => ({ heading: 'Gallery', layout: 'grid', items: [] }),
  fields: [
    headingField,
    { kind: 'segmented', key: 'layout', label: 'Layout', options: opts(['grid', 'Grid'], ['masonry', 'Masonry'], ['strip', 'Strip']) },
    {
      kind: 'list',
      key: 'items',
      label: 'Images',
      itemLabel: 'Image',
      titleKey: 'caption',
      createItem: () => ({ id: uid('gal'), image: emptyImage(), caption: '' }),
      fields: [
        { kind: 'image', key: 'image', label: 'Image' },
        { kind: 'text', key: 'caption', label: 'Caption' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.filter((i) => i.image.src).length === 0,
  images: (d) => d.items.map((g, i) => ({ ref: g.image, label: `Gallery image ${i + 1}` })),
  links: () => [],
  render: (d, ctx) =>
    `${sectionHeader(d.heading, '', ctx)}<div class="gallery gallery--${d.layout}">${d.items
      .filter((g) => g.image.src)
      .map((g) => `<figure class="gallery-item" data-anim-child><button type="button" class="gallery-open" data-lightbox aria-label="Enlarge: ${esc(g.image.alt || g.caption || 'image')}">${ctx.image(g.image, { width: 800, height: 600 })}</button>${hasText(g.caption) ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`)
      .join('')}</div>`,
  toDocument: (d) => d.items.filter((g) => g.image.src).map((g) => ({ kind: 'image' as const, src: g.image.src, alt: g.image.alt, caption: g.caption, maxWidthRatio: 0.7 })),
};
