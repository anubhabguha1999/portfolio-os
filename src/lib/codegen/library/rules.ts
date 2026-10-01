/**
 * Reusable style rules for the generated component library. Every rule carries the
 * Tailwind classes and the equivalent hand-written CSS; both reference only the
 * design tokens from styles/tokens.css.
 */
import type { StyleRule } from '../styles';

export const r = (tw: string, css: string): StyleRule => ({ tw: tw.replace(/\s+/g, ' ').trim(), css });

export const MD = '@media (min-width: 768px)';
export const LG = '@media (min-width: 1024px)';

export const container = r(
  'mx-auto w-full max-w-(--max-w) px-(--pad-x) data-[width=narrow]:max-w-[760px] data-[width=wide]:max-w-[calc(var(--max-w)+240px)] data-[width=full]:max-w-none',
  `margin-inline: auto;
width: 100%;
max-width: var(--max-w);
padding-inline: var(--pad-x);
&[data-width="narrow"] { max-width: 760px; }
&[data-width="wide"] { max-width: calc(var(--max-w) + 240px); }
&[data-width="full"] { max-width: none; }`,
);

export const card = r(
  `rounded-card bg-surface p-6 transition-[transform,box-shadow,border-color] duration-(--motion-duration)
   data-[card=flat]:bg-surface-2
   data-[card=outlined]:border data-[card=outlined]:border-border
   data-[card=elevated]:shadow-md
   data-[card=glass]:bg-glass data-[card=glass]:backdrop-blur-(--blur) data-[card=glass]:border data-[card=glass]:border-border
   data-[card=brutal]:border-2 data-[card=brutal]:border-text data-[card=brutal]:shadow-[6px_6px_0_var(--c-text)]`,
  `border-radius: var(--radius-card);
background: var(--c-surface);
padding: 1.5rem;
transition: transform var(--motion-duration) var(--motion-ease), box-shadow var(--motion-duration) var(--motion-ease), border-color var(--motion-duration);
&[data-card="flat"] { background: var(--c-surface-2); }
&[data-card="outlined"] { border: 1px solid var(--c-border); }
&[data-card="elevated"] { box-shadow: var(--shadow-md); }
&[data-card="glass"] { background: var(--c-glass); backdrop-filter: blur(var(--blur)); border: 1px solid var(--c-border); }
&[data-card="brutal"] { border: 2px solid var(--c-text); box-shadow: 6px 6px 0 var(--c-text); }`,
);

export const button = r(
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-5 text-sm font-semibold no-underline transition
   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
   data-[variant=primary]:bg-primary data-[variant=primary]:text-primary-contrast data-[variant=primary]:hover:opacity-90
   data-[variant=secondary]:border data-[variant=secondary]:border-border data-[variant=secondary]:bg-surface data-[variant=secondary]:text-text data-[variant=secondary]:hover:border-primary
   data-[variant=ghost]:text-text data-[variant=ghost]:hover:text-primary
   data-[btn=pill]:rounded-full
   data-[btn=outline]:border-2 data-[btn=outline]:border-primary data-[btn=outline]:data-[variant=primary]:bg-transparent data-[btn=outline]:data-[variant=primary]:text-primary
   data-[btn=brutal]:rounded-none data-[btn=brutal]:border-2 data-[btn=brutal]:border-text data-[btn=brutal]:shadow-[4px_4px_0_var(--c-text)]
   data-[btn=underline]:rounded-none data-[btn=underline]:bg-transparent data-[btn=underline]:px-0 data-[btn=underline]:text-primary data-[btn=underline]:underline data-[btn=underline]:underline-offset-4`,
  `display: inline-flex;
min-height: 2.75rem;
align-items: center;
justify-content: center;
gap: 0.5rem;
border-radius: var(--radius-btn);
padding-inline: 1.25rem;
font-size: var(--fs-sm);
font-weight: 600;
text-decoration: none;
border: 0;
cursor: pointer;
transition: opacity 0.2s, border-color 0.2s, color 0.2s, background 0.2s;
&:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }
&[data-variant="primary"] { background: var(--c-primary); color: var(--c-primary-contrast); }
&[data-variant="primary"]:hover { opacity: 0.9; }
&[data-variant="secondary"] { border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); }
&[data-variant="secondary"]:hover { border-color: var(--c-primary); }
&[data-variant="ghost"] { background: transparent; color: var(--c-text); }
&[data-variant="ghost"]:hover { color: var(--c-primary); }
&[data-btn="pill"] { border-radius: 999px; }
&[data-btn="outline"] { border: 2px solid var(--c-primary); }
&[data-btn="outline"][data-variant="primary"] { background: transparent; color: var(--c-primary); }
&[data-btn="brutal"] { border-radius: 0; border: 2px solid var(--c-text); box-shadow: 4px 4px 0 var(--c-text); }
&[data-btn="underline"] { border-radius: 0; background: transparent; padding-inline: 0; color: var(--c-primary); text-decoration: underline; text-underline-offset: 4px; }`,
);

export const chip = r(
  'inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted',
  `display: inline-flex;
align-items: center;
border-radius: 999px;
border: 1px solid var(--c-border);
background: var(--c-surface-2);
padding: 0.25rem 0.75rem;
font-size: var(--fs-xs);
font-weight: 500;
color: var(--c-muted);`,
);

export const chipList = r('m-0 flex list-none flex-wrap gap-2 p-0', 'margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem;');

export const bareList = r('m-0 list-none p-0', 'margin: 0; padding: 0; list-style: none;');

export const bullets = r('m-0 grid gap-1.5 pl-5 text-muted marker:text-primary', 'margin: 0; padding-left: 1.25rem; display: grid; gap: 0.375rem; color: var(--c-muted);\n& ::marker { color: var(--c-primary); }');

export const h3 = r('m-0 font-heading text-lg font-semibold leading-snug text-text', 'margin: 0; font-family: var(--font-heading); font-size: var(--fs-lg); font-weight: 600; line-height: 1.3; color: var(--c-text);');

export const muted = r('m-0 text-muted', 'margin: 0; color: var(--c-muted);');

export const small = r('m-0 text-sm text-muted', 'margin: 0; font-size: var(--fs-sm); color: var(--c-muted);');

export const meta = r('m-0 font-mono text-xs uppercase tracking-wider text-muted', 'margin: 0; font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-muted);');

export const textLink = r(
  'font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary',
  'font-weight: 500; color: var(--c-primary); text-underline-offset: 4px; text-decoration: none;\n&:hover { text-decoration: underline; }\n&:focus-visible { outline: 2px solid var(--c-primary); }',
);

export const grid = (cols: 2 | 3) =>
  r(
    `grid gap-(--gap) ${cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'}`,
    `display: grid;
gap: var(--gap);
${cols === 3 ? '@media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n@media (min-width: 1024px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }' : `${MD} { grid-template-columns: repeat(2, minmax(0, 1fr)); }`}`,
  );

export const media = r('block h-auto w-full rounded-card object-cover', 'display: block; width: 100%; height: auto; border-radius: var(--radius-card); object-fit: cover;');
