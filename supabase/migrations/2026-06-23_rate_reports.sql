-- Rate reports: anonymous crowdsourced lane rates.
-- No user_id — contributions are fully anonymous.
-- Indexed for fast lane lookups (origin + destination + type + band).

CREATE TABLE IF NOT EXISTS public.rate_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_state      TEXT        NOT NULL,
  destination_state TEXT        NOT NULL,
  load_type         TEXT        NOT NULL,
  distance_band     TEXT        NOT NULL,
  total_pay         NUMERIC(10, 2) NOT NULL,
  pay_per_mile      NUMERIC(8,  3) NOT NULL,
  miles             INTEGER     NOT NULL,
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_reports_lane_idx
  ON public.rate_reports (origin_state, destination_state, load_type, distance_band, reported_at DESC);

ALTER TABLE public.rate_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can contribute
DROP POLICY IF EXISTS "auth_insert" ON public.rate_reports;
CREATE POLICY "auth_insert" ON public.rate_reports
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can read (for aggregate queries)
DROP POLICY IF EXISTS "auth_select" ON public.rate_reports;
CREATE POLICY "auth_select" ON public.rate_reports
  FOR SELECT TO authenticated USING (true);
