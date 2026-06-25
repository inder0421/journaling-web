-- Trading Discipline Journal — database schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- It is safe to re-run (idempotent).

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- rules: one row per user, holds their configurable risk limits.
-- ----------------------------------------------------------------------------
create table if not exists public.rules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  daily_stop_loss    numeric  not null default 500,
  max_trades_per_day integer  not null default 2,
  starting_balance   numeric  not null default 50000,
  max_drawdown_floor numeric  not null default 48000,
  updated_at         timestamptz not null default now(),
  unique (user_id)
);

-- ----------------------------------------------------------------------------
-- trades: one row per logged trade.
-- ----------------------------------------------------------------------------
create table if not exists public.trades (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  setup_criteria_met boolean not null,
  entry_reason       text    not null default '',
  result             text    not null check (result in ('win', 'loss', 'scratch')),
  amount             numeric not null default 0,
  pnl                numeric not null default 0,
  instrument         text    not null default '',
  traded_at          timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists trades_user_traded_at_idx
  on public.trades (user_id, traded_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security: each user can only see and modify their own rows.
-- ----------------------------------------------------------------------------
alter table public.rules  enable row level security;
alter table public.trades enable row level security;

drop policy if exists rules_select_own on public.rules;
drop policy if exists rules_insert_own on public.rules;
drop policy if exists rules_update_own on public.rules;
drop policy if exists rules_delete_own on public.rules;

create policy rules_select_own on public.rules
  for select using (auth.uid() = user_id);
create policy rules_insert_own on public.rules
  for insert with check (auth.uid() = user_id);
create policy rules_update_own on public.rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy rules_delete_own on public.rules
  for delete using (auth.uid() = user_id);

drop policy if exists trades_select_own on public.trades;
drop policy if exists trades_insert_own on public.trades;
drop policy if exists trades_update_own on public.trades;
drop policy if exists trades_delete_own on public.trades;

create policy trades_select_own on public.trades
  for select using (auth.uid() = user_id);
create policy trades_insert_own on public.trades
  for insert with check (auth.uid() = user_id);
create policy trades_update_own on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trades_delete_own on public.trades
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime (optional): lets a second device update live. Safe to skip.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rules'
  ) then
    alter publication supabase_realtime add table public.rules;
  end if;
end $$;
