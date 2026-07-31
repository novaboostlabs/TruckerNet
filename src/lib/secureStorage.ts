// Hardened SecureStore wrapper — every read/write/remove in the app should go
// through this, not raw expo-secure-store calls. Exists because of a real bug:
// i18n.ts's language preference used raw SecureStore calls with the platform
// DEFAULT keychain accessibility and silently swallowed errors (returned null
// on any failure) — the exact same failure shape that caused the session
// storage issue in supabase.ts, just in a second, un-fixed location. Both are
// now on this one hardened implementation so a third recurrence isn't possible
// without deliberately bypassing this module.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { setSetting } from '../db/database';

// expo-secure-store has NO web implementation — its web build is literally
// `export default {}`, so every call throws
// "ExpoSecureStore.default.getValueWithKeyAsync is not a function".
// Supabase's auth client reads the session from a REPEATING ~30s auto-refresh
// timer, so on web that threw (and shipped a Sentry event) on a loop rather than
// once — 5,400+ events from QA tabs alone, enough to bury real user crashes and
// exhaust the Sentry quota. Web is a QA-only surface, so back it with
// localStorage there: the session actually persists across reloads, and the
// native path below is untouched.
const isWeb = Platform.OS === 'web';

/** localStorage, or null when it's absent/blocked (Safari private mode, SSR). */
function webStore(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Merely TOUCHING localStorage throws in some blocked-storage contexts.
    return null;
  }
}

// AFTER_FIRST_UNLOCK allows the item to be read any time after the device has
// been unlocked once since boot (vs the default WHEN_UNLOCKED, which requires
// the device to be unlocked AT THE MOMENT of the read/write). Without this,
// reads attempted very early in app launch, or during background execution,
// can fail with "User interaction is not allowed" — this was confirmed as the
// root cause of Supabase's session not restoring; language storage had the
// exact same exposure.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// Records the raw failure locally (Settings → "Sign-in event log" area reuses
// this same diagnostic surface) and to Sentry, instead of letting a read/write
// failure vanish silently — that silence is what made the original session bug
// take three rounds of instrumentation to pin down.
function recordStorageError(op: 'read' | 'write' | 'remove', key: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  try {
    setSetting('last_auth_storage_error', `[${op}] ${key}: ${msg}`);
    setSetting('last_auth_storage_error_at', new Date().toISOString());
  } catch { /* local settings write itself failed — nothing more we can do */ }
  try {
    Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
      tags: { area: 'secure_store', op, key },
    });
  } catch { /* Sentry unavailable — the local record above still captured it */ }
}

export async function secureGet(key: string): Promise<string | null> {
  if (isWeb) return webStore()?.getItem(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
  } catch (e) {
    recordStorageError('read', key, e);
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) { try { webStore()?.setItem(key, value); } catch { /* quota/blocked */ } return; }
  try {
    await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
  } catch (e) {
    recordStorageError('write', key, e);
  }
}

export async function secureRemove(key: string): Promise<void> {
  if (isWeb) { try { webStore()?.removeItem(key); } catch { /* blocked */ } return; }
  try {
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS);
  } catch (e) {
    recordStorageError('remove', key, e);
  }
}
