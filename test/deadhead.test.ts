import { describe, expect, it } from 'vitest';
import { computeLoadEconomics, verdictFor } from '../src/lib/loadEconomics';
import {
  addSingleLoadExpense,
  getAllLoads,
  getLoadById,
  getMonthlyMilesDetail,
  getWeekPnL,
  mergeLoads,
  clearAllUserData,
} from '../src/db/database';
import { load } from './support/fixtures';

// Break-even $1.60/mi: $0.60 fuel + $1.00 fixed.
const FUEL = 0.6, FIXED = 1.0, BE = FUEL + FIXED;

describe('deadhead to pickup is costed', () => {
  it('turns a "green" load red when the empty run to pickup eats the margin', () => {
    const near = computeLoadEconomics({ gross: 1000, loadedMiles: 500, fuelCPM: FUEL, fixedCPM: FIXED });
    expect(near.netPay).toBeCloseTo(200, 6);
    expect(verdictFor(near.netRPM, BE)).toBe('green');

    const far = computeLoadEconomics({ gross: 1000, loadedMiles: 500, deadheadMiles: 150, fuelCPM: FUEL, fixedCPM: FIXED });
    expect(far.drivenMiles).toBe(650);
    expect(far.netPay).toBeCloseTo(-40, 6);                    // 1000 − 650 × 1.60
    expect(verdictFor(far.netRPM, BE)).toBe('red');
  });

  it('keeps the broker rate on loaded miles, and judges per mile driven', () => {
    const e = computeLoadEconomics({ gross: 2000, loadedMiles: 800, deadheadMiles: 200, fuelCPM: FUEL, fixedCPM: FIXED, extras: 50 });
    expect(e.grossRPM).toBeCloseTo(2.5, 6);                    // what the broker quoted
    expect(e.allInRPM).toBeCloseTo(2.0, 6);                    // per mile actually driven
    expect(e.netPay).toBeCloseTo(2000 - 1000 * BE - 50, 6);
    expect(e.netRPM).toBeCloseTo(e.netPay / 1000, 6);
    // Without extras, the margin over break-even is exactly all-in − BE.
    const plain = computeLoadEconomics({ gross: 2000, loadedMiles: 800, deadheadMiles: 200, fuelCPM: FUEL, fixedCPM: FIXED });
    expect(plain.netRPM).toBeCloseTo(plain.allInRPM - BE, 9);
  });

  it('treats junk deadhead input as zero', () => {
    for (const d of [NaN, -50, undefined]) {
      expect(computeLoadEconomics({ gross: 1000, loadedMiles: 500, deadheadMiles: d, fuelCPM: FUEL, fixedCPM: FIXED }).drivenMiles).toBe(500);
    }
  });

  it('no break-even → no verdict', () => {
    expect(verdictFor(0.5, 0)).toBeNull();
  });
});

describe('deadhead in the database', () => {
  const saveWithDeadhead = (date = '2026-10-06') => {
    const e = computeLoadEconomics({ gross: 2000, loadedMiles: 800, deadheadMiles: 200, fuelCPM: FUEL, fixedCPM: FIXED });
    return load({
      date, gross_pay: 2000, total_miles: 800, deadhead_miles: 200,
      fuel_cost_for_load: e.fuelCost, fixed_cost_for_load: e.fixedCost, net_pay: e.netPay,
      gross_rate_per_mile: e.grossRPM, net_rate_per_mile: e.netRPM, verdict: verdictFor(e.netRPM, BE)!,
    });
  };

  it('re-costing after an edit keeps judging per mile driven', () => {
    const id = saveWithDeadhead();
    addSingleLoadExpense(id, { label: 'Lumper', category: 'lumper', amount: 100 });
    const l = getLoadById(id)!;
    expect(l.deadhead_miles).toBe(200);
    expect(l.net_pay).toBeCloseTo(2000 - 1000 * BE - 100, 6);              // $300
    expect(l.net_rate_per_mile).toBeCloseTo(l.net_pay / 1000, 6);           // per mile driven
    expect(l.gross_rate_per_mile).toBeCloseTo(2.5, 6);                      // per loaded mile
    expect(l.verdict).toBe('green');                                         // $0.30 ≥ 15% × $1.60
  });

  it('deadhead miles count as miles driven for the week and the miles engine', () => {
    saveWithDeadhead('2026-10-05');
    expect(getWeekPnL().miles).toBe(1000);
    for (let i = 0; i < 6; i++) saveWithDeadhead(`2026-09-${String(1 + i * 6).padStart(2, '0')}`);
    // 7 loads × 1,000 DRIVEN mi, Sep 1 → Oct 5 (34 days, 6 gaps):
    // 7,000 × 6/7 ÷ 34 × 30. Loaded miles alone would give 4,800 ÷ 34 × 30.
    expect(getMonthlyMilesDetail().realMonthly).toBeCloseTo((6000 / 34) * 30, 6);
  });

  it('round-trips through a cloud restore', () => {
    const id = saveWithDeadhead();
    const row = getAllLoads().find((l) => l.id === id)!;
    expect(row.deadhead_miles).toBe(200);
    clearAllUserData();
    mergeLoads([row], []);
    expect(getLoadById(id)!.deadhead_miles).toBe(200);
  });
});
