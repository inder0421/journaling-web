/**
 * Client-side alert rules. We don't have a live quote feed wired up, so "gaps
 * significantly after news" isn't generated yet (the Alert.kind union reserves
 * 'gap' for when a price source is added) — everything else fires off the
 * enriched news feed itself.
 */
import type { Alert, NewsItem } from './types';

export function deriveAlerts(items: NewsItem[], watchlist: string[]): Alert[] {
  const alerts: Alert[] = [];
  const watch = new Set(watchlist.map((t) => t.toUpperCase()));

  for (const item of items) {
    if (item.importance >= 8) {
      alerts.push({
        id: `alert-breaking-${item.id}`,
        time: item.time,
        kind: 'breaking',
        message: `Breaking (importance ${item.importance}/10): ${item.headline}`,
        item,
      });
      continue;
    }
    const hitTicker = (item.tickers ?? []).find((t) => watch.has(t.toUpperCase()));
    if (hitTicker) {
      alerts.push({
        id: `alert-watchlist-${item.id}`,
        time: item.time,
        kind: 'watchlist',
        message: `${hitTicker} news: ${item.headline}`,
        item,
      });
      continue;
    }
    if (item.categories.includes('Federal Reserve')) {
      alerts.push({ id: `alert-fed-${item.id}`, time: item.time, kind: 'fed', message: `Fed: ${item.headline}`, item });
      continue;
    }
    if (item.categories.some((c) => ['Inflation', 'Employment', 'Economic News'].includes(c))) {
      alerts.push({ id: `alert-econ-${item.id}`, time: item.time, kind: 'economic', message: `Economic data: ${item.headline}`, item });
      continue;
    }
    if (item.categories.includes('Earnings')) {
      alerts.push({ id: `alert-earn-${item.id}`, time: item.time, kind: 'earnings', message: `Earnings: ${item.headline}`, item });
    }
  }
  return alerts.sort((a, b) => +new Date(b.time) - +new Date(a.time));
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function notifyBrowser(alert: Alert): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  new Notification('News Intelligence Engine', { body: alert.message });
}
