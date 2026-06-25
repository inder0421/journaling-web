"use client";

import { useState } from "react";
import { INSTRUMENTS, NewTrade, TradeResult } from "@/lib/types";
import { SplitStats } from "@/lib/calc";
import { money, pct } from "@/lib/format";

const PRESETS = INSTRUMENTS as readonly string[];

export default function TradeForm({
  locked,
  offStats,
  onSubmit,
}: {
  locked: boolean;
  offStats: SplitStats;
  onSubmit: (t: NewTrade) => Promise<void>;
}) {
  const [setupMet, setSetupMet] = useState<boolean | null>(null);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [instrument, setInstrument] = useState<string>("ES");
  const [customInstrument, setCustomInstrument] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNoTrade = result === "no_trade";
  const needsAmount = result === "win" || result === "loss";

  const usingCustom = instrument === "__custom__";
  const resolvedInstrument = usingCustom
    ? customInstrument.trim().toUpperCase()
    : instrument;
  const amountNum = Number(amount);
  const amountValid = !needsAmount || (amount !== "" && amountNum > 0);

  // A no-trade is restraint, not a trade: setup, amount and instrument are
  // all optional. A taken trade requires the full set.
  const ready = isNoTrade
    ? true
    : setupMet !== null &&
      result !== null &&
      amountValid &&
      resolvedInstrument.length > 0;

  function reset() {
    setSetupMet(null);
    setResult(null);
    setAmount("");
    setReason("");
    setConfirming(false);
    setError(null);
    // keep instrument selection for speed across trades
  }

  async function doSave() {
    if (!ready || result === null) return;
    if (!isNoTrade && setupMet === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        setup_met: setupMet ?? false, // placeholder for no-trades
        result,
        amount: needsAmount ? Math.abs(amountNum) : 0,
        entry_reason: reason.trim(),
        instrument: resolvedInstrument || "—",
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save trade.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrimary(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    // Friction step for impulse trades you actually take (never for a no-trade).
    if (!isNoTrade && setupMet === false && !confirming) {
      setConfirming(true);
      return;
    }
    void doSave();
  }

  function pickResult(r: TradeResult) {
    setResult(r);
    setConfirming(false);
    if (r !== "win" && r !== "loss") setAmount("");
  }

  return (
    <section
      className={`rounded-lg border bg-surface ${
        locked ? "border-line opacity-50" : "border-line-strong"
      }`}
    >
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Log a trade</h2>
        <p className="text-xs text-faint">Saved with the current timestamp.</p>
      </div>

      <form onSubmit={handlePrimary} className="p-4">
        <fieldset disabled={locked || busy} className="space-y-5">
          {/* Setup criteria — required for a taken trade, optional for a no-trade */}
          <div className={isNoTrade ? "opacity-50" : ""}>
            <Label>
              Setup criteria met?{" "}
              <span className="font-normal text-faint">
                {isNoTrade ? "optional" : "required"}
              </span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Toggle
                active={setupMet === true}
                tone="win"
                onClick={() => {
                  setSetupMet(true);
                  setConfirming(false);
                }}
                label="On setup"
                sub="Met my rules"
              />
              <Toggle
                active={setupMet === false}
                tone="loss"
                onClick={() => {
                  setSetupMet(false);
                  setConfirming(false);
                }}
                label="Off setup"
                sub="Impulse / no setup"
              />
            </div>
          </div>

          {/* Result — Win / Loss / Breakeven / No trade */}
          <div>
            <Label>Result</Label>
            <div className="grid grid-cols-2 gap-2">
              <Seg
                active={result === "win"}
                tone="win"
                onClick={() => pickResult("win")}
                label="Win"
              />
              <Seg
                active={result === "loss"}
                tone="loss"
                onClick={() => pickResult("loss")}
                label="Loss"
              />
              <Seg
                active={result === "breakeven"}
                tone="breakeven"
                onClick={() => pickResult("breakeven")}
                label="Breakeven"
              />
              <Seg
                active={result === "no_trade"}
                tone="notrade"
                onClick={() => pickResult("no_trade")}
                label="No trade"
              />
            </div>
            {isNoTrade && (
              <p className="mt-2 text-xs text-accent">
                Logging restraint — a trade you chose not to take. It won&apos;t
                count against your daily trade limit.
              </p>
            )}
          </div>

          {/* Amount — only for win/loss */}
          {needsAmount && (
            <div>
              <Label>
                Amount{" "}
                <span className="font-normal text-faint">dollars, P&L size</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  $
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="0"
                  className="w-full rounded-md border border-line bg-bg py-3 pl-7 pr-3 text-base tnum text-fg placeholder:text-faint focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* Instrument */}
          <div>
            <Label>
              Instrument{" "}
              {isNoTrade && (
                <span className="font-normal text-faint">optional</span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((ins) => (
                <Chip
                  key={ins}
                  active={instrument === ins}
                  onClick={() => setInstrument(ins)}
                  label={ins}
                />
              ))}
              <Chip
                active={usingCustom}
                onClick={() => setInstrument("__custom__")}
                label="Custom"
              />
            </div>
            {usingCustom && (
              <input
                value={customInstrument}
                onChange={(e) => setCustomInstrument(e.target.value)}
                placeholder="e.g. CL, GC, 6E"
                className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-base uppercase text-fg placeholder:text-faint focus:border-accent"
              />
            )}
          </div>

          {/* Entry reason */}
          <div>
            <Label>
              {isNoTrade ? "Why did you pass?" : "Entry reason"}{" "}
              <span className="font-normal text-faint">short</span>
            </Label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isNoTrade
                  ? "What kept you out? (e.g. no setup, chasing)"
                  : "What was the trigger?"
              }
              maxLength={140}
              className="w-full rounded-md border border-line bg-bg px-3 py-3 text-base text-fg placeholder:text-faint focus:border-accent"
            />
          </div>
        </fieldset>

        {error && (
          <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Off-setup friction confirmation */}
        {confirming && !locked && (
          <div className="mt-4 rounded-md border border-warn/50 bg-warn/10 p-3">
            <p className="text-sm font-medium text-warn">
              This is an off-setup trade.
            </p>
            <p className="mt-1 text-xs text-fg/80">
              Off-setup so far: {pct(offStats.winRate)} win rate over{" "}
              {offStats.trades} trade{offStats.trades === 1 ? "" : "s"}, net{" "}
              {money(offStats.netPnl)}. These are the trades that hurt you.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 text-sm font-medium text-fg"
              >
                Don&apos;t take it
              </button>
              <button
                type="button"
                onClick={() => void doSave()}
                disabled={busy}
                className="flex-1 rounded-md border border-warn bg-warn/20 px-3 py-2.5 text-sm font-medium text-warn disabled:opacity-50"
              >
                {busy ? "Logging…" : "Log it anyway"}
              </button>
            </div>
          </div>
        )}

        {/* Primary submit */}
        {!confirming && (
          <button
            type="submit"
            disabled={locked || busy || !ready}
            className="mt-5 w-full rounded-md bg-accent px-3 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {locked
              ? "Locked"
              : busy
                ? "Saving…"
                : isNoTrade
                  ? "Log no-trade"
                  : "Log trade"}
          </button>
        )}
      </form>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

const toneRing: Record<string, string> = {
  win: "border-win bg-win/15 text-win",
  loss: "border-loss bg-loss/15 text-loss",
  breakeven: "border-scratch bg-scratch/15 text-fg",
  notrade: "border-accent bg-accent/15 text-accent",
};

function Toggle({
  active,
  tone,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  tone: keyof typeof toneRing;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-3 text-left transition-colors ${
        active
          ? toneRing[tone]
          : "border-line bg-bg text-fg hover:border-line-strong"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`text-xs ${active ? "opacity-80" : "text-faint"}`}>
        {sub}
      </div>
    </button>
  );
}

function Seg({
  active,
  tone,
  onClick,
  label,
}: {
  active: boolean;
  tone: keyof typeof toneRing;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? toneRing[tone]
          : "border-line bg-bg text-fg hover:border-line-strong"
      }`}
    >
      {label}
    </button>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-line bg-bg text-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
