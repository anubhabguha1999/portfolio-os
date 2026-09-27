import { useRef, useState } from 'react';
import { Check, Dices, Trash2, Type, Upload } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { useAssets } from '@/stores/assets';
import { toast } from '@/stores/ui';
import { THEMES } from '@/lib/theme/themes';
import { FONT_CATALOG } from '@/lib/theme/fonts';
import { generateTheme } from '@/lib/theme/randomizer';
import type { ColorKey, ColorScheme, CustomFont } from '@/types/portfolio';
import { contrastRatio } from '@/utils/color';
import { uid } from '@/utils/id';
import { Button } from '@/components/ui/Button';
import { Segmented, Select, Slider, Switch } from '@/components/ui/Field';
import { Badge } from '@/components/ui/misc';
import { ColorField } from '../fields/ColorField';
import { Group } from './Group';
import { cn } from '@/utils/cn';

const COLOR_LABELS: Array<[ColorKey, string]> = [
  ['primary', 'Primary'],
  ['primaryContrast', 'Text on primary'],
  ['secondary', 'Secondary'],
  ['accent', 'Accent'],
  ['background', 'Background'],
  ['surface', 'Surface'],
  ['text', 'Text'],
  ['muted', 'Muted text'],
  ['border', 'Border'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['error', 'Error'],
];

function ContrastBadge({ fg, bg }: { fg: string; bg: string }) {
  const r = contrastRatio(fg, bg);
  const tone = r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'danger';
  return (
    <Badge tone={tone} className="font-mono !text-[10px]">
      {r.toFixed(1)}:1 {r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'Fail'}
    </Badge>
  );
}

export function ThemePanel() {
  const theme = useEditor((s) => s.portfolio!.theme);
  const customFonts = useEditor((s) => s.portfolio!.metadata.customFonts);
  const scheme = useEditor((s) => s.portfolio!.settings.colorScheme);
  const setTheme = useEditor((s) => s.setTheme);
  const replaceTheme = useEditor((s) => s.replaceTheme);
  const updateTheme = useEditor((s) => s.updateTheme);
  const updateMeta = useEditor((s) => s.updateMetadata);
  const [editScheme, setEditScheme] = useState<ColorScheme>(scheme === 'system' ? theme.defaultScheme : scheme);
  const fontInput = useRef<HTMLInputElement>(null);
  const pal = theme.palettes[editScheme];
  const t = theme.typography;
  const l = theme.layout;
  const e = theme.effects;

  const fontOptions = [
    ...FONT_CATALOG.map((f) => ({ value: f.id, label: `${f.label}${f.google ? '' : ' · system'}` })),
    ...customFonts.map((f) => ({ value: f.id, label: `${f.family} · uploaded` })),
  ];

  const uploadFont = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const format = ({ woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' } as const)[ext as 'woff2' | 'woff' | 'ttf' | 'otf'];
    if (!format) return toast({ tone: 'error', title: 'Unsupported font', description: 'Use .woff2, .woff, .ttf or .otf files.' });
    if (file.size > 3 * 1024 * 1024) return toast({ tone: 'error', title: 'Font too large', description: 'Fonts must be under 3 MB (they are embedded in exports).' });
    const mime = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' }[format];
    const rec = await useAssets.getState().add(new Blob([await file.arrayBuffer()], { type: mime }), { name: file.name, width: 0, height: 0 });
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b(regular|variable|vf|webfont)\b/gi, '').trim() || 'Custom Font';
    const font: CustomFont = { id: uid('font'), family, assetId: rec.id, format, weight: '100 900', style: 'normal' };
    updateMeta('customFonts', [...customFonts, font]);
    toast({ tone: 'success', title: `Font “${family}” added`, description: 'Select it under Heading or Body font. It is embedded into exports.' });
  };

  return (
    <div>
      <Group
        title="Themes"
        action={
          <Button
            size="xs"
            variant="ghost"
            icon={<Dices className="size-3.5" />}
            onClick={() => {
              replaceTheme(generateTheme(theme, Math.floor(Math.random() * 2 ** 31)), 'Generate design');
              toast({ tone: 'success', title: 'New design generated', description: 'Content unchanged. Undo with ⌘/Ctrl+Z.' });
            }}
          >
            Generate
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((th) => {
            const p = th.palettes[th.defaultScheme];
            const active = th.id === theme.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => setTheme(th.id)}
                aria-pressed={active}
                title={th.description}
                className={cn('group overflow-hidden rounded-xl border text-left transition-all', active ? 'border-accent ring-2 ring-accent/25' : 'border-line hover:border-line-strong')}
              >
                <div className="relative h-14 p-2" style={{ background: p.background }}>
                  <div className="h-1.5 w-10 rounded-full" style={{ background: p.text, opacity: 0.85 }} />
                  <div className="mt-1 h-1 w-14 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <span className="h-3 w-6 rounded-sm" style={{ background: p.primary, borderRadius: Math.min(th.layout.buttonRadius, 6) }} />
                    <span className="size-3 rounded-full" style={{ background: p.accent }} />
                  </div>
                  {active && <Check className="absolute right-1.5 top-1.5 size-3.5 rounded-full bg-accent p-0.5 text-accent-fg" />}
                </div>
                <div className="flex items-center justify-between border-t border-line bg-bg/50 px-2 py-1.5">
                  <span className="truncate text-[11.5px] font-medium">{th.name}</span>
                </div>
              </button>
            );
          })}
        </div>
        {!THEMES.some((th) => th.id === theme.id) && <p className="text-[11.5px] text-fg-muted">Current: <span className="font-medium text-fg">{theme.name}</span> (custom)</p>}
      </Group>

      <Group title="Colours">
        <Segmented<ColorScheme> label="Editing palette" size="xs" value={editScheme} onChange={setEditScheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <div className="flex flex-wrap gap-1.5 text-[11px] text-fg-muted">
          <span className="flex items-center gap-1">Text <ContrastBadge fg={pal.text} bg={pal.background} /></span>
          <span className="flex items-center gap-1">Muted <ContrastBadge fg={pal.muted} bg={pal.background} /></span>
          <span className="flex items-center gap-1">Button <ContrastBadge fg={pal.primaryContrast} bg={pal.primary} /></span>
        </div>
        {COLOR_LABELS.map(([key, label]) => (
          <ColorField key={key} label={label} value={pal[key]} onChange={(v) => v && updateTheme(['palettes', editScheme, key], v)} />
        ))}
      </Group>

      <Group title="Typography">
        <Select label="Heading font" value={t.headingFont} onChange={(ev) => updateTheme('typography.headingFont', ev.target.value)} options={fontOptions} />
        <Select label="Body font" value={t.bodyFont} onChange={(ev) => updateTheme('typography.bodyFont', ev.target.value)} options={fontOptions} />
        <Select label="Monospace font" value={t.monoFont} onChange={(ev) => updateTheme('typography.monoFont', ev.target.value)} options={fontOptions} />
        <Slider label="Base size" value={t.baseSize} min={13} max={22} step={0.5} unit="px" onChange={(v) => updateTheme('typography.baseSize', v)} />
        <Select
          label="Type scale"
          value={String(t.scale)}
          onChange={(ev) => updateTheme('typography.scale', Number(ev.target.value))}
          options={[
            { value: '1.125', label: 'Major second · 1.125' },
            { value: '1.2', label: 'Minor third · 1.2' },
            { value: '1.25', label: 'Major third · 1.25' },
            { value: '1.3', label: '1.3' },
            { value: '1.333', label: 'Perfect fourth · 1.333' },
            { value: '1.4', label: '1.4' },
            { value: '1.414', label: 'Augmented fourth · 1.414' },
            { value: '1.5', label: 'Perfect fifth · 1.5' },
          ].concat([1.125, 1.2, 1.25, 1.3, 1.333, 1.4, 1.414, 1.5].includes(t.scale) ? [] : [{ value: String(t.scale), label: `Custom · ${t.scale}` }])}
        />
        <Slider label="Heading weight" value={t.headingWeight} min={300} max={900} step={100} onChange={(v) => updateTheme('typography.headingWeight', v)} />
        <Slider label="Body weight" value={t.bodyWeight} min={300} max={600} step={100} onChange={(v) => updateTheme('typography.bodyWeight', v)} />
        <Slider label="Body line height" value={t.lineHeight} min={1.2} max={2} step={0.05} onChange={(v) => updateTheme('typography.lineHeight', v)} />
        <Slider label="Heading line height" value={t.headingLineHeight} min={0.85} max={1.5} step={0.01} onChange={(v) => updateTheme('typography.headingLineHeight', v)} />
        <Slider label="Heading letter spacing" value={t.headingLetterSpacing} min={-0.06} max={0.1} step={0.005} unit="em" onChange={(v) => updateTheme('typography.headingLetterSpacing', v)} />
        <Slider label="Body letter spacing" value={t.letterSpacing} min={-0.02} max={0.06} step={0.005} unit="em" onChange={(v) => updateTheme('typography.letterSpacing', v)} />
        <Segmented label="Heading case" size="xs" value={t.headingTransform} onChange={(v) => updateTheme('typography.headingTransform', v)} options={[{ value: 'none', label: 'As typed' }, { value: 'uppercase', label: 'UPPERCASE' }]} />
        <div>
          <p className="app-label">Uploaded fonts</p>
          <input ref={fontInput} type="file" accept=".woff2,.woff,.ttf,.otf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void uploadFont(f); }} />
          <ul className="mb-2 space-y-1">
            {customFonts.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-[12px]">
                <Type className="size-3.5 text-fg-subtle" /> <span className="flex-1 truncate">{f.family}</span>
                <button
                  className="text-fg-subtle hover:text-danger"
                  aria-label={`Remove font ${f.family}`}
                  onClick={() => {
                    updateMeta('customFonts', customFonts.filter((x) => x.id !== f.id));
                    for (const key of ['headingFont', 'bodyFont', 'monoFont'] as const) if (t[key] === f.id) updateTheme(`typography.${key}`, 'system');
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />} onClick={() => fontInput.current?.click()}>
            Upload font file
          </Button>
        </div>
      </Group>

      <Group title="Layout" defaultOpen={false}>
        <Slider label="Max width" value={l.maxWidth} min={720} max={1600} step={20} unit="px" onChange={(v) => updateTheme('layout.maxWidth', v)} />
        <Slider label="Section spacing" value={l.sectionSpacing} min={32} max={200} step={4} unit="px" onChange={(v) => updateTheme('layout.sectionSpacing', v)} />
        <Slider label="Container padding" value={l.containerPadding} min={12} max={64} step={2} unit="px" onChange={(v) => updateTheme('layout.containerPadding', v)} />
        <Slider label="Grid gap" value={l.gridGap} min={8} max={56} step={2} unit="px" onChange={(v) => updateTheme('layout.gridGap', v)} />
        <Slider label="Card radius" value={l.cardRadius} min={0} max={40} step={1} unit="px" onChange={(v) => updateTheme('layout.cardRadius', v)} />
        <Slider label="Button radius" value={Math.min(l.buttonRadius, 40)} min={0} max={40} step={1} unit="px" format={(v) => (l.buttonRadius >= 999 ? 'pill' : `${v}px`)} onChange={(v) => updateTheme('layout.buttonRadius', v)} />
      </Group>

      <Group title="Effects" defaultOpen={false}>
        <Select label="Card style" value={theme.cardStyle} onChange={(ev) => updateTheme('cardStyle', ev.target.value)} options={[{ value: 'outlined', label: 'Outlined' }, { value: 'elevated', label: 'Elevated' }, { value: 'flat', label: 'Flat' }, { value: 'glass', label: 'Glass' }, { value: 'brutal', label: 'Brutal' }]} />
        <Select label="Button style" value={theme.buttonStyle} onChange={(ev) => updateTheme('buttonStyle', ev.target.value)} options={[{ value: 'solid', label: 'Solid' }, { value: 'pill', label: 'Pill' }, { value: 'outline', label: 'Outline' }, { value: 'brutal', label: 'Brutal' }, { value: 'underline', label: 'Underline' }]} />
        <Select label="Shadows" value={e.shadow} onChange={(ev) => updateTheme('effects.shadow', ev.target.value)} options={[{ value: 'none', label: 'None' }, { value: 'soft', label: 'Soft' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard offset' }, { value: 'glow', label: 'Glow' }]} />
        <Slider label="Border width" value={e.borderWidth} min={0} max={4} step={1} unit="px" onChange={(v) => updateTheme('effects.borderWidth', v)} />
        <Switch label="Glass background" help="Frosted panels over soft colour fields." checked={e.glass} onChange={(v) => updateTheme('effects.glass', v)} />
        {(e.glass || theme.cardStyle === 'glass') && <Slider label="Blur" value={e.blur} min={0} max={40} step={1} unit="px" onChange={(v) => updateTheme('effects.blur', v)} />}
        <Switch label="Gradients" help="Gradient buttons and headline." checked={e.gradient} onChange={(v) => updateTheme('effects.gradient', v)} />
        {e.gradient && <Slider label="Gradient angle" value={e.gradientAngle} min={0} max={360} step={5} unit="°" onChange={(v) => updateTheme('effects.gradientAngle', v)} />}
        <Switch label="Film grain" checked={e.grain} onChange={(v) => updateTheme('effects.grain', v)} />
      </Group>

      <Group title="Motion" defaultOpen={false}>
        <Switch label="Enable animations" help="Always disabled for visitors who prefer reduced motion." checked={theme.motion.enabled} onChange={(v) => updateTheme('motion.enabled', v)} />
        <Slider label="Default duration" value={theme.motion.duration} min={150} max={1600} step={50} unit="ms" onChange={(v) => updateTheme('motion.duration', v)} />
        <Select label="Default easing" value={theme.motion.easing} onChange={(ev) => updateTheme('motion.easing', ev.target.value)} options={[{ value: 'ease-out', label: 'Ease out' }, { value: 'ease-in-out', label: 'Ease in-out' }, { value: 'spring', label: 'Spring' }, { value: 'ease', label: 'Ease' }, { value: 'linear', label: 'Linear' }]} />
      </Group>
    </div>
  );
}
