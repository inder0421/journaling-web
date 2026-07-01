import type { SourceResult } from '../../lib/news/sources';

/** Shows which of the spec's integrations are live, unconfigured, or erroring — no silent gaps. */
export function SourceStatus({ statuses }: { statuses: SourceResult[] }) {
  if (statuses.length === 0) return null;
  return (
    <details className="card source-status">
      <summary className="card-title">Data sources</summary>
      <div className="source-status-grid">
        {statuses.map((s) => (
          <div key={s.source} className="source-status-row">
            <span
              className={`dot ${!s.configured ? 'local' : s.ok ? 'cloud' : ''}`}
              style={!s.configured ? undefined : s.ok ? undefined : { background: 'var(--neg)' }}
            />
            <span>{s.source}</span>
            <span className="faint">
              {!s.configured
                ? 'not configured'
                : s.ok
                  ? `${s.items.length} item${s.items.length === 1 ? '' : 's'}`
                  : `error: ${s.error}`}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
