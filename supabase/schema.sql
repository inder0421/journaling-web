-- ============================================================================
-- Discipline Journal — Supabase schema (NO-LOGIN / shared single-tenant)
-- ----------------------------------------------------------------------------
-- This app has no sign-in. Every row shares one fixed owner id and the tables
-- are openly readable/writable with the anon key. NOTE: anyone who has your
-- project URL + anon key (which ships in the browser bundle) can read and write
-- this data. That's the trade-off for skipping login — fine for a private
-- personal tool on an obscure URL; don't store anything sensitive.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- trades -----
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default '00000000-0000-0000-0000-000000000000',
  created_at   timestamptz not null default now(),
  setup_met    boolean not null,
  entry_reason text not null default '',
  result       text not null check (result in ('win', 'loss', 'breakeven', 'no_trade')),
  amount       numeric not null default 0 check (amount >= 0),
  instrument   text not null default ''
);
create index if not exists trades_created_idx on public.trades (created_at desc);

alter table public.trades enable row level security;
drop policy if exists "trades_public_all" on public.trades;
create policy "trades_public_all" on public.trades for all using (true) with check (true);

-- ----------------------------------------------------------------- rules -----
create table if not exists public.rules (
  user_id            uuid primary key default '00000000-0000-0000-0000-000000000000',
  daily_stop_loss    numeric not null default 500,
  max_trades_per_day integer not null default 2,
  starting_balance   numeric not null default 50000,
  max_drawdown_floor numeric not null default 48000,
  updated_at         timestamptz not null default now()
);

alter table public.rules enable row level security;
drop policy if exists "rules_public_all" on public.rules;
create policy "rules_public_all" on public.rules for all using (true) with check (true);

-- --------------------------------------------------------- copy_accounts -----
create table if not exists public.copy_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default '00000000-0000-0000-0000-000000000000',
  created_at    timestamptz not null default now(),
  firm          text not null default '',
  label         text not null default '',
  size          numeric not null default 0,
  multiplier    numeric not null default 1,
  max_contracts integer not null default 0,
  is_lead       boolean not null default false,
  active        boolean not null default true
);
create index if not exists copy_accounts_created_idx on public.copy_accounts (created_at);

alter table public.copy_accounts enable row level security;
drop policy if exists "copy_accounts_public_all" on public.copy_accounts;
create policy "copy_accounts_public_all" on public.copy_accounts for all using (true) with check (true);

-- ----------------------------------------- realtime (instant cross-device) ---
do $$ begin alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rules;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.copy_accounts;
exception when duplicate_object then null; end $$;
