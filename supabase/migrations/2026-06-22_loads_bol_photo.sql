-- Adds the BOL photo URL column to the remote loads table so proof-of-delivery
-- photos sync alongside the rest of the load. Idempotent.

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS bol_photo_url text;

-- ── Storage bucket for BOL photos ────────────────────────────────────────────
-- Public-read bucket (URLs contain an unguessable UUID); authenticated users can
-- only write/read within their own {userId}/ folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bol-photos', 'bol-photos', true)
ON CONFLICT (id) DO NOTHING;

-- A user may upload to their own folder: first path segment must equal their uid.
DROP POLICY IF EXISTS "bol_insert_own" ON storage.objects;
CREATE POLICY "bol_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bol-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bol_update_own" ON storage.objects;
CREATE POLICY "bol_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bol-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bol_delete_own" ON storage.objects;
CREATE POLICY "bol_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bol-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (bucket is public; this makes the intent explicit).
DROP POLICY IF EXISTS "bol_read_public" ON storage.objects;
CREATE POLICY "bol_read_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'bol-photos');
