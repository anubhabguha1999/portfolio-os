import type { SectionDefinition } from '../types';
import { esc, hasText, headingField, opts } from '../helpers';
import { sanitizeHtml, scopeCss } from '@/lib/sanitize';

export const customSection: SectionDefinition<'custom'> = {
  type: 'custom',
  label: 'Custom',
  description: 'Markdown or sanitised HTML with scoped CSS. Scripts never run.',
  icon: 'CodeXml',
  category: 'advanced',
  createData: () => ({ heading: 'Custom section', mode: 'markdown', content: 'Write **anything** here using Markdown.', css: '' }),
  fields: [
    headingField,
    { kind: 'segmented', key: 'mode', label: 'Content type', options: opts(['markdown', 'Markdown'], ['html', 'HTML']) },
    { kind: 'code', key: 'content', label: 'Content', language: 'markdown', showWhen: { key: 'mode', equals: ['markdown'] } },
    { kind: 'code', key: 'content', label: 'HTML', language: 'html', help: 'Sanitised: scripts, event handlers, iframes and forms are removed.', showWhen: { key: 'mode', equals: ['html'] } },
    { kind: 'code', key: 'css', label: 'Scoped CSS', language: 'css', help: 'Applies to this section only. @import and remote url() are stripped.' },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => !hasText(d.content),
  images: () => [],
  links: () => [],
  render(d, ctx, section) {
    const body = d.mode === 'html' ? sanitizeHtml(d.content) : ctx.markdown(d.content);
    if (hasText(d.css)) ctx.addCss(`custom-${section.id}`, scopeCss(d.css, `[data-section-id="${section.id}"]`));
    return `${hasText(d.heading) ? `<h2 class="section-title" data-anim-child>${esc(d.heading)}</h2>` : ''}<div class="custom-content prose" data-anim-child>${body}</div>`;
  },
  toDocument: (d, ctx) => (d.mode === 'markdown' ? ctx.markdownBlocks(d.content) : ctx.markdownBlocks(htmlToText(d.content))),
};

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
  const parts: string[] = [];
  doc.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote').forEach((el) => {
    const t = el.textContent?.trim();
    if (!t) return;
    if (/^H[1-4]$/.test(el.tagName)) parts.push(`### ${t}`);
    else if (el.tagName === 'LI') parts.push(`- ${t}`);
    else parts.push(t);
  });
  return parts.join('\n\n') || (doc.body.textContent ?? '');
}
