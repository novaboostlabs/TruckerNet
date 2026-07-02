// Fuel-entry sync — Phase 1 vertical slice (local-first).
//
// Mirrors expensesSync.ts. Local SQLite is the source of truth; push fill-ups up
// on save, pull them back on a fresh login. Append-only records (no "replace"
// editing model in the UI yet), but the push still removes cloud rows the user
// has deleted locally so the two stay in lockstep. Failure-safe: never throws,
// no-op for guests / unconfigured Supabase.

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  getAllFuelEntries, mergeFuelEntries, getQueuedDeletes, clearQueuedDeletes, FuelEntryRow,
} from '../../db/database';

interface SyncResult { error: string | null; }
interface PullResult extends SyncResult { found: boolean; }

const TABLE = 'fuel_entries';

export async function pushFuel(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };

  try {
    const rows = getAllFuelEntries();

    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        id:               r.id,
        user_id:          userId,
        date:             r.date,
        dollars_spent:    r.dollars_spent,
        gallons:          r.gallons,
        miles_driven:     r.miles_driven,
        cost_per_mile:    r.cost_per_mile,
        price_per_gallon: r.price_per_gallon,
        mpg:              r.mpg,
        odometer_reading: r.odometer_reading,
        state_purchased:  r.state_purchased,
      }));
      const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'id' });
      if (error) return { error: error.message };
    }

    // Propagate only fill-ups the user explicitly deleted (tombstone queue),
    // never "delete every cloud row not present locally".
    const deletedIds = getQueuedDeletes(TABLE);
    if (deletedIds.length > 0) {
      const { error: delError } = await supabase
        .from(TABLE).delete().eq('user_id', userId).in('id', deletedIds);
      if (delError) return { error: delError.message };
      clearQueuedDeletes(TABLE, deletedIds);
    }

    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown push error' };
  }
}

export async function pullFuel(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, date, dollars_spent, gallons, miles_driven, cost_per_mile, price_per_gallon, mpg, odometer_reading, state_purchased')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) return { error: error.message, found: false };

    const rows = data ?? [];
    if (rows.length > 0) {
      mergeFuelEntries(
        rows.map((r): FuelEntryRow => ({
          id:               r.id,
          // Remote `date` is a timestamptz; local stores a YYYY-MM-DD string.
          date:             String(r.date).split('T')[0],
          dollars_spent:    Number(r.dollars_spent) || 0,
          gallons:          Number(r.gallons) || 0,
          miles_driven:     Number(r.miles_driven) || 0,
          cost_per_mile:    Number(r.cost_per_mile) || 0,
          price_per_gallon: Number(r.price_per_gallon) || 0,
          mpg:              Number(r.mpg) || 0,
          odometer_reading: Number(r.odometer_reading) || 0,
          state_purchased:  r.state_purchased ?? '',
        }))
      );
    }

    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown pull error', found: false };
  }
}

/**
 * Reconcile on sign-in: pull cloud fuel; if the cloud is empty (e.g. a guest who
 * logged fill-ups then created an account), push local up instead. A pull error
 * (offline) is left alone — never overwrite or push on uncertain state.
 */
export async function syncFuelOnSignIn(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };

  // Pull merges cloud into local (keeping unpushed local fill-ups); then push
  // sends the union + queued deletes up. Offline pull error skips the push.
  const { error } = await pullFuel(userId);
  if (error) return { error };
  return await pushFuel(userId);
}
