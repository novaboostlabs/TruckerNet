-- Broker scorecard: anonymous crowdsourced broker intelligence.
-- No user_id — contributions are fully anonymous, same as rate_reports.
-- Each row is one completed load from one driver on one broker.
--
-- Key metric: pay_vs_market (gross_pay ÷ fair_market_mid).
--   > 1.0 → broker paid above market
--   = 1.0 → at market
--   < 1.0 → below market
--
-- null pay_vs_market: load had no fair-market benchmark (older load or short haul).
-- null verdict: load had no break-even set (driver hadn't completed onboarding).

CREATE TABLE IF NOT EXISTS public.broker_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Broker identifier: MC number preferred (globally unique); name-slug fallback.
  broker_key      TEXT        NOT NULL,        -- normalized: mc:{MC} or name:{slug}
  broker_name     TEXT        NOT NULL DEFAULT '',
  broker_mc       TEXT        NOT NULL DEFAULT '',
  -- Pay signal
  gross_pay       NUMERIC(10,2) NOT NULL,
  total_miles     INTEGER     NOT NULL,
  pay_vs_market   NUMERIC(5,3),               -- gross / fair_market_mid; null if no benchmark
  -- Verdict signal
  verdict         TEXT,                        -- 'green' | 'amber' | 'red' | null
  equipment_type  TEXT        NOT NULL DEFAULT 'dry_van',
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for broker lookups (the primary query pattern).
CREATE INDEX IF NOT EXISTS broker_reports_key_idx
  ON public.broker_reports (broker_key, reported_at DESC);

-- Index for global "top brokers" queries (future dashboard).
CREATE INDEX IF NOT EXISTS broker_reports_name_idx
  ON public.broker_reports (broker_name, reported_at DESC);

ALTER TABLE public.broker_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can contribute anonymously.
DROP POLICY IF EXISTS "broker_insert" ON public.broker_reports;
CREATE POLICY "broker_insert" ON public.broker_reports
  FOR INSERT TO authenticated WITH CHECK (true);

-- Anyone authenticated can read (for scorecard queries).
DROP POLICY IF EXISTS "broker_select" ON public.broker_reports;
CREATE POLICY "broker_select" ON public.broker_reports
  FOR SELECT TO authenticated USING (true);
