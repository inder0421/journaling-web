# Trading Discipline Journal — Desktop (Python)

A standalone Tkinter port of the web app in `../src`, plus the News
Intelligence Engine dashboard. Pure standard library — no `pip install`
required beyond a system Tk package on some Linux distros (see
`requirements.txt`).

## Run

```bash
python3 app.py
```

Data (trades, rules, watchlist) is stored locally in `~/.trading_journal/`
(override the location with the `TRADING_JOURNAL_HOME` env var). This is a
local-only app — there is no cloud sync here, unlike the web app's optional
Supabase mode.

## Tabs

- **Today** — status bar (P&L, trades today, cushion, balance), the lockout
  banner, and the trade entry form.
- **Analytics** — on-setup vs. impulse comparison, account cushion, overall
  stats.
- **History** — trades grouped by day/week in a tree view, with delete.
- **Rules** — edit the daily stop loss, max trades/day, starting balance,
  and drawdown floor.
- **News** — the News Intelligence Engine: Today's News (grouped into 20
  categories), This Week's News, Economic Calendar, Company News
  (watchlist-driven), AI Brief (morning/midday/closing), Trade Impact,
  Alerts, and a 0–100 Daily Score. See `news/` for the engine itself.

## Optional News API keys

All free-tier, all optional. Set as environment variables before running
(e.g. `export FINNHUB_API_KEY=...`) — leave any blank and that source is
skipped; the "Data sources" line at the top of the News tab always shows
live / not-configured / error status per integration, so nothing fails
silently.

| Env var                  | Source                      | Get a key                                                  |
|---------------------------|------------------------------|--------------------------------------------------------------|
| `FINNHUB_API_KEY`          | Finnhub market/company news   | https://finnhub.io/register                                  |
| `FMP_API_KEY`               | Financial Modeling Prep news + economic calendar (incl. FOMC) | https://site.financialmodelingprep.com/developer/docs |
| `ALPHA_VANTAGE_API_KEY`     | Alpha Vantage NEWS_SENTIMENT  | https://www.alphavantage.co/support/#api-key                  |

SEC EDGAR, the Federal Reserve, BLS, and BEA feeds need no key — and unlike
a browser, this desktop process has no CORS restrictions, so those feeds
are fetched directly (see `news/rss.py`, `news/edgar.py`).

## Tests

Standard-library `unittest`, no extra dependencies:

```bash
python3 -m unittest discover -s tests -v
```

## Layout

```
desktop/
  app.py             entry point — builds the Tk window and wires tabs
  state.py           observable app state (journal + news), the desktop
                     analogue of src/context/AppData.tsx
  journal/           trade journal core, ported from src/lib/*.ts
    models.py, calculations.py, storage.py, format.py
  news/              News Intelligence Engine, ported from src/lib/news/*.ts
    types.py, analysis.py, categorize.py, http.py, rss.py, edgar.py,
    sources.py, aggregator.py, calendar.py, weekly.py, score.py, brief.py,
    trade_impact.py, alerts.py, watchlist.py, service.py
  ui/                Tkinter widgets
    theme.py, widgets.py, today_tab.py, analytics_tab.py, history_tab.py,
    rules_tab.py, news_tab.py
  tests/             unittest tests mirroring src/lib/**/*.test.ts
```
