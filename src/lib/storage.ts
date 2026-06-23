import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

/**
 * BOL (bill of lading) photo storage. BOL photos are kept in the cloud as
 * proof-of-delivery (user decision 2026-06-22) — unlike fuel receipts, which we
 * OCR then discard. Stored in the Supabase Storage bucket `bol-photos` under
 * `{userId}/{uuid}.jpg`; the public URL is saved on the load row.
 *
 * Upload uses expo-file-system's binary upload (reliable in Expo Go — avoids the
 * RN Blob/ArrayBuffer pitfalls of supabase-js storage.upload).
 */

const BUCKET = 'bol-photos';

/** Downscale + compress a picked image; returns a local file URI. */
async function compress(localUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri);
  ctx.resize({ width: 1600 }); // a BOL must stay legible, so keep more detail
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Upload a BOL photo for the signed-in user. Returns the public URL, or null on
 * failure / guest (no session → nothing to attach to in the cloud).
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
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch {
    return null;
  }
}
