// Loads + state_mileage sync — Phase 1 vertical slice (local-first).
//
// Loads and their state_mileage rows always travel together — you can't sync
// one without the other since state_mileage has a FK to loads. The remote
// query uses Supabase's nested select to fetch them in one round-trip.
//
// Local IDs are now real UUIDs (saveLoad was updated; legacy `load-*` IDs were
// migrated to real UUIDs at startup). This means upsert-by-id to the remote
// `uuid` primary key works without any type coercion.
//
// Same failure-safe rules as expensesSync / fuelSync: never throws, never
// blocks the UI, no-op for guests / unconfigured Supabase.

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  getAllLoads, getAllStateMileage, mergeLoads,
  getAllLoadExpenses, replaceLoadExpenses,
  getQueuedDeletes, clearQueuedDeletes,
  LoadRow, StateMileageRow, LoadExpenseRow,
} from '../../db/database';

interface SyncResult { error: string | null; }
interface PullResult extends SyncResult { found: boolean; }

export async function pushLoads(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };

  try {
    const loads       = getAllLoads();
    const stateMileage = getAllStateMileage();
    const localIds    = loads.map((l) => l.id);

    if (loads.length > 0) {
      const loadsPayload = loads.map((l) => ({
        id:                    l.id,
        user_id:               userId,
        date:                  l.date,
        pickup_address:        l.pickup_address,
        pickup_city:           l.pickup_city,
        pickup_state:          l.pickup_state,
        delivery_address:      l.delivery_address,
        delivery_city:         l.delivery_city,
        delivery_state:        l.delivery_state,
        equipment_type:        l.equipment_type,
        total_miles:           l.total_miles,
        gross_pay:             l.gross_pay,
        additional_costs:      l.additional_costs,
        // weight_lbs is NOT NULL (default 0) both locally and in Supabase — a
        // load with no weight entered is legitimately 0, not "unknown". Using
        // `|| null` here (instead of `??`) turned that valid 0 into null on
        // every such load, since 0 is falsy in JS, which then violated the
        // column's NOT NULL constraint on every push.
        weight_lbs:            l.weight_lbs,
        bol_number:            l.bol_number,
        bol_photo_url:         l.bol_photo_url || null,
        broker_name:           l.broker_name,
        broker_mc:             l.broker_mc,
        is_deadhead:           !!l.is_deadhead,
        is_backhaul:           !!l.is_backhaul,
        status:                l.status,
        notes:                 l.notes,
        benchmark_fair_pay_min: l.benchmark_fair_pay_min ?? null,
        benchmark_fair_pay_max: l.benchmark_fair_pay_max ?? null,
        fuel_cost_for_load:    l.fuel_cost_for_load,
        fixed_cost_for_load:   l.fixed_cost_for_load,
        net_pay:               l.net_pay,
        gross_rate_per_mile:   l.gross_rate_per_mile,
        net_rate_per_mile:     l.net_rate_per_mile,
        verdict:               l.verdict ?? null,
        pickup_lat:            l.pickup_lat ?? null,
        pickup_lng:            l.pickup_lng ?? null,
        delivery_lat:          l.delivery_lat ?? null,
        delivery_lng:          l.delivery_lng ?? null,
        // Was device-local only — see the LoadRow interface comment in
        // database.ts for why that was a real bug (silent duplicate pool
        // contributions after any local-DB-wipe + cloud-restore cycle).
        rate_contributed:      !!l.rate_contributed,
      }));

      const { error: loadsErr } = await supabase
        .from('loads')
        .upsert(loadsPayload, { onConflict: 'id' });
      if (loadsErr) return { error: loadsErr.message };

      // Sync state_mileage: delete all remote rows for these loads, then re-insert.
      const { error: delErr } = await supabase
        .from('state_mileage')
        .delete()
        .in('load_id', localIds);
      if (delErr) return { error: delErr.message };

      if (stateMileage.length > 0) {
        const smPayload = stateMileage.map((sm) => ({
          load_id:           sm.load_id,
          state:             sm.state,
          miles:             sm.miles,
          is_manually_edited: !!sm.is_manually_edited,
        }));
        const { error: smErr } = await supabase.from('state_mileage').insert(smPayload);
        if (smErr) return { error: smErr.message };
      }

      // Sync load_expenses: same delete-then-reinsert pattern.
      const allExpenses = getAllLoadExpenses();
      const { error: delExpErr } = await supabase
        .from('load_expenses')
        .delete()
        .in('load_id', localIds);
      if (delExpErr) return { error: delExpErr.message };

      if (allExpenses.length > 0) {
        const expPayload = allExpenses.map((e) => ({
          id:         e.id,
          load_id:    e.load_id,
          user_id:    userId,
          label:      e.label,
          category:   e.category,
          amount:     e.amount,
          date:       e.date,
          created_at: e.created_at,
        }));
        const { error: expErr } = await supabase.from('load_expenses').insert(expPayload);
        if (expErr) return { error: expErr.message };
      }
    }

    // Propagate only loads the user explicitly deleted (drain the tombstone
    // queue). The old "delete every cloud row not present locally" let a stale
    // device wipe another device's loads — never do that.
    const deletedIds = getQueuedDeletes('loads');
    if (deletedIds.length > 0) {
      const { error: delLoadsErr } = await supabase
        .from('loads').delete().eq('user_id', userId).in('id', deletedIds);
      if (delLoadsErr) return { error: delLoadsErr.message };
      clearQueuedDeletes('loads', deletedIds);
    }

    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown push error' };
  }
}

export async function pullLoads(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };

  try {
    // Fetch loads with nested state_mileage + load_expenses in one round-trip.
    const { data, error } = await supabase
      .from('loads')
      .select(`
        id, date, pickup_address, pickup_city, pickup_state,
        delivery_address, delivery_city, delivery_state,
        equipment_type, total_miles, gross_pay, additional_costs,
        weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
        is_deadhead, is_backhaul, status, notes,
        benchmark_fair_pay_min, benchmark_fair_pay_max,
        fuel_cost_for_load, fixed_cost_for_load, net_pay,
        gross_rate_per_mile, net_rate_per_mile, verdict, created_at,
        pickup_lat, pickup_lng, delivery_lat, delivery_lng, rate_contributed,
        state_mileage ( load_id, state, miles, is_manually_edited ),
        load_expenses ( id, load_id, label, category, amount, date, created_at )
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) return { error: error.message, found: false };

    const rows = data ?? [];
    if (rows.length > 0) {
      const loads: LoadRow[] = rows.map((r: any) => ({
        id:                    r.id,
        date:                  String(r.date).split('T')[0],
        pickup_address:        r.pickup_address ?? '',
        pickup_city:           r.pickup_city ?? '',
        pickup_state:          r.pickup_state ?? '',
        delivery_address:      r.delivery_address ?? '',
        delivery_city:         r.delivery_city ?? '',
        delivery_state:        r.delivery_state ?? '',
        equipment_type:        r.equipment_type ?? 'dry_van',
        total_miles:           Number(r.total_miles) || 0,
        gross_pay:             Number(r.gross_pay) || 0,
        additional_costs:      Number(r.additional_costs) || 0,
        weight_lbs:            Number(r.weight_lbs) || 0,
        bol_number:            r.bol_number ?? '',
        bol_photo_url:         r.bol_photo_url ?? '',
        broker_name:           r.broker_name ?? '',
        broker_mc:             r.broker_mc ?? '',
        is_deadhead:           r.is_deadhead ? 1 : 0,
        is_backhaul:           r.is_backhaul ? 1 : 0,
        status:                r.status ?? 'completed',
        notes:                 r.notes ?? '',
        benchmark_fair_pay_min: r.benchmark_fair_pay_min != null ? Number(r.benchmark_fair_pay_min) : null,
        benchmark_fair_pay_max: r.benchmark_fair_pay_max != null ? Number(r.benchmark_fair_pay_max) : null,
        fuel_cost_for_load:    Number(r.fuel_cost_for_load) || 0,
        fixed_cost_for_load:   Number(r.fixed_cost_for_load) || 0,
        net_pay:               Number(r.net_pay) || 0,
        gross_rate_per_mile:   Number(r.gross_rate_per_mile) || 0,
        net_rate_per_mile:     Number(r.net_rate_per_mile) || 0,
        verdict:               r.verdict ?? null,
        created_at:            r.created_at ?? new Date().toISOString(),
        pickup_lat:            r.pickup_lat != null ? Number(r.pickup_lat) : null,
        pickup_lng:            r.pickup_lng != null ? Number(r.pickup_lng) : null,
        delivery_lat:          r.delivery_lat != null ? Number(r.delivery_lat) : null,
        delivery_lng:          r.delivery_lng != null ? Number(r.delivery_lng) : null,
        rate_contributed:      r.rate_contributed ? 1 : 0,
      }));

      const stateMileage: StateMileageRow[] = rows.flatMap((r: any) =>
        (r.state_mileage ?? []).map((sm: any) => ({
          load_id:           r.id,
          state:             sm.state ?? '',
          miles:             Number(sm.miles) || 0,
          is_manually_edited: sm.is_manually_edited ? 1 : 0,
        }))
      );

      const loadExpenses: LoadExpenseRow[] = rows.flatMap((r: any) =>
        (r.load_expenses ?? []).map((e: any) => ({
          id:         e.id,
          load_id:    r.id,
          label:      e.label ?? '',
          category:   e.category ?? 'other',
          amount:     Number(e.amount) || 0,
          date:       String(e.date ?? '').split('T')[0],
          created_at: e.created_at ?? new Date().toISOString(),
        }))
      );

      mergeLoads(loads, stateMileage);

      // Restore load expenses — replace per-load rather than wiping all.
      const loadIds = loads.map(l => l.id);
      for (const loadId of loadIds) {
        const forLoad = loadExpenses.filter(e => e.load_id === loadId);
        replaceLoadExpenses(loadId, forLoad);
      }
    }

    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown pull error', found: false };
  }
}

export async function syncLoadsOnSignIn(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null };

  // Pull merges the cloud into local (keeping unpushed local loads); then push
  // sends the merged union (+ any queued deletes) back up so all devices
  // converge. A pull error (offline) skips the push — never act on uncertain state.
  const { error } = await pullLoads(userId);
  if (error) return { error };
  return await pushLoads(userId);
}
