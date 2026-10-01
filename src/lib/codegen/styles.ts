/**
 * One style definition, three outputs.
 *
 * Each style key is declared once with a Tailwind class string and the equivalent CSS
 * (declarations, optionally with nested `&` rules). A Sheet turns keys into JSX:
 *
 *   tailwind     className="flex gap-4 …"
 *   css-modules  className={styles.root}          + Hero.module.css
 *   css          className="hero-root"             + styles/components.css
 *
 * Variants use data attributes (`data-layout="split"`) so every mode can express
 * them statically: Tailwind `data-[layout=split]:…` / CSS `&[data-layout="split"]`.
 */
import type { Styling } from './types';

export interface StyleRule {
  tw: string;
  css: string;
}

export type StyleMap = Record<string, StyleRule>;

const kebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .toLowerCase();

const ident = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s);

function indentCss(css: string, pad = '  '): string {
  return css
    .trim()
    .split('\n')
    .map((l) => (l.trim() ? pad + l.trim() : ''))
    .join('\n');
}

export class Sheet {
  private used = new Set<string>();

  constructor(
    /** Component name, e.g. "Hero" — prefixes plain-CSS classes. */
    readonly name: string,
    private readonly rules: StyleMap,
    readonly styling: Styling,
  ) {}

  private rule(key: string): StyleRule {
    const r = this.rules[key];
    if (!r) throw new Error(`Unknown style key "${this.name}.${key}"`);
    this.used.add(key);
    return r;
  }

  /** Plain-CSS class name for a key. */
  className(key: string): string {
    return `${kebab(this.name)}-${kebab(key)}`;
  }

  /** JS expression for the class value (for composing with cx()). */
  x(key: string): string {
    const r = this.rule(key);
    if (this.styling === 'tailwind') return JSON.stringify(r.tw);
    if (this.styling === 'css') return JSON.stringify(this.className(key));
    return ident(key) ? `styles.${key}` : `styles[${JSON.stringify(key)}]`;
  }

  /** Complete JSX attribute: className="…" or className={styles.key}. */
  c(key: string): string {
    const r = this.rule(key);
    if (this.styling === 'tailwind') return `className=${JSON.stringify(r.tw)}`;
    if (this.styling === 'css') return `className=${JSON.stringify(this.className(key))}`;
    return `className={${this.x(key)}}`;
  }

  /** className combining a key with an extra JS expression (e.g. a prop). */
  cx(key: string, extra: string): string {
    return `className={cx(${this.x(key)}, ${extra})}`;
  }

  /** Import line needed by the component (CSS Modules only). */
  importLine(): string {
    return this.styling === 'css-modules' ? `import styles from './${this.name}.module.css';` : '';
  }

  /** Whether the component needs the cx() helper for this styling. */
  get usedKeys(): string[] {
    return [...this.used];
  }

  /** CSS for the keys used so far. */
  css(): string {
    const keys = [...this.used];
    if (this.styling === 'tailwind' || !keys.length) return '';
    return keys
      .map((k) => {
        const sel = this.styling === 'css' ? `.${this.className(k)}` : `.${k}`;
        return `${sel} {\n${indentCss(this.rules[k]!.css)}\n}`;
      })
      .join('\n\n');
  }

  /** File emitted next to the component (CSS Modules) or null. */
  moduleFile(dir: string): { path: string; content: string } | null {
    if (this.styling !== 'css-modules') return null;
    const css = this.css();
    return css ? { path: `${dir}/${this.name}.module.css`, content: `${css}\n` } : null;
  }
}

/** Collects plain-CSS output from every sheet into one components.css. */
export class StyleCollector {
  private parts: string[] = [];
  add(sheet: Sheet): void {
    if (sheet.styling !== 'css') return;
    const css = sheet.css();
    if (css) this.parts.push(`/* ${sheet.name} */\n${css}`);
  }
  output(): string {
    return this.parts.join('\n\n') + (this.parts.length ? '\n' : '');
  }
}
