# Trading Discipline Journal

A discipline-first trade journal for funded futures traders. It is **not** a generic
trade tracker. Its single job is to make breaking your own risk rules *harder*, and to
make the gap between **on-setup** trades and **impulse** trades impossible to ignore.

Built for the documented failure mode: overriding a `max 2 trades/day` / `-$500 stop`
plan and taking impulse entries with no setup criteria.

![Dark, clinical, mobile-first](https://img.shields.io/badge/theme-dark%20%C2%B7%20clinical-1b1e22)

---

## What it does

- **Trade logging** — setup-criteria toggle (Yes/No, *required, no default*), entry
  reason, result (win/loss/scratch), dollar amount, instrument (ES/NQ/MES/MNQ/custom),
  and timestamp (defaults to now, auto-saved).
- **Live daily P&L** — recalculates as you log.
- **Configurable rules** — daily stop loss, max trades/day, account starting balance,
  and max drawdown floor.
- **Hard lockout** — once the daily stop is hit **or** the trade limit is reached
  (**or** the drawdown floor is breached), the logging form is *actually disabled*
  (every input + the submit button), behind a clear red banner. There is no override
  button — the lockout resets at local midnight.
- **Analytics that matter here**:
  - **On-criteria win rate & net P&L vs. impulse** win rate & net P&L, all-time, shown
    side by side.
  - **Running account cushion** in real dollars: `current balance − drawdown floor`,
    with the full breakdown (starting balance, net P&L, cumulative wins/losses).
  - **Day-by-day / week-by-week history**, with rule-break flags (stop hit, over limit,
    impulse trades) and per-trade detail.
- **Real cross-device sync** via Supabase (Postgres + Auth + Row Level Security), with a
  **local-only fallback** when sync isn't configured.
- **Mobile-first, dark, clinical** — flat colors, no gradients, no streaks/confetti.
  Designed to be glanced at on a phone before and during a session.

---

## Quick start (local-only mode)

No backend required to try it — data is stored in the browser.

```bash
npm install
npm run dev
```

Open the printed URL. The header will show **“Local only.”** Everything works; data just
stays in this browser and doesn't sync.

```bash
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build locally
npm test           # run the unit tests for the P&L / cushion / lockout logic
```

---

## Enabling cross-device sync (the default working path)

Sync is the intended way to run this — log on your phone before the session, review on
desktop after. It uses [Supabase](https://supabase.com) (free tier is plenty).

1. **Create a project** at <https://supabase.com> → *New project*.
2. **Create the schema.** In the dashboard: *SQL Editor → New query*, paste the contents
   of [`supabase/schema.sql`](./supabase/schema.sql), and **Run**. This creates the
   `rules` and `trades` tables, enables Row Level Security (each user only ever sees their
   own rows), and turns on realtime. It's safe to re-run.
3. *(Recommended for a single user)* **Turn off email confirmation** so sign-up is
   instant: *Authentication → Providers → Email →* disable **“Confirm email.”** (Leave it
   on if you prefer email verification.)
4. **Grab your keys.** *Project Settings → API*:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` / `public` key → `VITE_SUPABASE_ANON_KEY`
   (The anon key is safe in a browser bundle — RLS is what protects the data.)
5. **Add a `.env.local`** (copy from [`.env.example`](./.env.example)):

   ```bash
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

6. `npm run dev` (or redeploy). The header now shows **“Synced.”** Create an account, and
   sign in with the **same email/password on every device**.

> Already logged trades in local mode? After signing in, open **Rules → Sync & account →
> “Upload local trades to cloud.”**

---

## Deploy

It's a static SPA — host the `dist/` folder anywhere.

**Vercel** (config included in [`vercel.json`](./vercel.json)):

1. Import the repo at <https://vercel.com/new> (framework auto-detects as Vite).
2. Add the two `VITE_SUPABASE_*` env vars in *Project Settings → Environment Variables*.
3. Deploy. (Or `npx vercel --prod` from the project root.)

**Netlify / Cloudflare Pages / GitHub Pages**: build command `npm run build`, publish
directory `dist`. SPA fallback for Netlify is included via [`public/_redirects`](./public/_redirects).
Set the same two env vars in the host's dashboard.

---

## How the numbers work

All money logic lives in one pure, unit-tested module:
[`src/lib/calculations.ts`](./src/lib/calculations.ts).

- **Signed P&L** — you enter a positive dollar amount; `win → +amount`, `loss → −amount`,
  `scratch → 0`.
- **“Today”** is your local calendar day; daily stop and trade count reset at local
  midnight.
- **Cushion remaining** = `starting_balance + net P&L − max_drawdown_floor`
  (equivalently, `current balance − floor`). This is your real room to the account-blowing
  level, crediting wins and debiting losses. `max_drawdown_floor` is the **balance you
  must not fall below**, e.g. a $50,000 account with a $2,000 max drawdown → floor
  `48,000`.
- **Lockout** triggers when *any* of: today's P&L `≤ −daily_stop_loss`, today's trade
  count `≥ max_trades_per_day`, or cushion `≤ 0`.
- **Win rate** = `wins / (wins + losses)` (scratches excluded), computed separately for
  on-criteria and impulse trades.

> Note: this models a **static** drawdown floor. If your prop firm uses a *trailing*
> drawdown, set the floor to your current trailing level and update it as it ratchets.

---

## Tech & key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | **Vite + React + TypeScript** | Static SPA, fast, low-maintenance. No SSR needed — sync is client→Supabase. |
| Backend / sync | **Supabase** (Postgres, Auth, RLS, Realtime) | Simplest reliable managed backend with real auth + per-user isolation; generous free tier. |
| Auth | **Email + password** | Same credentials on every device → trivial cross-device sync. RLS scopes data per user. |
| Styling | **Hand-written CSS + variables** | Full control over a calm, flat, dark, dependency-free theme. |
| Fallback | **localStorage** | App is usable instantly with zero setup; cloud is the default once configured. |
| State | React Context + hooks | One small app; no need for a state library. |

**Why a hard lockout instead of a warning:** the documented problem is *overriding* rules,
so a dismissible warning would just be one more thing to override. The form is genuinely
disabled and there is intentionally no one-click bypass — the friction *is* the feature.

---

## Project structure

```
src/
  lib/
    calculations.ts        # pure domain logic (P&L, cushion, lockout, analytics)
    calculations.test.ts   # unit tests for the above
    storage.ts             # Store interface + local & Supabase implementations
    supabase.ts            # client (null in local-only mode)
    types.ts, format.ts
  context/AppData.tsx       # auth + data provider; picks cloud vs local store
  components/               # Header, Auth, TodayTab, StatusBar, LockoutBanner,
                            # TradeForm, AnalyticsTab, HistoryTab, RulesTab
  App.tsx, main.tsx, index.css
supabase/schema.sql         # tables + RLS + realtime (run once)
```

---

## Disclaimer

A personal discipline tool, not financial advice. It records what you tell it; the only
thing it enforces is the limits you set.
