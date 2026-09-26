import { marked, type Token, type Tokens } from 'marked';
import type { DocBlock, DocRun } from '@/types/document';
import { safeHref } from '@/utils/url';

/** Convert inline markdown tokens to styled runs (no DOM required — worker safe). */
function inlineRuns(tokens: Token[] | undefined, style: Partial<DocRun> = {}): DocRun[] {
  if (!tokens) return [];
  const out: DocRun[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'strong':
        out.push(...inlineRuns((t as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case 'em':
        out.push(...inlineRuns((t as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case 'codespan':
        out.push({ ...style, text: decode((t as Tokens.Codespan).text), code: true });
        break;
      case 'link': {
        const l = t as Tokens.Link;
        const href = safeHref(l.href);
        out.push(...inlineRuns(l.tokens, { ...style, ...(href ? { link: href } : {}) }));
        break;
      }
      case 'br':
        out.push({ ...style, text: '\n' });
        break;
      case 'del':
        out.push(...inlineRuns((t as Tokens.Del).tokens, style));
        break;
      case 'image':
        break;
      case 'text': {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length) out.push(...inlineRuns(tt.tokens, style));
        else out.push({ ...style, text: decode(tt.text) });
        break;
      }
      case 'escape':
        out.push({ ...style, text: decode((t as Tokens.Escape).text) });
        break;
      case 'html':
        break;
      default:
        if ('text' in t && typeof t.text === 'string') out.push({ ...style, text: decode(t.text) });
    }
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function markdownToBlocks(md: string): DocBlock[] {
  if (!md || !md.trim()) return [];
  const tokens = marked.lexer(md, { gfm: true, breaks: true });
  const blocks: DocBlock[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading;
        blocks.push({ kind: 'heading', level: h.depth <= 2 ? 2 : 3, text: decode(h.text) });
        break;
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph;
        const img = p.tokens?.find((x) => x.type === 'image') as Tokens.Image | undefined;
        if (img) blocks.push({ kind: 'image', src: img.href, alt: img.text || '' });
        const runs = inlineRuns(p.tokens);
        if (runs.some((r) => r.text.trim())) blocks.push({ kind: 'paragraph', runs });
        break;
      }
      case 'list': {
        const l = t as Tokens.List;
        blocks.push({ kind: 'list', ordered: l.ordered, items: l.items.map((it) => inlineRuns(it.tokens.flatMap((x) => ('tokens' in x && x.tokens ? x.tokens : [x])))) });
        break;
      }
      case 'blockquote': {
        const q = t as Tokens.Blockquote;
        blocks.push({ kind: 'quote', text: decode(q.text.replace(/^>\s?/gm, '').trim()) });
        break;
      }
      case 'code':
        blocks.push({ kind: 'paragraph', runs: [{ text: (t as Tokens.Code).text, code: true }], tone: 'small' });
        break;
      case 'table': {
        const tb = t as Tokens.Table;
        blocks.push({ kind: 'table', header: tb.header.map((c) => decode(c.text)), rows: tb.rows.map((r) => r.map((c) => decode(c.text))) });
        break;
      }
      case 'hr':
        blocks.push({ kind: 'divider' });
        break;
      default:
        break;
    }
  }
  return blocks;
}
