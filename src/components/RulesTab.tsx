import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppData';
import { money } from '../lib/format';
import type { Rules } from '../lib/types';

interface Draft {
  daily_stop_loss: string;
  max_trades_per_day: string;
  starting_balance: string;
  max_drawdown_floor: string;
}

function toDraft(r: Rules): Draft {
  return {
    daily_stop_loss: String(r.daily_stop_loss),
    max_trades_per_day: String(r.max_trades_per_day),
    starting_balance: String(r.starting_balance),
    max_drawdown_floor: String(r.max_drawdown_floor),
  };
}

export function RulesTab() {
  const { rules, saveRules, mode, email, signOut, localDataAvailable, migrateLocal } = useAppData();

  const [draft, setDraft] = useState<Draft>(() => toDraft(rules));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);

  // Keep the form in sync if rules arrive/refresh from the backend.
  useEffect(() => {
    setDraft(toDraft(rules));
  }, [rules]);

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setError(null);
    const stop = Number.parseFloat(draft.daily_stop_loss);
    const maxTrades = Number.parseInt(draft.max_trades_per_day, 10);
    const start = Number.parseFloat(draft.starting_balance);
    const floor = Number.parseFloat(draft.max_drawdown_floor);

    if (!Number.isFinite(stop) || stop < 0) return setError('Daily stop must be 0 or more.');
    if (!Number.isInteger(maxTrades) || maxTrades < 1)
      return setError('Max trades per day must be at least 1.');
    if (!Number.isFinite(start) || start < 0) return setError('Starting balance must be 0 or more.');
    if (!Number.isFinite(floor) || floor < 0) return setError('Drawdown floor must be 0 or more.');
    if (floor > start) return setError('Drawdown floor must be at or below the starting balance.');

    setBusy(true);
    try {
      await saveRules({
        ...rules,
        daily_stop_loss: stop,
        max_trades_per_day: maxTrades,
        starting_balance: start,
        max_drawdown_floor: floor,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save rules.');
    } finally {
      setBusy(false);
    }
  }

  async function onMigrate() {
    setMigrateMsg(null);
    setBusy(true);
    try {
      const n = await migrateLocal();
      setMigrateMsg(n > 0 ? `Uploaded ${n} local trade${n === 1 ? '' : 's'} to the cloud.` : 'No local trades to upload.');
    } catch (e) {
      setMigrateMsg(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  const drawdownRoom =
    Number.parseFloat(draft.starting_balance) - Number.parseFloat(draft.max_drawdown_floor);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Risk rules</div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="stop">Daily stop loss ($)</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                id="stop"
                type="number"
                inputMode="decimal"
                min="0"
                step="50"
                value={draft.daily_stop_loss}
                onChange={(e) => set('daily_stop_loss', e.target.value)}
              />
            </div>
            <div className="help">Day locks when P&amp;L hits −this.</div>
          </div>

          <div className="field">
            <label htmlFor="maxtrades">Max trades / day</label>
            <input
              id="maxtrades"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={draft.max_trades_per_day}
              onChange={(e) => set('max_trades_per_day', e.target.value)}
            />
            <div className="help">Day locks at this count.</div>
          </div>

          <div className="field">
            <label htmlFor="start">Starting balance ($)</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                id="start"
                type="number"
                inputMode="decimal"
                min="0"
                step="100"
                value={draft.starting_balance}
                onChange={(e) => set('starting_balance', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="floor">Max drawdown floor ($)</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                id="floor"
                type="number"
                inputMode="decimal"
                min="0"
                step="100"
                value={draft.max_drawdown_floor}
                onChange={(e) => set('max_drawdown_floor', e.target.value)}
              />
            </div>
            <div className="help">Balance that blows the account.</div>
          </div>
        </div>

        {Number.isFinite(drawdownRoom) && (
          <div className="muted-block" style={{ marginBottom: 12 }}>
            Starting drawdown room: <span className="num">{money(drawdownRoom)}</span>
            {drawdownRoom < 0 && <span className="neg"> — floor is above starting balance.</span>}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="row-between">
          <button className="btn btn-primary" onClick={() => void onSave()} disabled={busy}>
            {busy ? 'Saving…' : 'Save rules'}
          </button>
          {saved && <span className="saved-flash">✓ Saved</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Sync &amp; account</div>
        {mode === 'cloud' ? (
          <>
            <div className="kv">
              <span className="k">Status</span>
              <span className="v pos">Cloud sync on</span>
            </div>
            <div className="kv">
              <span className="k">Signed in as</span>
              <span className="v" style={{ fontWeight: 500 }}>{email}</span>
            </div>
            {localDataAvailable && (
              <div style={{ marginTop: 14 }}>
                <div className="muted-block" style={{ marginBottom: 8 }}>
                  Trades from this browser&rsquo;s local mode were found.
                </div>
                <button className="btn btn-ghost" onClick={() => void onMigrate()} disabled={busy}>
                  Upload local trades to cloud
                </button>
              </div>
            )}
            {migrateMsg && <div className="note ok" style={{ marginTop: 12 }}>{migrateMsg}</div>}
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="kv">
              <span className="k">Status</span>
              <span className="v warn">Local only (this browser)</span>
            </div>
            <div className="muted-block" style={{ marginTop: 12 }}>
              To sync across devices: create a free Supabase project, run{' '}
              <code>supabase/schema.sql</code>, then add <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code> and redeploy. Full steps
              are in the README. Your local trades can be uploaded after you sign in.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
