-- Geocoded endpoint coordinates on loads. These power the personal "nearby lane"
-- history (past loads whose pickup AND delivery are within ~50 mi of the load
-- being checked). Nullable — older loads and manually-typed addresses won't have
-- them, and the feature falls back to state-level matching in that case.
-- Purely additive; safe to re-run.

ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS pickup_lat   NUMERIC;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS pickup_lng   NUMERIC;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;
