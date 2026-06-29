-- Supports the community-rate "national" tier (getCommunityRate tier 3):
-- filters by load_type + distance_band + reported_at without a state pair.
-- The existing rate_reports_lane_idx leads with origin/destination state, so it
-- can't serve this query — add a dedicated index on the type+band+recency path.
CREATE INDEX IF NOT EXISTS rate_reports_type_band_idx
  ON public.rate_reports (load_type, distance_band, reported_at DESC);
