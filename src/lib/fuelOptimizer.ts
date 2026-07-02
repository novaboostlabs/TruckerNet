// Tax-adjusted fuel-stop optimizer ("Where to Fuel").
//
// The insight drivers pay ProMiles for: IFTA settles fuel tax by where you
// DRIVE, not where you BUY. Tax paid at the pump is a credit against the tax
// you owe on miles driven, so the real cost of a gallon is:
//
//   effective price = pump price − that state's diesel tax
//
// The cheapest-looking pump is routinely NOT the cheapest gallon — a lower
// pre-tax price in the next state over can flip the answer by $0.20–0.40/gal,
// which is $30–60 on a single fill. This module ranks the states on a route
// by effective price and estimates the savings vs. fueling naively.
//
// Data: seeded tables (like the fair-market benchmark model). Taxes are
// per-gallon state diesel rates; prices are state retail averages. Both are
// ESTIMATES — the UI must label them as such ("state averages, not station
// prices") and show the as-of date. Refresh cadence: update alongside the
// seeded benchmark rates (every 4–6 weeks) until a live price feed exists.

/** When the seeded tables below were last refreshed (shown in the UI). */
export const FUEL_DATA_AS_OF = '2026-06';

// State diesel tax, $/gallon — seeded approximations of published rates.
// Note OR: Oregon levies a weight-mile tax on heavy trucks instead of a pump
// diesel tax, so its pump price is already close to its effective price (the
// weight-mile tax is owed regardless of where you fuel). Modeled as 0 here.
const STATE_DIESEL_TAX: Record<string, number> = {
  AL: 0.30, AZ: 0.26, AR: 0.29, CA: 0.93, CO: 0.23, CT: 0.49, DE: 0.22,
  FL: 0.38, GA: 0.37, ID: 0.33, IL: 0.75, IN: 0.57, IA: 0.33, KS: 0.26,
  KY: 0.25, LA: 0.20, ME: 0.31, MD: 0.37, MA: 0.24, MI: 0.51, MN: 0.29,
  MS: 0.18, MO: 0.25, MT: 0.30, NE: 0.25, NV: 0.27, NH: 0.22, NJ: 0.45,
  NM: 0.22, NY: 0.44, NC: 0.41, ND: 0.23, OH: 0.47, OK: 0.19, OR: 0.00,
  PA: 0.74, RI: 0.34, SC: 0.28, SD: 0.28, TN: 0.27, TX: 0.20, UT: 0.37,
  VT: 0.32, VA: 0.31, WA: 0.49, WV: 0.36, WI: 0.33, WY: 0.24,
};

// State average retail diesel price, $/gallon — seeded estimates.
const STATE_DIESEL_PRICE: Record<string, number> = {
  AL: 3.30, AZ: 3.75, AR: 3.30, CA: 5.15, CO: 3.60, CT: 4.15, DE: 3.55,
  FL: 3.55, GA: 3.35, ID: 3.85, IL: 3.85, IN: 3.80, IA: 3.40, KS: 3.40,
  KY: 3.55, LA: 3.30, ME: 3.95, MD: 3.75, MA: 4.05, MI: 3.65, MN: 3.50,
  MS: 3.25, MO: 3.35, MT: 3.75, NE: 3.45, NV: 4.05, NH: 3.85, NJ: 3.75,
  NM: 3.55, NY: 4.15, NC: 3.50, ND: 3.55, OH: 3.60, OK: 3.25, OR: 4.35,
  PA: 4.05, RI: 4.00, SC: 3.35, SD: 3.55, TN: 3.35, TX: 3.30, UT: 3.85,
  VT: 3.95, VA: 3.55, WA: 4.55, WV: 3.75, WI: 3.55, WY: 3.55,
};

// Ignore states the route barely clips — you can't realistically plan a fill
// around 12 miles of Maryland panhandle.
const MIN_PLANNABLE_MILES = 30;

// Typical tractor fill: ~120 usable gallons across duals. Used only for the
// savings ESTIMATE; the per-gallon delta is the trustworthy number.
const FILL_GALLONS = 120;

export interface FuelStopOption {
  state:          string;  // 2-letter
  miles:          number;  // route miles in this state
  pumpPrice:      number;  // $/gal, state average (seeded)
  taxPerGallon:   number;  // $/gal state diesel tax (seeded)
  effectivePrice: number;  // pumpPrice − taxPerGallon
}

export interface FuelStopPlan {
  /** All plannable on-route states, cheapest EFFECTIVE price first. */
  options:       FuelStopOption[];
  /** The recommended state to fuel in (lowest effective price). */
  best:          FuelStopOption;
  /** The state a driver would naively pick (lowest PUMP price). */
  naive:         FuelStopOption;
  /** True when the tax math flips the answer away from the cheap-looking pump. */
  flipped:       boolean;
  /** Effective $/gal saved: naive.effectivePrice − best.effectivePrice. */
  savingsPerGallon: number;
  /** savingsPerGallon × a typical ~120-gal fill (estimate for display). */
  estSavingsPerFill: number;
  dataAsOf:      string;
}

/**
 * Rank the states on a route by tax-adjusted diesel price.
 * `stateMiles` is the per-state breakdown already computed for IFTA.
 * Returns null when fewer than two plannable states have seeded data —
 * a one-state route has no fueling decision to optimize.
 */
export function planFuelStops(
  stateMiles: { state: string; miles: number }[]
): FuelStopPlan | null {
  const options: FuelStopOption[] = stateMiles
    .filter(s => s.miles >= MIN_PLANNABLE_MILES)
    .map(s => {
      const st = s.state.toUpperCase();
      const pumpPrice = STATE_DIESEL_PRICE[st];
      const tax       = STATE_DIESEL_TAX[st];
      if (pumpPrice == null || tax == null) return null;
      return {
        state:          st,
        miles:          s.miles,
        pumpPrice,
        taxPerGallon:   tax,
        effectivePrice: pumpPrice - tax,
      };
    })
    .filter((o): o is FuelStopOption => o !== null);

  if (options.length < 2) return null;

  options.sort((a, b) => a.effectivePrice - b.effectivePrice);
  const best  = options[0];
  const naive = options.reduce((min, o) => (o.pumpPrice < min.pumpPrice ? o : min), options[0]);

  const savingsPerGallon = Math.max(0, naive.effectivePrice - best.effectivePrice);

  return {
    options,
    best,
    naive,
    flipped: best.state !== naive.state,
    savingsPerGallon,
    estSavingsPerFill: Math.round(savingsPerGallon * FILL_GALLONS),
    dataAsOf: FUEL_DATA_AS_OF,
  };
}
