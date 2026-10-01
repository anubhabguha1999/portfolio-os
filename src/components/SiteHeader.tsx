import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/utils/cn';

const links = [
  { to: '/studio', label: 'Dashboard' },
  { to: '/projects', label: 'Portfolios' },
  { to: '/resumes', label: 'Resumes' },
  { to: '/documents', label: 'Documents' },
  { to: '/profile', label: 'Profile' },
  { to: '/templates', label: 'Templates' },
  { to: '/settings', label: 'Settings' },
];

/** Header for marketing and management pages (not the builder). */
export function SiteHeader({ transparent }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const solid = !transparent || scrolled || open;

  return (
    <header className={cn('sticky top-0 z-40 border-b transition-[background,border-color] duration-300', solid ? 'border-line/70 bg-bg/80 backdrop-blur-xl' : 'border-transparent bg-transparent')}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-md" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'relative rounded-lg px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                  isActive ? 'text-fg after:absolute after:inset-x-3 after:-bottom-[11px] after:h-px after:bg-accent' : 'text-fg-muted hover:bg-hover hover:text-fg',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/studio" className="hidden h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 sm:inline-flex">
            Open app
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="site-mobile-nav" aria-label="Mobile" className="border-t border-line/70 px-4 pb-4 pt-2 md:hidden">
          <ul className="grid gap-0.5">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={({ isActive }) => cn('flex h-11 items-center rounded-lg px-3 text-[15px]', isActive ? 'bg-hover text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg')}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Link to="/studio" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-fg text-[14px] font-medium text-bg">
            Open app
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </nav>
      )}
    </header>
  );
}
