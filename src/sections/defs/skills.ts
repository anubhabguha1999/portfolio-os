import type { SectionDefinition } from '../types';
import { esc, hasText, opts, headingField, introField, sectionHeader } from '../helpers';
import { uid } from '@/utils/id';
import type { SkillItem } from '@/types/portfolio';
import type { DocBlock } from '@/types/document';
import { safeMediaSrc } from '@/utils/url';

const createSkill = (): SkillItem => ({ id: uid('skl'), name: 'Skill', category: 'General', level: 0, years: 0, icon: '', color: '' });

const LEVEL_LABELS = ['', 'Familiar', 'Working knowledge', 'Proficient', 'Advanced', 'Expert'];

export function groupSkills(items: SkillItem[]): Array<[string, SkillItem[]]> {
  const groups = new Map<string, SkillItem[]>();
  for (const s of items) {
    const key = s.category.trim() || 'Other';
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()];
}

export const skillsSection: SectionDefinition<'skills'> = {
  type: 'skills',
  label: 'Skills',
  description: 'Tools and disciplines — without fake percentage bars.',
  icon: 'Layers',
  category: 'work',
  createData: () => ({ heading: 'Skills', intro: '', display: 'grouped', items: [createSkill()] }),
  fields: [
    headingField,
    introField,
    {
      kind: 'select',
      key: 'display',
      label: 'Display',
      help: 'Experience bars use years of experience, relative to your most-used skill.',
      options: opts(['tags', 'Tags'], ['grouped', 'Grouped'], ['bars', 'Experience bars'], ['orbit', 'Orbit'], ['grid', 'Grid'], ['stack', 'Stack']),
    },
    {
      kind: 'list',
      key: 'items',
      label: 'Skills',
      itemLabel: 'Skill',
      titleKey: 'name',
      subtitleKey: 'category',
      createItem: () => ({ ...createSkill() }),
      fields: [
        { kind: 'text', key: 'name', label: 'Name' },
        { kind: 'text', key: 'category', label: 'Category' },
        { kind: 'number', key: 'years', label: 'Years of experience', min: 0, max: 60, step: 0.5 },
        { kind: 'select', key: 'level', label: 'Level (optional)', options: opts(['0', 'Not specified'], ['1', 'Familiar'], ['2', 'Working knowledge'], ['3', 'Proficient'], ['4', 'Advanced'], ['5', 'Expert']) },
        { kind: 'icon', key: 'icon', label: 'Icon', help: 'Built-in icon name or image URL.' },
        { kind: 'color', key: 'color', label: 'Accent colour' },
      ],
    },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => d.items.length === 0,
  images: () => [],
  links: () => [],
  render(d, ctx) {
    const maxYears = Math.max(1, ...d.items.map((s) => s.years || 0));
    const iconHtml = (s: SkillItem) => {
      if (!hasText(s.icon)) return '';
      const src = safeMediaSrc(s.icon);
      if (src) return `<img class="skill-icon" src="${esc(src)}" alt="" width="20" height="20" loading="lazy">`;
      return `<span class="skill-icon">${ctx.icon(s.icon)}</span>`;
    };
    const style = (s: SkillItem) => (hasText(s.color) && /^#[0-9a-f]{3,8}$/i.test(s.color) ? ` style="--skill-color:${s.color}"` : '');
    const meta = (s: SkillItem) => {
      const bits: string[] = [];
      if (s.years > 0) bits.push(`${s.years} yr${s.years === 1 ? '' : 's'}`);
      const lvl = LEVEL_LABELS[Math.round(Number(s.level))];
      if (lvl) bits.push(lvl);
      return bits.length ? `<span class="skill-meta">${esc(bits.join(' · '))}</span>` : '';
    };
    const chip = (s: SkillItem) => `<li class="skill"${style(s)} data-anim-child>${iconHtml(s)}<span class="skill-name">${esc(s.name)}</span>${d.display === 'tags' ? '' : meta(s)}</li>`;
    let body = '';
    switch (d.display) {
      case 'grouped':
        body = `<div class="skill-groups">${groupSkills(d.items)
          .map(([cat, list]) => `<div class="skill-group card" data-anim-child><h3 class="skill-group-title">${esc(cat)}</h3><ul class="skills skills--tags" role="list">${list.map(chip).join('')}</ul></div>`)
          .join('')}</div>`;
        break;
      case 'bars':
        body = `<ul class="skills skills--bars" role="list">${d.items
          .map((s) => {
            const pct = s.years > 0 ? Math.round((s.years / maxYears) * 100) : 0;
            return `<li class="skill-bar"${style(s)} data-anim-child><div class="skill-bar-head"><span class="skill-name">${iconHtml(s)}${esc(s.name)}</span>${meta(s)}</div>${
              pct ? `<div class="skill-bar-track" aria-hidden="true"><span style="width:${pct}%"></span></div>` : ''
            }</li>`;
          })
          .join('')}</ul>`;
        break;
      case 'orbit': {
        const n = d.items.length || 1;
        body = `<div class="skills-orbit" role="list">${d.items
          .map((s, i) => `<div role="listitem" class="orbit-item" style="--i:${i};--n:${n}${hasText(s.color) && /^#[0-9a-f]{3,8}$/i.test(s.color) ? `;--skill-color:${s.color}` : ''}" data-anim-child>${iconHtml(s)}<span>${esc(s.name)}</span></div>`)
          .join('')}<div class="orbit-core" aria-hidden="true"></div></div>`;
        break;
      }
      case 'stack':
        body = `<ul class="skills skills--stack" role="list">${groupSkills(d.items)
          .map(([cat, list]) => `<li class="stack-row" data-anim-child><span class="stack-cat">${esc(cat)}</span><span class="stack-items">${list.map((s) => esc(s.name)).join('<span aria-hidden="true"> / </span>')}</span></li>`)
          .join('')}</ul>`;
        break;
      default:
        body = `<ul class="skills skills--${d.display}" role="list">${d.items.map(chip).join('')}</ul>`;
    }
    return `${sectionHeader(d.heading, d.intro, ctx)}${body}`;
  },
  toDocument: (d): DocBlock[] => {
    const groups = groupSkills(d.items);
    if (groups.length <= 1) return [{ kind: 'tags', items: d.items.map((s) => s.name) }];
    return groups.map(([cat, list]) => ({ kind: 'tags' as const, label: cat, items: list.map((s) => s.name) }));
  },
};
