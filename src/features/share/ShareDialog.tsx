// CONTRACT (owned by the share workstream).
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, ImageOff, Lock, QrCode, TriangleAlert } from 'lucide-react';
import type { Portfolio } from '@/types/portfolio';
import { Dialog } from '@/components/ui/Dialog';
import { Button, Spinner } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Field';
import { Badge, SectionLabel } from '@/components/ui/misc';
import { useAssets } from '@/stores/assets';
import { toast } from '@/stores/ui';
import { copyText, downloadBlob } from '@/utils/download';
import { dataUrlToBlob } from '@/lib/storage/assets';
import { fileSafeName, formatBytes } from '@/utils/format';
import { safeHref } from '@/utils/url';
import { buildShareUrl, QR_MAX_CHARS, type ShareResult } from './share-codec';

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  portfolio: Portfolio;
}

/** Links longer than this get truncated by some chat apps and mail clients. */
const LONG_LINK = 8000;

function contactDetails(p: Portfolio): string[] {
  const c = p.sections.find((s) => s.type === 'contact' && s.enabled);
  if (!c || c.type !== 'contact') return [];
  return [c.data.email.trim() && `email (${c.data.email.trim()})`, c.data.phone.trim() && `phone number (${c.data.phone.trim()})`].filter((x): x is string => Boolean(x));
}

export function ShareDialog({ open, onClose, portfolio }: ShareDialogProps) {
  const blobs = useAssets((s) => s.blobs);
  const [includeImages, setIncludeImages] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrForSite, setQrForSite] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    buildShareUrl(portfolio, { includeImages, assetBlobs: blobs })
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not build the link.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, portfolio, includeImages, blobs]);

  const siteUrl = safeHref(portfolio.metadata.siteUrl);
  const siteUrlUsable = /^https?:\/\//i.test(siteUrl) ? siteUrl : '';
  const fits = Boolean(result && result.url.length <= QR_MAX_CHARS);
  const qrTarget = qrForSite && siteUrlUsable ? siteUrlUsable : fits && result ? result.url : '';

  useEffect(() => {
    if (!open || !qrTarget) {
      setQr(null);
      return;
    }
    let cancelled = false;
    setQrError(null);
    QRCode.toDataURL(qrTarget, { errorCorrectionLevel: qrTarget.length > 1200 ? 'L' : 'M', margin: 2, width: 640, color: { dark: '#0b0b0f', light: '#ffffff' } })
      .then((dataUrl) => {
        if (!cancelled) setQr({ url: qrTarget, dataUrl });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setQr(null);
          setQrError(err instanceof Error ? err.message : 'The QR code could not be generated.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, qrTarget]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const contact = useMemo(() => contactDetails(portfolio), [portfolio]);
  const assetImageCount = Object.keys(blobs).length;

  const copy = async () => {
    if (!result) return;
    const ok = await copyText(result.url);
    if (ok) {
      setCopied(true);
      toast({ title: 'Share link copied', tone: 'success' });
    } else toast({ title: 'Could not copy', description: 'Select the link and copy it manually.', tone: 'error' });
  };

  const downloadQr = () => {
    if (!qr) return;
    const name = fileSafeName(portfolio.metadata.title || 'portfolio');
    downloadBlob(dataUrlToBlob(qr.dataUrl), `${name}-${qrForSite ? 'site' : 'share'}-qr.png`);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Share a view-only link" description="No server, no account — the link carries the portfolio itself." size="md" footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-4 text-[13px]">
        <div className="flex gap-3 rounded-xl border border-accent/25 bg-accent-soft px-3.5 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-fg">Share link contains portfolio data.</p>
            <p className="mt-1 leading-relaxed text-fg-muted">
              Your content is compressed into the part of the link after <code className="font-mono text-[12px] text-fg">#</code>. Browsers never send that part to a server, so nothing is uploaded — but anyone who has the link can read everything in it.
            </p>
          </div>
        </div>

        {result?.containsContactInfo && (
          <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-3" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-fg">This link includes your contact details.</p>
              <p className="mt-1 leading-relaxed text-fg-muted">
                {contact.length ? `Your ${contact.join(' and ')} ${contact.length > 1 ? 'are' : 'is'} readable` : 'Email or phone links are readable'} by anyone the link reaches, including people it is forwarded to. Remove them from the Contact section first if that is not what you want.
              </p>
            </div>
          </div>
        )}

        <Switch
          checked={includeImages}
          onChange={setIncludeImages}
          label="Include images"
          help={assetImageCount ? `Embeds small, compressed copies of your uploaded images (up to ${formatBytes(60_000)} in total). Makes the link longer.` : 'This project has no uploaded images.'}
          disabled={!assetImageCount}
        />

        <div>
          <SectionLabel
            action={
              result && (
                <span className="flex items-center gap-1.5">
                  {result.removedImages > 0 && (
                    <Badge tone="warn">
                      <ImageOff className="size-3" aria-hidden="true" />
                      {result.removedImages} image{result.removedImages === 1 ? '' : 's'} left out
                    </Badge>
                  )}
                  <Badge tone={result.url.length > LONG_LINK ? 'warn' : 'neutral'}>{result.url.length.toLocaleString()} characters</Badge>
                </span>
              )
            }
          >
            Link
          </SectionLabel>
          <div className="mt-2 flex gap-2">
            <label htmlFor="share-url" className="sr-only">
              Share link
            </label>
            <input id="share-url" readOnly value={busy && !result ? 'Building link…' : (result?.url ?? '')} onFocus={(e) => e.currentTarget.select()} className="app-input min-w-0 flex-1 font-mono text-[12px]" aria-busy={busy} />
            <Button variant="primary" onClick={copy} disabled={!result || busy} icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={() => result && window.open(result.url, '_blank', 'noopener,noreferrer')} disabled={!result || busy} icon={<ExternalLink className="size-4" aria-hidden="true" />} aria-label="Open link in a new tab">
              <span className="max-sm:hidden">Open</span>
            </Button>
          </div>
          {busy && result && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-subtle">
              <Spinner className="size-3" /> Updating…
            </p>
          )}
          {error && (
            <p className="mt-2 text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}
          {result && result.url.length > LONG_LINK && (
            <p className="mt-2 text-[12px] leading-snug text-fg-subtle">Some chat apps and email clients cut off links this long. If the recipient sees an error, send an exported HTML file instead{includeImages ? ' or turn off images' : ''}.</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-bg/40 p-3.5">
          <SectionLabel>QR code</SectionLabel>
          {result && !fits && !qrForSite && (
            <div className="mt-2 space-y-2.5 text-[12.5px] leading-relaxed text-fg-muted">
              <p>
                This link is {result.url.length.toLocaleString()} characters; a QR code can hold at most {QR_MAX_CHARS.toLocaleString()}. Portfolio data travels inside the link, so a full portfolio is usually too large to scan.
              </p>
              {siteUrlUsable ? (
                <Button size="sm" icon={<QrCode className="size-4" aria-hidden="true" />} onClick={() => setQrForSite(true)}>
                  QR for {siteUrlUsable.replace(/^https?:\/\//, '')}
                </Button>
              ) : (
                <p className="text-fg-subtle">Tip: set a Site URL in SEO settings after you publish, and you can get a QR code for your live site here.</p>
              )}
            </div>
          )}
          {qrForSite && (
            <p className="mt-2 text-[12.5px] text-fg-muted">
              QR for your site URL.{' '}
              {fits && (
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => setQrForSite(false)}>
                  Use the share link instead
                </button>
              )}
              {!fits && (
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => setQrForSite(false)}>
                  Hide
                </button>
              )}
            </p>
          )}
          {qrError && (
            <p className="mt-2 text-[12px] text-danger" role="alert">
              {qrError}
            </p>
          )}
          {qr && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <img src={qr.dataUrl} alt={`QR code for ${qrForSite ? 'your site' : 'this share link'}`} className="size-36 rounded-lg border border-line bg-white p-1" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[12.5px] leading-relaxed text-fg-muted">Scan with a phone camera to open {qrForSite ? 'your site' : 'the portfolio'}.</p>
                <Button size="sm" icon={<Download className="size-4" aria-hidden="true" />} onClick={downloadQr}>
                  Download PNG
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
