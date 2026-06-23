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
// Update BASELINE_DRY_VAN quarterly from Scale Funding free rate page or
// Trucking Dive rate tracker — no subscription required.
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
// Source: 2026 national average. Update quarterly from public sources.
const BASELINE_DRY_VAN = 2.50;

// ── Equipment multipliers (relative to dry van = 1.0) ────────────────────────
// Sources: 2026 spot market averages; reefer +$0.39/mi over van (national);
// flatbed +$0.25–$0.45/mi; hazmat premium baked in (cert cost + risk).
const EQUIPMENT_MULT: Record<LoadType, number> = {
  dry_van:       1.00,
  reefer:        1.20,   // +$0.40–$0.50/mi; temperature control premium
  flatbed:       1.18,   // +$0.25–$0.45/mi; tarping, securement labor
  step_deck:     1.40,   // 40% premium; 20% fewer capable carriers than std flatbed
  intermodal:    0.88,   // −12%; rail leg reduces carrier cost but limits flexibility
  tanker:        1.13,   // +13%; CDL + tanker endorsement, cleaning requirements
  hazmat:        1.38,   // +38%; hazmat certification + placard liability
  rgn:           1.80,   // +80% floor; wide range ($3.50–$20+/mi — project-rated)
  power_only:    0.85,   // −15%; no trailer overhead but limited freight options
  auto_transport: 1.10,  // +10%; per-car pricing structure, equivalent FTL RPM
};

// ── Distance band multipliers (relative to standard 501–1000 mi = 1.0) ───────
// Short hauls have high $/mi because fixed costs (loading, detention, paperwork)
// are spread over fewer miles. Under 150 mi, minimum floor often overrides $/mi.
type DistanceBand = 'micro' | 'local' | 'short' | 'medium' | 'standard' | 'long' | 'mega';

const DISTANCE_MULT: Record<DistanceBand, number> = {
  micro:    1.85,   // ≤50 mi  — floor almost always binding; $4–$8/mi if billed
  local:    1.58,   // 51–100 mi — often flat-rated; floor frequently binding
  short:    1.30,   // 101–250 mi — per-mile pricing takes over
  medium:   1.14,   // 251–500 mi
  standard: 1.00,   // 501–1,000 mi — baseline band
  long:     0.90,   // 1,001–2,000 mi
  mega:     0.84,   // 2,001+ mi — longest hauls have lowest $/mi
};

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
// Reflects the typical regional variance in spot rates (~±13% nationally).
// RGN is wider because project freight is highly quote-specific.
const SPREAD_DEFAULT = 0.13;
const SPREAD_RGN     = 0.30;  // wider — heavy haul is extremely quote-specific

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDistanceBand(miles: number): DistanceBand {
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
}

// ── Core rate function ────────────────────────────────────────────────────────

export function getFairMarketRate(
  miles:     number,
  loadType:  LoadType,
  grossPay?: number,
): MarketRateResult {
  const band     = getDistanceBand(miles);
  const seasonal = getSeasonalMult();
  const spread   = loadType === 'rgn' ? SPREAD_RGN : SPREAD_DEFAULT;

  // Mid-market rate per mile
  const midRPM = BASELINE_DRY_VAN
    * EQUIPMENT_MULT[loadType]
    * DISTANCE_MULT[band]
    * seasonal;

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
