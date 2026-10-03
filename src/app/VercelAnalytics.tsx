import { useLocation } from 'react-router-dom';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

/** Vercel Web Analytics / Speed Insights only exist on Vercel (off for the GitHub Pages build). */
const ENABLED = import.meta.env.VITE_VERCEL_INSIGHTS !== 'off';

/** Collapse per-item ids so dashboards group by screen, and no local ids leave the device. */
function routeOf(pathname: string): string {
  return pathname.replace(/^\/(builder|preview|export|resume|document)\/[^/]+/, '/$1/[id]') || '/';
}

/**
 * Only the route is reported. Query strings and the fragment are stripped, since share
 * links carry the whole portfolio payload in the fragment.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.pathname = routeOf(url.pathname);
  url.hash = '';
  url.search = '';
  return { ...event, url: url.toString() };
}

function VercelAnalytics() {
  const route = routeOf(useLocation().pathname);
  return <Analytics route={route} path={route} beforeSend={beforeSend} />;
}

/** Web Analytics and Speed Insights, or nothing off Vercel. */
export function VercelInsights() {
  if (!ENABLED) return null;
  return (
    <>
      <VercelAnalytics />
      <SpeedInsights />
    </>
  );
}
