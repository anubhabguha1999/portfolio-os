import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, Play, Search, X } from 'lucide-react';
import { Logo } from './Logo';
import { ProfileAvatar, ProfileMenu, useProfileSummary } from './profile/ProfileMenu';
import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';
import { modKey } from '@/utils/download';

const links = [
  { to: '/studio', label: 'Dashboard' },
  { to: '/projects', label: 'Portfolios' },
  { to: '/resumes', label: 'Resumes' },
  { to: '/documents', label: 'Documents' },
  { to: '/knowledge', label: 'Extract Your Data' },
  { to: '/profile', label: 'Profile' },
  { to: '/templates', label: 'Templates' },
  { to: '/settings', label: 'Settings' },
];

/** Header for marketing and management pages (not the builder). */
export function SiteHeader({ transparent }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { profile, show: hasProfile } = useProfileSummary();
  // Once there is a profile the avatar menu replaces the plain "Profile" link.
  const navLinks = hasProfile ? links.filter((l) => l.to !== '/profile') : links;

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
        <Link to="/" className="shrink-0 rounded-md whitespace-nowrap" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden min-w-0 items-center gap-0.5 lg:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'relative rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors xl:px-3',
                  isActive ? 'text-fg after:absolute after:inset-x-3 after:-bottom-[11px] after:h-px after:bg-accent' : 'text-fg-muted hover:bg-hover hover:text-fg',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {/* Local build & test runner: the page only exists under `npm run dev`. */}
          {import.meta.env.DEV && (
            <NavLink
              to="/runner"
              aria-label="Local runner"
              title="Local runner (dev only)"
              className={({ isActive }) => cn('grid size-9 place-items-center rounded-lg hover:bg-hover', isActive ? 'text-ok' : 'text-fg-muted hover:text-fg')}
            >
              <Play className="size-4" />
            </NavLink>
          )}
          <NavLink
            to="/search"
            aria-label={`Search (${modKey}+K)`}
            title={`Search (${modKey}K)`}
            className={({ isActive }) => cn('grid size-9 place-items-center rounded-lg hover:bg-hover', isActive ? 'text-fg' : 'text-fg-muted hover:text-fg')}
          >
            <Search className="size-4" />
          </NavLink>
          <ProfileMenu />
          <Link to="/studio" className="hidden h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-fg px-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 sm:inline-flex lg:hidden xl:inline-flex">
            Open app
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg lg:hidden"
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
        <nav id="site-mobile-nav" aria-label="Mobile" className="border-t border-line/70 px-4 pb-4 pt-2 lg:hidden">
          {hasProfile && (
            <Link to="/profile" className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
              <ProfileAvatar profile={profile} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{profile.name.trim() || 'Your profile'}</span>
                <span className="block truncate text-[12px] text-fg-subtle">{profile.headline.trim() || 'Edit your profile'}</span>
              </span>
            </Link>
          )}
          <ul className="grid gap-0.5">
            {navLinks.map((l) => (
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
