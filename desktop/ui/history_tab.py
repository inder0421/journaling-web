"""History tab: trades grouped by day/week in a tree, with delete. Mirrors
src/components/HistoryTab.tsx (Treeview replaces the custom accordion)."""
from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk

from journal.calculations import summarize_by_day, summarize_by_week
from journal.format import format_day_key, format_time, money_signed


class HistoryTab(ttk.Frame):
    def __init__(self, parent, state):
        super().__init__(parent, padding=14)
        self.state = state
        self.view = tk.StringVar(value="daily")

        top = ttk.Frame(self)
        top.pack(fill="x", pady=(0, 8))
        ttk.Radiobutton(top, text="Daily", variable=self.view, value="daily", command=self.refresh).pack(side="left")
        ttk.Radiobutton(top, text="Weekly", variable=self.view, value="weekly", command=self.refresh).pack(side="left", padx=(10, 0))
        ttk.Button(top, text="Delete selected trade", command=self._delete_selected).pack(side="right")

        self.summary_label = ttk.Label(self, text="", style="Faint.TLabel")
        self.summary_label.pack(anchor="w", pady=(0, 6))

        columns = ("time", "instrument", "tag", "reason", "pnl")
        self.tree = ttk.Treeview(self, columns=columns, show="tree headings", height=20)
        self.tree.heading("#0", text="Day / trade")
        self.tree.heading("time", text="Time")
        self.tree.heading("instrument", text="Instrument")
        self.tree.heading("tag", text="Setup")
        self.tree.heading("reason", text="Reason")
        self.tree.heading("pnl", text="P&L")
        self.tree.column("#0", width=160)
        self.tree.column("time", width=80, anchor="center")
        self.tree.column("instrument", width=80, anchor="center")
        self.tree.column("tag", width=80, anchor="center")
        self.tree.column("reason", width=220)
        self.tree.column("pnl", width=90, anchor="e")
        self.tree.pack(fill="both", expand=True)

        self.state.on_change(self.refresh)
        self.refresh()

    def refresh(self):
        trades, rules = self.state.trades, self.state.rules
        self.tree.delete(*self.tree.get_children())

        total = sum(t.pnl for t in trades)
        self.summary_label.configure(text=f"{len(trades)} trades - net {money_signed(total)}")

        if not trades:
            return

        summaries = summarize_by_day(trades, rules) if self.view.get() == "daily" else summarize_by_week(trades, rules)
        for s in summaries:
            label = f"Week of {format_day_key(s.key)}" if self.view.get() == "weekly" else format_day_key(s.key)
            flags = []
            if s.hit_daily_stop:
                flags.append("stop hit")
            if s.exceeded_max_trades:
                flags.append("over limit")
            if s.impulse_count:
                flags.append(f"{s.impulse_count} impulse")
            meta = f"{s.trade_count} trades - {s.on_criteria_count} on-setup - {s.impulse_count} impulse"
            if flags:
                meta += "  [" + ", ".join(flags) + "]"

            self.tree.insert("", "end", iid=s.key, text=label,
                              values=("", "", "", meta, money_signed(s.net_pnl)), open=True)
            for t in reversed(s.trades):
                self.tree.insert(s.key, "end", iid=t.id, text="",
                                  values=(format_time(t.traded_at), t.instrument,
                                          "setup" if t.setup_criteria_met else "impulse",
                                          t.entry_reason or "-", money_signed(t.pnl)))

    def _delete_selected(self):
        selection = self.tree.selection()
        if not selection:
            return
        trade_ids = {t.id for t in self.state.trades}
        iid = selection[0]
        if iid not in trade_ids:
            messagebox.showinfo("Select a trade", "Select an individual trade row (not a day header) to delete.")
            return
        if messagebox.askyesno("Delete trade", "Delete this trade?"):
            self.state.delete_trade(iid)
