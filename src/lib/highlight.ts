/** Tiny dependency-free syntax highlighter for HTML, CSS and JSON (tokens only; rendering is React). */
export type TokenKind = 'plain' | 'tag' | 'attr' | 'string' | 'comment' | 'punct' | 'prop' | 'value' | 'number' | 'keyword' | 'selector' | 'key';
export interface Token {
  kind: TokenKind;
  text: string;
}

function scan(src: string, rules: Array<[RegExp, TokenKind | ((m: RegExpExecArray) => Token[])]>): Token[] {
  const out: Token[] = [];
  let i = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push({ kind: 'plain', text: plain });
    plain = '';
  };
  outer: while (i < src.length) {
    for (const [re, kind] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i && m[0].length) {
        flush();
        if (typeof kind === 'function') out.push(...kind(m));
        else out.push({ kind, text: m[0] });
        i += m[0].length;
        continue outer;
      }
    }
    plain += src[i];
    i++;
  }
  flush();
  return out;
}

export function highlightHtml(src: string): Token[] {
  return scan(src, [
    [/<!--[\s\S]*?-->/y, 'comment'],
    [/<!doctype[^>]*>/iy, 'keyword'],
    [
      /<\/?[a-zA-Z][\w:-]*(?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/y,
      (m) => {
        const t = m[0];
        const tokens: Token[] = [];
        const head = /^<\/?[a-zA-Z][\w:-]*/.exec(t)![0];
        tokens.push({ kind: 'tag', text: head });
        let rest = t.slice(head.length);
        const attrRe = /(\s+)([^\s=>/]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+))?/y;
        let pos = 0;
        while (pos < rest.length) {
          attrRe.lastIndex = pos;
          const a = attrRe.exec(rest);
          if (!a || a.index !== pos) break;
          tokens.push({ kind: 'plain', text: a[1]! });
          tokens.push({ kind: 'attr', text: a[2]! });
          if (a[3]) tokens.push({ kind: 'punct', text: a[3] });
          if (a[4]) tokens.push({ kind: 'string', text: a[4] });
          pos = attrRe.lastIndex;
        }
        rest = rest.slice(pos);
        tokens.push({ kind: 'tag', text: rest });
        return tokens;
      },
    ],
    [/&[a-z#0-9]+;/iy, 'keyword'],
  ]);
}

export function highlightCss(src: string): Token[] {
  return scan(src, [
    [/\/\*[\s\S]*?\*\//y, 'comment'],
    [/@[\w-]+/y, 'keyword'],
    [/"[^"]*"|'[^']*'/y, 'string'],
    [/--?[a-zA-Z][\w-]*(?=\s*:)/y, 'prop'],
    [/#[0-9a-fA-F]{3,8}\b/y, 'number'],
    [/-?\d*\.?\d+(px|rem|em|%|vw|vh|ms|s|deg|fr)?\b/y, 'number'],
    [/[{}:;,()]/y, 'punct'],
    [/[.#]?[a-zA-Z_][\w-]*/y, 'selector'],
  ]);
}

export function highlightJson(src: string): Token[] {
  return scan(src, [
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, 'key'],
    [/"(?:[^"\\]|\\.)*"/y, 'string'],
    [/-?\d+(\.\d+)?([eE][+-]?\d+)?/y, 'number'],
    [/\b(true|false|null)\b/y, 'keyword'],
    [/[{}[\],:]/y, 'punct'],
  ]);
}

/** Light formatting so generated HTML is readable (line breaks between tags). */
export function formatHtml(html: string): string {
  return html
    .replace(/>\s*</g, '>\n<')
    .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_m, a: string, css: string, b: string) => `${a}\n/* ${css.length.toLocaleString()} characters of CSS — see the CSS tab */\n${b}`)
    .replace(/(<script>)([\s\S]*?)(<\/script>)/g, (_m, a: string, js: string, b: string) => `${a}\n/* runtime: ${js.length.toLocaleString()} characters */\n${b}`);
}
