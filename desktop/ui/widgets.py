"""Small reusable Tkinter widgets shared across tabs."""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from news.types import NewsItem

from . import theme

CARD_WRAP = 620


class ScrollableFrame(ttk.Frame):
    """A vertically scrollable frame — Tkinter has no built-in equivalent."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.canvas = tk.Canvas(self, background=theme.BG, highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.body = ttk.Frame(self.canvas)

        self.body.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self._window = self.canvas.create_window((0, 0), window=self.body, anchor="nw")
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(self._window, width=e.width))
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel, add="+")

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def clear(self) -> None:
        for child in self.body.winfo_children():
            child.destroy()


def render_news_card(parent: tk.Widget, item: NewsItem) -> ttk.Frame:
    """A story card: time/headline/source/ticker/sector/summary/sentiment/importance/impact."""
    card = ttk.Frame(parent, style="Surface.TFrame", padding=10)

    head = ttk.Frame(card, style="Surface.TFrame")
    head.pack(fill="x")
    time_str = item.time[11:16] if len(item.time) >= 16 else item.time
    ttk.Label(head, text=time_str, style="SurfaceDim.TLabel", font=theme.FONT_MONO).pack(side="left")
    ttk.Label(head, text=f"  {item.publisher or item.source}", style="SurfaceDim.TLabel").pack(side="left")
    if item.sector:
        ttk.Label(head, text=f"  [{item.sector}]", style="SurfaceDim.TLabel").pack(side="left")
    if item.tickers:
        ttk.Label(head, text=f"  {' '.join(item.tickers[:4])}", style="SurfaceDim.TLabel").pack(side="left")

    ttk.Label(card, text=item.headline, style="Surface.TLabel", font=theme.FONT_BOLD,
              wraplength=CARD_WRAP, justify="left").pack(fill="x", pady=(4, 0), anchor="w")

    if item.ai_summary and item.ai_summary != item.headline:
        ttk.Label(card, text=item.ai_summary, style="SurfaceDim.TLabel",
                  wraplength=CARD_WRAP, justify="left").pack(fill="x", pady=(2, 0), anchor="w")

    foot = ttk.Frame(card, style="Surface.TFrame")
    foot.pack(fill="x", pady=(6, 0))
    ttk.Label(foot, text=f"{item.sentiment} · {item.sentiment_confidence}%",
              style=theme.sentiment_style(item.sentiment)).pack(side="left")
    ttk.Label(foot, text=f"   Importance {item.importance}/10", style="SurfaceDim.TLabel").pack(side="left")
    ttk.Label(foot, text=f"   {item.impact} impact", style=theme.impact_style(item.impact)).pack(side="left")

    return card
