import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { BRAND, SCHEMA_VERSION } from '@/config/brand';

const columns = [
  {
    title: 'Product',
    links: [
      { to: '/studio', label: 'Dashboard' },
      { to: '/projects', label: 'Portfolio Studio' },
      { to: '/resumes', label: 'Resume Studio' },
      { to: '/documents', label: 'Document Studio' },
      { to: '/profile', label: 'Profile Studio' },
      { to: '/templates', label: 'Templates' },
    ],
  },
  {
    title: 'App',
    links: [
      { to: '/settings', label: 'Settings' },
      { to: '/about', label: 'About & privacy' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-[13px] leading-relaxed text-fg-muted">
            {BRAND.tagline} A portfolio studio that runs entirely in your browser. No accounts, no servers, no tracking.
          </p>
          <p className="mt-4 font-mono text-[11px] text-fg-subtle">Schema v{SCHEMA_VERSION}</p>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{c.title}</h2>
            <ul className="mt-4 grid gap-2.5">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-[13px] text-fg-muted transition-colors hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line/50">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] text-fg-subtle sm:px-6">
          Everything you create is stored in this browser. Download a JSON backup from My Portfolios to keep a copy.
        </p>
      </div>
    </footer>
  );
}
