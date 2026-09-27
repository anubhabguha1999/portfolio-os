/**
 * jsPDF's built-in fonts (Helvetica, Times, Courier) are WinAnsi-encoded. Anything
 * outside Latin-1 would print as garbage, so text is normalised to safe equivalents
 * and unsupported symbols (emoji, CJK without a font…) are removed.
 */
const REPLACEMENTS: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '′': "'",
  'ʼ': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '″': '"',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '–': '-',
  '—': '-',
  '―': '-',
  '−': '-',
  '•': '·',
  '‣': '·',
  '⁃': '·',
  '∙': '·',
  '●': '·',
  '▪': '·',
  '◦': '·',
  '…': '...',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '↗': '',
  '™': '(TM)',
  '℠': '(SM)',
  '€': 'EUR',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '★': '*',
  '☆': '*',
  '✓': '',
  '✔': '',
  '✕': 'x',
  '✖': 'x',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '​': '',
  '‌': '',
  '‍': '',
  '⁠': '',
  '﻿': '',
  '­': '',
  'ł': 'l',
  'Ł': 'L',
  'đ': 'd',
  'Đ': 'D',
  'ı': 'i',
  'œ': 'oe',
  'Œ': 'OE',
};

function isSafe(code: number): boolean {
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
}

/** Normalise one string for WinAnsi output. Newlines/tabs become spaces. */
export function pdfText(input: string): string {
  if (!input) return '';
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const rep = REPLACEMENTS[ch];
    if (rep !== undefined) {
      out += rep;
      continue;
    }
    if (isSafe(code)) {
      out += ch;
      continue;
    }
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ' ';
      continue;
    }
    // Accented letters outside Latin-1 (ā, ł, ő…) → base letter.
    const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    let kept = '';
    for (const b of base) if (isSafe(b.codePointAt(0) ?? 0)) kept += b;
    out += kept;
  }
  return out.replace(/ {2,}/g, (m) => (m.length > 3 ? '  ' : m));
}
