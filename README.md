# Discipline Journal

A trading discipline journal for a funded futures trader. It is **not** a
generic trade tracker. Its single job is to make breaking your own risk rules
*harder*, and to make the gap between **on-setup** trades and **impulse**
trades impossible to ignore.

If you have a documented pattern of overriding a max-trades rule or blowing
through your daily stop on impulse trades, this app puts a wall in front of
that behavior:

- **Hard lockout.** When you hit your daily stop **or** your max-trades count,
  the logging form physically disables itself. No "you sure?" you can click
  through — the inputs go dead until tomorrow.
- **Friction on impulse trades.** Every trade requires you to declare, up
  front and with no default, whether it met your setup criteria. Logging an
  off-setup trade forces an extra confirmation that shows you, in dollars,
  what impulse trades have already cost you.
- **The contrast, always visible.** On-setup vs. impulse win rate and net P&L
  sit side by side, all-time.
- **Real remaining room, in dollars.** A running account-cushion number so you
  always see how close you are to the drawdown floor — not just today's P&L.

The design is dark, flat, and clinical on purpose. No streaks, no confetti, no
gamification. It is meant to sit quietly next to your charts.

---

## Features

- **Trade logging** — setup-criteria toggle (required, no default), entry
  reason, result (win / loss / scratch), dollar amount, instrument
  (ES / NQ / MES / MNQ / custom), auto-timestamped.
- **Live daily P&L** that recomputes as you log.
- **Configurable risk rules** — daily stop loss, max trades/day, account
  starting balance, and max-drawdown floor.
- **Hard lockout** when the daily stop or max-trades limit is reached.
- **Analytics built for this problem** — on-criteria vs. off-criteria win rate
  and net P&L (all-time), running account cushion, and a day/week history.
- **Real cross-device sync** via Supabase, with an automatic local-only
  fallback so it runs the moment you clone it.
- **Mobile-first** — built to be used on a phone before and during sessions.

---

## How the discipline logic works

**Lockout.** The form disables when either is true today:

- today's **net P&L ≤ −(daily stop loss)**, or
- today's **trade count ≥ max trades per day**.

Both win and loss trades count toward the trade cap — an impulse trade that
happens to win still used up a slot. "Today" is your local calendar day and
rolls over at local midnight.

**Account cushion** (the headline safety number) is computed exactly as:

```
cushion = (starting balance − max drawdown floor) − cumulative losses
```

This is deliberately conservative. `starting balance − floor` is your total
drawdown allowance; it is then reduced by your **realized losses only**. Wins
do **not** replenish it, so the number never lets a good streak disguise how
much real room you've burned. At `$0`, the account is blown. Your live balance
(`starting + all-time net P&L`) is shown separately so you still see reality.

**On-setup vs. impulse.** Win rate is `wins / (wins + losses)` (scratches
excluded), reported separately for trades where setup criteria were met vs.
not. The impulse column is tinted and called out because that split is the
entire point of the app.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (dark-only, flat tokens)
- **Supabase** (Postgres + Auth + Row Level Security) for sync
- Zero-config **localStorage fallback** when Supabase isn't set

The whole UI is client-rendered and talks directly to Supabase; there is no
custom server to run or maintain.

---

## Run it locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

With no environment configured, the app runs in **local-only mode** — data is
stored in your browser (`localStorage`), single-device. The header shows a
"Local only" badge. This is fine for trying it out, but for real use you want
sync (below).

> **Note on the compiler.** `dev` and `build` use Next.js's stable **Webpack**
> compiler (`next dev --webpack`). Next 16's newer Turbopack engine can crash on
> some Windows machines where antivirus/security agents kill its helper process
> (`os error 10054`). Webpack avoids that entirely. If you want to try Turbopack,
> run `npm run dev:turbo`.

---

## Enable real cross-device sync (Supabase)

This is the default intended working path. It takes a few minutes, once.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is
   plenty).

2. **Create the tables.** In the dashboard go to **SQL Editor → New query**,
   paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run
   it. This creates the `trades` and `rules` tables with Row Level Security so
   each signed-in user only ever sees their own data. It's safe to re-run.

3. **Configure auth.** Email auth is on by default. The app signs in with a
   **6-digit email code** (passwordless), which works across devices.

   - Go to **Authentication → URL Configuration** and set **Site URL** to your
     app URL (`http://localhost:3000` for local; your deployed URL for prod),
     and add both to **Redirect URLs**.
   - To make the **6-digit code** appear in the email, go to **Authentication →
     Email Templates → Magic Link** and make sure the body includes the token,
     e.g.:

     ```html
     <h2>Your sign-in code</h2>
     <p>Enter this code in the app:</p>
     <p style="font-size:24px;letter-spacing:4px;"><b>{{ .Token }}</b></p>
     <p>Or open this link on the device you want to sign in:</p>
     <p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
     ```

     (If you skip this, the email will still contain a sign-in **link** you can
     tap on the same device — the app handles that automatically too.)

4. **Add your keys.** Copy `.env.local.example` to `.env.local` and fill in the
   two values from **Project Settings → API**:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

5. **Restart** `npm run dev`. The header should now read **"Synced"**. Sign in
   with your email on each device and your data follows you.

> The `anon` key is safe to expose in a browser app — Row Level Security (set
> up by `schema.sql`) is what actually protects the data, not the key.

---

## Deploy (Vercel)

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New → Project** and import the repo.
   Next.js is auto-detected; no build config needed.
3. Add the two environment variables from step 4 above in **Project Settings →
   Environment Variables** (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Then set that deployed URL as the **Site URL** / **Redirect URL** in
   Supabase (auth step 3 above).

Any static-friendly host (Netlify, Cloudflare Pages, etc.) works too — it's a
standard Next.js app.

---

## Configuration

Open the **gear icon** (top right) to edit your rules:

| Rule | Meaning |
| --- | --- |
| Daily stop loss | Lockout when today's net P&L is down this much. |
| Max trades per day | Lockout when you've logged this many trades today. |
| Account starting balance | Your funded account's starting balance. |
| Max drawdown floor | Lowest balance allowed before the account is blown. |

Defaults match the brief: **2 trades/day**, **−$500** daily stop,
**$50,000** start, **$48,000** floor (a $2,000 drawdown allowance).

---

## Project structure

```
src/
  app/
    layout.tsx        Root layout, dark theme, mobile viewport
    page.tsx          Auth gate → SignIn or Dashboard
    globals.css       Tailwind v4 + clinical dark theme tokens
  components/
    Dashboard.tsx     Orchestrates state, sync, and all sections
    TradeForm.tsx     Logging form; native-disabled lockout + impulse friction
    LockoutBanner.tsx The unmissable "locked for today" banner
    StatCards.tsx     Cushion, today's P&L, live balance
    Analytics.tsx     On-setup vs. impulse split
    History.tsx       Day / week history with per-trade detail
    RulesEditor.tsx   Risk-rule settings modal
    SignIn.tsx        Passwordless email sign-in
    Header.tsx        Title, sync status, settings, sign-out
  lib/
    calc.ts           Pure discipline math (lockout, cushion, analytics)
    store.ts          Data layer: Supabase or localStorage
    supabase.ts       Client + "is sync configured?" detection
    types.ts          Trade / Rules types and defaults
    format.ts         Money / percent / date formatting
    useSession.ts     Supabase auth session hook
supabase/
  schema.sql          Tables + RLS policies + realtime (idempotent)
```

---

## Key decisions & trade-offs

- **Lockout is a real `disabled` fieldset, not a banner you can ignore.** The
  brief was explicit that the override has to get *harder*, so there is no
  one-click bypass. (It's a personal tool; the lockout is client-side by
  design — the point is friction against your own impulse, not defeating a
  determined attacker.)
- **Cushion counts losses only.** Of the two reasonable readings of the
  formula, I chose the conservative one so wins can never mask burned drawdown
  room. Live balance is shown alongside it for the full picture.
- **Supabase over a custom backend.** It's the lowest-maintenance way to get
  real auth + a synced database with per-user isolation (RLS) and no server to
  run. The local fallback means the repo is useful the instant it's cloned.
- **Passwordless email codes** instead of passwords — one less thing to manage
  on a phone, and the code path syncs cleanly across devices.
- **Dark-only, no theme toggle, no animations beyond a cushion bar.** Matching
  the "calm and clinical, not gamified" requirement and avoiding fluff.
