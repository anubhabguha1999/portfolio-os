const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

/** Validate a user-supplied link. Relative anchors (#id) and relative paths are allowed. */
export function checkUrl(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (value.startsWith('#')) return { ok: true, url: value };
  if (/^[\w-]+\.[\w.-]+(\/|$)/.test(value) && !value.includes(':')) {
    return { ok: true, url: `https://${value}` };
  }
  // Reject protocol-smuggling with control characters / whitespace.
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, '');
  try {
    const parsed = new URL(compact, 'https://relative.invalid');
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return { ok: false, reason: `unsafe protocol "${parsed.protocol}"` };
    if (parsed.host === 'relative.invalid') return { ok: true, url: value };
    return { ok: true, url: compact };
  } catch {
    return { ok: false, reason: 'malformed URL' };
  }
}

/** Return a safe href, or '' when the URL must not be rendered as a link. */
export function safeHref(raw: string | undefined | null): string {
  if (!raw) return '';
  const res = checkUrl(raw);
  return res.ok ? res.url : '';
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Only allow http(s) and data:image URLs as media sources. */
export function safeMediaSrc(raw: string): string {
  const v = raw.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(v)) return v;
  if (/^blob:/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(\.\/|\/)?assets\//.test(v)) return v;
  return '';
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
