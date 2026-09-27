import { useLocation } from 'react-router-dom';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';

/** Collapse per-project ids so dashboards group by screen, and no local ids leave the device. */
function routeOf(pathname: string): string {
  return pathname.replace(/^\/(builder|preview|export)\/[^/]+/, '/$1/[projectId]') || '/';
}

/**
 * Routes live in the URL fragment (HashRouter), which Vercel's auto-tracking ignores —
 * so page views are reported explicitly per route. The fragment and query are stripped
 * before sending because share links carry the whole portfolio payload there.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  const hashPath = url.hash.replace(/^#/, '').split('?')[0] || '/';
  url.pathname = routeOf(hashPath);
  url.hash = '';
  url.search = '';
  return { ...event, url: url.toString() };
}

export function VercelAnalytics() {
  const route = routeOf(useLocation().pathname);
  return <Analytics route={route} path={route} beforeSend={beforeSend} />;
}
