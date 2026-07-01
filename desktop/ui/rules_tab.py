"""Rules tab: edit the risk rules. Mirrors src/components/RulesTab.tsx (the
risk-rules half only — this desktop build is local-only, no cloud sync)."""
from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk

from journal.models import Rules


class RulesTab(ttk.Frame):
    def __init__(self, parent, state):
        super().__init__(parent, padding=14)
        self.state = state

        card = ttk.Frame(self, style="Surface.TFrame", padding=14)
        card.pack(fill="x")
        ttk.Label(card, text="Risk rules", style="SurfaceTitle.TLabel").pack(anchor="w", pady=(0, 10))

        grid = ttk.Frame(card, style="Surface.TFrame")
        grid.pack(fill="x")

        self.stop_var = tk.StringVar()
        self.max_trades_var = tk.StringVar()
        self.start_var = tk.StringVar()
        self.floor_var = tk.StringVar()

        fields = [
            ("Daily stop loss ($)", self.stop_var, "Day locks when P&L hits -this."),
            ("Max trades / day", self.max_trades_var, "Day locks at this count."),
            ("Starting balance ($)", self.start_var, ""),
            ("Max drawdown floor ($)", self.floor_var, "Balance that blows the account."),
        ]
        for row, (label, var, help_text) in enumerate(fields):
            ttk.Label(grid, text=label, style="Surface.TLabel").grid(row=row, column=0, sticky="w", pady=4)
            ttk.Entry(grid, textvariable=var, width=16).grid(row=row, column=1, sticky="w", padx=(10, 10))
            if help_text:
                ttk.Label(grid, text=help_text, style="SurfaceDim.TLabel").grid(row=row, column=2, sticky="w")

        row_bottom = ttk.Frame(card, style="Surface.TFrame")
        row_bottom.pack(fill="x", pady=(12, 0))
        ttk.Button(row_bottom, text="Save rules", style="Accent.TButton", command=self._save).pack(side="left")
        self.saved_label = ttk.Label(row_bottom, text="", style="Pos.TLabel")
        self.saved_label.pack(side="left", padx=(10, 0))

        self.state.on_change(self.refresh)
        self.refresh()

    def refresh(self):
        r = self.state.rules
        self.stop_var.set(str(r.daily_stop_loss))
        self.max_trades_var.set(str(r.max_trades_per_day))
        self.start_var.set(str(r.starting_balance))
        self.floor_var.set(str(r.max_drawdown_floor))

    def _save(self):
        try:
            stop = float(self.stop_var.get())
            max_trades = int(self.max_trades_var.get())
            start = float(self.start_var.get())
            floor = float(self.floor_var.get())
        except ValueError:
            messagebox.showerror("Invalid input", "All fields must be numbers.")
            return

        if stop < 0:
            return messagebox.showerror("Invalid input", "Daily stop must be 0 or more.")
        if max_trades < 1:
            return messagebox.showerror("Invalid input", "Max trades per day must be at least 1.")
        if start < 0:
            return messagebox.showerror("Invalid input", "Starting balance must be 0 or more.")
        if floor < 0:
            return messagebox.showerror("Invalid input", "Drawdown floor must be 0 or more.")
        if floor > start:
            return messagebox.showerror("Invalid input", "Drawdown floor must be at or below the starting balance.")

        self.state.save_rules(Rules(
            daily_stop_loss=stop, max_trades_per_day=max_trades,
            starting_balance=start, max_drawdown_floor=floor,
        ))
        self.saved_label.configure(text="Saved")
        self.after(2200, lambda: self.saved_label.configure(text=""))
