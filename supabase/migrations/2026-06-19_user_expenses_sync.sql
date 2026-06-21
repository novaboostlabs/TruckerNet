-- Migration: 2026-06-19_user_expenses_sync.sql
-- Creates profiles table + user_expenses table for cloud sync.
-- Idempotent — safe to re-run.

-- ──────────────────────────────────────────
-- 1. profiles table (per-user settings synced from the app)
-- ──────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  weekly_miles     numeric not null default 0,
  weekly_fuel_cost numeric not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy "Users can read and write own profile"
    on public.profiles for all
    using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- ──────────────────────────────────────────
-- 2. user_expenses table
--    Mirrors the local SQLite user_expenses table used by the
--    onboarding / expenses screen. Synced per-user, RLS-protected.
-- ──────────────────────────────────────────
create table if not exists public.user_expenses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  label               text not null,
  category            text not null default 'other',
  amount              numeric not null default 0,
  frequency           text not null default 'monthly'
                        check (frequency in (
                          'daily','weekly','biweekly','monthly',
                          'quarterly','semiannual','annual'
                        )),
  monthly_equivalent  numeric not null default 0,
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.user_expenses enable row level security;

do $$ begin
  create policy "Users can CRUD own expenses"
    on public.user_expenses for all
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
