// Standalone one-off expenses sync — local-first, mirrors expensesSync.
// SQLite is the source of truth; these helpers push it to Supabase and pull it
// back on a new device / fresh login. Fire-and-forget; never blocks the UI.

import { supabase, isSupabaseConfigured } from '../supabase';
import { getAllGeneralExpenses, replaceGeneralExpenses } from '../../db/database';

interface SyncResult { error: string | null; }
interface PullResult extends SyncResult { found: boolean; }

const TABLE = 'general_expenses';

/** Push local one-off expenses up: upsert all local rows, delete cloud rows that
 *  no longer exist locally (local "replace all" semantics). */
export async function pushGeneralExpenses(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };
  try {
    const rows = getAllGeneralExpenses();
    const localIds = rows.map((r) => r.id);

    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        id: r.id, user_id: userId, label: r.label, category: r.category,
        amount: r.amount, date: r.date,
      }));
      const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'id' });
      if (error) return { error: error.message };
    }

    let del = supabase.from(TABLE).delete().eq('user_id', userId);
    if (localIds.length > 0) del = del.not('id', 'in', `(${localIds.map((id) => `"${id}"`).join(',')})`);
    const { error: delErr } = await del;
    return { error: delErr?.message ?? null };
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
    if (rows.length > 0) replaceGeneralExpenses(rows);
    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown general-expenses pull error', found: false };
  }
}

/** Reconcile on sign-in: pull cloud; if empty (e.g. data created pre-auth), push local. */
export async function syncGeneralExpensesOnSignIn(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;
  const { found, error } = await pullGeneralExpenses(userId);
  if (error) return;
  if (!found) await pushGeneralExpenses(userId);
}
