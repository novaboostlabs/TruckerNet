// ─────────────────────────────────────────────────────────────
// TruckerNet Fair Market Rate Engine v2
//
// Model: formula-based, not a flat lookup table.
//   fair_rate = max(minimum_floor, baseline × equipment_mult
//                                 × distance_mult × seasonal_mult × miles)
//
// Sources & calibration (2025–2026):
//   • National dry van spot avg: $2.25–$2.79/mi (Nuvocargo, Scale Funding, 2026)
//   • Equipment premiums: industry reports, O Trucking, FreightSidekick (2026)
//   • Distance curve: Nuvocargo 2026 guide + driver forum benchmarks
//   • Minimum floors: owner-operator community consensus ($450–$600 floor for any
//     load; local runs priced as flat jobs, not $/mile)
//   • Seasonal index: Truck Dispatch Experts 2026 seasonal calendar
//
// Re-center the market by editing `baseline_dry_van` in the Supabase
// `market_config` row (refinement #3a) — no app release needed. Check it against
// the Scale Funding free rate page or Trucking Dive rate tracker periodically.
//
// CPM math is backend-only; users see total $ range.
// ─────────────────────────────────────────────────────────────

export type LoadType =
  | 'dry_van'
  | 'reefer'
  | 'flatbed'
  | 'step_deck'
  | 'intermodal'
  | 'tanker'
  | 'hazmat'
  | 'rgn'
  | 'power_only'
  | 'auto_transport';

// ── National baseline (all-in spot, $/mile, dry van) ─────────────────────────
// The foundation the whole formula multiplies off of. Remotely tunable
// (refinement #3a): marketConfig pushes the latest value here on launch via
// setBaselineDryVan(), so the market can be re-centered without an app release.
// Falls back to this bundled default offline / before the first fetch.
export const DEFAULT_BASELINE_DRY_VAN = 2.50; // 2026 national van avg, all-in spot

// Sanity envelope — a bad remote value can never nuke every estimate. Mirrors the
// CHECK constraint in 2026-06-27_market_config.sql.
const BASELINE_MIN = 1.50;
const BASELINE_MAX = 4.00;

let activeBaseline = DEFAULT_BASELINE_DRY_VAN;

/**
 * Set the active national baseline (called by marketConfig on launch with the
 * cached, then freshly-fetched, remote value). Clamped to a sane envelope.
 * Returns the value actually applied so the caller can cache the clamped figure.
 */
export function setBaselineDryVan(value: number): number {
  const clamped = Math.max(BASELINE_MIN, Math.min(BASELINE_MAX, value));
  activeBaseline = clamped;
  return clamped;
}

export function getBaselineDryVan(): number {
  return activeBaseline;
}

// ── Equipment multipliers (relative to dry van = 1.0) ────────────────────────
// Sources: 2026 spot market averages; reefer +$0.39/mi over van (national);
// flatbed +$0.25–$0.45/mi; hazmat premium baked in (cert cost + risk).
// Multipliers are RELATIVE RATIOS to dry van, calibrated against 2026 equipment
// rate trackers: national van ~$2.68, reefer ~$3.26 (ratio 1.22), flatbed ~$3.60
// (ratio 1.34) — Scale Funding / O Trucking / ACT, May 2026. Validated by blind
// lane comparison 2026-06-27 (flatbed/reefer were previously undercalibrated).
const EQUIPMENT_MULT: Record<LoadType, number> = {
  dry_van:       1.00,
  reefer:        1.22,   // ~$3.26/mi national vs $2.68 van — temp-control premium
  flatbed:       1.34,   // ~$3.60/mi national vs $2.68 van — tarping/securement labor
  step_deck:     1.50,   // ~12% over flatbed; fewer capable carriers, taller freight
  intermodal:    0.88,   // −12%; rail leg reduces carrier cost but limits flexibility
  tanker:        1.13,   // +13%; CDL + tanker endorsement, cleaning requirements
  hazmat:        1.38,   // +38%; hazmat certification + placard liability
  rgn:           1.80,   // +80% floor; wide range ($3.50–$20+/mi — project-rated)
  power_only:    0.85,   // −15%; no trailer overhead but limited freight options
  auto_transport: 1.10,  // +10%; per-car pricing structure, equivalent FTL RPM
};

// ── Distance multiplier (continuous curve, relative to ~750 mi = 1.0) ─────────
// Short hauls earn high $/mi because fixed costs (loading, detention, paperwork)
// are spread over fewer miles; the curve flattens toward a long-haul asymptote.
//
// This is a CONTINUOUS function, not a step table — a 250 vs 251 mi load must
// never get materially different estimates (the old 7-band version jumped ~12%
// at each arbitrary edge, which an experienced driver entering 248 vs 252 would
// immediately distrust). Piecewise-linear interpolation through the same
// calibrated anchor points the old bands were built on, so prior calibration
// (and the blind-study validation) is preserved while the cliffs disappear.
//
// The `DistanceBand` labels below are kept only as a categorical tag — they're
// used by the community rate network (rateReports.ts) to hold the band fixed
// across confidence tiers, and surfaced as result metadata. They no longer
// drive the multiplier.
export type DistanceBand = 'micro' | 'local' | 'short' | 'medium' | 'standard' | 'long' | 'mega';

// [miles, multiplier] anchors, ascending. Interpolated linearly between; flat
// beyond the ends. Anchor at the representative center of each old band.
const DISTANCE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [25,   1.85],   // micro    — floor almost always binding anyway
  [75,   1.58],   // local    — often flat-rated
  [175,  1.30],   // short    — per-mile pricing takes over
  [375,  1.14],   // medium
  [750,  1.00],   // standard — baseline
  [1500, 0.90],   // long
  [2500, 0.84],   // mega     — longest hauls, lowest $/mi
];

export function getDistanceMultiplier(miles: number): number {
  const a = DISTANCE_ANCHORS;
  if (miles <= a[0][0])               return a[0][1];
  if (miles >= a[a.length - 1][0])    return a[a.length - 1][1];
  for (let i = 0; i < a.length - 1; i++) {
    const [x0, y0] = a[i];
    const [x1, y1] = a[i + 1];
    if (miles <= x1) {
      const t = (miles - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return a[a.length - 1][1];
}

// ── Minimum load floors ($ total, any load) ──────────────────────────────────
// Below these thresholds no owner-operator should accept a load — covers
// minimum time (loading + detention + paperwork) regardless of miles.
// Source: owner-operator community benchmarks, O Trucking 2026 guides.
const MINIMUM_FLOOR: Record<LoadType, number> = {
  dry_van:       500,
  reefer:        625,    // refrigeration operating cost minimum
  flatbed:       575,
  step_deck:     700,
  intermodal:    420,
  tanker:        600,
  hazmat:        760,    // certification + placard fees on top
  rgn:           950,    // permit cost alone can be $300+
  power_only:    430,
  auto_transport: 480,
};

// ── Range spread (±% around midpoint) ────────────────────────────────────────
// Reflects typical regional variance in spot rates AND our own confidence in the
// estimate. A pure model with less information should present an honestly WIDER
// range — being humble where we're uncertain is what keeps an experienced driver
// from writing the number off. Confidence tightens automatically once real
// community data backs the lane (that path shows the data-derived range instead).
//   • high   — geography known, typical lane → tight ±13%
//   • medium — geography unknown (e.g. quick eval, miles + rate only) → ±18%
//   • low    — short flat-rated haul or project freight; highly negotiated → ±24%
export type RateConfidence = 'high' | 'medium' | 'low';

const SPREAD_BY_CONFIDENCE: Record<RateConfidence, number> = {
  high:   0.13,
  medium: 0.18,
  low:    0.24,
};
const SPREAD_RGN = 0.30;  // wider still — heavy haul is extremely quote-specific

// ── Seasonal index (month 1–12, annual avg = 1.0) ────────────────────────────
// Source: Truck Dispatch Experts 2026 seasonal calendar; FreightWaves patterns.
// Oct is peak (+20%); Jan is trough (−18%). Applied to current calendar month.
const SEASONAL_INDEX: Record<number, number> = {
  1: 0.82,   // Jan — post-holiday slump, lowest rates of year
  2: 0.85,   // Feb — slow recovery
  3: 0.90,   // Mar — gradual pick-up
  4: 0.95,   // Apr — produce season begins (especially reefer)
  5: 1.00,   // May — baseline; back-to-normal
  6: 1.02,   // Jun — produce peak, steady volume
  7: 1.05,   // Jul — back-to-school freight ramp-up
  8: 1.08,   // Aug — volume building toward peak
  9: 1.10,   // Sep — retail stocking intensifies
  10: 1.20,  // Oct — Q4 peak, tightest capacity of year
  11: 1.18,  // Nov — holiday freight; softens late month
  12: 1.00,  // Dec — early month strong, dead week post-Christmas
};

// ── Geographic market strength (origin-driven) ───────────────────────────────
// The single biggest determinant of rate that a pure distance/equipment model
// misses: WHERE the load originates. The same truck, trailer, miles and month
// pays very differently out of Los Angeles vs rural Montana. Rates are set
// primarily by how tight the ORIGIN market is (outbound load-to-truck balance);
// the destination matters as a smaller "how hard is my reload / backhaul" nudge.
//
// Calibration (2026 public freight-market data — never load-board scraping):
//   • National dry-van spot avg ~$2.30–$2.60/mi (Scale Funding, ACT, O Trucking)
//   • CA outbound (LA/Long Beach/Central Valley) $3.00–$3.50/mi — CARB + driver
//     shortage → hottest origin (DAT/CHR regional, Truck Dispatch Experts 2026)
//   • Midwest core strongest van region $2.58/mi, corridor $2.82 (Keynnect 2026)
//   • PNW→East premium long-haul $2.80–$3.20 (O Trucking 2026)
//   • SE produce corridors + TX cross-border +30–40% surge (CHR 2026)
//   • Mountain/N. Plains (MT/WY/ID/ND/SD): low load-to-truck, sparse van freight
//   • Northeast import-heavy → soft outbound; FL/Laredo = backhaul traps
// Values are RELATIVE to the national baseline (1.00). Re-tune as markets move.
const ORIGIN_STRENGTH: Record<string, number> = {
  // Hot — tightest outbound markets in the country
  CA: 1.15,
  // Strong — major freight generators / premium outbound
  TX: 1.08, IL: 1.08, IN: 1.08, OH: 1.08, MI: 1.08, WI: 1.08, WA: 1.08, OR: 1.08,
  // Solid — strong regional hubs and produce corridors
  GA: 1.04, NC: 1.04, SC: 1.04, TN: 1.04, MN: 1.04, IA: 1.04, MO: 1.04, KS: 1.04,
  // Average — national-typical outbound
  FL: 1.00, AL: 1.00, KY: 1.00, AR: 1.00, LA: 1.00, MS: 1.00, OK: 1.00, VA: 1.00,
  AZ: 1.00, NV: 1.00, UT: 1.00, CO: 1.00, NM: 1.00,
  // Soft — import-heavy / repositioning markets (Northeast favors inbound)
  NY: 0.95, NJ: 0.95, PA: 0.95, CT: 0.95, RI: 0.95, MA: 0.95, VT: 0.95, NH: 0.95,
  ME: 0.95, MD: 0.95, DE: 0.95, DC: 0.95, WV: 0.95, NE: 0.95,
  // Sparse — low freight density, van positioning risk
  MT: 0.90, WY: 0.90, ID: 0.90, ND: 0.90, SD: 0.90,
  // Non-contiguous — thin lanes, treat as average-soft
  AK: 0.95, HI: 0.95,
};

const GEO_NEUTRAL = 1.0;

// Destination "reload difficulty" coefficient: how much a weak destination
// market lifts the fair rate (deadhead compensation). Small and capped so it
// never dominates the origin signal.
const RELOAD_K = 0.25;

function originStrength(state?: string): number {
  if (!state) return GEO_NEUTRAL;
  return ORIGIN_STRENGTH[state.toUpperCase()] ?? GEO_NEUTRAL;
}

/**
 * Combined geographic multiplier for an origin→destination lane.
 *   geo = originStrength × reloadAdjustment(destination)
 * Returns 1.0 (neutral) when either endpoint is unknown — e.g. a quick eval
 * with only miles + rate. Clamped so combined extremes can never go absurd.
 */
export function getGeoMultiplier(originState?: string, destState?: string): number {
  const origin = originStrength(originState);

  // Weak destination (low strength) → harder reload → slight upward nudge.
  // Hot destination → easy reload → slight downward nudge. Capped at ±5%.
  let reload = GEO_NEUTRAL;
  if (destState) {
    const destStrength = originStrength(destState);
    reload = 1 + (1 - destStrength) * RELOAD_K;
    reload = Math.max(0.95, Math.min(1.05, reload));
  }

  const geo = origin * reload;
  return Math.max(0.82, Math.min(1.25, geo));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getDistanceBand(miles: number): DistanceBand {
  if (miles <= 50)   return 'micro';
  if (miles <= 100)  return 'local';
  if (miles <= 250)  return 'short';
  if (miles <= 500)  return 'medium';
  if (miles <= 1000) return 'standard';
  if (miles <= 2000) return 'long';
  return 'mega';
}

function getSeasonalMult(): number {
  const month = new Date().getMonth() + 1; // 1–12
  return SEASONAL_INDEX[month] ?? 1.0;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface MarketRateResult {
  minTotal:        number;       // Low end of fair range ($)
  maxTotal:        number;       // High end of fair range ($)
  minRPM:          number;       // Low end $/mi (informational)
  maxRPM:          number;       // High end $/mi (informational)
  distanceBand:    DistanceBand;
  loadType:        LoadType;
  verdict:         'strong' | 'fair' | 'low' | 'very_low';
  percentOfMarket: number;       // 100 = at midpoint of fair range
  floorApplied:    boolean;      // true when minimum floor overrode per-mile calc
  geoMult:         number;       // applied geographic multiplier (1.0 = neutral/unknown)
  confidence:      RateConfidence; // how sure the model is — drives range width + UI label
}

// ── Core rate function ────────────────────────────────────────────────────────

export function getFairMarketRate(
  miles:       number,
  loadType:    LoadType,
  grossPay?:   number,
  originState?: string,
  destState?:   string,
): MarketRateResult {
  const band     = getDistanceBand(miles);
  const distMult = getDistanceMultiplier(miles);
  const seasonal = getSeasonalMult();
  const geo      = getGeoMultiplier(originState, destState);

  // Confidence in the model estimate → drives how wide a range we present.
  // Geography is the biggest variable, so not knowing it lowers confidence;
  // short flat-rated hauls and project freight are inherently negotiated.
  let confidence: RateConfidence = (originState && destState) ? 'high' : 'medium';
  if (band === 'micro' || band === 'local' || loadType === 'rgn') confidence = 'low';

  const spread = loadType === 'rgn' ? SPREAD_RGN : SPREAD_BY_CONFIDENCE[confidence];

  // Mid-market rate per mile
  const midRPM = activeBaseline
    * EQUIPMENT_MULT[loadType]
    * distMult
    * seasonal
    * geo;

  const minRPM = midRPM * (1 - spread);
  const maxRPM = midRPM * (1 + spread);

  // Per-mile totals before floor
  const rawMin = minRPM * miles;
  const rawMax = maxRPM * miles;

  // Apply minimum floor — short hauls are flat-rated in practice
  const floor       = MINIMUM_FLOOR[loadType];
  const floorMin    = floor;
  const floorMax    = floor * (1 + spread * 0.8);   // upper floor slightly wider
  const floorApplied = rawMin < floorMin;

  const minTotal = Math.round(Math.max(floorMin, rawMin));
  const maxTotal = Math.round(Math.max(floorMax, rawMax));
  const midTotal = (minTotal + maxTotal) / 2;

  // Verdict & market % (compare total $ so floor loads are scored correctly)
  let verdict: MarketRateResult['verdict'] = 'fair';
  let percentOfMarket = 100;

  if (grossPay !== undefined && grossPay > 0) {
    percentOfMarket = Math.round((grossPay / midTotal) * 100);

    if (grossPay >= maxTotal)              verdict = 'strong';
    else if (grossPay >= minTotal)         verdict = 'fair';
    else if (grossPay >= minTotal * 0.85)  verdict = 'low';
    else                                   verdict = 'very_low';
  }

  return {
    minTotal,
    maxTotal,
    minRPM: Math.round(minRPM * 1000) / 1000,
    maxRPM: Math.round(maxRPM * 1000) / 1000,
    distanceBand: band,
    loadType,
    verdict,
    percentOfMarket,
    floorApplied,
    geoMult: Math.round(geo * 1000) / 1000,
    confidence,
  };
}

// ── Expense / frequency helpers (unchanged) ───────────────────────────────────

export type ExpenseFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

export const FREQUENCY_TO_MONTHLY: Record<ExpenseFrequency, number> = {
  daily:      30.44,
  weekly:     4.333,
  biweekly:   2.167,
  monthly:    1,
  quarterly:  0.3333,
  semiannual: 0.1667,
  annual:     0.08333,
};

export function toMonthlyAmount(amount: number, frequency: ExpenseFrequency): number {
  return amount * FREQUENCY_TO_MONTHLY[frequency];
}

// Calculate break-even rate per mile
export function calcBreakEven(
  monthlyFuelCost: number,
  monthlyFixedCosts: number,
  monthlyMiles: number
): { breakEvenRPM: number; fuelCPM: number; fixedCPM: number } {
  if (monthlyMiles <= 0) return { breakEvenRPM: 0, fuelCPM: 0, fixedCPM: 0 };
  const fuelCPM  = monthlyFuelCost / monthlyMiles;
  const fixedCPM = monthlyFixedCosts / monthlyMiles;
  return { breakEvenRPM: fuelCPM + fixedCPM, fuelCPM, fixedCPM };
}

// Calculate deadhead cost (how much an empty leg costs)
export function calcDeadheadCost(miles: number, fuelCPM: number, fixedCPM: number): number {
  return miles * (fuelCPM + fixedCPM);
}
