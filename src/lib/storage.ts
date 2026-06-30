import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

/**
 * BOL (bill of lading) photo storage. BOL photos are kept in the cloud as
 * proof-of-delivery (user decision 2026-06-22) — unlike fuel receipts, which we
 * OCR then discard. Stored in the Supabase Storage bucket `bol-photos` under
 * `{userId}/{uuid}.jpg`.
 *
 * SECURITY (2026-06-30): the bucket is PRIVATE. A BOL contains broker names,
 * addresses, weights and sometimes rates — it must not be world-readable. We now
 * store the storage PATH on the load row (not a public URL) and mint a short-lived
 * SIGNED URL on demand for display (`getBolDisplayUri`). Owner-only read is
 * enforced by RLS (see migration 2026-06-30_bol_private.sql).
 *
 * Upload uses expo-file-system's binary upload (reliable in Expo Go — avoids the
 * RN Blob/ArrayBuffer pitfalls of supabase-js storage.upload).
 */

const BUCKET = 'bol-photos';
const SIGNED_URL_TTL = 60 * 60; // 1 hour — plenty for viewing a load detail

/** Downscale + compress a picked image; returns a local file URI. */
async function compress(localUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri);
  ctx.resize({ width: 1600 }); // a BOL must stay legible, so keep more detail
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Upload a BOL photo for the signed-in user. Returns the storage PATH
 * (`{userId}/{uuid}.jpg`) to save on the load row, or null on failure / guest
 * (no session → nothing to attach to in the cloud). The path is resolved to a
 * short-lived signed URL at display time via `getBolDisplayUri`.
 */
export async function uploadBolPhoto(userId: string, localUri: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null; // guest / not authenticated

  try {
    const fileUri = await compress(localUri);
    const path    = `${userId}/${uuid()}.jpg`;
    const url     = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    const res = await uploadAsync(url, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'content-type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (res.status < 200 || res.status >= 300) return null;
    return path; // store the path; sign on demand for display
  } catch {
    return null;
  }
}

/**
 * Resolve a stored BOL value to a URI the <Image> component can render.
 *   • empty               → null
 *   • local file/content  → returned as-is (upload failed / offline fallback)
 *   • storage path        → minted into a short-lived signed URL (private bucket)
 *   • legacy public URL    → path extracted and signed; falls back to the URL
 * Returns null if a signed URL can't be produced (e.g. offline) so the UI can
 * simply hide the image rather than show a broken/forbidden link.
 */
export async function getBolDisplayUri(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('file:') || value.startsWith('content:')) return value;

  // Derive the storage path. Legacy rows hold a full public URL; extract the
  // part after the bucket name. New rows already hold the bare path.
  let path = value;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (value.startsWith('http') && idx !== -1) {
    path = value.slice(idx + marker.length);
  } else if (value.startsWith('http')) {
    return value; // unrecognized URL shape — best effort
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
