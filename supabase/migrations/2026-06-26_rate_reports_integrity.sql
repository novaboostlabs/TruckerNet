-- Slice 2 integrity: server-side sanity bounds on crowdsourced rate reports.
-- A generous-but-real envelope; anything outside is a typo or garbage and must
-- never enter the shared dataset. Mirrors the client-side guards in
-- src/lib/rateReports.ts (SANE_PPM/PAY/MILES). NOT VALID = enforce on all new
-- inserts/updates without failing on any pre-existing rows.
--
-- Note: dedup is handled client-side (one report per load via the local
-- `rate_contributed` flag) — the table is intentionally anonymous (no load_id /
-- user_id), so there is nothing server-side to dedupe against.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rate_reports_ppm_chk') THEN
    ALTER TABLE public.rate_reports
      ADD CONSTRAINT rate_reports_ppm_chk
      CHECK (pay_per_mile >= 0.30 AND pay_per_mile <= 20.0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rate_reports_pay_chk') THEN
    ALTER TABLE public.rate_reports
      ADD CONSTRAINT rate_reports_pay_chk
      CHECK (total_pay >= 50 AND total_pay <= 100000) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rate_reports_miles_chk') THEN
    ALTER TABLE public.rate_reports
      ADD CONSTRAINT rate_reports_miles_chk
      CHECK (miles >= 1 AND miles <= 6000) NOT VALID;
  END IF;
END $$;
