import type { GenCtx } from '../context';
import { text } from '../context';
import type { GeneratedFile } from '../types';
import { Sheet, StyleCollector, type StyleMap } from '../styles';

/** Accumulates files, used icons and plain-CSS output while the library is emitted. */
export class LibOut {
  files: GeneratedFile[] = [];
  icons = new Set<string>();
  collector = new StyleCollector();
  constructor(readonly ctx: GenCtx) {}

  sheet(name: string, rules: StyleMap): Sheet {
    return new Sheet(name, rules, this.ctx.styling);
  }

  icon(name: string): string {
    this.icons.add(name);
    return name;
  }

  /**
   * Write a component. `body` must be built *after* all sheet.c()/x() calls it needs
   * (it is a string already), so the used keys are known here.
   */
  component(dir: 'components' | 'sections', name: string, sheet: Sheet | null, body: string, opts: { client?: boolean; imports?: string[] } = {}): void {
    const directive = opts.client && this.ctx.framework === 'nextjs' ? `'use client';\n\n` : '';
    const imports = [...(opts.imports ?? []).filter(Boolean), sheet?.importLine() ?? ''].filter(Boolean);
    const head = imports.length ? `${imports.join('\n')}\n\n` : '';
    this.files.push(text(`src/${dir}/${name}.tsx`, `${directive}${head}${body.trim()}\n`));
    if (sheet) {
      const mod = sheet.moduleFile(`src/${dir}`);
      if (mod) this.files.push(text(mod.path, mod.content));
      this.collector.add(sheet);
    }
  }
}

/** Indent every line of a multi-line string. */
export function indent(s: string, n: number): string {
  const pad = ' '.repeat(n);
  return s
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}
