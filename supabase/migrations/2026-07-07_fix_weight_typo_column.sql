-- Migration: 2026-07-07_fix_weight_typo_column.sql
--
-- The live `loads` table was originally created by hand (pre-dates the
-- migration files in this repo), and picked up a typo'd column somewhere in
-- that process: "weight_Ibs" (capital I) instead of "weight_lbs" (lowercase
-- L) — extremely easy to miss since the two look nearly identical in most
-- fonts. That stray column was left NOT NULL with no default, so it silently
-- blocked EVERY load insert from the app (which only ever knows about the
-- correctly-spelled weight_lbs, added in 2026-06-26_sync_schema_parity.sql).
--
-- This just relaxes the constraint rather than dropping the column outright —
-- non-destructive, reversible, and immediately unblocks syncing. The column
-- can be dropped later once it's confirmed nothing else references it.
--
-- Idempotent — safe to re-run.

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loads' and column_name = 'weight_Ibs'
  ) then
    execute 'alter table public.loads alter column "weight_Ibs" drop not null';
  end if;
end $$;
