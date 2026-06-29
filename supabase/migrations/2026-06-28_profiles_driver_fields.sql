-- Driver profile fields on the existing `profiles` table.
--
-- ProfileSetupScreen captures name / equipment / truck # / home base into local
-- SQLite during onboarding (which runs BEFORE auth). These columns let that data
-- follow the account to the cloud so a reinstall or new device restores it —
-- closing the "profile is local-only" gap. weekly_miles / weekly_fuel_cost already
-- live on this table (2026-06-19_user_expenses_sync.sql); these just add to it.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS truck_number   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base      TEXT;
