-- Income goal + tax rate on the profile row.
--
-- Bug: sign-out wipes these from local SQLite (clearAllUserData) but they were
-- never part of profileSync — so every sign-out permanently lost the driver's
-- income goal and tax-rate choice. profileSync now pushes/pulls these columns.
--
-- Stored as text to mirror the local key-value settings store (the app parses
-- them with parseFloat / a period union on read).
--
-- Idempotent — safe to run more than once.

alter table public.profiles add column if not exists income_goal_amount text;
alter table public.profiles add column if not exists income_goal_period text;
alter table public.profiles add column if not exists tax_rate           text;
