import { formatDateTime } from '../../lib/format';
import type { CalendarResult } from '../../lib/news/calendar';
import type { EconomicEvent } from '../../lib/news/types';

const HIGHLIGHT_RE = /\b(cpi|ppi|pce|gdp|nonfarm payrolls|unemployment|retail sales|pmi|consumer confidence|fomc|fed speak|treasury auction)/i;

function impactClass(impact: EconomicEvent['impact']): string {
  if (impact === 'High') return 'neg';
  if (impact === 'Medium') return 'warn';
  return 'dim';
}

function EventRow({ event }: { event: EconomicEvent }) {
  const highlighted = HIGHLIGHT_RE.test(event.event);
  return (
    <div className={`kv econ-row${highlighted ? ' highlight' : ''}`}>
      <div className="k">
        <div className="num">{formatDateTime(event.time)}</div>
        <div className="faint">{event.country}</div>
      </div>
      <div className="v">
        <div>
          {event.event} {event.estimated && <span className="tag">estimated</span>}
        </div>
        <div className="faint">
          {event.forecast && <>Forecast: {event.forecast} </>}
          {event.previous && <>Previous: {event.previous} </>}
          {event.actual && <>Actual: {event.actual}</>}
        </div>
        <div className={impactClass(event.impact)}>
          {'★'.repeat(event.importance)} · {event.impact} impact
        </div>
      </div>
    </div>
  );
}

function CalendarSection({ title, result }: { title: string; result: CalendarResult }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {!result.live && (
        <div className="note ok" style={{ marginBottom: 10 }}>
          {result.error
            ? `Live calendar unavailable (${result.error}) — showing an estimated recurring-release schedule.`
            : 'No calendar API key configured — showing an estimated recurring-release schedule (CPI/PPI/PCE/NFP/PMI/etc). FOMC dates, Fed speakers, and Treasury auctions only appear once a live source is connected.'}
        </div>
      )}
      {result.events.length === 0 ? (
        <div className="empty">No events.</div>
      ) : (
        <div className="stack">
          {result.events.map((e) => (
            <EventRow event={e} key={e.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EconomicCalendar({
  today,
  tomorrow,
  week,
}: {
  today: CalendarResult;
  tomorrow: CalendarResult;
  week: CalendarResult;
}) {
  return (
    <div className="stack">
      <CalendarSection title="Today" result={today} />
      <CalendarSection title="Tomorrow" result={tomorrow} />
      <CalendarSection title="This Week" result={week} />
    </div>
  );
}
