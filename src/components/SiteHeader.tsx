import { Link, NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import { cn } from '@/utils/cn';

const links = [
  { to: '/projects', label: 'My Portfolios' },
  { to: '/templates', label: 'Templates' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' },
];

export function SiteHeader({ transparent }: { transparent?: boolean }) {
  return (
    <header className={cn('sticky top-0 z-40 border-b', transparent ? 'border-transparent bg-transparent' : 'border-line/70 bg-bg/80 backdrop-blur-xl')}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-md" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => cn('rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors', isActive ? 'bg-hover text-fg' : 'text-fg-muted hover:text-fg')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
