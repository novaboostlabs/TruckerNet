// ─────────────────────────────────────────────────────────────
// TruckerNet Fair Market Rate Engine
//
// Source: Industry averages based on DAT/Truckstop data patterns.
// Future: calibrated by anonymized user reports submitted in-app.
//
// Rates are per-mile. The app shows TOTAL amount to user.
// CPM is backend-only.
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

// Distance bands in miles
type DistanceBand = 'local' | 'short' | 'medium' | 'long' | 'xlong' | 'mega';

function getDistanceBand(miles: number): DistanceBand {
  if (miles <= 100)  return 'local';
  if (miles <= 250)  return 'short';
  if (miles <= 500)  return 'medium';
  if (miles <= 750)  return 'long';
  if (miles <= 1200) return 'xlong';
  return 'mega';
}

// Rate table: [min, max] per mile by load type and distance band
// Rates reflect 2024-2025 national averages
const RATE_TABLE: Record<LoadType, Record<DistanceBand, [number, number]>> = {
  dry_van: {
    local:  [2.80, 3.50],
    short:  [2.50, 3.10],
    medium: [2.20, 2.80],
    long:   [2.00, 2.55],
    xlong:  [1.90, 2.40],
    mega:   [1.80, 2.25],
  },
  reefer: {
    local:  [3.10, 3.90],
    short:  [2.80, 3.50],
    medium: [2.50, 3.15],
    long:   [2.30, 2.90],
    xlong:  [2.15, 2.75],
    mega:   [2.05, 2.60],
  },
  flatbed: {
    local:  [3.00, 3.80],
    short:  [2.70, 3.40],
    medium: [2.40, 3.05],
    long:   [2.20, 2.80],
    xlong:  [2.10, 2.65],
    mega:   [1.95, 2.50],
  },
  step_deck: {
    local:  [3.10, 3.90],
    short:  [2.75, 3.50],
    medium: [2.45, 3.10],
    long:   [2.25, 2.85],
    xlong:  [2.15, 2.70],
    mega:   [2.00, 2.55],
  },
  intermodal: {
    local:  [2.50, 3.20],
    short:  [2.20, 2.80],
    medium: [2.00, 2.55],
    long:   [1.85, 2.35],
    xlong:  [1.75, 2.20],
    mega:   [1.65, 2.10],
  },
  tanker: {
    local:  [3.20, 4.00],
    short:  [2.90, 3.60],
    medium: [2.60, 3.25],
    long:   [2.40, 3.00],
    xlong:  [2.25, 2.85],
    mega:   [2.10, 2.70],
  },
  hazmat: {
    local:  [3.60, 4.50],
    short:  [3.20, 4.00],
    medium: [2.90, 3.65],
    long:   [2.65, 3.35],
    xlong:  [2.50, 3.15],
    mega:   [2.35, 3.00],
  },
  rgn: {
    local:  [4.00, 5.50],
    short:  [3.50, 4.80],
    medium: [3.10, 4.20],
    long:   [2.80, 3.80],
    xlong:  [2.60, 3.50],
    mega:   [2.40, 3.20],
  },
  power_only: {
    local:  [2.60, 3.30],
    short:  [2.30, 2.95],
    medium: [2.05, 2.65],
    long:   [1.90, 2.45],
    xlong:  [1.80, 2.30],
    mega:   [1.70, 2.15],
  },
  auto_transport: {
    // Auto transport is priced per car, not per mile.
    // Showing equivalent RPM for a typical 7-car load
    local:  [2.40, 3.20],
    short:  [2.10, 2.80],
    medium: [1.90, 2.55],
    long:   [1.75, 2.35],
    xlong:  [1.65, 2.20],
    mega:   [1.55, 2.05],
  },
};

export interface MarketRateResult {
  minTotal: number;        // Min fair total payout ($)
  maxTotal: number;        // Max fair total payout ($)
  minRPM: number;          // Min rate per mile
  maxRPM: number;          // Max rate per mile
  distanceBand: DistanceBand;
  loadType: LoadType;
  verdict: 'strong' | 'fair' | 'low' | 'very_low';
  percentOfMarket: number; // e.g. 85 = driver is getting 85% of fair market
}

export function getFairMarketRate(
  miles: number,
  loadType: LoadType,
  grossPay?: number
): MarketRateResult {
  const band = getDistanceBand(miles);
  const [minRPM, maxRPM] = RATE_TABLE[loadType][band];
  const minTotal = Math.round(minRPM * miles);
  const maxTotal = Math.round(maxRPM * miles);
  const midRPM   = (minRPM + maxRPM) / 2;

  let verdict: MarketRateResult['verdict'] = 'fair';
  let percentOfMarket = 100;

  if (grossPay !== undefined && grossPay > 0) {
    const driverRPM = grossPay / miles;
    percentOfMarket = Math.round((driverRPM / midRPM) * 100);

    if (driverRPM >= maxRPM)              verdict = 'strong';
    else if (driverRPM >= minRPM)         verdict = 'fair';
    else if (driverRPM >= minRPM * 0.85)  verdict = 'low';
    else                                   verdict = 'very_low';
  }

  return { minTotal, maxTotal, minRPM, maxRPM, distanceBand: band, loadType, verdict, percentOfMarket };
}

// Frequency → monthly multiplier
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
