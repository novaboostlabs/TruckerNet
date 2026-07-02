// Standalone one-off expenses sync — local-first, mirrors expensesSync.
// SQLite is the source of truth; these helpers push it to Supabase and pull it
// back on a new device / fresh login. Fire-and-forget; never blocks the UI.

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  getAllGeneralExpenses, mergeGeneralExpenses, getQueuedDeletes, clearQueuedDeletes,
} from '../../db/database';

interface SyncResult { error: string | null; }
interface PullResult extends SyncResult { found: boolean; }

const TABLE = 'general_expenses';

/** Push local one-off expenses up: upsert all local rows, delete cloud rows that
 *  no longer exist locally (local "replace all" semantics). */
export async function pushGeneralExpenses(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };
  try {
    const rows = getAllGeneralExpenses();

    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        id: r.id, user_id: userId, label: r.label, category: r.category,
        amount: r.amount, date: r.date,
      }));
      const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'id' });
      if (error) return { error: error.message };
    }

    // Propagate only rows the user explicitly deleted (tombstone queue).
    const deletedIds = getQueuedDeletes(TABLE);
    if (deletedIds.length > 0) {
      const { error: delErr } = await supabase
        .from(TABLE).delete().eq('user_id', userId).in('id', deletedIds);
      if (delErr) return { error: delErr.message };
      clearQueuedDeletes(TABLE, deletedIds);
    }
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown general-expenses push error' };
  }
}

/** Pull cloud one-off expenses down, replacing the local set. */
export async function pullGeneralExpenses(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, label, category, amount, date')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) return { error: error.message, found: false };

    const rows = (data ?? []).map((r) => ({
      id: r.id, label: r.label ?? '', category: r.category ?? 'other',
      amount: Number(r.amount) || 0, date: String(r.date),
    }));
    if (rows.length > 0) mergeGeneralExpenses(rows);
    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown general-expenses pull error', found: false };
  }
}

/** Reconcile on sign-in: pull cloud; if empty (e.g. data created pre-auth), push local. */
export async function syncGeneralExpensesOnSignIn(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };
  // Pull merges cloud into local; then push sends the union + queued deletes up.
  const { error } = await pullGeneralExpenses(userId);
  if (error) return { error };
  return await pushGeneralExpenses(userId);
}
