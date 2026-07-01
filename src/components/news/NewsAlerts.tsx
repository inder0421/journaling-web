import { useState } from 'react';
import { formatDateTime } from '../../lib/format';
import { notificationsSupported, requestNotificationPermission } from '../../lib/news/alerts';
import type { Alert } from '../../lib/news/types';

const KIND_LABEL: Record<Alert['kind'], string> = {
  breaking: 'Breaking',
  watchlist: 'Watchlist',
  economic: 'Economic data',
  fed: 'Federal Reserve',
  earnings: 'Earnings',
  gap: 'Price gap',
};

export function NewsAlerts({ alerts }: { alerts: Alert[] }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationsSupported() ? Notification.permission : 'denied',
  );

  const enable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  return (
    <div className="stack">
      {notificationsSupported() && permission !== 'granted' && (
        <div className="banner info">
          <div className="foot">
            Get a browser notification the moment a breaking or watchlist story lands.
            <button className="btn btn-sm" style={{ marginLeft: 10 }} onClick={() => void enable()}>
              Enable notifications
            </button>
          </div>
        </div>
      )}
      {alerts.length === 0 ? (
        <div className="empty">No alerts yet — breaking news, watchlist hits, and economic releases will show up here.</div>
      ) : (
        alerts.map((a) => (
          <div className="card" key={a.id}>
            <div className="news-card-head">
              <span className="tag">{KIND_LABEL[a.kind]}</span>
              <span className="num faint">{formatDateTime(a.time)}</span>
            </div>
            <div className="news-card-headline">{a.message}</div>
          </div>
        ))
      )}
    </div>
  );
}
