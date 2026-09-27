import { useEffect, useRef } from 'react';

export interface Hotkey {
  /** e.g. "mod+z", "mod+shift+z", "mod+k", "escape", "?" */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Fire even when focus is in an input/textarea. Default true for mod-combos. */
  allowInInputs?: boolean;
  enabled?: boolean;
}

function matches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const mod = parts.includes('mod');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const isMod = e.metaKey || e.ctrlKey;
  if (mod !== isMod) return false;
  if (shift !== e.shiftKey && key !== '?') return false;
  if (alt !== e.altKey) return false;
  const k = e.key.toLowerCase();
  return k === key || (key === 'escape' && k === 'esc') || e.code.toLowerCase() === `key${key}`;
}

function inEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useHotkeys(hotkeys: Hotkey[]): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const h of ref.current) {
        if (h.enabled === false || !matches(h.combo, e)) continue;
        const allow = h.allowInInputs ?? h.combo.includes('mod');
        if (!allow && inEditable(e.target)) continue;
        h.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
