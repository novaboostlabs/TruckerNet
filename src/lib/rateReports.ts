import { supabase, isSupabaseConfigured } from './supabase';
import { getSetting } from '../db/database';
import { getDistanceBand } from '../utils/marketRates';

// Minimum reports required before we show community data to prevent outlier
// distortion and protect early contributors' privacy.
const MIN_REPORTS = 3;

// Max records to pull per lane query (keeps payload small; >100 means lots of
// drivers on the same lane which is plenty for a solid median anyway).
const MAX_RECORDS = 150;

// Only include reports from the last 90 days — rates shift seasonally.
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export interface CommunityRate {
  count:     number;
  lowPay:    number;   // 25th-percentile pay
  medianPay: number;   // 50th-percentile pay
  highPay:   number;   // 75th-percentile pay
}

export function shouldShareRateData(): boolean {
  return getSetting('share_rate_data') !== 'false';
}

/**
 * Anonymously contribute a completed load's rate to the community pool.
 * Fire-and-forget — caller must NOT await; never blocks the save flow.
 */
export async function contributeRateReport(input: {
  originState: string;
  destState:   string;
  loadType:    string;
  miles:       number;
  totalPay:    number;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!shouldShareRateData()) return;
  if (!input.originState || !input.destState) return;
  if (input.miles <= 0 || input.totalPay <= 0) return;

  const band = getDistanceBand(input.miles);
  try {
    await supabase.from('rate_reports').insert({
      origin_state:      input.originState,
      destination_state: input.destState,
      load_type:         input.loadType,
      distance_band:     band,
      total_pay:         Math.round(input.totalPay * 100) / 100,
      pay_per_mile:      Math.round((input.totalPay / input.miles) * 1000) / 1000,
      miles:             Math.round(input.miles),
    });
  } catch {
    // Never surface errors — contribution is best-effort
  }
}

/**
 * Fetch aggregated community rates for a lane.
 * Returns null when Supabase is unavailable or fewer than MIN_REPORTS exist.
 */
export async function getCommunityRate(
  originState: string,
  destState:   string,
  loadType:    string,
  miles:       number,
): Promise<CommunityRate | null> {
  if (!isSupabaseConfigured()) return null;
  if (!originState || !destState || miles <= 0) return null;

  const band  = getDistanceBand(miles);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  try {
    const { data, error } = await supabase
      .from('rate_reports')
      .select('total_pay')
      .eq('origin_state', originState)
      .eq('destination_state', destState)
      .eq('load_type', loadType)
      .eq('distance_band', band)
      .gte('reported_at', since)
      .order('total_pay', { ascending: true })
      .limit(MAX_RECORDS);

    if (error || !data || data.length < MIN_REPORTS) return null;

    const pays = data.map((r: { total_pay: number }) => r.total_pay).sort((a, b) => a - b);
    const n = pays.length;

    const percentile = (p: number) => pays[Math.min(Math.floor(n * p), n - 1)];

    return {
      count:     n,
      lowPay:    Math.round(percentile(0.25)),
      medianPay: Math.round(percentile(0.50)),
      highPay:   Math.round(percentile(0.75)),
    };
  } catch {
    return null;
  }
}
