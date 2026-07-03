// Sync orchestrator + status.
//
// Runs every local-first sync slice (pull-merge then push) and records the
// outcome so the UI can show "Last backup: …" / a failure — instead of the old
// behavior where every sync error was swallowed and the driver believed their
// data was safely backed up when it wasn't.

import { getSetting, setSetting } from '../../db/database';
import { isSupabaseConfigured } from '../supabase';
import { syncExpensesOnSignIn, pushExpenses } from './expensesSync';
import { syncFuelOnSignIn, pushFuel } from './fuelSync';
import { syncLoadsOnSignIn, pushLoads } from './loadsSync';
import { syncProfileOnSignIn, pushProfile } from './profileSync';
import { syncGeneralExpensesOnSignIn, pushGeneralExpenses } from './generalExpensesSync';

const LAST_SYNC_AT    = 'last_sync_at';
const LAST_SYNC_ERROR = 'last_sync_error';

export interface SyncStatus {
  lastSyncAt: string | null;   // ISO timestamp of the last fully-successful sync
  lastError:  string | null;   // human-readable error from the last attempt, if any
  isSchemaError: boolean;      // true when the error looks like an unapplied migration
}

// A Postgres/PostgREST error that means the hosted schema is missing a column
// or table (i.e. the migrations in supabase/migrations weren't applied). We
// call this out explicitly so it's not mistaken for a transient network blip.
function looksLikeSchemaError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('column') && m.includes('not') ||
    m.includes('relation') && m.includes('exist')
  );
}

/**
 * Run all sync slices for the given user. Fire-and-forget safe: never throws.
 * Records last-success timestamp + last error into settings for the UI.
 */
export async function syncAll(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;

  const results = await Promise.all([
    syncExpensesOnSignIn(userId),
    syncFuelOnSignIn(userId),
    syncLoadsOnSignIn(userId),
    syncGeneralExpensesOnSignIn(userId),
    syncProfileOnSignIn(userId),
  ]);

  const firstError = results.map((r) => r?.error).find(Boolean) ?? null;

  setSetting(LAST_SYNC_ERROR, firstError ?? '');
  if (!firstError) setSetting(LAST_SYNC_AT, new Date().toISOString());
}

/**
 * Push every local slice UP to the cloud without pulling first. Use this right
 * after a deliberate local edit (e.g. Replay Setup) — a pull there would let a
 * staler cloud copy overwrite the just-made edits (weekly_miles / weekly_fuel_cost
 * and the profile are restored from the cloud row on pull, bypassing the merge).
 */
export async function pushAll(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;

  const results = await Promise.all([
    pushExpenses(userId),
    pushFuel(userId),
    pushLoads(userId),
    pushGeneralExpenses(userId),
    pushProfile(userId),
  ]);

  const firstError = results.map((r) => r?.error).find(Boolean) ?? null;
  setSetting(LAST_SYNC_ERROR, firstError ?? '');
  if (!firstError) setSetting(LAST_SYNC_AT, new Date().toISOString());
}

export function getSyncStatus(): SyncStatus {
  const lastError = (getSetting(LAST_SYNC_ERROR) || '').trim() || null;
  return {
    lastSyncAt:    getSetting(LAST_SYNC_AT),
    lastError,
    isSchemaError: lastError ? looksLikeSchemaError(lastError) : false,
  };
}
