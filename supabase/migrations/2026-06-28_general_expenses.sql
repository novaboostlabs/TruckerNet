-- Standalone one-off expenses (repair, parking ticket, fine, etc.) that are NOT
-- tied to a load. They reduce the driver's period (week/month) net pay directly.
-- Load-attached one-offs continue to live in load_expenses. Local-first: SQLite
-- is source of truth; this table is the cloud mirror (see generalExpensesSync.ts).

CREATE TABLE IF NOT EXISTS public.general_expenses (
  id         TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL DEFAULT '',
  category   TEXT        NOT NULL DEFAULT 'other',
  amount     NUMERIC     NOT NULL DEFAULT 0,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS general_expenses_user_date_idx
  ON public.general_expenses (user_id, date DESC);

ALTER TABLE public.general_expenses ENABLE ROW LEVEL SECURITY;

-- Each driver sees and writes only their own rows.
DROP POLICY IF EXISTS "general_expenses_owner" ON public.general_expenses;
CREATE POLICY "general_expenses_owner" ON public.general_expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
