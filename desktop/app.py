#!/usr/bin/env python3
"""Trading Discipline Journal - desktop edition.

A local-only Tkinter port of the web app (see ../src) plus the News
Intelligence Engine, all in the standard library (tkinter + urllib +
xml.etree) - no pip install required beyond a system Tk (python3-tk on
some Linux distros; bundled with the standard installer on Windows/macOS).

Run: python3 app.py
Data is stored in ~/.trading_journal/ (override with TRADING_JOURNAL_HOME).
Optional free API keys for the News tab: FINNHUB_API_KEY, FMP_API_KEY,
ALPHA_VANTAGE_API_KEY (see README.md).
"""
from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk

from state import AppState
from ui import theme
from ui.analytics_tab import AnalyticsTab
from ui.history_tab import HistoryTab
from ui.news_tab import NewsTab
from ui.rules_tab import RulesTab
from ui.today_tab import TodayTab


def main() -> None:
    root = tk.Tk()
    root.title("Trading Discipline Journal")
    root.geometry("900x720")
    theme.apply(root)

    state = AppState()

    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True)

    notebook.add(TodayTab(notebook, state), text="Today")
    notebook.add(AnalyticsTab(notebook, state), text="Analytics")
    notebook.add(HistoryTab(notebook, state), text="History")
    notebook.add(RulesTab(notebook, state), text="Rules")
    notebook.add(NewsTab(notebook, state), text="News")

    root.mainloop()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        sys.exit("Python 3.9+ is required.")
    main()
