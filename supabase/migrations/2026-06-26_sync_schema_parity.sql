-- TruckerNet — Sync schema parity (safety net).
--
-- The prior sync migrations were incremental ADDs against a base schema created
-- elsewhere, so it was never provable from the repo alone that the remote tables
-- contain EVERY column the app pushes. A missing column makes the upsert error,
-- and every sync caller is fire-and-forget — so it would fail silently and a
-- driver's loads/fuel could quietly never reach the cloud.
--
-- This migration guarantees the remote schema is a superset of what the client
-- writes. Every statement is `ADD COLUMN IF NOT EXISTS` — purely additive and
-- idempotent; it never alters or drops an existing column (so it can't change a
-- type or break existing rows). Run it once; safe to re-run.
--
-- Column lists mirror the push payloads in:
--   src/lib/sync/loadsSync.ts, src/lib/sync/fuelSync.ts
-- Nullability mirrors the payload: fields the client may send as null are left
-- nullable; always-present fields get NOT NULL DEFAULTs (safe for new columns).
--
-- NOTE: the local-only `rate_contributed` flag is intentionally NOT synced — it
-- is a device-local idempotency marker for community-rate contribution.

-- ── public.loads ──────────────────────────────────────────────────────────────
alter table public.loads add column if not exists date                   date    not null default current_date;
alter table public.loads add column if not exists pickup_address          text    not null default '';
alter table public.loads add column if not exists pickup_city             text    not null default '';
alter table public.loads add column if not exists pickup_state            text    not null default '';
alter table public.loads add column if not exists delivery_address        text    not null default '';
alter table public.loads add column if not exists delivery_city           text    not null default '';
alter table public.loads add column if not exists delivery_state          text    not null default '';
alter table public.loads add column if not exists equipment_type          text    not null default 'dry_van';
alter table public.loads add column if not exists total_miles             numeric not null default 0;
alter table public.loads add column if not exists gross_pay               numeric not null default 0;
alter table public.loads add column if not exists additional_costs        numeric not null default 0;
alter table public.loads add column if not exists weight_lbs              numeric;
alter table public.loads add column if not exists bol_number              text    not null default '';
alter table public.loads add column if not exists bol_photo_url           text;
alter table public.loads add column if not exists broker_name             text    not null default '';
alter table public.loads add column if not exists broker_mc               text    not null default '';
alter table public.loads add column if not exists is_deadhead             boolean not null default false;
alter table public.loads add column if not exists is_backhaul             boolean not null default false;
alter table public.loads add column if not exists status                  text    not null default 'completed';
alter table public.loads add column if not exists notes                   text    not null default '';
alter table public.loads add column if not exists benchmark_fair_pay_min  numeric;
alter table public.loads add column if not exists benchmark_fair_pay_max  numeric;
alter table public.loads add column if not exists fuel_cost_for_load      numeric not null default 0;
alter table public.loads add column if not exists fixed_cost_for_load     numeric not null default 0;
alter table public.loads add column if not exists net_pay                 numeric not null default 0;
alter table public.loads add column if not exists gross_rate_per_mile     numeric not null default 0;
alter table public.loads add column if not exists net_rate_per_mile       numeric not null default 0;
alter table public.loads add column if not exists verdict                 text;

-- ── public.state_mileage ──────────────────────────────────────────────────────
alter table public.state_mileage add column if not exists state              text    not null default '';
alter table public.state_mileage add column if not exists miles              numeric not null default 0;
alter table public.state_mileage add column if not exists is_manually_edited boolean not null default false;

-- ── public.load_expenses ──────────────────────────────────────────────────────
alter table public.load_expenses add column if not exists label      text    not null default '';
alter table public.load_expenses add column if not exists category   text    not null default 'other';
alter table public.load_expenses add column if not exists amount     numeric not null default 0;
alter table public.load_expenses add column if not exists date       date    not null default current_date;
alter table public.load_expenses add column if not exists created_at timestamptz not null default now();

-- ── public.fuel_entries ───────────────────────────────────────────────────────
alter table public.fuel_entries add column if not exists dollars_spent    numeric not null default 0;
alter table public.fuel_entries add column if not exists gallons          numeric not null default 0;
alter table public.fuel_entries add column if not exists miles_driven     numeric not null default 0;
alter table public.fuel_entries add column if not exists cost_per_mile    numeric not null default 0;
alter table public.fuel_entries add column if not exists price_per_gallon numeric not null default 0;
alter table public.fuel_entries add column if not exists mpg              numeric not null default 0;
alter table public.fuel_entries add column if not exists odometer_reading numeric not null default 0;
alter table public.fuel_entries add column if not exists state_purchased  text    not null default '';
