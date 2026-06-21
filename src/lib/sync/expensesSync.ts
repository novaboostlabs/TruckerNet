// Expenses sync — Phase 1 vertical slice (local-first).
//
// Local SQLite is the source of truth. These helpers push it up to Supabase and
// pull it back down (e.g. on a new device / fresh login). Everything is wrapped
// so a network failure NEVER blocks the UI: callers can fire-and-forget, and
// each function resolves to a {error} result instead of throwing.
//
// Scope is deliberately limited to expenses + weekly miles. The same pattern
// will be replicated to loads / fuel / IFTA in later steps once this is proven.

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  getUserExpenses, replaceUserExpenses, getWeeklyMiles, getSetting, setSetting,
} from '../../db/database';

interface SyncResult {
  error: string | null;
}

interface PullResult extends SyncResult {
  /** True when the cloud had at least one expense row for this user. */
  found: boolean;
}

const TABLE = 'user_expenses';

/**
 * Push local expenses + weekly miles up to Supabase.
 * Upserts every local row, removes cloud rows that no longer exist locally
 * (local "replace all" semantics), then stores weekly miles on the profile.
 */
export async function pushExpenses(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };

  try {
    const rows    = getUserExpenses();
    const weekly  = getWeeklyMiles();
    const now     = new Date().toISOString();
    const localIds = rows.map((r) => r.id);

    if (rows.length > 0) {
      // rows arrive ordered by sort_order asc, so the index preserves ordering
      // through the round-trip (pull re-orders by sort_order).
      const payload = rows.map((r, index) => ({
        id:                 r.id,
        user_id:            userId,
        label:              r.label,
        category:           r.category,
        amount:             r.amount,
        frequency:          r.frequency,
        monthly_equivalent: r.monthly_equivalent,
        is_active:          true,
        sort_order:         index,
        updated_at:         now,
      }));
      const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'id' });
      if (error) return { error: error.message };
    }

    // Remove cloud rows the user has deleted locally.
    let del = supabase.from(TABLE).delete().eq('user_id', userId);
    del = localIds.length > 0
      ? del.not('id', 'in', `(${localIds.join(',')})`)
      : del; // no local rows → delete all cloud rows for this user
    const { error: delError } = await del;
    if (delError) return { error: delError.message };

    // Persist weekly miles + fuel estimate on the profile row.
    // Use upsert (not update) so a missing profile row is created rather than
    // silently skipping the save — guards against trigger race conditions.
    const weeklyFuelCost = parseFloat(getSetting('weekly_fuel_cost') ?? '0') || 0;
    const { error: profError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, weekly_miles: weekly, weekly_fuel_cost: weeklyFuelCost },
        { onConflict: 'id' }
      );
    if (profError) return { error: profError.message };

    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown push error' };
  }
}

/**
 * Pull cloud expenses + weekly miles down into local SQLite, replacing the
 * local set. Used to restore an account's data on a new device / login.
 */
export async function pullExpenses(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, label, category, amount, frequency, monthly_equivalent, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });
    if (error) return { error: error.message, found: false };

    const rows = data ?? [];
    if (rows.length > 0) {
      replaceUserExpenses(
        rows.map((r) => ({
          id:                 r.id,
          label:              r.label ?? '',
          category:           r.category ?? 'other',
          amount:             Number(r.amount) || 0,
          frequency:          r.frequency ?? 'monthly',
          monthly_equivalent: Number(r.monthly_equivalent) || 0,
        }))
      );
    }

    // Restore weekly miles + fuel estimate from the profile.
    const { data: prof, error: profError } = await supabase
      .from('profiles')
      .select('weekly_miles, weekly_fuel_cost')
      .eq('id', userId)
      .single();
    if (!profError && prof) {
      if (Number(prof.weekly_miles) > 0)
        setSetting('weekly_miles', String(Number(prof.weekly_miles)));
      if (Number(prof.weekly_fuel_cost) > 0)
        setSetting('weekly_fuel_cost', String(Number(prof.weekly_fuel_cost)));
    }

    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown pull error', found: false };
  }
}

/**
 * Reconcile on sign-in. Pull the account's cloud data; if the cloud is empty
 * (e.g. a guest who set up expenses and just created an account), push the
 * local data up instead so nothing is lost. A pull error (offline) is left
 * alone — never overwrite or push on uncertain state.
 */
export async function syncExpensesOnSignIn(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;

  const { found, error } = await pullExpenses(userId);
  if (error) return;            // transient/offline — don't risk a bad push
  if (!found) await pushExpenses(userId);
}
