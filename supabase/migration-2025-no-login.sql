-- ============================================================================
-- Migration: switch an existing database to NO-LOGIN shared access.
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor. Brings any earlier version of the DB up
-- to date for the no-sign-in app: ensures all tables exist, drops the auth
-- foreign keys, points existing rows at one shared owner, and opens the tables.
-- Safe to re-run.
--
-- Trade-off: anyone with your project URL + anon key can read/write this data.
-- ============================================================================

create extension if not exists pgcrypto;

-- Make sure copy_accounts exists (in case that migration was never run).
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

-- Ensure the result set allows breakeven / no_trade.
alter table public.trades drop constraint if exists trades_result_check;
update public.trades set result = 'breakeven' where result = 'scratch';
alter table public.trades
  add constraint trades_result_check
  check (result in ('win', 'loss', 'breakeven', 'no_trade'));

-- Drop foreign keys to auth.users (a fixed non-auth owner id is used now).
alter table public.trades        drop constraint if exists trades_user_id_fkey;
alter table public.rules         drop constraint if exists rules_user_id_fkey;
alter table public.copy_accounts drop constraint if exists copy_accounts_user_id_fkey;

-- Point existing rows at the shared owner id.
update public.trades        set user_id = '00000000-0000-0000-0000-000000000000';
update public.rules         set user_id = '00000000-0000-0000-0000-000000000000';
update public.copy_accounts set user_id = '00000000-0000-0000-0000-000000000000';

-- Default future rows to the shared owner id.
alter table public.trades        alter column user_id set default '00000000-0000-0000-0000-000000000000';
alter table public.rules         alter column user_id set default '00000000-0000-0000-0000-000000000000';
alter table public.copy_accounts alter column user_id set default '00000000-0000-0000-0000-000000000000';

-- Replace owner-only policies with open ones.
drop policy if exists "trades_select_own" on public.trades;
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_update_own" on public.trades;
drop policy if exists "trades_delete_own" on public.trades;
drop policy if exists "trades_public_all" on public.trades;
create policy "trades_public_all" on public.trades for all using (true) with check (true);

drop policy if exists "rules_select_own" on public.rules;
drop policy if exists "rules_insert_own" on public.rules;
drop policy if exists "rules_update_own" on public.rules;
drop policy if exists "rules_public_all" on public.rules;
create policy "rules_public_all" on public.rules for all using (true) with check (true);

drop policy if exists "copy_accounts_select_own" on public.copy_accounts;
drop policy if exists "copy_accounts_insert_own" on public.copy_accounts;
drop policy if exists "copy_accounts_update_own" on public.copy_accounts;
drop policy if exists "copy_accounts_delete_own" on public.copy_accounts;
drop policy if exists "copy_accounts_public_all" on public.copy_accounts;
create policy "copy_accounts_public_all" on public.copy_accounts for all using (true) with check (true);

-- Realtime (harmless if already added).
do $$ begin alter publication supabase_realtime add table public.copy_accounts;
exception when duplicate_object then null; end $$;
