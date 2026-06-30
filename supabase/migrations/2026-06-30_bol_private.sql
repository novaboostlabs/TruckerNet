-- Migration: 2026-06-30_bol_private.sql
-- SECURITY HARDENING — make the BOL photo bucket PRIVATE (owner-only read).
--
-- WHY: a bill of lading contains broker names, pickup/delivery addresses, weights
-- and sometimes rates. The original setup (2026-06-22_loads_bol_photo.sql) made the
-- bucket world-readable via a "bol_read_public" policy + public URLs — anyone with a
-- URL could read another driver's BOL. The app now stores the storage PATH and mints
-- a short-lived SIGNED URL on demand (see src/lib/storage.ts getBolDisplayUri), so
-- the bucket no longer needs to be public.
--
-- Idempotent — safe to run more than once.

-- 1. Flip the bucket to private (signed URLs still work; public URLs stop working).
update storage.buckets set public = false where id = 'bol-photos';

-- 2. Remove the world-readable policy.
drop policy if exists "bol_read_public" on storage.objects;

-- 3. Owner-only read — a user can read (and therefore sign URLs for) only files in
--    their own {userId}/... folder. Insert/update/delete owner policies from the
--    original migration are unchanged.
do $$ begin
  create policy "bol_read_own" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'bol-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;
