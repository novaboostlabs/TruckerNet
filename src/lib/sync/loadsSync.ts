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
  getAllLoads, getAllStateMileage, replaceLoads,
  LoadRow, StateMileageRow,
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
        weight_lbs:            l.weight_lbs || null,
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
      }));

      const { error: loadsErr } = await supabase
        .from('loads')
        .upsert(loadsPayload, { onConflict: 'id' });
      if (loadsErr) return { error: loadsErr.message };

      // Sync state_mileage: delete all remote rows for these loads, then re-insert.
      // This is simpler than diffing rows that have no stable client-side PK.
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
        const { error: smErr } = await supabase
          .from('state_mileage')
          .insert(smPayload);
        if (smErr) return { error: smErr.message };
      }
    }

    // Remove cloud load rows deleted locally.
    let del = supabase.from('loads').delete().eq('user_id', userId);
    del = localIds.length > 0
      ? del.not('id', 'in', `(${localIds.join(',')})`)
      : del;
    const { error: delLoadsErr } = await del;
    if (delLoadsErr) return { error: delLoadsErr.message };

    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown push error' };
  }
}

export async function pullLoads(userId: string): Promise<PullResult> {
  if (!isSupabaseConfigured() || !userId) return { error: null, found: false };

  try {
    // Fetch loads with their nested state_mileage in one round-trip.
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
        state_mileage ( load_id, state, miles, is_manually_edited )
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
      }));

      const stateMileage: StateMileageRow[] = rows.flatMap((r: any) =>
        (r.state_mileage ?? []).map((sm: any) => ({
          load_id:           r.id,
          state:             sm.state ?? '',
          miles:             Number(sm.miles) || 0,
          is_manually_edited: sm.is_manually_edited ? 1 : 0,
        }))
      );

      replaceLoads(loads, stateMileage);
    }

    return { error: null, found: rows.length > 0 };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown pull error', found: false };
  }
}

export async function syncLoadsOnSignIn(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;

  const { found, error } = await pullLoads(userId);
  if (error) return;
  if (!found) await pushLoads(userId);
}
