/**
 * Shared UI components for generated projects. Server Components by default; only
 * genuinely interactive pieces (Navbar, ThemeToggle, Reveal, ContactForm, TypingText,
 * Carousel) are client components.
 */
import { iconBody } from '@/sections/icons';
import { text } from '../context';
import type { LibOut } from './emit';
import { bareList, button, card, chip, chipList, container, h3, LG, MD, media, meta, muted, r, small, textLink } from './rules';

/* ------------------------------------------------------------------ */
/* lib/                                                                */
/* ------------------------------------------------------------------ */

export function emitLib(out: LibOut): void {
  const { ctx } = out;
  out.files.push(
    text(
      'src/lib/utils.ts',
      `/** Join class names, skipping empty values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** True for absolute http(s) URLs. */
export function isExternal(href: string): boolean {
  return /^https?:\\/\\//i.test(href);
}

/** Display a URL without protocol and trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^mailto:/i, '').replace(/^https?:\\/\\//i, '').replace(/^www\\./i, '').replace(/\\/$/, '');
}
`,
    ),
  );
  out.files.push(
    text(
      'src/lib/content.ts',
      `import { portfolio } from '@/data/portfolio';
import type { PageDefinition, Project, ProjectsSection, Section } from '@/types/portfolio';

/** Page definition for a route path ("/", "/about", …). */
export function getPage(path: string): PageDefinition | undefined {
  return portfolio.pages.find((page) => page.path === path);
}

/** Sections shown on a page, in order. */
export function pageSections(path: string): Section[] {
  const page = getPage(path);
  if (!page) return [];
  return page.sectionIds.map(sectionById).filter((s): s is Section => Boolean(s));
}

export function sectionById(id: string): Section | undefined {
  return portfolio.sections.find((s) => s.id === id);
}

export function getProject(slug: string): Project | undefined {
  return portfolio.projects.find((p) => p.slug === slug);
}

/** Projects that have their own /projects/[slug] page. */
export function projectPages(): Project[] {
  return portfolio.projects.filter((p) => p.hasPage);
}

export function projectsForSection(section: ProjectsSection): Project[] {
  return section.projectSlugs.map(getProject).filter((p): p is Project => Boolean(p));
}
`,
    ),
  );
  const scheme = ctx.data.theme.scheme;
  const script = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('pos-scheme');if(s==='light'||s==='dark'){d.dataset.scheme=s;return;}var m='${scheme}';d.dataset.scheme=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;}catch(e){}})();`;
  out.files.push(
    text(
      'src/lib/theme.ts',
      `/**
 * Runs before first paint: applies the saved colour scheme (localStorage "pos-scheme")
 * or the site default, so there is no flash of the wrong theme.
 */
export const THEME_INIT_SCRIPT = ${JSON.stringify(script)};

export const SCHEME_STORAGE_KEY = 'pos-scheme';
`,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export function emitPrimitives(out: LibOut): void {
  const { ctx } = out;
  const next = ctx.framework === 'nextjs';
  const routerLink = next ? `import Link from 'next/link';` : ctx.router ? `import { Link } from 'react-router-dom';` : '';
  const internal = next
    ? `  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    );
  }`
    : ctx.router
      ? `  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} {...rest}>
        {children}
      </Link>
    );
  }`
      : '';
  out.component(
    'components',
    'SmartLink',
    null,
    `
type SmartLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

/**
 * One link component for the whole site: internal routes use the framework router,
 * external links open in a new tab safely, mailto:/tel:/#anchors are plain links.
 */
export function SmartLink({ href, className, children, ...rest }: SmartLinkProps) {
  if (/^https?:\\/\\//i.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
${internal ? `${internal}\n` : ''}  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}
`,
    { imports: [routerLink, `import type { AnchorHTMLAttributes, ReactNode } from 'react';`] },
  );

  // Img
  const imgBody = ctx.nextImage
    ? `
interface ImgProps {
  image: SiteImage;
  className?: string;
  /** Responsive sizes hint, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  /** Preload above-the-fold images (hero/profile) only. */
  priority?: boolean;
  alt?: string;
}

/** Optimised image via next/image. Remote URLs are served as-is. */
export function Img({ image, className, sizes = '100vw', priority = false, alt }: ImgProps) {
  return (
    <Image
      src={image.src}
      alt={alt ?? image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      preload={priority}
      unoptimized={/^https?:\\/\\//i.test(image.src)}
      className={className}
    />
  );
}
`
    : `
interface ImgProps {
  image: SiteImage;
  className?: string;
  /** Responsive sizes hint, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  /** Load eagerly with high priority (hero/profile) — use sparingly. */
  priority?: boolean;
  alt?: string;
}

/** Image with intrinsic size (prevents layout shift) and lazy loading by default. */
export function Img({ image, className, sizes, priority = false, alt }: ImgProps) {
  return (${next ? '\n    // eslint-disable-next-line @next/next/no-img-element' : ''}
    <img
      src={image.src}
      alt={alt ?? image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}
`;
  out.component('components', 'Img', null, imgBody, { imports: [ctx.nextImage ? `import Image from 'next/image';` : '', `import type { SiteImage } from '@/types/portfolio';`] });

  // Button
  const bs = out.sheet('Button', { root: button });
  out.component(
    'components',
    'Button',
    bs,
    `
interface ButtonProps {
  href: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ href, variant = 'primary', children }: ButtonProps) {
  return (
    <SmartLink href={href} ${bs.c('root')} data-variant={variant} data-btn={portfolio.theme.buttonStyle}>
      {children}
    </SmartLink>
  );
}
`,
    { imports: [`import type { ReactNode } from 'react';`, `import { portfolio } from '@/data/portfolio';`, `import { SmartLink } from './SmartLink';`] },
  );

  // SectionShell + SectionHeading
  const ss = out.sheet('SectionShell', {
    root: r(
      `relative scroll-mt-20 py-(--section-y) text-text
       data-[spacing=none]:py-0 data-[spacing=sm]:py-[calc(var(--section-y)*0.55)] data-[spacing=lg]:py-[calc(var(--section-y)*1.35)] data-[spacing=xl]:py-[calc(var(--section-y)*1.7)]
       data-[bg=surface]:bg-surface data-[bg=primary]:bg-primary data-[bg=primary]:text-primary-contrast data-[bg=accent]:bg-accent-soft
       data-[bg=inverted]:bg-text data-[bg=inverted]:text-bg data-[bg=gradient]:bg-(image:--gradient-soft)
       data-[align=center]:text-center
       max-md:data-[hide-mobile]:hidden md:max-lg:data-[hide-tablet]:hidden lg:data-[hide-desktop]:hidden`,
      `position: relative;
scroll-margin-top: 5rem;
padding-block: var(--section-y);
color: var(--c-text);
&[data-spacing="none"] { padding-block: 0; }
&[data-spacing="sm"] { padding-block: calc(var(--section-y) * 0.55); }
&[data-spacing="lg"] { padding-block: calc(var(--section-y) * 1.35); }
&[data-spacing="xl"] { padding-block: calc(var(--section-y) * 1.7); }
&[data-bg="surface"] { background: var(--c-surface); }
&[data-bg="primary"] { background: var(--c-primary); color: var(--c-primary-contrast); }
&[data-bg="accent"] { background: var(--c-accent-soft); }
&[data-bg="inverted"] { background: var(--c-text); color: var(--c-bg); }
&[data-bg="gradient"] { background-image: var(--gradient-soft); }
&[data-align="center"] { text-align: center; }
@media (max-width: 767px) { &[data-hide-mobile] { display: none; } }
@media (min-width: 768px) and (max-width: 1023px) { &[data-hide-tablet] { display: none; } }
${LG} { &[data-hide-desktop] { display: none; } }`,
    ),
    inner: container,
  });
  const reveal = ctx.animations;
  out.component(
    'components',
    'SectionShell',
    ss,
    `
interface SectionShellProps {
  section: SectionBase;
  children: ReactNode;
}

/** The <section> wrapper every section uses: anchor, background, width, spacing and visibility. */
export function SectionShell({ section, children }: SectionShellProps) {
  return (
    <section
      id={section.anchor}
      data-section={section.id}
      data-bg={section.background}
      data-spacing={section.spacing}
      data-align={section.align}
      data-hide-mobile={section.hideOn.mobile || undefined}
      data-hide-tablet={section.hideOn.tablet || undefined}
      data-hide-desktop={section.hideOn.desktop || undefined}
      aria-labelledby={section.heading ? \`\${section.anchor}-title\` : undefined}
      ${ss.c('root')}
    >
      <div ${ss.c('inner')} data-width={section.width}>
        ${reveal ? '<Reveal animation={section.animation}>{children}</Reveal>' : '{children}'}
      </div>
    </section>
  );
}
`,
    { imports: [`import type { ReactNode } from 'react';`, `import type { SectionBase } from '@/types/portfolio';`, reveal ? `import { Reveal } from './Reveal';` : ''] },
  );

  const sh = out.sheet('SectionHeading', {
    root: r('mb-10 grid gap-3 data-[align=center]:justify-items-center', `margin-bottom: 2.5rem;\ndisplay: grid;\ngap: 0.75rem;\n&[data-align="center"] { justify-items: center; }`),
    title: r(
      'm-0 font-heading text-3xl [font-weight:var(--fw-heading)] leading-(--lh-heading) tracking-(--ls-heading) [text-transform:var(--tt-heading)] text-balance',
      'margin: 0;\nfont-family: var(--font-heading);\nfont-size: var(--fs-3xl);\nfont-weight: var(--fw-heading);\nline-height: var(--lh-heading);\nletter-spacing: var(--ls-heading);\ntext-transform: var(--tt-heading);\ntext-wrap: balance;',
    ),
    intro: r('m-0 max-w-2xl text-lg text-muted', 'margin: 0;\nmax-width: 42rem;\nfont-size: var(--fs-lg);\ncolor: var(--c-muted);'),
  });
  out.component(
    'components',
    'SectionHeading',
    sh,
    `
export function SectionHeading({ section }: { section: SectionBase }) {
  if (!section.heading && !section.intro) return null;
  return (
    <header ${sh.c('root')} data-align={section.align}>
      {section.heading && (
        <h2 id={\`\${section.anchor}-title\`} ${sh.c('title')}>
          {section.heading}
        </h2>
      )}
      {section.intro && <p ${sh.c('intro')}>{section.intro}</p>}
    </header>
  );
}
`,
    { imports: [`import type { SectionBase } from '@/types/portfolio';`] },
  );

  // Chips (shared tag list)
  const cs = out.sheet('Tags', { list: chipList, item: chip });
  out.component(
    'components',
    'Tags',
    cs,
    `
/** A list of short labels (technologies, skills). */
export function Tags({ items, label }: { items: string[]; label?: string }) {
  if (!items.length) return null;
  return (
    <ul ${cs.c('list')} aria-label={label}>
      {items.map((item, index) => (
        <li key={\`\${item}-\${index}\`} ${cs.c('item')}>
          {item}
        </li>
      ))}
    </ul>
  );
}
`,
  );

  // Reveal (client, animations only)
  if (ctx.animations) {
    out.component(
      'components',
      'Reveal',
      null,
      `
type Animation = 'none' | 'fade' | 'slide' | 'scale' | 'blur';

const HIDDEN = {
  fade: { opacity: 0 },
  slide: { opacity: 0, y: 24 },
  scale: { opacity: 0, scale: 0.96 },
  blur: { opacity: 0, filter: 'blur(8px)' },
};

const SHOWN = { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' };

/**
 * Entrance animation for a block of server-rendered content. The smallest possible
 * client boundary: the children stay Server Components. Honours reduced motion.
 */
export function Reveal({ animation, children }: { animation: Animation; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (animation === 'none' || reduceMotion) return <>{children}</>;
  return (
    <motion.div initial={HIDDEN[animation]} whileInView={SHOWN} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
`,
      { client: true, imports: [`import { motion, useReducedMotion } from 'motion/react';`, `import type { ReactNode } from 'react';`] },
    );
  }

  // ThemeToggle (client)
  if (ctx.data.theme.toggle) {
    const ts = out.sheet('ThemeToggle', {
      root: r(
        'inline-grid size-10 place-items-center rounded-full border border-border bg-surface text-text transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'display: inline-grid;\nplace-items: center;\nwidth: 2.5rem;\nheight: 2.5rem;\nborder-radius: 999px;\nborder: 1px solid var(--c-border);\nbackground: var(--c-surface);\ncolor: var(--c-text);\ncursor: pointer;\n&:hover { border-color: var(--c-primary); }\n&:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }',
      ),
    });
    out.icon('sun');
    out.icon('moon');
    out.component(
      'components',
      'ThemeToggle',
      ts,
      `
type Scheme = 'light' | 'dark';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  return () => observer.disconnect();
}

const currentScheme = (): Scheme => (document.documentElement.dataset.scheme === 'dark' ? 'dark' : 'light');

/** Light/dark switch. The choice is remembered in localStorage. */
export function ThemeToggle() {
  const scheme = useSyncExternalStore(subscribe, currentScheme, (): Scheme => 'light');
  const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      ${ts.c('root')}
      aria-label={\`Switch to \${next} theme\`}
      aria-pressed={scheme === 'dark'}
      onClick={() => {
        document.documentElement.dataset.scheme = next;
        try {
          localStorage.setItem(SCHEME_STORAGE_KEY, next);
        } catch {
          /* storage unavailable (private mode) — the choice lasts for this visit */
        }
      }}
    >
      <Icon name={scheme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
`,
      { client: true, imports: [`import { useSyncExternalStore } from 'react';`, `import { SCHEME_STORAGE_KEY } from '@/lib/theme';`, `import { Icon } from './Icon';`] },
    );
  }

  // SocialLinks
  for (const s of ctx.data.social) out.icon(s.icon);
  const sl = out.sheet('SocialLinks', {
    list: r('m-0 flex list-none flex-wrap items-center gap-2 p-0 data-[align=center]:justify-center', 'margin: 0;\npadding: 0;\nlist-style: none;\ndisplay: flex;\nflex-wrap: wrap;\nalign-items: center;\ngap: 0.5rem;\n&[data-align="center"] { justify-content: center; }'),
    link: r(
      `inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text no-underline transition hover:border-primary hover:text-primary
       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[style=icons]:px-0`,
      'display: inline-flex;\nmin-height: 2.5rem;\nmin-width: 2.5rem;\nalign-items: center;\njustify-content: center;\ngap: 0.5rem;\nborder-radius: 999px;\nborder: 1px solid var(--c-border);\nbackground: var(--c-surface);\npadding-inline: 0.75rem;\nfont-size: var(--fs-sm);\nfont-weight: 500;\ncolor: var(--c-text);\ntext-decoration: none;\ntransition: color 0.2s, border-color 0.2s;\n&:hover { color: var(--c-primary); border-color: var(--c-primary); }\n&:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }\n&[data-style="icons"] { padding-inline: 0; }',
    ),
  });
  out.component(
    'components',
    'SocialLinks',
    sl,
    `
interface SocialLinksProps {
  style?: 'icons' | 'list' | 'buttons';
  align?: 'left' | 'center';
}

/** Profile links (GitHub, LinkedIn…). URLs were validated at export. */
export function SocialLinks({ style = 'icons', align = 'left' }: SocialLinksProps) {
  if (!portfolio.social.length) return null;
  return (
    <ul ${sl.c('list')} data-align={align} aria-label="Social profiles">
      {portfolio.social.map((link) => (
        <li key={link.href}>
          <SmartLink href={link.href} className={${sl.x('link')}} data-style={style}>
            <Icon name={link.icon} />
            {style === 'icons' ? <span className="sr-only">{link.label}</span> : <span>{link.label}</span>}
          </SmartLink>
        </li>
      ))}
    </ul>
  );
}
`,
    { imports: [`import { portfolio } from '@/data/portfolio';`, `import { Icon } from './Icon';`, `import { SmartLink } from './SmartLink';`] },
  );

  // SkipLink
  out.component(
    'components',
    'SkipLink',
    null,
    `
/** First focusable element: lets keyboard users jump past the navigation. */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  );
}
`,
  );
}

/* ------------------------------------------------------------------ */
/* Navigation & footer                                                 */
/* ------------------------------------------------------------------ */

export function emitChrome(out: LibOut): void {
  const { ctx } = out;
  const next = ctx.framework === 'nextjs';
  const pathHook = next ? `import { usePathname } from 'next/navigation';` : ctx.router ? `import { useLocation } from 'react-router-dom';` : '';
  const pathLine = next ? `  const pathname = usePathname();\n` : ctx.router ? `  const { pathname } = useLocation();\n` : '';
  const current = pathHook ? ` aria-current={link.href === pathname ? 'page' : undefined}` : '';
  out.icon('menu');
  out.icon('close');
  const ns = out.sheet('Navbar', {
    root: r(
      `relative z-40 border-b border-border bg-bg/85 backdrop-blur-md data-[sticky]:sticky data-[sticky]:top-0
       data-[style=floating]:mx-auto data-[style=floating]:mt-3 data-[style=floating]:w-[min(100%-1.5rem,var(--max-w))] data-[style=floating]:rounded-full data-[style=floating]:border data-[style=floating]:shadow-md data-[sticky]:data-[style=floating]:top-3
       data-[style=minimal]:border-transparent data-[style=minimal]:bg-transparent data-[style=minimal]:backdrop-blur-none`,
      `position: relative;
z-index: 40;
border-bottom: 1px solid var(--c-border);
background: color-mix(in srgb, var(--c-bg) 85%, transparent);
backdrop-filter: blur(12px);
&[data-sticky] { position: sticky; top: 0; }
&[data-style="floating"] { margin: 0.75rem auto 0; width: min(100% - 1.5rem, var(--max-w)); border: 1px solid var(--c-border); border-radius: 999px; box-shadow: var(--shadow-md); }
&[data-sticky][data-style="floating"] { top: 0.75rem; }
&[data-style="minimal"] { border-color: transparent; background: transparent; backdrop-filter: none; }`,
    ),
    inner: r('mx-auto flex min-h-16 w-full max-w-(--max-w) flex-wrap items-center justify-between gap-x-6 px-(--pad-x)', 'margin-inline: auto;\ndisplay: flex;\nflex-wrap: wrap;\nalign-items: center;\njustify-content: space-between;\ncolumn-gap: 1.5rem;\nmin-height: 4rem;\nwidth: 100%;\nmax-width: var(--max-w);\npadding-inline: var(--pad-x);'),
    brand: r('font-heading text-lg font-bold text-text no-underline focus-visible:outline-2 focus-visible:outline-primary', 'font-family: var(--font-heading);\nfont-size: var(--fs-lg);\nfont-weight: 700;\ncolor: var(--c-text);\ntext-decoration: none;\n&:focus-visible { outline: 2px solid var(--c-primary); }'),
    toggle: r(
      'inline-grid size-10 place-items-center rounded-lg text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary md:hidden',
      `display: inline-grid;\nplace-items: center;\nwidth: 2.5rem;\nheight: 2.5rem;\nborder: 0;\nborder-radius: 0.5rem;\nbackground: transparent;\ncolor: var(--c-text);\ncursor: pointer;\n&:hover { background: var(--c-surface-2); }\n&:focus-visible { outline: 2px solid var(--c-primary); }\n${MD} { display: none; }`,
    ),
    links: r(
      'm-0 hidden w-full list-none flex-col gap-1 p-0 pb-4 data-[open=true]:flex md:flex md:w-auto md:flex-row md:items-center md:gap-1 md:pb-0',
      `margin: 0;\npadding: 0 0 1rem;\nlist-style: none;\ndisplay: none;\nwidth: 100%;\nflex-direction: column;\ngap: 0.25rem;\n&[data-open="true"] { display: flex; }\n${MD} { display: flex; width: auto; flex-direction: row; align-items: center; padding-bottom: 0; }`,
    ),
    link: r(
      'block rounded-lg px-3 py-2 text-sm font-medium text-muted no-underline transition hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:text-primary',
      'display: block;\nborder-radius: 0.5rem;\npadding: 0.5rem 0.75rem;\nfont-size: var(--fs-sm);\nfont-weight: 500;\ncolor: var(--c-muted);\ntext-decoration: none;\ntransition: color 0.2s, background 0.2s;\n&:hover { background: var(--c-surface-2); color: var(--c-text); }\n&:focus-visible { outline: 2px solid var(--c-primary); }\n&[aria-current="page"] { color: var(--c-primary); }',
    ),
  });
  const toggle = ctx.data.theme.toggle;
  out.component(
    'components',
    'Navbar',
    ns,
    `
/** Site navigation: responsive menu (Escape closes it), current page highlight${toggle ? ', theme switch' : ''}. */
export function Navbar() {
  const { nav } = portfolio;
  const [open, setOpen] = useState(false);
  const menuId = useId();
${pathLine}
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!nav.enabled) return null;
  return (
    <header ${ns.c('root')} data-style={nav.style} data-sticky={nav.sticky || undefined}>
      <nav aria-label="Main" ${ns.c('inner')}>
        <SmartLink href="/" className={${ns.x('brand')}}>
          {nav.brand}
        </SmartLink>
        <button type="button" ${ns.c('toggle')} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}>
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
        <ul id={menuId} ${ns.c('links')} data-open={open}>
          {nav.links.map((link) => (
            <li key={link.href}>
              <SmartLink href={link.href} className={${ns.x('link')}}${current} onClick={() => setOpen(false)}>
                {link.label}
              </SmartLink>
            </li>
          ))}${toggle ? `
          <li>
            <ThemeToggle />
          </li>` : ''}
        </ul>
      </nav>
    </header>
  );
}
`,
    {
      client: true,
      imports: [`import { useEffect, useId, useState } from 'react';`, pathHook, `import { portfolio } from '@/data/portfolio';`, `import { Icon } from './Icon';`, `import { SmartLink } from './SmartLink';`, toggle ? `import { ThemeToggle } from './ThemeToggle';` : ''],
    },
  );

  const fs = out.sheet('Footer', {
    root: r('border-t border-border py-10 text-sm text-muted', 'border-top: 1px solid var(--c-border);\npadding-block: 2.5rem;\nfont-size: var(--fs-sm);\ncolor: var(--c-muted);'),
    inner: r('mx-auto flex w-full max-w-(--max-w) flex-col items-center justify-between gap-4 px-(--pad-x) md:flex-row', `margin-inline: auto;\ndisplay: flex;\nflex-direction: column;\nalign-items: center;\njustify-content: space-between;\ngap: 1rem;\nwidth: 100%;\nmax-width: var(--max-w);\npadding-inline: var(--pad-x);\n${MD} { flex-direction: row; }`),
    text: r('m-0', 'margin: 0;'),
  });
  out.component(
    'components',
    'Footer',
    fs,
    `
export function Footer() {
  if (!portfolio.footer.enabled) return null;
  const year = new Date().getFullYear();
  return (
    <footer ${fs.c('root')}>
      <div ${fs.c('inner')}>
        <p ${fs.c('text')}>{portfolio.footer.text || \`© \${year} \${portfolio.person.name}\`}</p>
        <SocialLinks />
      </div>
    </footer>
  );
}
`,
    { imports: [`import { portfolio } from '@/data/portfolio';`, `import { SocialLinks } from './SocialLinks';`] },
  );
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function emitProjectComponents(out: LibOut): void {
  const { ctx } = out;
  out.icon('arrow-right');
  out.icon('external');
  out.icon('code');
  const pc = out.sheet('ProjectCard', {
    root: r(
      `${card.tw} flex flex-col gap-4 overflow-hidden hover:-translate-y-0.5
       data-[layout=minimal]:flex-row data-[layout=minimal]:items-baseline data-[layout=minimal]:justify-between data-[layout=minimal]:rounded-none data-[layout=minimal]:border-0 data-[layout=minimal]:border-b data-[layout=minimal]:border-border data-[layout=minimal]:bg-transparent data-[layout=minimal]:px-0 data-[layout=minimal]:shadow-none
       data-[layout=horizontal]:w-[min(85vw,380px)] data-[layout=horizontal]:shrink-0 data-[layout=horizontal]:snap-start
       data-[layout=masonry]:mb-(--gap) data-[layout=masonry]:break-inside-avoid
       md:data-[layout=editorial]:grid md:data-[layout=editorial]:grid-cols-2 md:data-[layout=editorial]:items-center md:data-[layout=editorial]:gap-10
       md:data-[featured=true]:data-[layout=featured]:col-span-2`,
      `${card.css}
display: flex;
flex-direction: column;
gap: 1rem;
overflow: hidden;
&:hover { transform: translateY(-2px); }
&[data-layout="minimal"] { flex-direction: row; align-items: baseline; justify-content: space-between; border: 0; border-bottom: 1px solid var(--c-border); border-radius: 0; background: transparent; padding-inline: 0; box-shadow: none; }
&[data-layout="horizontal"] { width: min(85vw, 380px); flex-shrink: 0; scroll-snap-align: start; }
&[data-layout="masonry"] { margin-bottom: var(--gap); break-inside: avoid; }
${MD} {
  &[data-layout="editorial"] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: 2.5rem; }
  &[data-layout="featured"][data-featured="true"] { grid-column: span 2; }
}`,
    ),
    media: r(`${media.tw} aspect-[16/10] data-[layout=minimal]:hidden`, `${media.css}\naspect-ratio: 16 / 10;\n&[data-layout="minimal"] { display: none; }`),
    body: r('grid gap-3', 'display: grid;\ngap: 0.75rem;'),
    title: h3,
    titleLink: r('text-inherit no-underline hover:text-primary focus-visible:outline-2 focus-visible:outline-primary', 'color: inherit;\ntext-decoration: none;\n&:hover { color: var(--c-primary); }\n&:focus-visible { outline: 2px solid var(--c-primary); }'),
    meta,
    desc: muted,
    links: r('flex flex-wrap gap-4', 'display: flex;\nflex-wrap: wrap;\ngap: 1rem;'),
    link: r(`${textLink.tw} inline-flex items-center gap-1.5 text-sm`, `${textLink.css}\ndisplay: inline-flex;\nalign-items: center;\ngap: 0.375rem;\nfont-size: var(--fs-sm);`),
  });
  out.component(
    'components',
    'ProjectCard',
    pc,
    `
interface ProjectCardProps {
  project: Project;
  layout: ProjectsSection['layout'];
}

export function ProjectCard({ project, layout }: ProjectCardProps) {
  const pageHref = project.hasPage ? \`/projects/\${project.slug}\` : '';
  const titleHref = pageHref || project.live || project.github;
  return (
    <article ${pc.c('root')} data-card={portfolio.theme.cardStyle} data-layout={layout} data-featured={project.featured}>
      {project.image && <Img image={project.image} className={${pc.x('media')}} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />}
      <div ${pc.c('body')}>
        {(project.role || project.duration) && <p ${pc.c('meta')}>{[project.role, project.duration].filter(Boolean).join(' · ')}</p>}
        <h3 ${pc.c('title')}>
          {titleHref ? (
            <SmartLink href={titleHref} className={${pc.x('titleLink')}}>
              {project.title}
            </SmartLink>
          ) : (
            project.title
          )}
        </h3>
        {project.description && <p ${pc.c('desc')}>{project.description}</p>}
        <Tags items={project.technologies} label={\`Technologies used in \${project.title}\`} />
        <div ${pc.c('links')}>
          {pageHref && (
            <SmartLink href={pageHref} className={${pc.x('link')}}>
              Case study <Icon name="arrow-right" />
            </SmartLink>
          )}
          {project.live && (
            <SmartLink href={project.live} className={${pc.x('link')}}>
              Live site <Icon name="external" />
            </SmartLink>
          )}
          {project.github && (
            <SmartLink href={project.github} className={${pc.x('link')}}>
              Source <Icon name="code" />
            </SmartLink>
          )}
        </div>
      </div>
    </article>
  );
}
`,
    {
      imports: [`import { portfolio } from '@/data/portfolio';`, `import type { Project, ProjectsSection } from '@/types/portfolio';`, `import { Icon } from './Icon';`, `import { Img } from './Img';`, `import { SmartLink } from './SmartLink';`, `import { Tags } from './Tags';`],
    },
  );

  if (!ctx.hasProjectPages) return;
  const pd = out.sheet('ProjectDetail', {
    root: r('mx-auto grid w-full max-w-[880px] gap-8 px-(--pad-x) py-(--section-y)', 'margin-inline: auto;\ndisplay: grid;\ngap: 2rem;\nwidth: 100%;\nmax-width: 880px;\npadding: var(--section-y) var(--pad-x);'),
    back: r(`${textLink.tw} text-sm`, `${textLink.css}\nfont-size: var(--fs-sm);`),
    header: r('grid gap-4', 'display: grid;\ngap: 1rem;'),
    title: r(
      'm-0 font-heading text-4xl [font-weight:var(--fw-heading)] leading-(--lh-heading) tracking-(--ls-heading) text-balance',
      'margin: 0;\nfont-family: var(--font-heading);\nfont-size: var(--fs-4xl);\nfont-weight: var(--fw-heading);\nline-height: var(--lh-heading);\nletter-spacing: var(--ls-heading);\ntext-wrap: balance;',
    ),
    meta,
    lead: r('m-0 text-lg text-muted', 'margin: 0;\nfont-size: var(--fs-lg);\ncolor: var(--c-muted);'),
    cover: media,
    h2: r('m-0 font-heading text-xl font-semibold', 'margin: 0;\nfont-family: var(--font-heading);\nfont-size: var(--fs-xl);\nfont-weight: 600;'),
    block: r('grid gap-4', 'display: grid;\ngap: 1rem;'),
    list: r('m-0 grid gap-2 pl-5 text-muted marker:text-primary', 'margin: 0;\npadding-left: 1.25rem;\ndisplay: grid;\ngap: 0.5rem;\ncolor: var(--c-muted);\n& li::marker { color: var(--c-primary); }'),
    gallery: r('grid gap-(--gap) sm:grid-cols-2', 'display: grid;\ngap: var(--gap);\n@media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }'),
    figure: r('m-0', 'margin: 0;'),
    links: r('flex flex-wrap gap-3', 'display: flex;\nflex-wrap: wrap;\ngap: 0.75rem;'),
  });
  out.component(
    'components',
    'ProjectDetail',
    pd,
    `
/** Full project page: rendered for every project with a case study or gallery. */
export function ProjectDetail({ project }: { project: Project }) {
  return (
    <article ${pd.c('root')}>
      <SmartLink href="/${ctx.structure === 'multi' ? 'projects' : ''}" className={${pd.x('back')}}>
        ← All projects
      </SmartLink>
      <header ${pd.c('header')}>
        {(project.role || project.duration) && <p ${pd.c('meta')}>{[project.role, project.duration].filter(Boolean).join(' · ')}</p>}
        <h1 ${pd.c('title')}>{project.title}</h1>
        {project.description && <p ${pd.c('lead')}>{project.description}</p>}
        <Tags items={project.technologies} label="Technologies" />
        {(project.live || project.github) && (
          <div ${pd.c('links')}>
            {project.live && (
              <Button href={project.live}>
                Visit live site <Icon name="external" />
              </Button>
            )}
            {project.github && (
              <Button href={project.github} variant="secondary">
                View source <Icon name="code" />
              </Button>
            )}
          </div>
        )}
      </header>
      {project.image && <Img image={project.image} className={${pd.x('cover')}} sizes="(min-width: 880px) 880px, 100vw" priority />}
      {project.caseStudyHtml && (
        // The case study HTML was rendered from Markdown and sanitised when the project was exported.
        <div className="prose" dangerouslySetInnerHTML={{ __html: project.caseStudyHtml }} />
      )}
      {project.features.length > 0 && (
        <section ${pd.c('block')} aria-labelledby="features-title">
          <h2 id="features-title" ${pd.c('h2')}>
            Key features
          </h2>
          <ul ${pd.c('list')}>
            {project.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>
      )}
      {project.gallery.length > 0 && (
        <section ${pd.c('block')} aria-labelledby="gallery-title">
          <h2 id="gallery-title" ${pd.c('h2')}>
            Gallery
          </h2>
          <div ${pd.c('gallery')}>
            {project.gallery.map((image) => (
              <figure key={image.src} ${pd.c('figure')}>
                <Img image={image} className={${pd.x('cover')}} sizes="(min-width: 640px) 50vw, 100vw" />
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
`,
    { imports: [`import type { Project } from '@/types/portfolio';`, `import { Button } from './Button';`, `import { Icon } from './Icon';`, `import { Img } from './Img';`, `import { SmartLink } from './SmartLink';`, `import { Tags } from './Tags';`] },
  );
}

/* ------------------------------------------------------------------ */
/* Client islands                                                      */
/* ------------------------------------------------------------------ */

export function emitIslands(out: LibOut): void {
  const { ctx } = out;
  const types = ctx.sectionTypes;
  const hero = ctx.data.sections.find((s) => s.type === 'hero');
  if (hero && hero.type === 'hero' && hero.typingPhrases.length) {
    out.component(
      'components',
      'TypingText',
      null,
      `
/**
 * Cycles through phrases with a typewriter effect. Screen readers get the full list;
 * with reduced motion the first phrase is shown statically.
 */
export function TypingText({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(phrases[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (phrases.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phrase = phrases[index] ?? '';
    const done = !deleting && length === phrase.length;
    const empty = deleting && length === 0;
    const timer = window.setTimeout(
      () => {
        if (done) setDeleting(true);
        else if (empty) {
          setDeleting(false);
          setIndex((i) => (i + 1) % phrases.length);
        } else setLength((n) => n + (deleting ? -1 : 1));
      },
      done ? 1600 : deleting ? 35 : 70,
    );
    return () => window.clearTimeout(timer);
  }, [phrases, index, length, deleting]);

  const phrase = phrases[index] ?? '';
  return (
    <>
      <span aria-hidden="true">
        {phrase.slice(0, length)}
        <span className="typing-caret">|</span>
      </span>
      <span className="sr-only">{phrases.join(', ')}</span>
    </>
  );
}
`,
      { client: true, imports: [`import { useEffect, useState } from 'react';`] },
    );
  }

  if (types.has('contact') && ctx.data.sections.some((s) => s.type === 'contact' && s.showForm)) {
    const cf = out.sheet('ContactForm', {
      form: r('grid gap-4 text-left', 'display: grid;\ngap: 1rem;\ntext-align: left;'),
      field: r('grid gap-1.5', 'display: grid;\ngap: 0.375rem;'),
      label: r('text-sm font-medium text-text', 'font-size: var(--fs-sm);\nfont-weight: 500;\ncolor: var(--c-text);'),
      input: r(
        'w-full rounded-btn border border-border bg-bg px-3.5 py-2.5 text-base text-text placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        'width: 100%;\nborder-radius: var(--radius-btn);\nborder: 1px solid var(--c-border);\nbackground: var(--c-bg);\npadding: 0.625rem 0.875rem;\nfont: inherit;\ncolor: var(--c-text);\n&::placeholder { color: var(--c-muted); }\n&:focus-visible { border-color: var(--c-primary); outline: 2px solid var(--c-primary); outline-offset: 1px; }',
      ),
      submit: r(`${button.tw} justify-self-start`, `${button.css}\njustify-self: start;`),
      note: r('m-0 text-xs text-muted', 'margin: 0;\nfont-size: var(--fs-xs);\ncolor: var(--c-muted);'),
    });
    out.component(
      'components',
      'ContactForm',
      cf,
      `
/** Opens the visitor's email app with the message filled in — no server needed. */
export function ContactForm({ to }: { to: string }) {
  const id = useId();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const message = String(form.get('message') ?? '');
    const subject = encodeURIComponent(\`Message from \${name || 'your website'}\`);
    const body = encodeURIComponent(\`\${message}\\n\\n— \${name}\${email ? \` (\${email})\` : ''}\`);
    window.location.href = \`mailto:\${to}?subject=\${subject}&body=\${body}\`;
  };
  return (
    <form ${cf.c('form')} onSubmit={onSubmit}>
      <div ${cf.c('field')}>
        <label htmlFor={\`\${id}-name\`} ${cf.c('label')}>
          Name
        </label>
        <input id={\`\${id}-name\`} name="name" autoComplete="name" required ${cf.c('input')} />
      </div>
      <div ${cf.c('field')}>
        <label htmlFor={\`\${id}-email\`} ${cf.c('label')}>
          Email
        </label>
        <input id={\`\${id}-email\`} name="email" type="email" autoComplete="email" required ${cf.c('input')} />
      </div>
      <div ${cf.c('field')}>
        <label htmlFor={\`\${id}-message\`} ${cf.c('label')}>
          Message
        </label>
        <textarea id={\`\${id}-message\`} name="message" rows={5} required ${cf.c('input')} />
      </div>
      <button type="submit" ${cf.c('submit')} data-variant="primary" data-btn={portfolio.theme.buttonStyle}>
        Send message
      </button>
      <p ${cf.c('note')}>This opens your email app; nothing is sent until you press send there.</p>
    </form>
  );
}
`,
      { client: true, imports: [`import { useId, type FormEvent } from 'react';`, `import { portfolio } from '@/data/portfolio';`] },
    );
  }

  if (ctx.data.sections.some((s) => s.type === 'testimonials' && s.layout === 'carousel')) {
    const cs = out.sheet('Carousel', {
      root: r('grid gap-5', 'display: grid;\ngap: 1.25rem;'),
      slide: r(`${card.tw} m-0 grid gap-4 text-left`, `${card.css}\nmargin: 0;\ndisplay: grid;\ngap: 1rem;\ntext-align: left;`),
      quote: r('m-0 font-heading text-xl leading-relaxed text-text', 'margin: 0;\nfont-family: var(--font-heading);\nfont-size: var(--fs-xl);\nline-height: 1.6;\ncolor: var(--c-text);'),
      cite: small,
      controls: r('flex items-center justify-center gap-3', 'display: flex;\nalign-items: center;\njustify-content: center;\ngap: 0.75rem;'),
      control: r(
        'inline-grid size-10 place-items-center rounded-full border border-border bg-surface text-text hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'display: inline-grid;\nplace-items: center;\nwidth: 2.5rem;\nheight: 2.5rem;\nborder-radius: 999px;\nborder: 1px solid var(--c-border);\nbackground: var(--c-surface);\ncolor: var(--c-text);\ncursor: pointer;\n&:hover { border-color: var(--c-primary); }\n&:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }',
      ),
      count: small,
    });
    out.component(
      'components',
      'Carousel',
      cs,
      `
interface Slide {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
}

/** Accessible testimonial carousel: previous/next buttons, announced slide changes. */
export function Carousel({ slides, label }: { slides: Slide[]; label: string }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  if (!slide) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);
  return (
    <div ${cs.c('root')} role="region" aria-roledescription="carousel" aria-label={label}>
      <figure ${cs.c('slide')} aria-live="polite" data-card={portfolio.theme.cardStyle}>
        <blockquote ${cs.c('quote')}>“{slide.quote}”</blockquote>
        <figcaption ${cs.c('cite')}>
          <strong>{slide.author}</strong>
          {[slide.role, slide.company].filter(Boolean).length > 0 && <> — {[slide.role, slide.company].filter(Boolean).join(', ')}</>}
        </figcaption>
      </figure>
      {slides.length > 1 && (
        <div ${cs.c('controls')}>
          <button type="button" ${cs.c('control')} onClick={() => go(-1)} aria-label="Previous testimonial">
            ‹
          </button>
          <span ${cs.c('count')}>
            {index + 1} / {slides.length}
          </span>
          <button type="button" ${cs.c('control')} onClick={() => go(1)} aria-label="Next testimonial">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
`,
      { client: true, imports: [`import { useState } from 'react';`, `import { portfolio } from '@/data/portfolio';`] },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Icon (emitted last: contains only icons that were used)             */
/* ------------------------------------------------------------------ */

export function emitIcon(out: LibOut): void {
  const names = [...out.icons].sort();
  const entries = names.map((n) => {
    const b = iconBody(n);
    return `  ${JSON.stringify(n)}: { filled: ${b.filled}, body: ${JSON.stringify(b.body)} },`;
  });
  out.component(
    'components',
    'Icon',
    null,
    `
/** SVG path data for the icons this site uses (24×24 grid). */
const ICONS: Record<string, { filled: boolean; body: string }> = {
${entries.join('\n')}
};

/** Decorative inline icon (hidden from assistive technology). Unknown names fall back to a link icon. */
export function Icon({ name, className }: { name: string; className?: string }) {
  const icon = ICONS[name] ?? ICONS[${JSON.stringify(names.includes('link') ? 'link' : names[0] ?? 'link')}];
  if (!icon) return null;
  return (
    <svg
      className={className ?? 'icon'}
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      aria-hidden="true"
      focusable="false"
      fill={icon.filled ? 'currentColor' : 'none'}
      stroke={icon.filled ? undefined : 'currentColor'}
      strokeWidth={icon.filled ? undefined : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
`,
  );
}

export { bareList };
