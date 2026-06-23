# Photo Processing Setup — Fuel Receipt OCR + BOL Photos

The app code for both features is built and works in Expo Go. Two backend pieces
need deploying on your side to make them live. Until then, the app fails
gracefully ("Scanning not set up" / BOL falls back to a local-only photo).

---

## 1. Fuel Receipt OCR (Claude vision)

The app sends a downscaled receipt photo to a **Supabase Edge Function** that calls
the Anthropic API server-side, so your Anthropic key never ships in the app.

### Deploy the function

```bash
# from the repo root, with the Supabase CLI installed + logged in
supabase functions deploy ocr-fuel-receipt
supabase functions deploy ocr-bol            # BOL autofill (section 3)
```

Sources: [`ocr-fuel-receipt`](supabase/functions/ocr-fuel-receipt/index.ts) and
[`ocr-bol`](supabase/functions/ocr-bol/index.ts).

### Set the Anthropic key as a secret (shared by both functions)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Get the key from **console.anthropic.com → API Keys**. Models: fuel receipts use
`claude-haiku-4-5` (fast + cheap), BOLs use `claude-sonnet-4-6` (denser docs,
addresses/handwriting). Both prompt-cache the static system prompt, so repeat
scans are cheaper.

### Test
In the app: **Fuel → Log Fill-up → Scan receipt** → take/choose a photo. The
$ / gallons / state fields auto-fill for you to review before saving. The image
is **discarded** after scanning (only the numbers are kept).

---

## 2. BOL Photos (Supabase Storage)

BOL photos are kept in the cloud as proof of delivery. One SQL migration creates
the column, the storage bucket, and the access policies.

### Run the migration

Open **Supabase → SQL Editor** and run
[`supabase/migrations/2026-06-22_loads_bol_photo.sql`](supabase/migrations/2026-06-22_loads_bol_photo.sql).

It is idempotent and does three things:
1. Adds `loads.bol_photo_url` (so the URL syncs with the rest of the load).
2. Creates a **public** storage bucket `bol-photos`.
3. Adds RLS policies: a user can only write/update/delete within their own
   `{userId}/` folder; read is public (URLs contain an unguessable UUID).

> **Hardening later (optional):** if you'd rather BOLs not be publicly readable
> by URL, flip the bucket to private and switch the app to signed URLs. Ping me
> and I'll wire `createSignedUrl` into the load-detail view.

### Test
**Add Load → Add details → Attach BOL photo** → take/choose a photo → save. Open
the load from History → the BOL photo shows; tap it for a full-screen view.

---

## 3. BOL OCR — autofill the whole load (Claude vision)

Like the fuel receipt scan, **Add Load → "Scan BOL to autofill"** reads a bill of
lading photo and fills in **pickup, delivery, weight, BOL number, and broker**.
The addresses are then geocoded and the existing flow takes over automatically —
route distance + per-state mileage are calculated for you. The scanned photo is
also kept as the load's BOL proof photo (section 2), so one photo does both.

Backend: the `ocr-bol` edge function (deployed above) + the same
`ANTHROPIC_API_KEY` secret. No extra storage setup beyond section 2.

### Test
**Add Load → "Scan BOL to autofill"** → take/choose a BOL photo → pickup, delivery,
weight, etc. fill in, and the route + state mileage compute automatically. Review,
adjust if needed, add the rate, and save.

---

## Notes
- Both features use `expo-image-picker` (already a plugin) + `expo-image-manipulator`
  (added) for downscaling. All Expo Go compatible — **no dev build required**
  (unlike RevenueCat).
- Permissions: iOS will prompt for Camera / Photos on first use. The
  `expo-image-picker` plugin supplies default usage strings; customize them in
  `app.json` before the App Store build if you want tailored copy.
