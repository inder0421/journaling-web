-- ============================================================================
-- Discipline Journal — Supabase schema
-- ----------------------------------------------------------------------------
-- Run this once in your Supabase project: SQL Editor → New query → paste →
-- Run. Safe to re-run (idempotent). Creates two owner-scoped tables with
-- Row Level Security so each signed-in user only ever sees their own data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- trades -----
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  setup_met    boolean not null,
  entry_reason text not null default '',
  result       text not null check (result in ('win', 'loss', 'scratch')),
  amount       numeric not null default 0 check (amount >= 0),
  instrument   text not null default ''
);

create index if not exists trades_user_created_idx
  on public.trades (user_id, created_at desc);

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_update_own" on public.trades;
drop policy if exists "trades_delete_own" on public.trades;

create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------- rules -----
-- One row per user (user_id is the primary key).
create table if not exists public.rules (
  user_id            uuid primary key default auth.uid()
                       references auth.users (id) on delete cascade,
  daily_stop_loss    numeric not null default 500,
  max_trades_per_day integer not null default 2,
  starting_balance   numeric not null default 50000,
  max_drawdown_floor numeric not null default 48000,
  updated_at         timestamptz not null default now()
);

alter table public.rules enable row level security;

drop policy if exists "rules_select_own" on public.rules;
drop policy if exists "rules_insert_own" on public.rules;
drop policy if exists "rules_update_own" on public.rules;

create policy "rules_select_own" on public.rules
  for select using (auth.uid() = user_id);
create policy "rules_insert_own" on public.rules
  for insert with check (auth.uid() = user_id);
create policy "rules_update_own" on public.rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------- realtime (instant cross-device) ---
-- Optional but recommended: lets the app receive live updates when you log a
-- trade on another device. Wrapped so re-running doesn't error.
do $$
begin
  alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rules;
exception when duplicate_object then null;
end $$;
