/**
 * Text measurement with the exact metrics the PDF renderer uses (jsPDF's standard
 * 14 fonts). Layout, preview and PDF therefore agree to the hundredth of a millimetre.
 */
import { jsPDF } from 'jspdf';
import { pdfText } from '@/lib/pdf/text';
import type { FontFamily } from './flow';

export const PT = 25.4 / 72;

export interface Measurer {
  width(text: string, font: FontFamily, bold: boolean, italic: boolean, size: number, tracking?: number): number;
}

let shared: Measurer | null = null;

export function variantOf(bold: boolean, italic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  return bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
}

export function getMeasurer(): Measurer {
  if (shared) return shared;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
  const cache = new Map<string, number>();
  let current = '';
  shared = {
    width(text, font, bold, italic, size, tracking = 0) {
      if (!text) return 0;
      const key = `${font}${bold ? 'b' : ''}${italic ? 'i' : ''}${size}|${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        const fk = `${font}|${variantOf(bold, italic)}|${size}`;
        if (fk !== current) {
          doc.setFont(font, variantOf(bold, italic));
          doc.setFontSize(size);
          current = fk;
        }
        w = doc.getTextWidth(text);
        if (cache.size > 60_000) cache.clear();
        cache.set(key, w);
      }
      return w + (tracking ? tracking * text.length : 0);
    },
  };
  return shared;
}

/** Characters the PDF core fonts cannot show (emoji, CJK…). Whitespace and typographic marks that map cleanly are fine. */
export function unsupportedChars(input: string): string[] {
  const out = new Set<string>();
  for (const ch of input) {
    if (/\s/.test(ch)) continue;
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x7f) continue;
    if (!pdfText(ch)) {
      if (/[​-‍⁠﻿­↗✓✔]/.test(ch)) continue;
      out.add(ch);
    }
  }
  return [...out];
}

export { pdfText };
