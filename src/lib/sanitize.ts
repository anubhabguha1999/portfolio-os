import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { safeHref } from '@/utils/url';

/**
 * All user-authored markup passes through here. Scripts, event handlers,
 * iframes, forms and unsafe URL protocols are stripped. Nothing entered by
 * a user is ever executed as JavaScript.
 */
const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'frame', 'frameset', 'noscript', 'template'];

let hooksInstalled = false;
function installHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;
    if (node.hasAttribute('href')) {
      const href = safeHref(node.getAttribute('href'));
      if (href) node.setAttribute('href', href);
      else node.removeAttribute('href');
      if (/^https?:/i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (node.hasAttribute('style')) {
      const style = node.getAttribute('style') ?? '';
      if (/expression\s*\(|javascript:|url\s*\(\s*['"]?\s*(?!https?:|data:image)/i.test(style)) node.removeAttribute('style');
    }
  });
}

export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') return '';
  installHooks();
  return DOMPurify.sanitize(dirty, {
    FORBID_TAGS,
    FORBID_ATTR: ['srcdoc', 'formaction', 'action'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/|\.\/|data:image\/(?:png|jpe?g|gif|webp|avif);base64,)/i,
  });
}

export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false, gfm: true, breaks: true });
  return sanitizeHtml(typeof html === 'string' ? html : '');
}

/** Custom CSS snippets: strip anything that could load remote code or break out of <style>. */
export function sanitizeCss(css: string): string {
  return (css ?? '')
    .replace(/<\/?\s*style[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:[^;]*;?/gi, '')
    .replace(/-moz-binding\s*:[^;]*;?/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*(?!https?:|data:image\/)[^)]*\)/gi, 'none');
}

/** Scope custom CSS so it cannot restyle the rest of the portfolio. */
export function scopeCss(css: string, scope: string): string {
  const clean = sanitizeCss(css);
  const out: string[] = [];
  const stack: Array<'at' | 'rule' | 'keyframes'> = [];
  let buffer = '';
  for (const ch of clean) {
    if (ch === '{') {
      const selector = buffer.trim();
      buffer = '';
      if (selector.startsWith('@')) {
        stack.push(/^@(-\w+-)?keyframes/i.test(selector) ? 'keyframes' : 'at');
        out.push(`${selector} {`);
        continue;
      }
      const scopable = stack.every((s) => s === 'at');
      out.push(
        scopable
          ? selector
              .split(',')
              .map((s) => `${scope} ${s.trim().replace(/^(html|body|:root)\b\s*/, '')}`.trim())
              .join(', ') + ' {'
          : `${selector} {`,
      );
      stack.push('rule');
    } else if (ch === '}') {
      out.push(`${buffer.trim()}}`);
      buffer = '';
      stack.pop();
    } else {
      buffer += ch;
    }
  }
  return out.join('\n');
}

/** Plain text from markdown (for PDF/DOCX fallbacks and analyzers). */
export function markdownToPlain(md: string): string {
  return (md ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
