"use client";

import { useEffect, useState } from "react";
import { Rules } from "@/lib/types";
import { money } from "@/lib/format";

function NumField({
  label,
  hint,
  value,
  onChange,
  prefix,
  step,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
      <span className="mb-2 block text-xs text-faint">{hint}</span>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            {prefix}
          </span>
        )}
        <input
          inputMode="decimal"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className={`w-full rounded-md border border-line bg-bg py-3 ${
            prefix ? "pl-7" : "pl-3"
          } pr-3 text-base tnum text-fg focus:border-accent`}
        />
      </div>
    </label>
  );
}

export default function RulesEditor({
  rules,
  onSave,
  onClose,
}: {
  rules: Rules;
  onSave: (r: Rules) => Promise<void>;
  onClose: () => void;
}) {
  const [stop, setStop] = useState(String(rules.daily_stop_loss));
  const [maxTrades, setMaxTrades] = useState(String(rules.max_trades_per_day));
  const [start, setStart] = useState(String(rules.starting_balance));
  const [floor, setFloor] = useState(String(rules.max_drawdown_floor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allowance = (Number(start) || 0) - (Number(floor) || 0);
  const floorAboveStart = allowance < 0;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        daily_stop_loss: Number(stop) || 0,
        max_trades_per_day: Math.floor(Number(maxTrades) || 0),
        starting_balance: Number(start) || 0,
        max_drawdown_floor: Number(floor) || 0,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rules.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Risk rules</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <NumField
            label="Daily stop loss"
            hint="When today's net P&L is down this much, logging locks for the day."
            value={stop}
            onChange={setStop}
            prefix="$"
          />
          <NumField
            label="Max trades per day"
            hint="When you've logged this many trades today, logging locks."
            value={maxTrades}
            onChange={setMaxTrades}
            step="1"
          />
          <NumField
            label="Account starting balance"
            hint="Your funded account's starting balance."
            value={start}
            onChange={setStart}
            prefix="$"
          />
          <NumField
            label="Max drawdown floor"
            hint="The lowest balance allowed before the account is blown."
            value={floor}
            onChange={setFloor}
            prefix="$"
          />

          <div className="rounded-md border border-line bg-bg p-3 text-xs text-muted">
            Drawdown allowance:{" "}
            <span
              className={`font-medium tnum ${
                floorAboveStart ? "text-danger" : "text-fg"
              }`}
            >
              {money(allowance)}
            </span>
            {floorAboveStart && (
              <span className="text-danger">
                {" "}
                — floor is above starting balance. Check these values.
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-md bg-accent px-3 py-3 text-base font-medium text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save rules"}
          </button>
        </div>
      </div>
    </div>
  );
}
