import type { SectionDefinition } from '../types';
import { esc, hasText, opts, emptyImage, headingField, bullets } from '../helpers';

export const aboutSection: SectionDefinition<'about'> = {
  type: 'about',
  label: 'About',
  description: 'Your story, values and what drives your work.',
  icon: 'User',
  category: 'essentials',
  createData: () => ({
    heading: 'About',
    body: 'Write two or three short paragraphs about your background, the problems you enjoy solving, and how you work with others.',
    image: emptyImage(),
    highlights: [],
    layout: 'split',
  }),
  fields: [
    headingField,
    { kind: 'markdown', key: 'body', label: 'Body', help: 'Markdown supported.' },
    { kind: 'image', key: 'image', label: 'Image' },
    { kind: 'stringList', key: 'highlights', label: 'Highlights', itemLabel: 'Highlight' },
    { kind: 'segmented', key: 'layout', label: 'Layout', options: opts(['split', 'Split'], ['stacked', 'Stacked'], ['quote', 'Statement']) },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => !hasText(d.body),
  images: (d) => [{ ref: d.image, label: 'About image' }],
  links: () => [],
  render(d, ctx) {
    const img = ctx.image(d.image, { className: 'about-image', width: 560, height: 700 });
    const highlights = d.highlights.filter(hasText);
    return `<div class="about about--${d.layout}${img ? ' has-image' : ''}">
  <div class="about-copy">
    ${hasText(d.heading) ? `<h2 class="section-title" data-anim-child>${esc(d.heading)}</h2>` : ''}
    <div class="prose" data-anim-child>${ctx.markdown(d.body)}</div>
    ${highlights.length ? `<ul class="about-highlights" role="list">${highlights.map((h) => `<li data-anim-child>${ctx.icon('check')}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
  </div>
  ${img ? `<div class="about-media" data-anim-child>${img}</div>` : ''}
</div>`;
  },
  toDocument: (d, ctx) => [...ctx.markdownBlocks(d.body), ...bullets(d.highlights)],
};
