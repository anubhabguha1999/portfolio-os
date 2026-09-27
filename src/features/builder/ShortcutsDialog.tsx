import { Dialog } from '@/components/ui/Dialog';
import { Shortcut } from '@/components/ui/misc';

export const SHORTCUTS: Array<[string, string]> = [
  ['mod+k', 'Command palette'],
  ['mod+s', 'Save a version'],
  ['mod+z', 'Undo'],
  ['mod+shift+z', 'Redo'],
  ['mod+p', 'Open preview'],
  ['mod+e', 'Open Export Studio'],
  ['mod+.', 'Toggle focus mode'],
  ['mod+/', 'Keyboard shortcuts'],
  ['alt+arrowup', 'Move selected section up'],
  ['alt+arrowdown', 'Move selected section down'],
  ['esc', 'Close dialog / exit focus or presentation'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <ul className="divide-y divide-line">
        {SHORTCUTS.map(([k, label]) => (
          <li key={k} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-fg-muted">{label}</span>
            <Shortcut keys={k.replace('arrowup', '↑').replace('arrowdown', '↓')} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-fg-subtle">In the layers list: ↑/↓ to move focus, Space to pick up a section and ↑/↓ to drag it, F2 to rename.</p>
    </Dialog>
  );
}
