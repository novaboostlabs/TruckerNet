-- Migration: 2026-10-07_loads_deadhead_miles.sql
--
-- Empty miles driven TO a load's pickup. total_miles stays the paid
-- pickup→delivery distance (what the broker's rate is quoted on); the app
-- charges fuel + fixed costs on total_miles + deadhead_miles, so a load that
-- needs a long empty run to reach no longer shows as profitable when it isn't.
--
-- The app syncs fine before this is applied (it retries without the column),
-- but deadhead miles won't back up or restore across devices until it is.
--
-- Idempotent — safe to re-run.

alter table public.loads add column if not exists deadhead_miles numeric not null default 0;
