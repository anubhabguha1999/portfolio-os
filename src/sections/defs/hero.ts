import type { SectionDefinition } from '../types';
import { esc, hasText, link, opts, emptyImage, para, run } from '../helpers';
import { uid } from '@/utils/id';
import { socialIconFor } from '../icons';
import { safeHref, safeMediaSrc } from '@/utils/url';

export const heroSection: SectionDefinition<'hero'> = {
  type: 'hero',
  label: 'Hero',
  description: 'Your name, headline and primary calls to action.',
  icon: 'Sparkles',
  category: 'essentials',
  singleton: true,
  fullBleed: true,
  createData: () => ({
    eyebrow: '',
    name: 'Your Name',
    title: 'What you do, in one line',
    description: 'A short, specific introduction: who you help, what you build, and what makes your work distinctive.',
    image: emptyImage(),
    layout: 'centered',
    ctas: [
      { id: uid('cta'), label: 'View my work', url: '#projects', variant: 'primary' },
      { id: uid('cta'), label: 'Get in touch', url: '#contact', variant: 'secondary' },
    ],
    showSocial: true,
    background: 'gradient',
    backgroundImage: emptyImage(),
    videoUrl: '',
    overlayOpacity: 0.55,
    typingEnabled: false,
    typingPhrases: [],
    parallax: false,
    magneticButtons: false,
    availability: '',
  }),
  fields: [
    { kind: 'text', key: 'name', label: 'Name' },
    { kind: 'text', key: 'title', label: 'Headline' },
    { kind: 'textarea', key: 'description', label: 'Introduction', rows: 3 },
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow', placeholder: 'e.g. Senior Engineer at Acme' },
    { kind: 'text', key: 'availability', label: 'Availability badge', placeholder: 'e.g. Available for freelance' },
    { kind: 'image', key: 'image', label: 'Profile image' },
    { kind: 'segmented', key: 'layout', label: 'Layout', options: opts(['centered', 'Centered'], ['split', 'Split'], ['minimal', 'Minimal'], ['bold', 'Bold']) },
    {
      kind: 'list',
      key: 'ctas',
      label: 'Buttons',
      itemLabel: 'Button',
      titleKey: 'label',
      subtitleKey: 'url',
      createItem: () => ({ id: uid('cta'), label: 'New button', url: '#', variant: 'secondary' }),
      fields: [
        { kind: 'text', key: 'label', label: 'Label' },
        { kind: 'url', key: 'url', label: 'Link' },
        { kind: 'segmented', key: 'variant', label: 'Style', options: opts(['primary', 'Primary'], ['secondary', 'Secondary'], ['ghost', 'Ghost']) },
      ],
    },
    { kind: 'toggle', key: 'showSocial', label: 'Show social links', help: 'Pulled from your Social Links section.' },
    {
      kind: 'select',
      key: 'background',
      label: 'Background',
      options: opts(['none', 'None'], ['gradient', 'Gradient'], ['aurora', 'Aurora'], ['particles', 'Particles'], ['grid', 'Grid'], ['spotlight', 'Spotlight'], ['image', 'Image'], ['video', 'Video']),
    },
    { kind: 'image', key: 'backgroundImage', label: 'Background image', showWhen: { key: 'background', equals: ['image'] } },
    { kind: 'url', key: 'videoUrl', label: 'Video URL (.mp4/.webm)', help: 'Hosted video file. Requires network when viewed.', showWhen: { key: 'background', equals: ['video'] } },
    { kind: 'number', key: 'overlayOpacity', label: 'Overlay opacity', min: 0, max: 0.95, step: 0.05, showWhen: { key: 'background', equals: ['image', 'video'] } },
    { kind: 'toggle', key: 'typingEnabled', label: 'Typing effect' },
    { kind: 'stringList', key: 'typingPhrases', label: 'Typing phrases', itemLabel: 'Phrase', showWhen: { key: 'typingEnabled', equals: [true] } },
    { kind: 'toggle', key: 'parallax', label: 'Parallax' },
    { kind: 'toggle', key: 'magneticButtons', label: 'Magnetic buttons' },
  ],
  heading: (d) => d.name,
  isEmpty: (d) => !hasText(d.name) && !hasText(d.title),
  images: (d) => [
    { ref: d.image, label: 'Hero profile image' },
    ...(d.background === 'image' ? [{ ref: d.backgroundImage, label: 'Hero background image' }] : []),
  ],
  links: (d) => d.ctas.map((c) => ({ url: c.url, label: `Hero button "${c.label}"` })),
  render(d, ctx) {
    let bg = '';
    switch (d.background) {
      case 'particles':
        bg = '<canvas class="hero-particles" data-particles aria-hidden="true"></canvas>';
        break;
      case 'grid':
        bg = '<div class="hero-grid" aria-hidden="true"></div>';
        break;
      case 'spotlight':
        bg = '<div class="hero-spotlight" data-spotlight aria-hidden="true"></div>';
        break;
      case 'aurora':
        bg = '<div class="hero-aurora" aria-hidden="true"><span></span><span></span><span></span></div>';
        break;
      case 'gradient':
        bg = '<div class="hero-gradient" aria-hidden="true"></div>';
        break;
      case 'image':
        if (d.backgroundImage.src) bg = `<div class="hero-media" ${ctx.backgroundImage(d.backgroundImage.src)} aria-hidden="true"></div>`;
        break;
      case 'video': {
        const src = safeMediaSrc(d.videoUrl);
        if (src) bg = `<video class="hero-media" src="${esc(src)}" autoplay muted loop playsinline aria-hidden="true" data-bg-video></video>`;
        break;
      }
    }
    const overlay = d.background === 'image' || d.background === 'video' ? `<div class="hero-overlay" style="opacity:${Math.max(0, Math.min(0.95, d.overlayOpacity))}" aria-hidden="true"></div>` : '';
    const phrases = d.typingPhrases.filter(hasText);
    const typing = d.typingEnabled && phrases.length ? ` <span class="typing" data-typing="${esc(JSON.stringify(phrases))}" aria-hidden="true"></span><span class="sr-only">${esc(phrases.join(', '))}</span>` : '';
    const ctas = d.ctas
      .filter((c) => hasText(c.label))
      .map((c) => link(c.url, `<span>${esc(c.label)}</span>`, `btn btn--${c.variant}`, d.magneticButtons ? 'data-magnetic' : ''))
      .join('');
    const socials = d.showSocial
      ? ctx
          .socialLinks()
          .filter((s) => safeHref(s.url))
          .map((s) => link(s.url, ctx.icon(socialIconFor(s.platform, s.url)), 'social-icon', `aria-label="${esc(s.label || s.platform)}"`))
          .join('')
      : '';
    const img = d.layout !== 'minimal' ? ctx.image(d.image, { className: 'hero-avatar', eager: true, width: 480, height: 480 }) : '';
    return `<div class="hero hero--${d.layout} hero-bg--${d.background}"${d.parallax ? ' data-parallax-root' : ''}>
  <div class="hero-bg"${d.parallax ? ' data-parallax="0.25"' : ''}>${bg}${overlay}</div>
  <div class="container hero-inner">
    ${img && d.layout === 'centered' ? `<div class="hero-avatar-wrap" data-anim-child>${img}</div>` : ''}
    <div class="hero-copy">
      ${hasText(d.availability) ? `<p class="hero-badge" data-anim-child><span class="pulse" aria-hidden="true"></span>${esc(d.availability)}</p>` : ''}
      ${hasText(d.eyebrow) ? `<p class="hero-eyebrow" data-anim-child>${esc(d.eyebrow)}</p>` : ''}
      <h1 class="hero-name" data-anim-child>${esc(d.name)}</h1>
      ${hasText(d.title) || typing ? `<p class="hero-title" data-anim-child>${esc(d.title)}${typing}</p>` : ''}
      ${hasText(d.description) ? `<p class="hero-description" data-anim-child>${esc(d.description)}</p>` : ''}
      ${ctas ? `<div class="hero-ctas" data-anim-child>${ctas}</div>` : ''}
      ${socials ? `<div class="hero-social" data-anim-child>${socials}</div>` : ''}
    </div>
    ${img && d.layout !== 'centered' ? `<div class="hero-visual" data-anim-child>${img}</div>` : ''}
  </div>
  ${d.layout !== 'minimal' ? '<a class="hero-scroll" href="#main-after-hero" aria-label="Scroll to content">' + ctx.icon('arrow-down') + '</a>' : ''}
</div>`;
  },
  toDocument: (d) => [
    ...(hasText(d.title) ? [{ kind: 'paragraph' as const, runs: [run(d.title, { bold: true })], tone: 'lead' as const }] : []),
    ...para(d.description),
  ],
};
