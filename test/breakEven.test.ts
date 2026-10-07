import { describe, expect, it } from 'vitest';
import {
  addSingleLoadExpense,
  calcBreakEven,
  getLoadById,
  getMonthlyMilesDetail,
} from '../src/db/database';
import { fuelEntry, load, monthlyExpenses, onboard } from './support/fixtures';

describe('break-even (the number every verdict is judged against)', () => {
  it('is zero until the driver has told us their miles', () => {
    monthlyExpenses({ truck: 2500 });
    expect(calcBreakEven().breakEvenRPM).toBe(0);
  });

  it('= fuel CPM + fixed costs ÷ monthly miles, from onboarding answers alone', () => {
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });          // $0.60/mi fuel
    monthlyExpenses({ truck: 2500, insurance: 1200, eld: 50 }); // $3,750/mo
    const be = calcBreakEven();
    const monthlyMiles = 2500 * 4.333;
    expect(be.milesSource).toBe('estimate');
    expect(be.fuelCPM).toBeCloseTo(0.60, 6);
    expect(be.fixedCPM).toBeCloseTo(3750 / monthlyMiles, 6);
    expect(be.breakEvenRPM).toBeCloseTo(0.60 + 3750 / monthlyMiles, 6);
  });

  it('excludes the fuel expense category so fuel is never counted twice', () => {
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });
    monthlyExpenses({ truck: 2500, fuel: 6000 });
    expect(calcBreakEven().fixedCPM).toBeCloseTo(2500 / (2500 * 4.333), 6);
  });
});

describe('monthly miles engine', () => {
  it('trusts a full month of odometer readings over the stated estimate', () => {
    onboard({ weeklyMiles: 1000 });
    // 5 fills over 30 days, 12,000 odometer miles → 12,000 mi/month, full confidence.
    [0, 7, 15, 22, 30].forEach((d, i) => {
      const date = new Date(2026, 8, 1 + d);
      fuelEntry({
        date: `2026-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        odometer_reading: 500_000 + i * 3000,
      });
    });
    const m = getMonthlyMilesDetail();
    expect(m.source).toBe('odometer');
    expect(m.confidence).toBe(1);
    expect(m.monthlyMiles).toBe(12_000);
  });

  it('ignores a mistyped odometer that implies an impossible pace', () => {
    onboard({ weeklyMiles: 2500 });
    fuelEntry({ date: '2026-09-01', odometer_reading: 500_000 });
    fuelEntry({ date: '2026-09-10', odometer_reading: 5_000_000 }); // extra digit
    expect(getMonthlyMilesDetail().source).toBe('estimate');
  });
});

describe('load verdict (regression: 2026-07-31 double-count fix)', () => {
  // Break-even ≈ $1.15/mi. A load's stored net already has fuel+fixed taken
  // out, so the verdict must compare net RPM to 0 (and a 15% cushion), never
  // to break-even itself.
  const setup = () => {
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });
    monthlyExpenses({ truck: 6000 });
    return calcBreakEven().breakEvenRPM;
  };

  it('a load paying well over break-even is green, and per-load costs move it down', () => {
    const be = setup();
    const id = load({
      gross_pay: 2000, total_miles: 1000,
      fuel_cost_for_load: 600, fixed_cost_for_load: 1000 * (be - 0.6),
    });

    addSingleLoadExpense(id, { label: 'Lumper', category: 'lumper', amount: 50 });
    let l = getLoadById(id)!;
    expect(l.net_pay).toBeCloseTo(2000 - 1000 * be - 50, 6);
    expect(l.verdict).toBe('green');

    // Eat into the cushion but stay profitable → amber.
    addSingleLoadExpense(id, { label: 'Tolls', category: 'toll', amount: 700 });
    l = getLoadById(id)!;
    expect(l.net_pay).toBeGreaterThan(0);
    expect(l.verdict).toBe('amber');

    // Now losing money → red.
    addSingleLoadExpense(id, { label: 'Repair', category: 'other', amount: 200 });
    expect(getLoadById(id)!.verdict).toBe('red');
  });

  it('a load at 1.3× break-even is NOT red (the old bug demanded 2× gross)', () => {
    const be = setup();
    const miles = 1000;
    const id = load({
      gross_pay: 1.3 * be * miles, total_miles: miles,
      fuel_cost_for_load: 600, fixed_cost_for_load: miles * (be - 0.6),
    });
    addSingleLoadExpense(id, { label: 'Scale', category: 'scale', amount: 0.01 });
    expect(getLoadById(id)!.verdict).toBe('green');
  });
});
