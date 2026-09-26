import { useEffect, useState } from 'react';

export type AppTheme = 'dark' | 'light' | 'system';
const KEY = 'pos-app-theme';

function read(): AppTheme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyAppTheme(t: AppTheme): void {
  const resolved = t === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.setAttribute('data-theme', resolved);
}

/** Theme for the editor chrome itself (independent of the portfolio theme). */
export function useAppTheme(): [AppTheme, (t: AppTheme) => void] {
  const [theme, setTheme] = useState<AppTheme>(read);
  useEffect(() => {
    applyAppTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => applyAppTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  return [theme, setTheme];
}

applyAppTheme(read());
