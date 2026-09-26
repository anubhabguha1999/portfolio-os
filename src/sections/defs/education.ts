import type { SectionDefinition } from '../types';
import { esc, hasText, headingField, dateRange, sectionHeader, para } from '../helpers';
import { uid } from '@/utils/id';
import { formatRange } from '@/utils/format';

const createItem = () => ({ id: uid('edu'), institution: 'Institution', degree: 'Degree', field: '', location: '', start: '', end: '', grade: '', description: '' });

export const educationSection: SectionDefinition<'education'> = {
  type: 'education',
  label: 'Education',
  description: 'Degrees, schools and programmes.',
  icon: 'GraduationCap',
  category: 'work',
  createData: () => ({ heading: 'Education', items: [createItem()] }),
  fields: [
    headingField,
    {
      kind: 'list',
      key: 'items',
      label: 'Entries',
      itemLabel: 'Entry',
      titleKey: 'degree',
      subtitleKey: 'institution',
      createItem,
      fields: [
        { kind: 'text', key: 'institution', label: 'Institution' },
        { kind: 'text', key: 'degree', label: 'Degree' },
        { kind: 'text', key: 'field', label: 'Field of study' },
        { kind: 'text', key: 'location', label: 'Location' },
        { kind: 'month', key: 'start', label: 'Start' },
        { kind: 'month', key: 'end', label: 'End' },
        { kind: 'text', key: 'grade', label: 'Grade / honours' },
        { kind: 'textarea', key: 'description', label: 'Description', rows: 3 },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: () => [],
  render(d, ctx) {
    const items = d.items
      .map(
        (i) => `<li class="edu-item card" data-anim-child>
  <div class="edu-icon" aria-hidden="true">${ctx.icon('graduation')}</div>
  <div class="edu-body">
    <h3 class="edu-degree">${esc(i.degree)}${hasText(i.field) ? `, ${esc(i.field)}` : ''}</h3>
    <p class="edu-school">${esc(i.institution)}${hasText(i.location) ? ` · ${esc(i.location)}` : ''}</p>
    ${hasText(i.grade) ? `<p class="edu-grade">${esc(i.grade)}</p>` : ''}
    ${hasText(i.description) ? `<p class="edu-desc">${esc(i.description)}</p>` : ''}
  </div>
  ${dateRange(i.start, i.end)}
</li>`,
      )
      .join('');
    return `${sectionHeader(d.heading, '', ctx)}<ul class="edu" role="list">${items}</ul>`;
  },
  toDocument: (d) =>
    d.items.map((i) => ({
      kind: 'entry' as const,
      title: `${i.degree}${hasText(i.field) ? `, ${i.field}` : ''}`,
      subtitle: i.institution,
      meta: formatRange(i.start, i.end),
      location: i.location,
      body: [...para(i.grade, 'muted'), ...para(i.description)],
    })),
};
