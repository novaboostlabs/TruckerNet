// The per-load money math, in one place. Check Load, Add Load and the
// database's recalculation all use this, so the same load can't produce a
// different net or verdict depending on which screen did the arithmetic.
//
// Miles:
//   loadedMiles   — pickup → delivery. Paid miles: what the broker's rate is
//                   quoted on, what fair-market and the rate pool compare.
//   deadheadMiles — empty miles driven TO the pickup. Unpaid, but the truck
//                   burns the same fuel and wears the same per-mile fixed
//                   costs. Ignoring them showed money-losing loads as green.
//   drivenMiles   — loaded + deadhead: what the load actually costs to run.

export type Verdict = 'green' | 'amber' | 'red';

export interface LoadEconomicsInput {
  gross:          number;
  loadedMiles:    number;
  deadheadMiles?: number;
  fuelCPM:        number;
  fixedCPM:       number;
  /** Per-load extras: tolls, lumper, scale… */
  extras?:        number;
}

export interface LoadEconomics {
  drivenMiles: number;
  fuelCost:    number;
  fixedCost:   number;
  netPay:      number;
  /** gross ÷ loaded miles — the broker's quoted rate. */
  grossRPM:    number;
  /** gross ÷ driven miles — the rate to hold against break-even. */
  allInRPM:    number;
  /** net ÷ driven miles — margin per mile actually driven. */
  netRPM:      number;
}

const safeMiles = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

export function computeLoadEconomics(i: LoadEconomicsInput): LoadEconomics {
  const loaded   = safeMiles(i.loadedMiles);
  const deadhead = safeMiles(i.deadheadMiles);
  const driven   = loaded + deadhead;
  const fuelCost  = driven * i.fuelCPM;
  const fixedCost = driven * i.fixedCPM;
  const netPay    = i.gross - fuelCost - fixedCost - (i.extras ?? 0);
  return {
    drivenMiles: driven,
    fuelCost,
    fixedCost,
    netPay,
    grossRPM: loaded > 0 ? i.gross / loaded : 0,
    allInRPM: driven > 0 ? i.gross / driven : 0,
    netRPM:   driven > 0 ? netPay / driven : 0,
  };
}

/**
 * Costs are already inside netRPM, so profitable = netRPM ≥ 0; green adds a
 * cushion of 15% of break-even (≡ gross ≥ 1.15 × the load's running cost).
 * Comparing netRPM to break-even itself double-counts costs (2026-07-31 bug).
 * Null when there's no break-even to judge against.
 */
export function verdictFor(netRPM: number, breakEvenRPM: number): Verdict | null {
  if (!(breakEvenRPM > 0)) return null;
  if (netRPM >= breakEvenRPM * 0.15) return 'green';
  if (netRPM >= 0) return 'amber';
  return 'red';
}
