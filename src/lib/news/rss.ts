/**
 * Generic RSS/Atom reader. Most public feeds (Fed, BLS, Yahoo Finance, wire services)
 * don't send CORS headers, so browser fetches are routed through a read-only public
 * proxy. Override with VITE_NEWS_CORS_PROXY (must accept `${proxy}${encodeURIComponent(url)}`).
 */

const DEFAULT_PROXY = 'https://api.allorigins.win/raw?url=';

function proxyBase(): string {
  return (import.meta.env.VITE_NEWS_CORS_PROXY?.trim() || DEFAULT_PROXY) as string;
}

export interface FeedItem {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

function text(el: Element | null): string | undefined {
  const t = el?.textContent?.trim();
  return t ? t : undefined;
}

/** Parses RSS 2.0 <item> and Atom <entry> elements alike. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const items: FeedItem[] = [];
  for (const el of Array.from(doc.querySelectorAll('item'))) {
    const title = text(el.querySelector('title'));
    if (!title) continue;
    items.push({
      title,
      link: text(el.querySelector('link')),
      pubDate: text(el.querySelector('pubDate')) ?? text(el.querySelector('date')),
      description: text(el.querySelector('description')),
    });
  }
  if (items.length === 0) {
    for (const el of Array.from(doc.querySelectorAll('entry'))) {
      const title = text(el.querySelector('title'));
      if (!title) continue;
      const linkEl = el.querySelector('link');
      items.push({
        title,
        link: linkEl?.getAttribute('href') ?? undefined,
        pubDate: text(el.querySelector('updated')) ?? text(el.querySelector('published')),
        description: text(el.querySelector('summary')) ?? text(el.querySelector('content')),
      });
    }
  }
  return items;
}

/** Fetches and parses a feed, with a timeout so one dead source can't stall the dashboard. */
export async function fetchFeed(url: string, timeoutMs = 10_000): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${proxyBase()}${encodeURIComponent(url)}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml);
  } finally {
    clearTimeout(timer);
  }
}
