import type { SectionDefinition } from '../types';
import { langOf, esc, hasText, opts, headingField, introField, sectionHeader, dateRange, bulletList, tagList, link, bullets, para } from '../helpers';
import { uid } from '@/utils/id';
import { formatRange } from '@/utils/format';
import type { ExperienceItem } from '@/types/portfolio';

export const createExperienceItem = (): ExperienceItem => ({
  id: uid('exp'),
  company: 'Company',
  role: 'Role',
  location: '',
  start: '',
  end: '',
  current: false,
  url: '',
  description: '',
  achievements: [],
  technologies: [],
});

export const experienceSection: SectionDefinition<'experience'> = {
  type: 'experience',
  label: 'Experience',
  description: 'Roles, impact and the technologies you used.',
  icon: 'Briefcase',
  category: 'work',
  createData: () => ({ heading: 'Experience', intro: '', style: 'timeline', items: [createExperienceItem()] }),
  fields: [
    headingField,
    introField,
    { kind: 'segmented', key: 'style', label: 'Style', options: opts(['timeline', 'Timeline'], ['cards', 'Cards'], ['compact', 'Compact'], ['alternating', 'Alternating']) },
    {
      kind: 'list',
      key: 'items',
      label: 'Positions',
      itemLabel: 'Position',
      titleKey: 'role',
      subtitleKey: 'company',
      createItem: () => ({ ...createExperienceItem() }),
      fields: [
        { kind: 'text', key: 'role', label: 'Role' },
        { kind: 'text', key: 'company', label: 'Company' },
        { kind: 'url', key: 'url', label: 'Company URL' },
        { kind: 'text', key: 'location', label: 'Location' },
        { kind: 'month', key: 'start', label: 'Start' },
        { kind: 'toggle', key: 'current', label: 'I currently work here' },
        { kind: 'month', key: 'end', label: 'End', showWhen: { key: 'current', equals: [false] } },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 3 },
        { kind: 'stringList', key: 'achievements', label: 'Achievements', itemLabel: 'Achievement' },
        { kind: 'tags', key: 'technologies', label: 'Technologies' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: (d) => d.items.filter((i) => hasText(i.url)).map((i) => ({ url: i.url, label: `${i.company} website` })),
  render(d, ctx) {
    const items = d.items
      .map(
        (i) => `<li class="xp-item" data-anim-child>
  <div class="xp-marker" aria-hidden="true"></div>
  <article class="xp-card card">
    <header class="xp-head">
      <div>
        <h3 class="xp-role">${esc(i.role)}</h3>
        <p class="xp-company">${hasText(i.url) ? link(i.url, esc(i.company)) : esc(i.company)}${hasText(i.location) ? `<span class="xp-location"> · ${esc(i.location)}</span>` : ''}</p>
      </div>
      ${dateRange(i.start, i.end, i.current, langOf(ctx))}
    </header>
    ${hasText(i.description) ? `<p class="xp-desc">${esc(i.description)}</p>` : ''}
    ${bulletList(i.achievements, 'bullets xp-achievements')}
    ${tagList(i.technologies)}
  </article>
</li>`,
      )
      .join('');
    return `${sectionHeader(d.heading, d.intro, ctx)}<ol class="xp xp--${d.style}" role="list">${items}</ol>`;
  },
  toDocument: (d, ctx) => [
    ...ctx.markdownBlocks(d.intro),
    ...d.items.map((i) => ({
      kind: 'entry' as const,
      title: i.role,
      subtitle: i.company,
      meta: formatRange(i.start, i.end, i.current, langOf(ctx)),
      location: i.location,
      ...(hasText(i.url) ? { link: i.url } : {}),
      body: [
        ...para(i.description),
        ...bullets(i.achievements),
        ...(i.technologies.length ? [{ kind: 'tags' as const, label: 'Technologies', items: i.technologies }] : []),
      ],
    })),
  ],
};
