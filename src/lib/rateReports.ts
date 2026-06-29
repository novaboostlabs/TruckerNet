import { supabase, isSupabaseConfigured } from './supabase';
import { getSetting, getLoadById, markLoadRateContributed } from '../db/database';
import { contributeBrokerReport } from './brokerScorecard';
import { getDistanceBand } from '../utils/marketRates';

// Window: only include reports from the last 90 days — rates shift seasonally.
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Max records pulled per tier query (keeps payload small; a solid median needs
// far fewer than this).
const MAX_RECORDS = 200;

// ── Sanity bounds (Slice 2 integrity) ─────────────────────────────────────────
// A generous-but-real envelope. Anything outside is a typo or garbage and must
// never enter (or skew) the shared dataset. Enforced both client-side here AND
// server-side via CHECK constraints (migration 2026-06-26_rate_reports_integrity).
const SANE_PPM_MIN   = 0.30;    // $/mi — below this is almost certainly an error
const SANE_PPM_MAX   = 20.0;    // $/mi — above this is a typo even for specialized
const SANE_PAY_MIN   = 50;      // $ total
const SANE_PAY_MAX   = 100000;  // $ total
const SANE_MILES_MIN = 1;
const SANE_MILES_MAX = 6000;

function within(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence tiers — cascade from most specific to broadest. We hold the
// DISTANCE BAND fixed across every tier so per-mile rates stay comparable, and
// only widen the GEOGRAPHY (state pair → region corridor → nationwide). This
// surfaces real driver data with ~10× less of it than exact-lane-only matching,
// while never mixing a 40-mile haul's $/mi with a 1,500-mile haul's.
// ─────────────────────────────────────────────────────────────────────────────
export type CommunityTier = 'exact' | 'corridor' | 'national';

// Minimum reports required at each tier before we'll show it. Broader tiers
// demand more samples since the lane match is looser.
const MIN_EXACT    = 3;
const MIN_CORRIDOR = 5;
const MIN_NATIONAL = 8;

export interface CommunityRate {
  count:     number;
  lowPay:    number;        // 25th-percentile pay for this trip's miles
  medianPay: number;        // 50th-percentile
  highPay:   number;        // 75th-percentile
  tier:      CommunityTier; // how specific the matched data is
}

// ── US freight regions (state → region) — used for the corridor tier ──────────
const REGION_OF: Record<string, string> = {
  // West
  WA: 'west', OR: 'west', CA: 'west', NV: 'west', ID: 'west', MT: 'west',
  WY: 'west', UT: 'west', AZ: 'west', CO: 'west', NM: 'west', AK: 'west', HI: 'west',
  // Midwest
  ND: 'midwest', SD: 'midwest', NE: 'midwest', KS: 'midwest', MN: 'midwest',
  IA: 'midwest', MO: 'midwest', WI: 'midwest', IL: 'midwest', MI: 'midwest',
  IN: 'midwest', OH: 'midwest',
  // South
  TX: 'south', OK: 'south', AR: 'south', LA: 'south', MS: 'south', AL: 'south',
  TN: 'south', KY: 'south',
  // Southeast
  FL: 'southeast', GA: 'southeast', SC: 'southeast', NC: 'southeast',
  VA: 'southeast', WV: 'southeast',
  // Northeast
  PA: 'northeast', NY: 'northeast', NJ: 'northeast', CT: 'northeast',
  RI: 'northeast', MA: 'northeast', VT: 'northeast', NH: 'northeast',
  ME: 'northeast', MD: 'northeast', DE: 'northeast', DC: 'northeast',
};

// All states sharing a given state's region (incl. the state itself).
function regionStates(state: string): string[] {
  const region = REGION_OF[state];
  if (!region) return [state];
  return Object.keys(REGION_OF).filter((s) => REGION_OF[s] === region);
}

export function shouldShareRateData(): boolean {
  return getSetting('share_rate_data') !== 'false';
}

/**
 * Total reports in the network over the active window — the "X loads powering
 * the network" figure for the contribution flywheel. Returns null when Supabase
 * is unavailable (offline / not configured) so the UI can hide the line.
 */
export async function getNetworkReportCount(): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  try {
    const { count, error } = await supabase
      .from('rate_reports')
      .select('*', { count: 'exact', head: true })
      .gte('reported_at', since);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
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

  // Reject out-of-range data before it can pollute the pool.
  const ppm = input.totalPay / input.miles;
  if (!within(ppm, SANE_PPM_MIN, SANE_PPM_MAX)) return;
  if (!within(input.totalPay, SANE_PAY_MIN, SANE_PAY_MAX)) return;
  if (!within(input.miles, SANE_MILES_MIN, SANE_MILES_MAX)) return;

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
 * Contribute a load's rate to the pool EXACTLY ONCE, the first time it is
 * completed — idempotent across re-saves and edits. Call this from any screen
 * that saves/updates a load (Add Load create, Load Detail edit). Synchronous
 * orchestration; the network insert itself is fire-and-forget.
 *
 * We set the local `rate_contributed` flag BEFORE firing the insert: we'd rather
 * under-count (a dropped insert) than double-count the shared dataset.
 */
export function maybeContributeLoadRate(loadId: string): void {
  const load = getLoadById(loadId);
  if (!load) return;
  if (load.status !== 'completed') return;
  if ((load as any).rate_contributed) return;
  if (!shouldShareRateData()) return;
  if (!load.pickup_state || !load.delivery_state) return;
  if (load.total_miles <= 0 || load.gross_pay <= 0) return;

  markLoadRateContributed(loadId);
  contributeRateReport({
    originState: load.pickup_state,
    destState:   load.delivery_state,
    loadType:    load.equipment_type,
    miles:       load.total_miles,
    totalPay:    load.gross_pay,
  }).catch(() => {});

  // Broker scorecard contribution — only when broker info was entered.
  if (load.broker_name && load.broker_name.trim().length >= 2) {
    contributeBrokerReport({
      brokerName:    load.broker_name,
      brokerMC:      load.broker_mc ?? '',
      grossPay:      load.gross_pay,
      totalMiles:    load.total_miles,
      fairMarketMin: load.benchmark_fair_pay_min ?? null,
      fairMarketMax: load.benchmark_fair_pay_max ?? null,
      verdict:       load.verdict ?? null,
      equipmentType: load.equipment_type,
    }).catch(() => {});
  }
}

// Aggregate a set of reports into a pay range for THIS trip's miles. We use
// per-mile percentiles × miles (not raw totals) so reports with slightly
// different mileage within the same band normalize cleanly.
function aggregate(
  ppms:  number[],
  miles: number,
  tier:  CommunityTier,
): CommunityRate {
  const sorted = [...ppms].sort((a, b) => a - b);
  const n = sorted.length;
  const pct = (p: number) => sorted[Math.min(Math.floor(n * p), n - 1)];
  return {
    count:     n,
    lowPay:    Math.round(pct(0.25) * miles),
    medianPay: Math.round(pct(0.50) * miles),
    highPay:   Math.round(pct(0.75) * miles),
    tier,
  };
}

// One tier query → array of pay_per_mile values (or null on error/unavailable).
async function fetchPpms(
  filter: (q: any) => any,
  since:  string,
): Promise<number[] | null> {
  try {
    const { data, error } = await filter(
      supabase.from('rate_reports').select('pay_per_mile'),
    )
      .gte('reported_at', since)
      .limit(MAX_RECORDS);
    if (error || !data) return null;
    // Drop any out-of-range values (protects against rows that predate the
    // server-side CHECK constraints). The displayed range is already the IQR
    // (25th–75th pct), which ignores tails — this guards the median too.
    return data
      .map((r: { pay_per_mile: number }) => r.pay_per_mile)
      .filter((p: number) => within(p, SANE_PPM_MIN, SANE_PPM_MAX));
  } catch {
    return null;
  }
}

/**
 * Fetch the best-available community rate for a lane, cascading from the most
 * specific match to the broadest. Returns null only when even nationwide data
 * for this load type + distance band is too thin. The `tier` tells the UI how
 * confident to be (and what label to show).
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

  // Tier 1 — exact lane (state → state), same band.
  const exact = await fetchPpms(
    (q) => q
      .eq('origin_state', originState)
      .eq('destination_state', destState)
      .eq('load_type', loadType)
      .eq('distance_band', band),
    since,
  );
  if (exact && exact.length >= MIN_EXACT) return aggregate(exact, miles, 'exact');

  // Tier 2 — regional corridor (region → region), same band.
  const corridor = await fetchPpms(
    (q) => q
      .in('origin_state', regionStates(originState))
      .in('destination_state', regionStates(destState))
      .eq('load_type', loadType)
      .eq('distance_band', band),
    since,
  );
  if (corridor && corridor.length >= MIN_CORRIDOR) return aggregate(corridor, miles, 'corridor');

  // Tier 3 — nationwide for this load type + distance band.
  const national = await fetchPpms(
    (q) => q
      .eq('load_type', loadType)
      .eq('distance_band', band),
    since,
  );
  if (national && national.length >= MIN_NATIONAL) return aggregate(national, miles, 'national');

  return null;
}
