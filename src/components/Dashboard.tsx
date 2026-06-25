"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_RULES, NewTrade, Rules, Trade } from "@/lib/types";
import {
  accountCushion,
  criteriaSplit,
  currentBalance,
  dailyPnl,
  lockoutState,
} from "@/lib/calc";
import { coachInsights } from "@/lib/coach";
import {
  addTrade,
  deleteTrade,
  getRules,
  listTrades,
  saveRules,
  subscribeChanges,
} from "@/lib/store";
import { signOut } from "@/lib/useSession";

import Header from "./Header";
import StatCards from "./StatCards";
import TradeForm from "./TradeForm";
import LockoutBanner from "./LockoutBanner";
import Analytics from "./Analytics";
import Coach from "./Coach";
import History from "./History";
import RulesEditor from "./RulesEditor";
import CopyTab from "./CopyTab";

export default function Dashboard({
  isLocal,
  email,
}: {
  isLocal: boolean;
  email: string | null;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<"journal" | "copy">("journal");

  const refetch = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([listTrades(), getRules()]);
      setTrades(t);
      setRules(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + live sync + refetch on focus.
  useEffect(() => {
    void refetch();
    const unsub = subscribeChanges(() => void refetch());
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsub();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  // Keep "today" fresh so daily P&L / lockout roll over at midnight.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lock = useMemo(() => lockoutState(trades, rules, now), [trades, rules, now]);
  const cushion = useMemo(() => accountCushion(trades, rules), [trades, rules]);
  const balance = useMemo(() => currentBalance(trades, rules), [trades, rules]);
  const today = useMemo(() => dailyPnl(trades, now), [trades, now]);
  const split = useMemo(() => criteriaSplit(trades), [trades]);
  const insights = useMemo(
    () => coachInsights(trades, rules, now),
    [trades, rules, now]
  );

  const handleAdd = useCallback(
    async (t: NewTrade) => {
      await addTrade(t);
      await refetch();
    },
    [refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setTrades((prev) => prev.filter((t) => t.id !== id)); // optimistic
      try {
        await deleteTrade(id);
      } finally {
        await refetch();
      }
    },
    [refetch]
  );

  const handleSaveRules = useCallback(async (r: Rules) => {
    const saved = await saveRules(r);
    setRules(saved);
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-5 sm:pt-8 lg:max-w-6xl lg:px-8 2xl:max-w-[90rem]">
      <Header
        isLocal={isLocal}
        email={email}
        onOpenRules={() => setRulesOpen(true)}
        onSignOut={() => void signOut()}
      />

      {error && (
        <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <nav className="mt-5 flex gap-1 border-b border-line">
        {(["journal", "copy"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              view === v
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {v}
          </button>
        ))}
      </nav>

      {view === "copy" && (
        <div className="mt-5">
          <CopyTab />
        </div>
      )}

      {view === "journal" && lock.locked && (
        <div className="mt-5">
          <LockoutBanner lock={lock} rules={rules} />
        </div>
      )}

      {/* Single column on mobile; wide two-column dashboard on desktop. */}
      {view === "journal" && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        <div className="space-y-5 lg:col-span-5">
          <StatCards
            dailyPnl={today}
            cushion={cushion}
            balance={balance}
            lock={lock}
            rules={rules}
          />

          <TradeForm
            locked={lock.locked}
            offStats={split.offCriteria}
            onSubmit={handleAdd}
          />
        </div>

        <div className="space-y-5 lg:col-span-7">
          <Coach insights={insights} />

          <Analytics
            onCriteria={split.onCriteria}
            offCriteria={split.offCriteria}
          />

          <History trades={trades} onDelete={handleDelete} />
        </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-faint">
        {loading
          ? "Loading…"
          : isLocal
            ? "Local-only mode — data lives in this browser. Add Supabase keys for cross-device sync."
            : "Synced across your devices."}
      </p>

      {rulesOpen && (
        <RulesEditor
          rules={rules}
          onSave={handleSaveRules}
          onClose={() => setRulesOpen(false)}
        />
      )}
    </div>
  );
}
