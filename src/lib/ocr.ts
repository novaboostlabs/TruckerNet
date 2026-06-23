import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Fuel-receipt OCR via Claude vision. The image is sent to a Supabase Edge
 * Function (`ocr-fuel-receipt`) which calls the Anthropic API server-side — the
 * API key never ships in the app. We DISCARD the image after scanning; only the
 * extracted numbers matter (user decision 2026-06-22). Works in Expo Go (pure
 * REST + Expo SDK modules; no native OCR dependency).
 */

export interface FuelReceiptData {
  dollars:        number | null;  // total $ spent on fuel
  gallons:        number | null;  // gallons pumped
  pricePerGallon: number | null;  // $/gal printed on the receipt
  state:          string | null;  // 2-letter US state, if determinable
  date:           string | null;  // YYYY-MM-DD, if printed
}

export type OcrResult =
  | { ok: true;  data: FuelReceiptData }
  | { ok: false; error: 'cancelled' | 'permission' | 'not_configured' | 'failed' };

// ── Image acquisition ────────────────────────────────────────────────────────

/** Take a photo or pick one from the library; returns a local URI or null. */
export async function pickImage(source: 'camera' | 'library'): Promise<string | null | 'permission'> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'permission';
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled) return null;
    return res.assets[0]?.uri ?? null;
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'permission';
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

/** Downscale + compress to keep the upload (and OCR token cost) small. */
async function toBase64(uri: string): Promise<string | null> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1200 }); // receipts are tall/narrow; width cap is plenty
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
  return out.base64 ?? null;
}

// ── OCR call ─────────────────────────────────────────────────────────────────

/**
 * Full flow: acquire → downscale → Edge Function (Claude vision) → parsed data.
 * Returns a discriminated result so the UI can show the right message.
 */
export async function scanFuelReceipt(source: 'camera' | 'library'): Promise<OcrResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };

  const uri = await pickImage(source);
  if (uri === 'permission') return { ok: false, error: 'permission' };
  if (!uri) return { ok: false, error: 'cancelled' };

  try {
    const base64 = await toBase64(uri);
    if (!base64) return { ok: false, error: 'failed' };

    const { data, error } = await supabase.functions.invoke('ocr-fuel-receipt', {
      body: { image: base64 },
    });
    if (error || !data) return { ok: false, error: 'failed' };

    // Edge function returns { dollars, gallons, pricePerGallon, state, date }.
    return { ok: true, data: normalize(data) };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

// ── BOL OCR ──────────────────────────────────────────────────────────────────

export interface BolData {
  pickupAddress:   string | null;  // shipper / origin full address
  deliveryAddress: string | null;  // consignee / destination full address
  weightLbs:       number | null;  // total weight in pounds
  bolNumber:       string | null;
  brokerName:      string | null;  // broker / carrier, if printed
}

export type BolResult =
  | { ok: true;  data: BolData }
  | { ok: false; error: 'not_configured' | 'failed' };

/**
 * OCR a bill of lading the user already picked (the same image is kept as the
 * load's BOL photo, so we take a URI instead of acquiring one here). Extracts
 * the fields needed to pre-fill Add Load; the screen then geocodes the
 * addresses and the existing route/state-split flow takes over.
 */
export async function ocrBOL(uri: string): Promise<BolResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  try {
    const base64 = await toBase64(uri);
    if (!base64) return { ok: false, error: 'failed' };

    const { data, error } = await supabase.functions.invoke('ocr-bol', {
      body: { image: base64 },
    });
    if (error || !data) return { ok: false, error: 'failed' };

    return {
      ok: true,
      data: {
        pickupAddress:   str(data.pickupAddress),
        deliveryAddress: str(data.deliveryAddress),
        weightLbs:       num(data.weightLbs),
        bolNumber:       str(data.bolNumber),
        brokerName:      str(data.brokerName),
      },
    };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalize(raw: any): FuelReceiptData {
  const state = typeof raw?.state === 'string' && raw.state.length === 2
    ? raw.state.toUpperCase()
    : null;
  const date = typeof raw?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : null;
  return {
    dollars:        num(raw?.dollars),
    gallons:        num(raw?.gallons),
    pricePerGallon: num(raw?.pricePerGallon),
    state,
    date,
  };
}
