-- Load-attached expenses: scale tickets, tolls, lumper fees, detention, etc.
-- Each row belongs to one load (FK with CASCADE delete).
-- user_id included for fast RLS without joining through loads.

CREATE TABLE IF NOT EXISTS public.load_expenses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id     UUID        NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'other',
  amount      NUMERIC(10, 2) NOT NULL,
  date        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS load_expenses_load_idx  ON public.load_expenses (load_id);
CREATE INDEX IF NOT EXISTS load_expenses_user_idx  ON public.load_expenses (user_id);

ALTER TABLE public.load_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select" ON public.load_expenses;
CREATE POLICY "user_select" ON public.load_expenses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_insert" ON public.load_expenses;
CREATE POLICY "user_insert" ON public.load_expenses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_delete" ON public.load_expenses;
CREATE POLICY "user_delete" ON public.load_expenses
  FOR DELETE TO authenticated USING (user_id = auth.uid());
