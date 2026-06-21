-- TruckerNet — Migration: loads + state_mileage sync (Phase 1)
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
--
-- Adds the columns that were added locally after the initial schema was written.
-- The state_mileage table already exists in the remote schema with the right
-- structure, so only loads needs updating.
-- Idempotent: safe to run more than once.

-- ── Missing columns on public.loads ──

alter table public.loads
  add column if not exists pickup_address text not null default '';

alter table public.loads
  add column if not exists delivery_address text not null default '';

alter table public.loads
  add column if not exists is_backhaul boolean not null default false;

alter table public.loads
  add column if not exists status text not null default 'completed';

alter table public.loads
  add column if not exists benchmark_fair_pay_min numeric;

alter table public.loads
  add column if not exists benchmark_fair_pay_max numeric;
