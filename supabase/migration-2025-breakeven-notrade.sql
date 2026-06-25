-- ============================================================================
-- Migration: rename "scratch" -> "breakeven" and allow "no_trade" results.
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor if you created your database with
-- the original schema (which only allowed win/loss/scratch). Safe to re-run.
-- Not needed for fresh databases created from the current schema.sql.
-- ============================================================================

-- 1. Drop the old result check constraint (auto-named trades_result_check).
alter table public.trades drop constraint if exists trades_result_check;

-- 2. Convert any existing "scratch" rows to "breakeven".
update public.trades set result = 'breakeven' where result = 'scratch';

-- 3. Re-add the constraint with the new allowed set.
alter table public.trades
  add constraint trades_result_check
  check (result in ('win', 'loss', 'breakeven', 'no_trade'));
