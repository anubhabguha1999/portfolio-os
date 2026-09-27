import type { PortfolioSection, AnimationType } from '@/types/portfolio';
import { useEditor } from '@/stores/editor';
import { Segmented, Select, Slider, Switch, TextInput } from '@/components/ui/Field';
import { Group } from './Group';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/utils/cn';

const ANIMATIONS: Array<{ value: AnimationType; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide up' },
  { value: 'scale', label: 'Scale' },
  { value: 'blur', label: 'Blur in' },
  { value: 'reveal', label: 'Reveal (wipe)' },
  { value: 'stagger', label: 'Stagger children' },
  { value: 'parallax', label: 'Parallax' },
  { value: 'magnetic', label: 'Magnetic cards' },
];

export function SectionStylePanel({ section }: { section: PortfolioSection }) {
  const update = useEditor((s) => s.updateSectionStyle);
  const rename = useEditor((s) => s.renameSection);
  const st = section.style;
  const set = (path: string, v: unknown) => update(section.id, path, v);
  const disabled = section.locked;
  const a = st.animation;

  return (
    <div>
      <Group title="Section">
        <TextInput label="Name" help="Shown in navigation and the layers list." value={section.name} onChange={(e) => rename(section.id, e.target.value)} />
        <TextInput label="Anchor (#id)" help="Used for in-page links like #projects." value={st.anchor} disabled={disabled} spellCheck={false} onChange={(e) => set('anchor', e.target.value)} />
        <Switch label="Show in navigation" checked={st.showInNav} disabled={disabled} onChange={(v) => set('showInNav', v)} />
      </Group>
      <Group title="Layout">
        <Select
          label="Background"
          value={st.background}
          disabled={disabled}
          onChange={(e) => set('background', e.target.value)}
          options={[
            { value: 'default', label: 'Page background' },
            { value: 'surface', label: 'Surface' },
            { value: 'gradient', label: 'Soft gradient' },
            { value: 'primary', label: 'Primary colour' },
            { value: 'accent', label: 'Accent colour' },
            { value: 'inverted', label: 'Inverted' },
            { value: 'transparent', label: 'Transparent' },
          ]}
        />
        <Segmented label="Vertical spacing" size="xs" value={st.paddingY} onChange={(v) => !disabled && set('paddingY', v)} options={['none', 'sm', 'md', 'lg', 'xl'].map((v) => ({ value: v as typeof st.paddingY, label: v.toUpperCase() }))} />
        <Segmented label="Content width" size="xs" value={st.width} onChange={(v) => !disabled && set('width', v)} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'default', label: 'Default' }, { value: 'wide', label: 'Wide' }, { value: 'full', label: 'Full' }]} />
        <Segmented label="Alignment" size="xs" value={st.align} onChange={(v) => !disabled && set('align', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }]} />
      </Group>
      <Group title="Animation">
        <Select label="Entrance" value={a.type} disabled={disabled} onChange={(e) => set('animation.type', e.target.value)} options={ANIMATIONS} />
        {a.type !== 'none' && (
          <>
            {!['parallax', 'magnetic'].includes(a.type) && (
              <>
                <Slider label="Duration" value={a.duration} min={100} max={2000} step={50} unit="ms" onChange={(v) => set('animation.duration', v)} />
                <Slider label="Delay" value={a.delay} min={0} max={1500} step={50} unit="ms" onChange={(v) => set('animation.delay', v)} />
                <Select label="Easing" value={a.easing} disabled={disabled} onChange={(e) => set('animation.easing', e.target.value)} options={[{ value: 'ease-out', label: 'Ease out (expo)' }, { value: 'ease-in-out', label: 'Ease in-out' }, { value: 'spring', label: 'Spring' }, { value: 'ease', label: 'Ease' }, { value: 'linear', label: 'Linear' }]} />
                <Segmented label="Trigger" size="xs" value={a.trigger} onChange={(v) => !disabled && set('animation.trigger', v)} options={[{ value: 'scroll', label: 'On scroll' }, { value: 'load', label: 'On load' }]} />
              </>
            )}
            <p className="text-[11.5px] leading-snug text-fg-subtle">Visitors with “reduce motion” enabled always see content without animation.</p>
          </>
        )}
      </Group>
      <Group title="Responsive visibility">
        <div className="grid grid-cols-3 gap-2">
          {([
            ['desktop', 'Desktop', Monitor],
            ['tablet', 'Tablet', Tablet],
            ['mobile', 'Mobile', Smartphone],
          ] as const).map(([key, label, Icon]) => {
            const hidden = st.hideOn[key];
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-pressed={!hidden}
                onClick={() => set(`hideOn.${key}`, !hidden)}
                className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-[11.5px] transition-colors', hidden ? 'border-line text-fg-subtle line-through' : 'border-accent/40 bg-accent-soft text-fg')}
              >
                <Icon className="size-4" /> {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-fg-subtle">Desktop ≥1025px · Tablet 641–1024px · Mobile ≤640px</p>
      </Group>
    </div>
  );
}
