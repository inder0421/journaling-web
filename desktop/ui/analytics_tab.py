"""Analytics tab: on-setup vs. impulse comparison + account cushion + overall stats.
Mirrors src/components/AnalyticsTab.tsx."""
from __future__ import annotations

from tkinter import ttk

from journal.calculations import (
    cumulative_losses,
    cumulative_wins,
    current_balance,
    cushion_remaining,
    group_stats,
    initial_cushion,
    off_criteria,
    on_criteria,
    sum_pnl,
)
from journal.format import money, money_signed


def _pct(ratio) -> str:
    return "-" if ratio is None else f"{round(ratio * 100)}%"


class AnalyticsTab(ttk.Frame):
    def __init__(self, parent, state):
        super().__init__(parent, padding=14)
        self.state = state
        self.empty_label = ttk.Label(self, text="No trades logged yet. Your stats will appear here.", style="Faint.TLabel")
        self.body = ttk.Frame(self)
        self.state.on_change(self.refresh)
        self.refresh()

    def _kv(self, parent, k, v, style="Surface.TLabel"):
        row = ttk.Frame(parent, style="Surface.TFrame")
        row.pack(fill="x", pady=2)
        ttk.Label(row, text=k, style="SurfaceDim.TLabel").pack(side="left")
        ttk.Label(row, text=v, style=style).pack(side="right")

    def _compare_card(self, parent, title, stats, pos_style):
        card = ttk.Frame(parent, style="Surface.TFrame", padding=12)
        ttk.Label(card, text=title, style="SurfaceTitle.TLabel").pack(anchor="w", pady=(0, 8))
        self._kv(card, "Win rate", _pct(stats.win_rate))
        pnl_style = "Pos.TLabel" if stats.net_pnl > 0 else "Neg.TLabel" if stats.net_pnl < 0 else "Surface.TLabel"
        self._kv(card, "Net P&L", money_signed(stats.net_pnl), pnl_style)
        self._kv(card, "Trades", str(stats.count))
        self._kv(card, "W / L / S", f"{stats.wins} / {stats.losses} / {stats.scratches}")
        avg = "-" if stats.avg_pnl is None else money_signed(round(stats.avg_pnl))
        self._kv(card, "Avg / trade", avg)
        return card

    def refresh(self):
        for w in self.winfo_children():
            w.pack_forget()

        trades, rules = self.state.trades, self.state.rules
        if not trades:
            self.empty_label.pack(anchor="w")
            return

        for w in self.body.winfo_children():
            w.destroy()
        self.body.pack(fill="both", expand=True)

        on_stats = group_stats(on_criteria(trades))
        off_stats = group_stats(off_criteria(trades))
        overall = group_stats(trades)

        ttk.Label(self.body, text="On-setup vs. impulse - all-time", style="Title.TLabel").pack(anchor="w", pady=(0, 8))
        compare = ttk.Frame(self.body)
        compare.pack(fill="x", pady=(0, 14))
        self._compare_card(compare, "On-setup trades", on_stats, "Pos.TLabel").pack(side="left", fill="both", expand=True, padx=(0, 6))
        self._compare_card(compare, "Impulse trades", off_stats, "Warn.TLabel").pack(side="left", fill="both", expand=True, padx=(6, 0))

        balance = current_balance(rules, trades)
        cushion = cushion_remaining(rules, trades)
        start_cushion = initial_cushion(rules)
        wins = cumulative_wins(trades)
        losses = cumulative_losses(trades)
        net = sum_pnl(trades)
        cushion_style = "Neg.TLabel" if cushion <= 0 else "Warn.TLabel" if (start_cushion > 0 and cushion <= start_cushion * 0.25) else "Pos.TLabel"

        cushion_card = ttk.Frame(self.body, style="Surface.TFrame", padding=12)
        cushion_card.pack(fill="x", pady=(0, 10))
        ttk.Label(cushion_card, text="Account cushion", style="SurfaceTitle.TLabel").pack(anchor="w", pady=(0, 8))
        self._kv(cushion_card, "Starting balance", money(rules.starting_balance))
        self._kv(cushion_card, "Net P&L (all-time)", money_signed(net), "Pos.TLabel" if net > 0 else "Neg.TLabel" if net < 0 else "Surface.TLabel")
        self._kv(cushion_card, "Current balance", money(balance))
        self._kv(cushion_card, "Drawdown floor", money(rules.max_drawdown_floor))
        self._kv(cushion_card, "Cushion remaining", money(cushion), cushion_style)
        self._kv(cushion_card, "Cumulative wins", money_signed(wins), "Pos.TLabel")
        self._kv(cushion_card, "Cumulative losses", money_signed(-losses), "Neg.TLabel")

        overall_card = ttk.Frame(self.body, style="Surface.TFrame", padding=12)
        overall_card.pack(fill="x")
        ttk.Label(overall_card, text="Overall", style="SurfaceTitle.TLabel").pack(anchor="w", pady=(0, 8))
        self._kv(overall_card, "Total trades", str(overall.count))
        self._kv(overall_card, "Win rate", _pct(overall.win_rate))
        self._kv(overall_card, "Net P&L", money_signed(overall.net_pnl), "Pos.TLabel" if overall.net_pnl > 0 else "Neg.TLabel" if overall.net_pnl < 0 else "Surface.TLabel")
        avg = "-" if overall.avg_pnl is None else money_signed(round(overall.avg_pnl))
        self._kv(overall_card, "Avg / trade", avg)
