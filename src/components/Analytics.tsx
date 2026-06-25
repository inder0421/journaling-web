"use client";

import { SplitStats } from "@/lib/calc";
import { money, pct, signedMoney } from "@/lib/format";

function netColor(n: number): string {
  if (n > 0) return "text-win";
  if (n < 0) return "text-loss";
  return "text-scratch";
}

function Column({
  title,
  subtitle,
  stats,
  accent,
}: {
  title: string;
  subtitle: string;
  stats: SplitStats;
  accent: "on" | "off";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent === "on"
          ? "border-line bg-surface"
          : "border-loss/30 bg-loss/5"
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-faint">{subtitle}</div>

      <div className="mt-3 text-3xl font-semibold tnum">
        {pct(stats.winRate)}
      </div>
      <div className="text-xs text-muted">win rate</div>

      <dl className="mt-3 space-y-1 text-xs">
        <Row label="Trades" value={String(stats.trades)} />
        <Row
          label="W / L / S"
          value={`${stats.wins} / ${stats.losses} / ${stats.scratches}`}
        />
        <Row
          label="Net P&L"
          value={signedMoney(stats.netPnl)}
          valueClass={netColor(stats.netPnl)}
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-fg",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`tnum font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}

export default function Analytics({
  onCriteria,
  offCriteria,
}: {
  onCriteria: SplitStats;
  offCriteria: SplitStats;
}) {
  const drag = offCriteria.netPnl; // usually the damage from impulse trades
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">On setup vs. impulse</h2>
      <div className="grid grid-cols-2 gap-3">
        <Column
          title="On setup"
          subtitle="Criteria met"
          stats={onCriteria}
          accent="on"
        />
        <Column
          title="Impulse"
          subtitle="Off setup"
          stats={offCriteria}
          accent="off"
        />
      </div>
      {offCriteria.trades > 0 && (
        <p className="mt-2 text-xs text-faint">
          Impulse trades have netted{" "}
          <span className={`font-medium ${netColor(drag)}`}>
            {signedMoney(drag)}
          </span>{" "}
          all-time across {offCriteria.trades} trade
          {offCriteria.trades === 1 ? "" : "s"}.
          {onCriteria.winRate !== null && offCriteria.winRate !== null && (
            <>
              {" "}
              That&apos;s {pct(offCriteria.winRate)} vs {pct(onCriteria.winRate)}{" "}
              on setup.
            </>
          )}
        </p>
      )}
    </section>
  );
}
