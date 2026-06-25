"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CopyAccount, INSTRUMENTS, NewCopyAccount } from "@/lib/types";
import {
  addAccount,
  deleteAccount,
  listAccounts,
  setLeadAccount,
  subscribeChanges,
  updateAccount,
} from "@/lib/store";
import {
  isCapped,
  leadOf,
  scaledContracts,
  suggestMultiplier,
  totalContracts,
} from "@/lib/copy";
import { money } from "@/lib/format";

export default function CopyTab() {
  const [accounts, setAccounts] = useState<CopyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [instrument, setInstrument] = useState("ES");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [leadQty, setLeadQty] = useState("1");
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const refetch = useCallback(async () => {
    try {
      setAccounts(await listAccounts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const unsub = subscribeChanges(() => void refetch());
    const onVis = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unsub();
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refetch]);

  const lead = useMemo(() => leadOf(accounts), [accounts]);
  const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);
  const qty = Math.max(0, Math.floor(Number(leadQty) || 0));
  const total = useMemo(() => totalContracts(accounts, qty), [accounts, qty]);
  const allCopied =
    activeAccounts.length > 0 && activeAccounts.every((a) => copied[a.id]);

  // Reset the copy checklist whenever the ticket changes.
  useEffect(() => {
    setCopied({});
  }, [instrument, direction, leadQty, accounts.length]);

  const handleAdd = useCallback(
    async (data: NewCopyAccount) => {
      const created = await addAccount(data);
      if (accounts.length === 0) await setLeadAccount(created.id);
      await refetch();
    },
    [accounts.length, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, patch: Partial<CopyAccount>) => {
      await updateAccount(id, patch);
      await refetch();
    },
    [refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      try {
        await deleteAccount(id);
      } finally {
        await refetch();
      }
    },
    [refetch]
  );

  const handleSetLead = useCallback(
    async (id: string) => {
      await setLeadAccount(id);
      await refetch();
    },
    [refetch]
  );

  const autoScale = useCallback(async () => {
    if (!lead) return;
    for (const a of accounts) {
      if (a.id === lead.id) continue;
      await updateAccount(a.id, { multiplier: suggestMultiplier(a, lead) });
    }
    await refetch();
  }, [accounts, lead, refetch]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
      {/* Sizer / copy plan */}
      <div className="space-y-5 lg:col-span-7">
        <section className="rounded-lg border border-line-strong bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Copy plan</h2>
            <p className="text-xs text-faint">
              You place the orders in Tradovate — this gives each account the
              right contract size off your lead.
            </p>
          </div>

          {accounts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Add your accounts on the right to build a copy plan.
            </p>
          ) : !lead ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Set one account as the lead to size the others.
            </p>
          ) : (
            <div className="p-4">
              {/* Ticket */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-2">
                  <Label>Instrument</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(INSTRUMENTS as readonly string[]).map((ins) => (
                      <button
                        key={ins}
                        onClick={() => setInstrument(ins)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                          instrument === ins
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-line bg-bg text-muted hover:text-fg"
                        }`}
                      >
                        {ins}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Direction</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setDirection("long")}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                        direction === "long"
                          ? "border-win bg-win/15 text-win"
                          : "border-line bg-bg text-muted"
                      }`}
                    >
                      Long
                    </button>
                    <button
                      onClick={() => setDirection("short")}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                        direction === "short"
                          ? "border-loss bg-loss/15 text-loss"
                          : "border-line bg-bg text-muted"
                      }`}
                    >
                      Short
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Lead contracts</Label>
                  <input
                    inputMode="numeric"
                    data-testid="lead-qty"
                    value={leadQty}
                    onChange={(e) =>
                      setLeadQty(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full rounded-md border border-line bg-bg px-3 py-2 text-base tnum text-fg focus:border-accent"
                  />
                </div>
              </div>

              {/* Plan rows */}
              <div className="mt-4 overflow-hidden rounded-md border border-line">
                {activeAccounts.map((a) => {
                  const n = scaledContracts(a, qty);
                  const capped = isCapped(a, qty);
                  return (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 ${
                        copied[a.id] ? "bg-surface-2/60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!copied[a.id]}
                        onChange={(e) =>
                          setCopied((c) => ({ ...c, [a.id]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {a.firm || "Account"}
                            {a.label ? ` · ${a.label}` : ""}
                          </span>
                          {a.is_lead && (
                            <span className="rounded border border-accent/50 px-1 text-[10px] font-medium uppercase text-accent">
                              lead
                            </span>
                          )}
                          {capped && (
                            <span className="rounded border border-warn/50 px-1 text-[10px] font-medium uppercase text-warn">
                              capped
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-faint">
                          {a.is_lead ? "your size" : `× ${a.multiplier}`}
                          {a.max_contracts > 0 ? ` · max ${a.max_contracts}` : ""}
                          {copied[a.id] ? " · placed" : ""}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right ${
                          copied[a.id] ? "opacity-50" : ""
                        }`}
                      >
                        <span className="text-lg font-semibold tnum">{n}</span>
                        <span className="ml-1 text-xs text-faint">
                          {n === 1 ? "ct" : "cts"}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted">
                  {direction === "long" ? "Long" : "Short"} {instrument} ·{" "}
                  {activeAccounts.length} account
                  {activeAccounts.length === 1 ? "" : "s"}
                </span>
                <span className="font-semibold tnum">
                  {total} total ct{total === 1 ? "" : "s"}
                </span>
              </div>

              <p className="mt-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                One ticket fires {total} contract{total === 1 ? "" : "s"} across{" "}
                {activeAccounts.length} account
                {activeAccounts.length === 1 ? "" : "s"} at once. Confirm both
                firms allow copy trading — and remember the discipline rules
                apply to every account.
              </p>

              {allCopied && (
                <p className="mt-2 text-center text-xs font-medium text-win">
                  All accounts marked placed.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Accounts manager */}
      <div className="space-y-3 lg:col-span-5">
        <section className="rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Accounts</h2>
            {accounts.length > 1 && lead && (
              <button
                onClick={() => void autoScale()}
                className="text-xs font-medium text-accent hover:underline"
              >
                Auto-size from $
              </button>
            )}
          </div>

          <div className="divide-y divide-line">
            {accounts.map((a) => (
              <AccountRow
                key={a.id}
                acct={a}
                isLead={a.is_lead}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSetLead={handleSetLead}
              />
            ))}
          </div>

          {accounts.length === 0 && !adding && (
            <p className="px-4 py-6 text-center text-sm text-faint">
              No accounts yet. Add Lucid, Alpha Futures, and any others.
            </p>
          )}

          {adding ? (
            <AddAccountForm
              onCancel={() => setAdding(false)}
              onAdd={async (d) => {
                await handleAdd(d);
                setAdding(false);
              }}
            />
          ) : (
            <div className="p-3">
              <button
                onClick={() => setAdding(true)}
                className="w-full rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 text-sm font-medium text-fg hover:border-accent"
              >
                + Add account
              </button>
            </div>
          )}
        </section>

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="px-1 text-xs text-faint">
          The lead is the account you trade. Followers scale by their multiplier
          (× lead contracts) and never exceed their max-contracts cap.
        </p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

function AccountRow({
  acct,
  isLead,
  onUpdate,
  onDelete,
  onSetLead,
}: {
  acct: CopyAccount;
  isLead: boolean;
  onUpdate: (id: string, patch: Partial<CopyAccount>) => void;
  onDelete: (id: string) => void;
  onSetLead: (id: string) => void;
}) {
  const [mult, setMult] = useState(String(acct.multiplier));
  const [max, setMax] = useState(String(acct.max_contracts));
  const [confirmDel, setConfirmDel] = useState(false);

  // Resync when the value changes from elsewhere (e.g. auto-size).
  useEffect(() => setMult(String(acct.multiplier)), [acct.multiplier]);
  useEffect(() => setMax(String(acct.max_contracts)), [acct.max_contracts]);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {acct.firm || "Account"}
              {acct.label ? ` · ${acct.label}` : ""}
            </span>
            {isLead && (
              <span className="rounded border border-accent/50 px-1 text-[10px] font-medium uppercase text-accent">
                lead
              </span>
            )}
          </div>
          <div className="text-xs text-faint">{money(acct.size)} account</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isLead && (
            <button
              onClick={() => onSetLead(acct.id)}
              className="rounded border border-line px-1.5 py-1 text-[11px] font-medium text-muted hover:border-accent hover:text-accent"
            >
              Make lead
            </button>
          )}
          <button
            onClick={() => onUpdate(acct.id, { active: !acct.active })}
            className={`rounded border px-1.5 py-1 text-[11px] font-medium ${
              acct.active
                ? "border-win/50 text-win"
                : "border-line text-faint"
            }`}
          >
            {acct.active ? "On" : "Off"}
          </button>
          {confirmDel ? (
            <button
              onClick={() => onDelete(acct.id)}
              onBlur={() => setConfirmDel(false)}
              className="rounded px-1 text-[11px] font-medium text-danger"
            >
              Sure?
            </button>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              aria-label="Delete account"
              className="text-faint hover:text-danger"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
      </div>

      {!isLead && (
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            ×
            <input
              inputMode="decimal"
              value={mult}
              onChange={(e) => setMult(e.target.value.replace(/[^0-9.]/g, ""))}
              onBlur={() =>
                onUpdate(acct.id, { multiplier: Number(mult) || 0 })
              }
              className="w-16 rounded border border-line bg-bg px-2 py-1 text-sm tnum text-fg focus:border-accent"
            />
            <span className="text-faint">per lead ct</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            max
            <input
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() =>
                onUpdate(acct.id, {
                  max_contracts: Math.max(0, Math.floor(Number(max) || 0)),
                })
              }
              placeholder="0"
              className="w-14 rounded border border-line bg-bg px-2 py-1 text-sm tnum text-fg placeholder:text-faint focus:border-accent"
            />
            <span className="text-faint">cts</span>
          </label>
        </div>
      )}
    </div>
  );
}

function AddAccountForm({
  onAdd,
  onCancel,
}: {
  onAdd: (d: NewCopyAccount) => Promise<void>;
  onCancel: () => void;
}) {
  const [firm, setFirm] = useState("");
  const [label, setLabel] = useState("");
  const [size, setSize] = useState("50000");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firm.trim()) return;
    setBusy(true);
    try {
      await onAdd({
        firm: firm.trim(),
        label: label.trim(),
        size: Number(size) || 0,
        multiplier: 1,
        max_contracts: 0,
        is_lead: false,
        active: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line p-3">
      <input
        autoFocus
        value={firm}
        onChange={(e) => setFirm(e.target.value)}
        placeholder="Firm (e.g. Lucid, Alpha Futures)"
        className="w-full rounded-md border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-faint focus:border-accent"
      />
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label / acct #"
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-faint focus:border-accent"
        />
        <div className="relative w-32">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            $
          </span>
          <input
            inputMode="numeric"
            value={size}
            onChange={(e) => setSize(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Size"
            className="w-full rounded-md border border-line bg-bg py-2.5 pl-6 pr-2 text-base tnum text-fg placeholder:text-faint focus:border-accent"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm font-medium text-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !firm.trim()}
          className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
