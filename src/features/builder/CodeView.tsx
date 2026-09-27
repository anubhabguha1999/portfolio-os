import { useDeferredValue, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { Portfolio } from '@/types/portfolio';
import { renderPortfolio } from '@/lib/engine/render';
import { formatHtml, highlightCss, highlightHtml, highlightJson, type Token, type TokenKind } from '@/lib/highlight';
import { copyText } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import { Button } from '@/components/ui/Button';

const COLORS: Record<TokenKind, string> = {
  plain: 'text-fg-muted',
  tag: 'text-[#ff7ab2]',
  attr: 'text-[#d9c97c]',
  string: 'text-[#8fd694]',
  comment: 'text-fg-subtle italic',
  punct: 'text-fg-subtle',
  prop: 'text-[#7dd3fc]',
  value: 'text-fg',
  number: 'text-[#f5a97f]',
  keyword: 'text-[#c4a7ff]',
  selector: 'text-[#ff9e64]',
  key: 'text-[#7dd3fc]',
};

const MAX_HIGHLIGHT = 250_000;

export function CodeView({ portfolio, kind }: { portfolio: Portfolio; kind: 'html' | 'css' | 'json' }) {
  const deferred = useDeferredValue(portfolio);
  const [copied, setCopied] = useState(false);
  const { text, tokens } = useMemo(() => {
    let t = '';
    if (kind === 'json') t = JSON.stringify(deferred, null, 2);
    else {
      const r = renderPortfolio(deferred, { mode: 'export', assetUrl: (id) => `assets/images/${id}` });
      t = kind === 'html' ? formatHtml(r.html) : r.css;
    }
    const src = t.length > MAX_HIGHLIGHT ? t.slice(0, MAX_HIGHLIGHT) : t;
    const tk: Token[] = kind === 'html' ? highlightHtml(src) : kind === 'css' ? highlightCss(src) : highlightJson(src);
    return { text: t, tokens: tk };
  }, [deferred, kind]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0e]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <p className="font-mono text-[11px] text-fg-subtle">
          {kind === 'html' ? 'index.html (images shown as asset paths)' : kind === 'css' ? 'styles.css' : 'portfolio.json'} · {formatBytes(new Blob([text]).size)}
          {text.length > MAX_HIGHLIGHT && ' · highlighting truncated'}
        </p>
        <Button
          size="xs"
          variant="secondary"
          icon={copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-[1.65]" tabIndex={0} aria-label={`Generated ${kind.toUpperCase()}`}>
        <code>
          {tokens.map((t, i) => (
            <span key={i} className={COLORS[t.kind]}>
              {t.text}
            </span>
          ))}
          {text.length > MAX_HIGHLIGHT && <span className="text-fg-muted">{text.slice(MAX_HIGHLIGHT)}</span>}
        </code>
      </pre>
    </div>
  );
}
