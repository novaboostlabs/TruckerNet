-- TruckerNet — Supabase Postgres Schema
-- Run this in the Supabase SQL Editor (https://app.supabase.com)
-- Project: Settings > SQL Editor > New Query → paste → Run

-- ──────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ──────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  subscription_tier text not null default 'free',
  revenue_cat_customer_id text,
  crowdsourcing_opt_in boolean not null default false,
  truck_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────
-- TRUCKS
-- ──────────────────────────────────────────
create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nickname text not null default '',
  year int,
  make text not null default '',
  model text not null default '',
  vin text not null default '',
  dot_number text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.trucks enable row level security;
create policy "Users can CRUD own trucks" on public.trucks for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- FIXED EXPENSES
-- ──────────────────────────────────────────
create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  truck_id uuid references public.trucks(id) on delete set null,
  truck_payment numeric not null default 0,
  insurance numeric not null default 0,
  eld_payment numeric not null default 0,
  maintenance_monthly numeric not null default 0,
  parking_monthly numeric not null default 0,
  other_monthly numeric not null default 0,
  estimated_monthly_miles numeric not null default 0,
  fixed_cost_per_mile numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.fixed_expenses enable row level security;
create policy "Users can CRUD own fixed expenses" on public.fixed_expenses for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- FUEL ENTRIES
-- ──────────────────────────────────────────
create table public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  truck_id uuid references public.trucks(id) on delete set null,
  date timestamptz not null,
  dollars_spent numeric not null,
  gallons numeric not null,
  miles_driven numeric not null,
  cost_per_mile numeric not null,
  price_per_gallon numeric not null,
  state_purchased char(2) not null,
  created_at timestamptz not null default now()
);

alter table public.fuel_entries enable row level security;
create policy "Users can CRUD own fuel entries" on public.fuel_entries for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- LOADS
-- ──────────────────────────────────────────
create table public.loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  truck_id uuid references public.trucks(id) on delete set null,
  date timestamptz not null,
  pickup_city text not null default '',
  pickup_state char(2) not null default '',
  delivery_city text not null default '',
  delivery_state char(2) not null default '',
  equipment_type text not null default 'dry_van',
  total_miles numeric not null default 0,
  gross_pay numeric not null default 0,
  additional_costs numeric not null default 0,
  weight_lbs numeric,
  bol_number text not null default '',
  broker_name text not null default '',
  broker_mc text not null default '',
  is_deadhead boolean not null default false,
  notes text not null default '',
  benchmark_fair_pay numeric,
  fuel_cost_for_load numeric not null default 0,
  fixed_cost_for_load numeric not null default 0,
  net_pay numeric not null default 0,
  gross_rate_per_mile numeric not null default 0,
  net_rate_per_mile numeric not null default 0,
  verdict text check (verdict in ('green', 'amber', 'red')),
  created_at timestamptz not null default now()
);

alter table public.loads enable row level security;
create policy "Users can CRUD own loads" on public.loads for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- STATE MILEAGE (per load)
-- ──────────────────────────────────────────
create table public.state_mileage (
  id bigint generated always as identity primary key,
  load_id uuid references public.loads(id) on delete cascade not null,
  state char(2) not null,
  miles numeric not null,
  is_manually_edited boolean not null default false
);

alter table public.state_mileage enable row level security;
create policy "Users can CRUD own state mileage" on public.state_mileage for all
  using (exists (
    select 1 from public.loads
    where loads.id = state_mileage.load_id
      and loads.user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- INCOME GOALS
-- ──────────────────────────────────────────
create table public.income_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period text not null check (period in ('weekly', 'monthly')),
  target_net_pay numeric not null,
  created_at timestamptz not null default now()
);

alter table public.income_goals enable row level security;
create policy "Users can CRUD own income goals" on public.income_goals for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- MAINTENANCE ENTRIES (Pro tier)
-- ──────────────────────────────────────────
create table public.maintenance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  truck_id uuid references public.trucks(id) on delete set null,
  date timestamptz not null,
  service_type text not null,
  cost numeric not null default 0,
  odometer numeric,
  notes text not null default '',
  next_due_miles numeric,
  next_due_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.maintenance_entries enable row level security;
create policy "Users can CRUD own maintenance entries" on public.maintenance_entries for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- BROKER ENTRIES (Pro tier)
-- ──────────────────────────────────────────
create table public.broker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  broker_name text not null,
  mc_number text not null default '',
  payment_speed_rating int check (payment_speed_rating between 1 and 5),
  reliability_rating int check (reliability_rating between 1 and 5),
  notes text not null default '',
  last_used timestamptz,
  created_at timestamptz not null default now()
);

alter table public.broker_entries enable row level security;
create policy "Users can CRUD own broker entries" on public.broker_entries for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- BENCHMARK RATES (seeded, admin-managed)
-- ──────────────────────────────────────────
create table public.benchmark_rates (
  id uuid primary key default gen_random_uuid(),
  equipment_type text not null,
  origin_region text not null,
  destination_region text not null,
  rate_per_mile numeric not null,
  source text not null default 'seeded' check (source in ('seeded', 'crowdsourced')),
  data_point_count int not null default 1,
  last_updated timestamptz not null default now()
);

alter table public.benchmark_rates enable row level security;
create policy "Anyone can read benchmark rates" on public.benchmark_rates for select using (true);

-- ──────────────────────────────────────────
-- CROWDSOURCED RATE ENTRIES (opt-in, anonymous)
-- ──────────────────────────────────────────
create table public.crowdsourced_rate_entries (
  id uuid primary key default gen_random_uuid(),
  origin_state char(2) not null,
  destination_state char(2) not null,
  equipment_type text not null,
  total_miles numeric not null,
  gross_pay numeric not null,
  rate_per_mile numeric not null,
  weight_lbs numeric,
  week_of text not null,
  created_at timestamptz not null default now()
);

alter table public.crowdsourced_rate_entries enable row level security;
create policy "Authenticated users can insert crowdsourced entries"
  on public.crowdsourced_rate_entries for insert
  with check (auth.role() = 'authenticated');
