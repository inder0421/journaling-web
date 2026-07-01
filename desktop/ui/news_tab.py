"""News tab: the desktop analogue of src/components/news/NewsTab.tsx and its
8 sub-sections. Fetches run on a background thread (network I/O must never block
the Tk main loop) and results are marshalled back via a queue polled with `after`.
"""
from __future__ import annotations

import queue
import threading
import tkinter as tk
from datetime import datetime
from tkinter import ttk

from news.brief import generate_brief
from news.service import fetch_news_snapshot
from news.trade_impact import top_trade_impacts
from news.types import NEWS_CATEGORIES
from news.weekly import build_weekly_groups, sector_rotation, story_breakdown

from . import theme
from .widgets import CARD_WRAP, ScrollableFrame, render_news_card

POLL_MS = 5 * 60_000


class NewsTab(ttk.Frame):
    def __init__(self, parent, state):
        super().__init__(parent, padding=14)
        self.state = state
        self._queue: "queue.Queue" = queue.Queue()

        top = ttk.Frame(self)
        top.pack(fill="x", pady=(0, 8))
        self.status_label = ttk.Label(top, text="Not yet loaded", style="Faint.TLabel")
        self.status_label.pack(side="left")
        self.refresh_btn = ttk.Button(top, text="Refresh", command=self.trigger_refresh)
        self.refresh_btn.pack(side="right")

        self.source_status_label = ttk.Label(self, text="", style="Faint.TLabel", wraplength=700, justify="left")
        self.source_status_label.pack(fill="x", pady=(0, 8))

        self.sub = ttk.Notebook(self)
        self.sub.pack(fill="both", expand=True)

        self.tabs: dict[str, ScrollableFrame] = {}
        for key, label in [
            ("today", "Today"), ("week", "This Week"), ("calendar", "Calendar"),
            ("company", "Company"), ("brief", "AI Brief"), ("impact", "Trade Impact"),
            ("alerts", "Alerts"), ("score", "Daily Score"),
        ]:
            frame = ScrollableFrame(self.sub)
            self.sub.add(frame, text=label)
            self.tabs[key] = frame

        self._brief_kind = tk.StringVar(value=self._default_brief_kind())
        self._watchlist_entry_var = tk.StringVar()

        self.state.on_change(self.render_all)
        self.trigger_refresh()
        self.after(POLL_MS, self._auto_refresh)

    def _default_brief_kind(self) -> str:
        hour = datetime.now().hour
        if hour < 11:
            return "morning"
        if hour < 15:
            return "midday"
        return "closing"

    # ------------------------------- fetching ---------------------------------

    def _auto_refresh(self):
        self.trigger_refresh()
        self.after(POLL_MS, self._auto_refresh)

    def trigger_refresh(self):
        self.state.set_news_loading(True)
        self.refresh_btn.state(["disabled"])
        self.status_label.configure(text="Loading news...")
        watchlist = list(self.state.watchlist)
        seen = set(self.state.seen_alert_ids)
        threading.Thread(target=self._fetch_worker, args=(watchlist, seen), daemon=True).start()
        self.after(200, self._poll_queue)

    def _fetch_worker(self, watchlist, seen_alert_ids):
        try:
            snapshot = fetch_news_snapshot(watchlist, seen_alert_ids)
            self._queue.put(("ok", snapshot))
        except Exception as e:  # noqa: BLE001 - surfaced to the UI, not crashing the app
            self._queue.put(("error", str(e)))

    def _poll_queue(self):
        try:
            kind, payload = self._queue.get_nowait()
        except queue.Empty:
            self.after(200, self._poll_queue)
            return

        self.state.set_news_loading(False)
        self.refresh_btn.state(["!disabled"])
        if kind == "ok":
            self.state.set_news_snapshot(payload)
            for alert in payload.alerts:
                if alert.kind in ("breaking", "watchlist"):
                    self._maybe_notify(alert)
        else:
            self.state.set_news_error(payload)

    def _maybe_notify(self, alert):
        # No OS notification here (stdlib-only) - the Alerts sub-tab is the surface.
        pass

    # -------------------------------- rendering --------------------------------

    def render_all(self):
        snapshot = self.state.news
        if self.state.news_loading:
            self.status_label.configure(text="Loading news...")
        elif snapshot:
            self.status_label.configure(text=f"Updated {snapshot.fetched_at.astimezone().strftime('%H:%M:%S')}")
        elif self.state.news_error:
            self.status_label.configure(text=f"Error: {self.state.news_error}")

        self._render_source_status()
        self._render_today()
        self._render_week()
        self._render_calendar()
        self._render_company()
        self._render_brief()
        self._render_impact()
        self._render_alerts()
        self._render_score()

    def _render_source_status(self):
        snapshot = self.state.news
        if not snapshot:
            self.source_status_label.configure(text="")
            return
        parts = []
        for s in snapshot.source_statuses:
            if not s.configured:
                parts.append(f"{s.source}: not configured")
            elif s.ok:
                parts.append(f"{s.source}: {len(s.items)} items")
            else:
                parts.append(f"{s.source}: error ({s.error})")
        self.source_status_label.configure(text="Data sources - " + " | ".join(parts))

    def _section(self, parent, title):
        frame = ttk.LabelFrame(parent, text=title, style="Card.TLabelframe", padding=10)
        frame.pack(fill="x", pady=(0, 10), anchor="n")
        return frame

    def _empty(self, parent, text):
        ttk.Label(parent, text=text, style="Faint.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w", pady=4)

    def _render_today(self):
        frame = self.tabs["today"]
        frame.clear()
        snapshot = self.state.news
        if not snapshot or not snapshot.todays_items:
            self._empty(frame.body, "No stories yet today - check back soon, or trigger a refresh above.")
            return
        by_category: dict[str, list] = {}
        for item in snapshot.todays_items:
            for cat in item.categories:
                by_category.setdefault(cat, []).append(item)
        for cat in NEWS_CATEGORIES:
            items = by_category.get(cat)
            if not items:
                continue
            section = self._section(frame.body, f"{cat} ({len(items)})")
            for item in sorted(items, key=lambda i: i.importance, reverse=True):
                render_news_card(section, item).pack(fill="x", pady=(0, 6))

    def _render_week(self):
        frame = self.tabs["week"]
        frame.clear()
        snapshot = self.state.news
        if not snapshot or not snapshot.week_items:
            self._empty(frame.body, "No stories from the last 7 days yet.")
            return
        groups = build_weekly_groups(snapshot.week_items)
        rotation = sector_rotation(snapshot.week_items)
        for group in groups:
            section = self._section(frame.body, group.label)
            if group.unavailable:
                self._empty(section, group.unavailable)
            elif not group.items:
                self._empty(section, "Nothing this week.")
            elif group.key == "sector-rotation":
                for row in rotation:
                    line = ttk.Frame(section, style="Surface.TFrame")
                    line.pack(fill="x", pady=2)
                    ttk.Label(line, text=row.sector, style="Surface.TLabel").pack(side="left")
                    ttk.Label(line, text=f"{row.bullish} bullish / {row.bearish} bearish / {row.neutral} neutral",
                              style="SurfaceDim.TLabel").pack(side="right")
            else:
                for item in group.items:
                    render_news_card(section, item).pack(fill="x", pady=(0, 4))
                    b = story_breakdown(item)
                    detail = ttk.Frame(section, style="Surface.TFrame", padding=(10, 0, 0, 8))
                    detail.pack(fill="x")
                    for label, value, style in [
                        ("Why it matters", b.why, "SurfaceDim.TLabel"),
                        ("Could benefit", b.beneficiaries, "Pos.TLabel"),
                        ("Could be hurt", b.laggards, "Neg.TLabel"),
                    ]:
                        row = ttk.Frame(detail, style="Surface.TFrame")
                        row.pack(fill="x")
                        ttk.Label(row, text=f"{label}: ", style="SurfaceDim.TLabel").pack(side="left")
                        ttk.Label(row, text=value, style=style, wraplength=CARD_WRAP).pack(side="left")

    def _render_calendar(self):
        frame = self.tabs["calendar"]
        frame.clear()
        snapshot = self.state.news
        if not snapshot:
            self._empty(frame.body, "Not loaded yet.")
            return
        for title, result in [("Today", snapshot.calendar_today), ("Tomorrow", snapshot.calendar_tomorrow), ("This Week", snapshot.calendar_week)]:
            section = self._section(frame.body, title)
            if not result.live:
                note = (f"Live calendar unavailable ({result.error}) - showing an estimated schedule."
                        if result.error else
                        "No calendar API key configured - showing an estimated recurring-release schedule. "
                        "FOMC dates, Fed speakers, and Treasury auctions only appear with a live source.")
                ttk.Label(section, text=note, style="SurfaceDim.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w", pady=(0, 8))
            if not result.events:
                self._empty(section, "No events.")
                continue
            for e in result.events:
                row = ttk.Frame(section, style="Surface.TFrame")
                row.pack(fill="x", pady=3)
                when = e.time[:16].replace("T", " ")
                ttk.Label(row, text=when, style="SurfaceDim.TLabel", font=theme.FONT_MONO, width=18).pack(side="left")
                tag = " (estimated)" if e.estimated else ""
                detail = f"{'*' * e.importance} {e.event}{tag}"
                if e.forecast or e.previous or e.actual:
                    bits = []
                    if e.forecast:
                        bits.append(f"forecast {e.forecast}")
                    if e.previous:
                        bits.append(f"previous {e.previous}")
                    if e.actual:
                        bits.append(f"actual {e.actual}")
                    detail += " (" + ", ".join(bits) + ")"
                ttk.Label(row, text=detail, style=theme.impact_style(e.impact), wraplength=520, justify="left").pack(side="left")

    def _render_company(self):
        frame = self.tabs["company"]
        frame.clear()

        section = self._section(frame.body, "Watchlist")
        add_row = ttk.Frame(section, style="Surface.TFrame")
        add_row.pack(fill="x", pady=(0, 8))
        ttk.Entry(add_row, textvariable=self._watchlist_entry_var, width=16).pack(side="left")
        ttk.Button(add_row, text="Add", command=self._add_watchlist_ticker).pack(side="left", padx=(6, 0))

        tags_row = ttk.Frame(section, style="Surface.TFrame")
        tags_row.pack(fill="x")
        for t in self.state.watchlist:
            chip = ttk.Frame(tags_row, style="Surface.TFrame")
            chip.pack(side="left", padx=(0, 8))
            ttk.Label(chip, text=t, style="Surface.TLabel").pack(side="left")
            ttk.Button(chip, text="x", width=2, command=lambda t=t: self._remove_watchlist_ticker(t)).pack(side="left")

        snapshot = self.state.news
        for ticker in self.state.watchlist:
            company_section = self._section(frame.body, ticker)
            items = snapshot.company_items(ticker) if snapshot else []
            if not items:
                self._empty(company_section, "No recent news or filings.")
            else:
                for item in items:
                    render_news_card(company_section, item).pack(fill="x", pady=(0, 6))

    def _add_watchlist_ticker(self):
        ticker = self._watchlist_entry_var.get().strip().upper()
        if not ticker:
            return
        if ticker not in self.state.watchlist:
            self.state.set_watchlist([*self.state.watchlist, ticker])
        self._watchlist_entry_var.set("")
        self.trigger_refresh()

    def _remove_watchlist_ticker(self, ticker):
        self.state.set_watchlist([t for t in self.state.watchlist if t != ticker])

    def _render_brief(self):
        frame = self.tabs["brief"]
        frame.clear()
        section = self._section(frame.body, "Market Brief")
        seg = ttk.Frame(section, style="Surface.TFrame")
        seg.pack(fill="x", pady=(0, 10))
        for label, value in [("Morning Brief", "morning"), ("Midday Update", "midday"), ("Closing Summary", "closing")]:
            ttk.Radiobutton(seg, text=label, variable=self._brief_kind, value=value,
                            command=self._render_brief).pack(side="left", padx=(0, 10))

        snapshot = self.state.news
        if not snapshot:
            self._empty(section, "Not loaded yet.")
            return
        text = generate_brief(self._brief_kind.get(), snapshot.todays_items, snapshot.daily_score)
        ttk.Label(section, text=text, style="Surface.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w")

    def _render_impact(self):
        frame = self.tabs["impact"]
        frame.clear()
        snapshot = self.state.news
        if not snapshot or not snapshot.todays_items:
            self._empty(frame.body, "No high-importance stories to assess yet.")
            return
        for ti in top_trade_impacts(snapshot.todays_items, 10):
            section = self._section(frame.body, ti.item.headline[:80])
            ttk.Label(section, text=f"{ti.sentiment} - {ti.confidence}% confidence", style=theme.sentiment_style(ti.sentiment)).pack(anchor="w")
            ttk.Label(section, text=f"Affected sectors: {', '.join(ti.affected_sectors)}", style="SurfaceDim.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w", pady=(4, 0))
            ttk.Label(section, text=f"Potential volatility: {ti.volatility}", style=theme.impact_style(ti.volatility)).pack(anchor="w")
            for idea in ti.opportunities:
                ttk.Label(section, text=f"- {idea}", style="SurfaceDim.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w", pady=(2, 0))

    def _render_alerts(self):
        frame = self.tabs["alerts"]
        frame.clear()
        snapshot = self.state.news
        alerts = snapshot.alerts if snapshot else []
        if not alerts:
            self._empty(frame.body, "No alerts yet - breaking news, watchlist hits, and economic releases show up here.")
            return
        for a in alerts:
            row = self._section(frame.body, a.kind.capitalize())
            ttk.Label(row, text=a.message, style="Surface.TLabel", wraplength=CARD_WRAP, justify="left").pack(anchor="w")

    def _render_score(self):
        frame = self.tabs["score"]
        frame.clear()
        snapshot = self.state.news
        if not snapshot:
            self._empty(frame.body, "Not loaded yet.")
            return
        score = snapshot.daily_score
        section = self._section(frame.body, "Daily News Score")
        style = "Pos.TLabel" if score.score >= 60 else "Neg.TLabel" if score.score <= 40 else "Warn.TLabel"
        ttk.Label(section, text=f"{score.score}/100", style=style, font=theme.FONT_TITLE).pack(anchor="w")
        ttk.Label(section, text=score.label, style="SurfaceDim.TLabel").pack(anchor="w")

        factors_section = self._section(frame.body, "Factors")
        for f in score.factors:
            row = ttk.Frame(factors_section, style="Surface.TFrame")
            row.pack(fill="x", pady=2)
            ttk.Label(row, text=f.label, style="SurfaceDim.TLabel").pack(side="left")
            ttk.Label(row, text=f.value, style="Surface.TLabel").pack(side="right")
