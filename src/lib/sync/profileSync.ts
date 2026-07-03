// Driver-profile sync — local-first, mirrors expensesSync.
//
// ProfileSetupScreen writes the driver's name / equipment / truck # / home base
// into local SQLite during onboarding (before auth). These helpers carry that
// up to the Supabase `profiles` row and back down on a new device / fresh login,
// so the profile survives a reinstall. Network failure never blocks the UI —
// every function resolves to a result instead of throwing.

import { supabase, isSupabaseConfigured } from '../supabase';
import { getSetting, setSetting } from '../../db/database';

interface SyncResult { error: string | null; }
interface PullResult extends SyncResult { found: boolean; }

// Local setting key ↔ remote column.
const FIELD_MAP: { key: string; col: string }[] = [
  { key: 'profile_name',           col: 'name' },
  { key: 'profile_equipment_type', col: 'equipment_type' },
  { key: 'profile_truck_number',   col: 'truck_number' },
  { key: 'profile_home_base',      col: 'home_base' },
];

/**
 * Push the local profile fields up to the account's `profiles` row. Upsert only
 * touches the columns we provide, so weekly_miles / weekly_fuel_cost (owned by
 * expensesSync) are left intact.
 */
export async function pushProfile(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };
  try {
    const payload: Record<string, any> = { id: userId };
    for (const { key, col } of FIELD_MAP) {
      const v = (getSetting(key) ?? '').trim();
      if (v) payload[col] = v;
    }
    // Nothing captured locally yet — don't write an empty profile.
    if (Object.keys(payload).length === 1) return { error: null };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    return { error: error?.message ?? null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown profile push error' };
  }
}

/**
 * Pull the account's profile fields into local SQLite. `found` is true when the
 * cloud row has a non-empty name (our proxy for "this account has a profile").
 */
export async function pullProfile(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, equipment_type, truck_number, home_base')
      .eq('id', userId)
      .single();
    if (error || !data) return { error: error?.message ?? null, found: false };

    // LOCAL WINS: only fill a profile field the device doesn't already have, so a
    // stale cloud row can't revert a name/equipment/etc. the driver just edited.
    for (const { key, col } of FIELD_MAP) {
      const v = (data as any)[col];
      if (typeof v === 'string' && v.trim() && !(getSetting(key) ?? '').trim()) {
        setSetting(key, v.trim());
      }
    }
    return { error: null, found: !!(data.name && String(data.name).trim()) };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown profile pull error', found: false };
  }
}

/**
 * Reconcile on sign-in. Pull the cloud profile; if the cloud has none (e.g. a
 * driver who set up their profile pre-auth and just created an account), push
 * the local profile up so it isn't lost. Offline/pull error → leave it alone.
 */
export async function syncProfileOnSignIn(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };
  const { found, error } = await pullProfile(userId);
  if (error) return { error };          // transient/offline — never risk a bad push
  if (!found) return await pushProfile(userId);
  return { error: null };
}
