-- Migration: 2026-06-30_core_tables_rls.sql
-- SECURITY HARDENING — provably enforce Row Level Security on the core tables.
--
-- WHY THIS EXISTS:
-- loads, state_mileage, and fuel_entries were created in the ORIGINAL base schema
-- (which is not in this repo — the other migrations only ADD COLUMNS to them), so
-- their RLS status cannot be verified from code. This matters enormously because
-- the app authenticates every client with the PUBLIC anon key, which ships inside
-- every app binary and can be trivially extracted. Row Level Security is therefore
-- the ONLY thing stopping one signed-in user from reading or modifying ANOTHER
-- user's loads, routes, and fuel data.
--
-- This migration makes RLS + strict per-owner policies provably enabled regardless
-- of what the base schema did. It is purely additive and owner-scoped:
--   • Enabling RLS that is already on is a no-op.
--   • Adding an owner-scoped policy can never WIDEN access — if a correct policy
--     already exists this is redundant; if none existed it closes the hole.
--
-- Idempotent — safe to run more than once.
--
-- ⚠️ AFTER RUNNING: in the Supabase dashboard (Authentication → Policies) confirm
-- loads / state_mileage / fuel_entries show "RLS enabled" and only the owner
-- policies below (plus any pre-existing owner policies). If you find any policy
-- using `true` / `USING (true)` for these tables, DELETE it — that is an open door.

-- ── loads (owner = user_id) ─────────────────────────────────────────────────
alter table public.loads enable row level security;

do $$ begin
  create policy "loads_owner_all" on public.loads
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ── fuel_entries (owner = user_id) ──────────────────────────────────────────
alter table public.fuel_entries enable row level security;

do $$ begin
  create policy "fuel_entries_owner_all" on public.fuel_entries
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ── state_mileage (owner via parent load — table has load_id, not user_id) ──
alter table public.state_mileage enable row level security;

do $$ begin
  create policy "state_mileage_owner_all" on public.state_mileage
    for all to authenticated
    using (exists (
      select 1 from public.loads l
      where l.id = state_mileage.load_id and l.user_id = auth.uid()
    ))
    with check (exists (
      select 1 from public.loads l
      where l.id = state_mileage.load_id and l.user_id = auth.uid()
    ));
exception when duplicate_object then null;
end $$;
