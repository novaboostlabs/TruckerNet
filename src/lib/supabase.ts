import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { setSetting } from '../db/database';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when both Supabase env vars are present. Sync degrades to a no-op otherwise. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 0;
}

// AFTER_FIRST_UNLOCK allows SecureStore to be read in the background after the
// device has been unlocked at least once since boot. Without this, Supabase's
// auto-refresh timer throws "User interaction is not allowed" when the app is
// backgrounded or the screen is locked while a token refresh fires.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// Records the raw failure so a "signed out every time I close the app" report
// is diagnosable instead of a dead end — same pattern as the Cloud Backup
// error detail (Settings), which is what actually found the last two bugs.
// Surfaced in Settings; also reported to Sentry for our own visibility.
function recordStorageError(op: 'read' | 'write' | 'remove', key: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  try {
    setSetting('last_auth_storage_error', `[${op}] ${key}: ${msg}`);
    setSetting('last_auth_storage_error_at', new Date().toISOString());
  } catch { /* local settings write itself failed — nothing more we can do */ }
  try {
    Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
      tags: { area: 'auth_secure_store', op },
    });
  } catch { /* Sentry unavailable — the local record above still captured it */ }
}

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
    } catch (e) {
      // Token can't be read right now (device locked before first unlock, or
      // a genuine Keychain failure). Returning null lets Supabase treat the
      // session as absent and retry later — but the failure is now recorded
      // instead of silently vanishing.
      recordStorageError('read', key, e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
    } catch (e) {
      // This is the dangerous silent failure: if WRITING the session throws,
      // the current app run keeps working (session lives in memory), but
      // nothing is there to restore on the next cold launch — "signed out
      // every single time I close the app" with no visible cause. Record it.
      recordStorageError('write', key, e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS);
    } catch (e) {
      recordStorageError('remove', key, e);
    }
  },
};

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Supabase's auto-refresh timer only runs while the app is foregrounded (per the
// official React Native setup). Without this wiring the timer keeps "running"
// while suspended, misses the refresh window, and the driver gets bounced to
// Sign In on reopen even though they never signed out.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
if (AppState.currentState === 'active') {
  supabase.auth.startAutoRefresh();
}
