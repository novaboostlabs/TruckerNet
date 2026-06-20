-- Migration: 2026-06-19_fuel_entries_sync.sql
-- Adds mpg and odometer_reading columns to the existing fuel_entries table.
-- Idempotent — safe to re-run.

alter table public.fuel_entries
  add column if not exists mpg              numeric not null default 0,
  add column if not exists odometer_reading numeric not null default 0;
