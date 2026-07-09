-- Migration: 2026-07-09_loads_rate_contributed.sql
--
-- Syncs the `rate_contributed` idempotency marker (previously device-local
-- only — see 2026-06-26_sync_schema_parity.sql's note, which this corrects).
--
-- Real bug this closes: rate_contributed is the flag that stops a load's
-- data from being submitted to the anonymous crowdsourced rate pool twice.
-- Being local-only meant ANY local-DB wipe + cloud-restore cycle (sign out
-- then back in, a cross-account claim on a shared device, a reinstall — all
-- routine, not edge cases) reset it to false even for loads that had already
-- been contributed. The next time anything re-touched that load, it would
-- silently submit a duplicate entry to the rate pool, quietly degrading the
-- Fair Market feature's data quality over time.
--
-- Idempotent — safe to re-run.

alter table public.loads add column if not exists rate_contributed boolean not null default false;
