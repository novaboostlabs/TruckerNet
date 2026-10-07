import { describe, expect, it, vi } from 'vitest';
import {
  addSingleLoadExpense,
  calcBreakEven,
  consecutiveWeeksOverBreakEven,
  getLoadById,
  getMonthlyMilesDetail,
  getSetting,
  getTaxSetAside,
  initDatabase,
  setSetting,
} from '../src/db/database';
import { db } from './support/nodeSqlite';
import { load, monthlyExpenses, onboard } from './support/fixtures';

const at = (iso: string) => vi.setSystemTime(new Date(`${iso}T12:00:00`));

describe('estimated-tax set-aside', () => {
  it('"this quarter" follows IRS payment periods (Sep–Dec), not calendar quarters', () => {
    at('2026-10-07');
    load({ date: '2026-09-15', gross_pay: 3000, total_miles: 1000, net_pay: 2000 });
    expect(getTaxSetAside().quarterNet).toBe(2000);   // was 0 — September was dropped
  });

  it('Jun–Aug period includes June', () => {
    at('2026-07-10');
    load({ date: '2026-06-10', gross_pay: 3000, total_miles: 1000, net_pay: 1500 });
    expect(getTaxSetAside().quarterNet).toBe(1500);
  });

  it.each([
    ['2026-10-07', '2027-01-15'],
    ['2027-01-05', '2027-01-15'],   // Q4 payment due THIS month — was skipped to Apr 15
    ['2027-01-15', '2027-01-15'],   // due today still counts
    ['2026-06-02', '2026-06-15'],   // 2026's is the 15th (a Monday), not a hard-coded 16th
    ['2027-12-01', '2028-01-17'],   // Jan 15, 2028 is a Saturday → Monday (holidays not modeled)
  ])('on %s the next deadline is %s', (today, due) => {
    at(today);
    expect(getTaxSetAside().nextDeadlineDate).toBe(due);
  });
});

describe('weeks-over-break-even streak (regression: same double-count as the verdict)', () => {
  it('counts weeks whose loads cleared their costs', () => {
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });
    monthlyExpenses({ truck: 6000 });
    const be = calcBreakEven().breakEvenRPM;
    // Two consecutive weeks of loads at 1.3× break-even gross → positive net.
    for (const date of ['2026-10-05', '2026-09-28']) {
      const gross = 1.3 * be * 1000;
      load({ date, gross_pay: gross, total_miles: 1000, net_pay: gross - be * 1000 });
    }
    expect(consecutiveWeeksOverBreakEven()).toBe(2);   // was 0
  });
});

describe('monthly miles from completed loads', () => {
  it('n loads span n−1 gaps — the last load is driven after the span ends', () => {
    // 6 loads × 1,500 mi, one every 6 days → 7,500 mi per 30 days.
    for (let i = 0; i < 6; i++) {
      const d = new Date(2026, 8, 1 + i * 6);
      const iso = `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      load({ date: iso, gross_pay: 3000, total_miles: 1500 });
    }
    const m = getMonthlyMilesDetail();
    expect(m.source).toBe('loads_90d');
    expect(m.realMonthly).toBeCloseTo(7500, 6);   // was 9,000
  });
});

describe('verdict after editing a load', () => {
  it('is judged against the costs the load was priced at, not today’s break-even', () => {
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });
    monthlyExpenses({ truck: 6000 });
    const be = calcBreakEven().breakEvenRPM;                       // ≈ $1.15
    const id = load({
      gross_pay: 1400, total_miles: 1000,
      fuel_cost_for_load: 600, fixed_cost_for_load: 1000 * (be - 0.6),
    });
    // Expenses later double — today's break-even is now far higher.
    monthlyExpenses({ truck: 12000 });
    addSingleLoadExpense(id, { label: 'Scale', category: 'scale', amount: 10 });
    const l = getLoadById(id)!;
    expect(l.net_pay).toBeCloseTo(1400 - 1000 * be - 10, 6);
    // net/mi ≈ $0.24 ≥ 15% of the load's own ~$1.15 → still green.
    expect(l.verdict).toBe('green');
  });
});

describe('2026-07-31 verdict backfill', () => {
  it('waits until there is a break-even to backfill against', () => {
    // Fresh install: no break-even yet → the backfill can't run and must not be marked done.
    expect(getSetting('verdict_fix_2026_07_31')).toBeNull();

    // A cloud restore lands loads still carrying the old double-counted verdict.
    onboard({ weeklyMiles: 2500, weeklyFuel: 1500 });
    monthlyExpenses({ truck: 6000 });
    const id = load({ gross_pay: 2000, total_miles: 1000, net_rate_per_mile: 0.5, verdict: 'red' });

    initDatabase();   // next launch
    expect(getLoadById(id)!.verdict).toBe('green');
    expect(getSetting('verdict_fix_2026_07_31')).toBe('1');
  });
});

describe('sanity', () => {
  it('setSetting/db wiring still round-trips', () => {
    setSetting('x', '1');
    expect(db.getFirstSync<{ value: string }>("SELECT value FROM settings WHERE key = 'x'")?.value).toBe('1');
  });
});
