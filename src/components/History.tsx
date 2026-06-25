"use client";

import { useMemo, useState } from "react";
import { Trade } from "@/lib/types";
import { groupByDay, groupByWeek, pnlOf } from "@/lib/calc";
import { fmtDayLabel, fmtTime, money, signedMoney } from "@/lib/format";

function netColor(n: number): string {
  if (n > 0) return "text-win";
  if (n < 0) return "text-loss";
  return "text-scratch";
}

const resultTone: Record<string, string> = {
  win: "text-win",
  loss: "text-loss",
  scratch: "text-scratch",
};

function TradeRow({
  t,
  onDelete,
}: {
  t: Trade;
  onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const pnl = pnlOf(t);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-12 shrink-0 text-xs text-faint tnum">
        {fmtTime(t.created_at)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t.instrument}</span>
          <span className={`text-xs font-medium uppercase ${resultTone[t.result]}`}>
            {t.result}
          </span>
          {!t.setup_met && (
            <span className="rounded border border-loss/40 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-loss">
              impulse
            </span>
          )}
        </div>
        {t.entry_reason && (
          <div className="truncate text-xs text-faint">{t.entry_reason}</div>
        )}
      </div>
      <div className={`shrink-0 text-sm font-medium tnum ${netColor(pnl)}`}>
        {t.result === "scratch" ? "$0" : signedMoney(pnl)}
      </div>
      {confirm ? (
        <button
          onClick={() => onDelete(t.id)}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase text-danger"
        >
          Delete?
        </button>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          onBlur={() => setConfirm(false)}
          aria-label="Delete trade"
          className="shrink-0 text-faint hover:text-danger"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 7h12M9 7V5h6v2m-7 0 1 13h6l1-13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function History({
  trades,
  onDelete,
}: {
  trades: Trade[];
  onDelete: (id: string) => void;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const days = useMemo(() => groupByDay(trades), [trades]);
  const weeks = useMemo(() => groupByWeek(trades), [trades]);
  const now = new Date();

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">History</h2>
        <div className="flex rounded-md border border-line bg-surface p-0.5 text-xs">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 font-medium capitalize ${
                view === v ? "bg-surface-2 text-fg" : "text-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {trades.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-faint">
          No trades logged yet.
        </div>
      )}

      {view === "day" &&
        days.map((d) => (
          <div
            key={d.key}
            className="mb-3 overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
              <div>
                <div className="text-sm font-semibold">
                  {fmtDayLabel(d.date, now)}
                </div>
                <div className="text-xs text-faint">
                  {d.trades.length} trade{d.trades.length === 1 ? "" : "s"} ·{" "}
                  {d.onCount} on · {d.offCount} impulse
                </div>
              </div>
              <div className={`text-base font-semibold tnum ${netColor(d.pnl)}`}>
                {signedMoney(d.pnl)}
              </div>
            </div>
            <div className="divide-y divide-line">
              {d.trades.map((t) => (
                <TradeRow key={t.id} t={t} onDelete={onDelete} />
              ))}
            </div>
          </div>
        ))}

      {view === "week" && (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {weeks.map((w) => (
            <div
              key={w.key}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <div>
                <div className="text-sm font-medium">{w.label}</div>
                <div className="text-xs text-faint">
                  {w.trades} trade{w.trades === 1 ? "" : "s"} · {w.onCount} on ·{" "}
                  {w.offCount} impulse
                </div>
              </div>
              <div className={`text-base font-semibold tnum ${netColor(w.pnl)}`}>
                {signedMoney(w.pnl)}
              </div>
            </div>
          ))}
          {weeks.length === 0 && (
            <div className="p-6 text-center text-sm text-faint">
              No trades logged yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
