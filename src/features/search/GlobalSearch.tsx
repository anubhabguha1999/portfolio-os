import { useLocation, useNavigate } from 'react-router-dom';
import { useHotkeys } from '@/hooks/useHotkeys';

/** ⌘K / "/" open the search page (or focus its box when already there). */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The builder has its own ⌘K command palette; on the runner ⌘K clears the output.
  const enabled = !pathname.startsWith('/builder/') && !(import.meta.env.DEV && pathname === '/runner');

  const open = (e: KeyboardEvent) => {
    e.preventDefault();
    if (pathname === '/search') document.getElementById('site-search')?.focus();
    else void navigate('/search');
  };

  useHotkeys([
    { combo: 'mod+k', enabled, handler: open },
    { combo: '/', enabled, handler: open },
  ]);

  return null;
}
