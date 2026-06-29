-- Market config: a single remotely-tunable row that re-centers the fair-market
-- formula's national baseline WITHOUT shipping an app release (refinement #3a).
--
-- When the freight market swings, edit `baseline_dry_van` from the Supabase
-- dashboard (check a free van-rate tracker — Scale Funding / ACT Research) and
-- every app re-centers within a day. Clients read only; writes happen via the
-- dashboard / service role. Seeded at 2.50 = the bundled default, so applying
-- this migration changes NOTHING until you deliberately tune the value.

CREATE TABLE IF NOT EXISTS public.market_config (
  id               INTEGER      PRIMARY KEY DEFAULT 1,
  baseline_dry_van NUMERIC(4,2) NOT NULL,
  note             TEXT         NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Singleton: only ever one row.
  CONSTRAINT market_config_singleton CHECK (id = 1),
  -- Sanity envelope: a fat-fingered value can never nuke every estimate.
  CONSTRAINT market_config_baseline_sane CHECK (baseline_dry_van >= 1.50 AND baseline_dry_van <= 4.00)
);

-- Seed the single row with the current bundled default (no behavior change).
INSERT INTO public.market_config (id, baseline_dry_van, note)
  VALUES (1, 2.50, 'Bundled default — tune from dashboard as the market moves')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.market_config ENABLE ROW LEVEL SECURITY;

-- Everyone reads (the formula runs in guest mode too). No write policy exists,
-- so only the service role / dashboard can change the value.
DROP POLICY IF EXISTS "public_select" ON public.market_config;
CREATE POLICY "public_select" ON public.market_config
  FOR SELECT TO anon, authenticated USING (true);
