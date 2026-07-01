"""Today tab: status bar, lockout banner, and the trade entry form.
Mirrors src/components/TodayTab.tsx + StatusBar.tsx + LockoutBanner.tsx + TradeForm.tsx."""
from __future__ import annotations

import tkinter as tk
from datetime import datetime
from tkinter import messagebox, ttk

from journal.calculations import current_balance, cushion_remaining, initial_cushion, signed_pnl, today_stats
from journal.models import INSTRUMENTS, NewTrade

from . import theme

CUSTOM = "Custom…"


class TodayTab(ttk.Frame):
    def __init__(self, parent, state):
        super().__init__(parent, padding=14)
        self.state = state
        self.setup_met: bool | None = None
        self.result: str | None = None

        self.status_frame = ttk.Frame(self)
        self.status_frame.pack(fill="x")

        self.lockout_frame = ttk.Frame(self)
        self.lockout_frame.pack(fill="x", pady=(10, 0))

        self._build_form()
        self.state.on_change(self.refresh)
        self.refresh()

    # ------------------------------- status/lockout --------------------------

    def _stat(self, parent, label, value, meta, value_style="Surface.TLabel"):
        box = ttk.Frame(parent, style="Surface.TFrame", padding=10)
        ttk.Label(box, text=label, style="SurfaceDim.TLabel").pack(anchor="w")
        ttk.Label(box, text=value, style=value_style, font=theme.FONT_BOLD).pack(anchor="w", pady=(4, 0))
        ttk.Label(box, text=meta, style="SurfaceDim.TLabel").pack(anchor="w")
        return box

    def _render_status(self):
        for w in self.status_frame.winfo_children():
            w.destroy()
        rules, trades = self.state.rules, self.state.trades
        stats = today_stats(trades)
        cushion = cushion_remaining(rules, trades)
        balance = current_balance(rules, trades)
        start_cushion = initial_cushion(rules)

        pnl_style = "Pos.TLabel" if stats.pnl > 0 else "Neg.TLabel" if stats.pnl < 0 else "Surface.TLabel"
        cushion_low = start_cushion > 0 and cushion <= start_cushion * 0.25
        cushion_style = "Neg.TLabel" if cushion <= 0 else "Warn.TLabel" if cushion_low else "Pos.TLabel"

        self._stat(self.status_frame, "Today's P&L", f"{stats.pnl:+.0f}", f"stop at -{rules.daily_stop_loss:.0f}", pnl_style).grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        self._stat(self.status_frame, "Trades today", f"{stats.trade_count} / {rules.max_trades_per_day}", f"max {rules.max_trades_per_day}/day").grid(row=0, column=1, sticky="nsew", padx=6)
        self._stat(self.status_frame, "Cushion left", f"{cushion:,.0f}", f"to floor {rules.max_drawdown_floor:,.0f}", cushion_style).grid(row=0, column=2, sticky="nsew", padx=6)
        self._stat(self.status_frame, "Balance", f"{balance:,.0f}", f"started {rules.starting_balance:,.0f}").grid(row=0, column=3, sticky="nsew", padx=(6, 0))
        for c in range(4):
            self.status_frame.columnconfigure(c, weight=1)

    def _render_lockout(self):
        for w in self.lockout_frame.winfo_children():
            w.destroy()
        lock = self.state.lockout()
        if not lock.locked:
            return
        rules = self.state.rules
        reasons = []
        if lock.daily_stop_hit:
            reasons.append(f"Daily stop hit — today's P&L is {lock.today_pnl:+.0f} (limit -{rules.daily_stop_loss:.0f}).")
        if lock.max_trades_hit:
            reasons.append(f"Trade limit reached — {lock.today_count} of {rules.max_trades_per_day} taken today.")
        if lock.floor_breached:
            reasons.append("Drawdown floor breached — there is no cushion left in the account.")

        banner = ttk.Frame(self.lockout_frame, style="Surface.TFrame", padding=12)
        banner.pack(fill="x")
        ttk.Label(banner, text="Trading locked for today", style="Neg.TLabel", font=theme.FONT_TITLE).pack(anchor="w")
        for r in reasons:
            ttk.Label(banner, text=f"- {r}", style="SurfaceDim.TLabel", wraplength=640, justify="left").pack(anchor="w", pady=(4, 0))

    # ---------------------------------- form ----------------------------------

    def _build_form(self):
        form = ttk.Frame(self, style="Surface.TFrame", padding=14)
        form.pack(fill="x", pady=(14, 0))
        ttk.Label(form, text="Log a trade", style="SurfaceTitle.TLabel").pack(anchor="w", pady=(0, 10))

        ttk.Label(form, text="Setup criteria met?", style="Surface.TLabel").pack(anchor="w")
        seg1 = ttk.Frame(form, style="Surface.TFrame")
        seg1.pack(fill="x", pady=(4, 10))
        self.setup_var = tk.StringVar(value="")
        ttk.Radiobutton(seg1, text="Yes — on setup", variable=self.setup_var, value="yes").pack(side="left", padx=(0, 12))
        ttk.Radiobutton(seg1, text="No — impulse", variable=self.setup_var, value="no").pack(side="left")

        ttk.Label(form, text="Result", style="Surface.TLabel").pack(anchor="w")
        seg2 = ttk.Frame(form, style="Surface.TFrame")
        seg2.pack(fill="x", pady=(4, 10))
        self.result_var = tk.StringVar(value="")
        for label, value in (("Win", "win"), ("Loss", "loss"), ("Scratch", "scratch")):
            ttk.Radiobutton(seg2, text=label, variable=self.result_var, value=value,
                            command=self._on_result_change).pack(side="left", padx=(0, 12))

        grid = ttk.Frame(form, style="Surface.TFrame")
        grid.pack(fill="x", pady=(0, 10))
        ttk.Label(grid, text="Amount ($)", style="Surface.TLabel").grid(row=0, column=0, sticky="w")
        self.amount_var = tk.StringVar()
        self.amount_entry = ttk.Entry(grid, textvariable=self.amount_var, width=14)
        self.amount_entry.grid(row=1, column=0, sticky="w", padx=(0, 20))

        ttk.Label(grid, text="Instrument", style="Surface.TLabel").grid(row=0, column=1, sticky="w")
        self.instrument_var = tk.StringVar(value=INSTRUMENTS[0])
        instrument_box = ttk.Combobox(grid, textvariable=self.instrument_var, values=[*INSTRUMENTS, CUSTOM],
                                       state="readonly", width=12)
        instrument_box.grid(row=1, column=1, sticky="w")
        self.custom_instrument_var = tk.StringVar()
        self.custom_instrument_entry = ttk.Entry(grid, textvariable=self.custom_instrument_var, width=12)

        def on_instrument_change(_evt=None):
            if self.instrument_var.get() == CUSTOM:
                self.custom_instrument_entry.grid(row=1, column=2, sticky="w", padx=(8, 0))
            else:
                self.custom_instrument_entry.grid_remove()

        instrument_box.bind("<<ComboboxSelected>>", on_instrument_change)

        ttk.Label(form, text="Entry reason", style="Surface.TLabel").pack(anchor="w")
        self.reason_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.reason_var, width=60).pack(fill="x", pady=(4, 10))

        submit_row = ttk.Frame(form, style="Surface.TFrame")
        submit_row.pack(fill="x")
        ttk.Button(submit_row, text="Log trade", style="Accent.TButton", command=self._submit).pack(side="left")
        self.saved_label = ttk.Label(submit_row, text="", style="Pos.TLabel")
        self.saved_label.pack(side="left", padx=(10, 0))

    def _on_result_change(self):
        if self.result_var.get() == "scratch":
            self.amount_var.set("")
            self.amount_entry.state(["disabled"])
        else:
            self.amount_entry.state(["!disabled"])

    def _submit(self):
        if self.state.lockout().locked:
            messagebox.showwarning("Locked", "Trading is locked for today.")
            return
        if self.setup_var.get() not in ("yes", "no"):
            messagebox.showerror("Missing field", "Mark whether your setup criteria were met.")
            return
        if self.result_var.get() not in ("win", "loss", "scratch"):
            messagebox.showerror("Missing field", "Select the result.")
            return

        result = self.result_var.get()
        is_decisive = result != "scratch"
        try:
            amount = float(self.amount_var.get()) if is_decisive else 0.0
        except ValueError:
            amount = -1
        if is_decisive and amount <= 0:
            messagebox.showerror("Invalid amount", "Enter the dollar amount for this trade.")
            return

        instrument = self.instrument_var.get()
        if instrument == CUSTOM:
            instrument = self.custom_instrument_var.get().strip().upper()
        if not instrument:
            messagebox.showerror("Missing field", "Enter the instrument.")
            return

        trade = NewTrade(
            setup_criteria_met=self.setup_var.get() == "yes",
            entry_reason=self.reason_var.get().strip(),
            result=result,
            amount=amount,
            pnl=signed_pnl(amount, result),
            instrument=instrument,
            traded_at=datetime.now().astimezone().isoformat(),
        )
        self.state.add_trade(trade)

        self.setup_var.set("")
        self.result_var.set("")
        self.amount_var.set("")
        self.reason_var.set("")
        self.amount_entry.state(["!disabled"])
        self.saved_label.configure(text="Saved")
        self.after(2200, lambda: self.saved_label.configure(text=""))

    def refresh(self):
        self._render_status()
        self._render_lockout()
