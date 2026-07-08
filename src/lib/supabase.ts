import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureGet, secureSet, secureRemove } from './secureStorage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when both Supabase env vars are present. Sync degrades to a no-op otherwise. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 0;
}

// secureStorage.ts already handles AFTER_FIRST_UNLOCK accessibility + error
// recording (Settings-visible + Sentry) — that's what found and fixed the
// "signed out every time I close the app" bug (a silent storage failure).
const SecureStoreAdapter = {
  getItem: secureGet,
  setItem: secureSet,
  removeItem: secureRemove,
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
