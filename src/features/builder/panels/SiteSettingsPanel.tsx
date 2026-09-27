import { useEditor } from '@/stores/editor';
import { Segmented, Switch, TextInput } from '@/components/ui/Field';
import { Group } from './Group';

export function SiteSettingsPanel() {
  const s = useEditor((st) => st.portfolio!.settings);
  const update = useEditor((st) => st.updateSettings);
  return (
    <div>
      <Group title="Colour scheme">
        <Segmented label="Visitors see" size="xs" value={s.colorScheme} onChange={(v) => update('colorScheme', v)} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
        <Switch label="Show light/dark toggle" help="Visitors can switch; their choice is remembered." checked={s.showThemeToggle} onChange={(v) => update('showThemeToggle', v)} />
      </Group>
      <Group title="Navigation">
        <Switch label="Show navigation" checked={s.navigation.enabled} onChange={(v) => update('navigation.enabled', v)} />
        {s.navigation.enabled && (
          <>
            <Segmented label="Style" size="xs" value={s.navigation.style} onChange={(v) => update('navigation.style', v)} options={[{ value: 'bar', label: 'Bar' }, { value: 'floating', label: 'Floating' }, { value: 'minimal', label: 'Minimal' }]} />
            <Switch label="Sticky" checked={s.navigation.sticky} onChange={(v) => update('navigation.sticky', v)} />
            <TextInput label="Brand text" placeholder="Defaults to your name" value={s.navigation.brand} onChange={(e) => update('navigation.brand', e.target.value)} />
          </>
        )}
      </Group>
      <Group title="Footer">
        <Switch label="Show footer" checked={s.footer.enabled} onChange={(v) => update('footer.enabled', v)} />
        {s.footer.enabled && (
          <>
            <TextInput label="Footer text" placeholder="© {year} Your Name" value={s.footer.text} onChange={(e) => update('footer.text', e.target.value)} help="{year} is replaced with the current year." />
            <Switch label="“Built with” credit" checked={s.footer.showCredit} onChange={(v) => update('footer.showCredit', v)} />
          </>
        )}
        <Switch label="Back-to-top button" checked={s.backToTop} onChange={(v) => update('backToTop', v)} />
      </Group>
      <Group title="Behaviour">
        <Switch label="Animations" help="Master switch for scroll and entrance animations." checked={s.animations} onChange={(v) => update('animations', v)} />
        <Switch label="Smooth scrolling" checked={s.smoothScroll} onChange={(v) => update('smoothScroll', v)} />
      </Group>
      <Group title="Fonts in exports">
        <Segmented
          label="Delivery"
          size="xs"
          value={s.fontDelivery}
          onChange={(v) => update('fontDelivery', v)}
          options={[
            { value: 'system', label: 'Self-contained' },
            { value: 'cdn', label: 'Google Fonts CDN' },
          ]}
        />
        <p className="text-[11.5px] leading-snug text-fg-subtle">Self-contained uses each font’s local fallback stack plus any uploaded fonts — no network needed. CDN loads the exact web fonts from Google Fonts.</p>
      </Group>
    </div>
  );
}
