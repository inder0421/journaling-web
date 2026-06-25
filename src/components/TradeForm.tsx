import { useState, type FormEvent } from 'react';
import { useAppData } from '../context/AppData';
import { signedPnl } from '../lib/calculations';
import { toDatetimeLocal } from '../lib/format';
import { INSTRUMENTS, type TradeResult } from '../lib/types';

const CUSTOM = 'CUSTOM';

export function TradeForm({ disabled }: { disabled: boolean }) {
  const { addTrade } = useAppData();

  const [setupMet, setSetupMet] = useState<boolean | null>(null);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [instrument, setInstrument] = useState<string>('ES');
  const [customInstrument, setCustomInstrument] = useState('');
  const [tradedAt, setTradedAt] = useState(() => toDatetimeLocal(new Date()));

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function resetForm(keepInstrument: boolean) {
    setSetupMet(null);
    setResult(null);
    setAmount('');
    setReason('');
    if (!keepInstrument) {
      setInstrument('ES');
      setCustomInstrument('');
    }
    setTradedAt(toDatetimeLocal(new Date()));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled || submitting) return;
    setError(null);

    if (setupMet === null) return setError('Mark whether your setup criteria were met.');
    if (result === null) return setError('Select the result.');

    const isDecisive = result !== 'scratch';
    const amt = isDecisive ? Number.parseFloat(amount) : 0;
    if (isDecisive && (!Number.isFinite(amt) || amt <= 0)) {
      return setError('Enter the dollar amount for this trade.');
    }

    const instr = instrument === CUSTOM ? customInstrument.trim().toUpperCase() : instrument;
    if (!instr) return setError('Enter the instrument.');

    const when = new Date(tradedAt);
    if (Number.isNaN(when.getTime())) return setError('Enter a valid trade time.');

    setSubmitting(true);
    try {
      await addTrade({
        setup_criteria_met: setupMet,
        entry_reason: reason.trim(),
        result,
        amount: amt,
        pnl: signedPnl(amt, result),
        instrument: instr,
        traded_at: when.toISOString(),
      });
      resetForm(true);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trade.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} aria-disabled={disabled}>
      <div className="card-title">Log a trade</div>
      <fieldset disabled={disabled} style={{ border: 0, margin: 0, padding: 0 }}>
        {/* Setup criteria — required, no default */}
        <div className="field">
          <label>
            Setup criteria met? <span className="req">*</span>
          </label>
          <div className="seg">
            <button
              type="button"
              className={`choice${setupMet === true ? ' sel sel-pos' : ''}`}
              aria-pressed={setupMet === true}
              onClick={() => setSetupMet(true)}
            >
              <span className="big">Yes — on setup</span>
              <span className="small">followed my plan</span>
            </button>
            <button
              type="button"
              className={`choice${setupMet === false ? ' sel sel-warn' : ''}`}
              aria-pressed={setupMet === false}
              onClick={() => setSetupMet(false)}
            >
              <span className="big">No — impulse</span>
              <span className="small">no valid setup</span>
            </button>
          </div>
          {setupMet === false && (
            <div className="note impulse" style={{ marginTop: 10 }}>
              This will be recorded as an <strong>impulse trade</strong> and counted against your
              off-criteria stats.
            </div>
          )}
        </div>

        {/* Result — required */}
        <div className="field">
          <label>
            Result <span className="req">*</span>
          </label>
          <div className="seg">
            <button
              type="button"
              className={`choice${result === 'win' ? ' sel sel-pos' : ''}`}
              aria-pressed={result === 'win'}
              onClick={() => setResult('win')}
            >
              Win
            </button>
            <button
              type="button"
              className={`choice${result === 'loss' ? ' sel sel-neg' : ''}`}
              aria-pressed={result === 'loss'}
              onClick={() => setResult('loss')}
            >
              Loss
            </button>
            <button
              type="button"
              className={`choice${result === 'scratch' ? ' sel sel-neutral' : ''}`}
              aria-pressed={result === 'scratch'}
              onClick={() => {
                setResult('scratch');
                setAmount('');
              }}
            >
              Scratch
            </button>
          </div>
        </div>

        <div className="field-grid">
          {/* Amount */}
          <div className="field">
            <label htmlFor="amount">
              Amount {result !== 'scratch' && <span className="req">*</span>}
            </label>
            <div className="input-prefix">
              <span>$</span>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder={result === 'scratch' ? '0' : '0.00'}
                value={result === 'scratch' ? '' : amount}
                disabled={result === 'scratch'}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="help">
              {result === 'loss'
                ? 'Recorded as a loss.'
                : result === 'win'
                  ? 'Recorded as a gain.'
                  : 'Dollar P&L magnitude.'}
            </div>
          </div>

          {/* Instrument */}
          <div className="field">
            <label htmlFor="instrument">Instrument</label>
            <select
              id="instrument"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
            {instrument === CUSTOM && (
              <input
                type="text"
                placeholder="e.g. CL, GC, 6E"
                value={customInstrument}
                maxLength={12}
                onChange={(e) => setCustomInstrument(e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        </div>

        {/* Entry reason */}
        <div className="field">
          <label htmlFor="reason">Entry reason</label>
          <input
            id="reason"
            type="text"
            placeholder="What was the trigger? (e.g. failed breakout retest)"
            value={reason}
            maxLength={280}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Time */}
        <div className="field">
          <label htmlFor="tradedAt">Time</label>
          <input
            id="tradedAt"
            type="datetime-local"
            value={tradedAt}
            onChange={(e) => setTradedAt(e.target.value)}
          />
          <div className="help">Defaults to now. Auto-saved on submit.</div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="row-between">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Log trade'}
          </button>
          {savedFlash && <span className="saved-flash">✓ Saved</span>}
        </div>
      </fieldset>
    </form>
  );
}
