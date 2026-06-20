-- Migration: 2026-06-19_user_expenses_sync.sql
-- Adds user_expenses table (for cloud sync) and weekly_miles column to profiles.
-- Idempotent — safe to re-run.

-- ──────────────────────────────────────────
-- 1. Add weekly_miles to profiles
-- ──────────────────────────────────────────
alter table public.profiles
  add column if not exists weekly_miles numeric not null default 0;

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
