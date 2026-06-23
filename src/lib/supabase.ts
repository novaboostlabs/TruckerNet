import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

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

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
    } catch {
      // Token can't be read right now (device locked before first unlock).
      // Returning null lets Supabase treat the session as absent and retry later.
      return null;
    }
  },
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key: string) =>
    SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
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
