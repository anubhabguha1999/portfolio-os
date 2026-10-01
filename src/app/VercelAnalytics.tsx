import { useLocation } from 'react-router-dom';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';

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

export function VercelAnalytics() {
  const route = routeOf(useLocation().pathname);
  return <Analytics route={route} path={route} beforeSend={beforeSend} />;
}
