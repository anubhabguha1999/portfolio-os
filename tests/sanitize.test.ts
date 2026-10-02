import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('keeps plain presentational attributes (SVG geometry, table spans, image sizes)', () => {
    const out = sanitizeHtml('<svg viewBox="0 0 240 70"><polyline fill="none" stroke-width="2.5" points="4,58 36,52"></polyline><circle cx="236" cy="8" r="4"></circle></svg><table><tr><td colspan="2">x</td></tr></table><img src="https://example.com/a.png" width="120" alt="a">');
    for (const a of ['viewBox="0 0 240 70"', 'points="4,58 36,52"', 'stroke-width="2.5"', 'cx="236"', 'colspan="2"', 'width="120"', 'src="https://example.com/a.png"']) expect(out).toContain(a);
  });

  it('still removes scripts, handlers and unsafe URLs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a><img src="javascript:alert(1)" onerror="alert(1)"><img src="data:text/html;base64,PHNjcmlwdD4="><svg><a xlink:href="javascript:alert(1)"><text>y</text></a></svg><script>alert(1)</script><p style="background:url(javascript:alert(1))">z</p>');
    expect(out).not.toMatch(/javascript:|onerror|<script|data:text\/html/i);
    expect(out).not.toContain('style=');
  });

  it('keeps safe links and inline images', () => {
    const out = sanitizeHtml('<a href="https://example.com">a</a><a href="#top">b</a><img src="data:image/png;base64,iVBORw0KGgo=" alt="">');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="#top"');
    expect(out).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });
});
