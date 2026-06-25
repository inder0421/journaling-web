-- ============================================================================
-- Migration: add the copy_accounts table for the multi-account Copy tab.
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor on an existing database. Safe to
-- re-run. Not needed for fresh databases created from the current schema.sql.
-- ============================================================================

create table if not exists public.copy_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  firm          text not null default '',
  label         text not null default '',
  size          numeric not null default 0,
  multiplier    numeric not null default 1,
  max_contracts integer not null default 0,
  is_lead       boolean not null default false,
  active        boolean not null default true
);

create index if not exists copy_accounts_user_idx
  on public.copy_accounts (user_id, created_at);

alter table public.copy_accounts enable row level security;

drop policy if exists "copy_accounts_select_own" on public.copy_accounts;
drop policy if exists "copy_accounts_insert_own" on public.copy_accounts;
drop policy if exists "copy_accounts_update_own" on public.copy_accounts;
drop policy if exists "copy_accounts_delete_own" on public.copy_accounts;

create policy "copy_accounts_select_own" on public.copy_accounts
  for select using (auth.uid() = user_id);
create policy "copy_accounts_insert_own" on public.copy_accounts
  for insert with check (auth.uid() = user_id);
create policy "copy_accounts_update_own" on public.copy_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "copy_accounts_delete_own" on public.copy_accounts
  for delete using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.copy_accounts;
exception when duplicate_object then null;
end $$;
