import { useAppData } from '../context/AppData';
import { lockoutState } from '../lib/calculations';
import { StatusBar } from './StatusBar';
import { LockoutBanner } from './LockoutBanner';
import { TradeForm } from './TradeForm';

export function TodayTab() {
  const { rules, trades, mode, error } = useAppData();
  const lock = lockoutState(rules, trades);

  return (
    <div className="stack">
      <StatusBar />

      {error && (
        <div className="banner warn" role="alert">
          <h2>⚠ Sync issue</h2>
          <div className="foot">{error}</div>
        </div>
      )}

      <LockoutBanner lock={lock} rules={rules} />

      <TradeForm disabled={lock.locked} />

      {mode === 'local' && (
        <div className="banner info">
          <div className="foot">
            Running in <strong>local-only</strong> mode — trades stay in this browser. Add Supabase
            credentials (see the Rules tab) to sync across your phone and desktop.
          </div>
        </div>
      )}
    </div>
  );
}
