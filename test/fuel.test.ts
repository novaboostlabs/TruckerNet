import { describe, expect, it } from 'vitest';
import {
  addFuelEntry,
  deleteFuelEntry,
  getAllFuelEntries,
  getFuelStats,
  getLastFuelState,
  getLatestFuelCPM,
  getOdometerBounds,
  updateFuelEntry,
} from '../src/db/database';

// The form passes these in; the chain recompute owns them afterwards.
const fill = (date: string, odometer: number, opts: { dollars?: number; gallons?: number; state?: string } = {}) =>
  addFuelEntry({
    date, odometer_reading: odometer,
    dollars_spent: opts.dollars ?? 600, gallons: opts.gallons ?? 150,
    price_per_gallon: (opts.dollars ?? 600) / (opts.gallons ?? 150),
    miles_driven: 0, mpg: 0, cost_per_mile: 0,
    state_purchased: opts.state ?? 'TX',
  });

const milesByDate = () =>
  Object.fromEntries(getAllFuelEntries().map((e) => [e.date, e.miles_driven]));

describe('back-dated fill-ups (IFTA catch-up before a deadline)', () => {
  it('bounds a back-dated reading by the fills around its date, not the latest one', () => {
    fill('2026-09-01', 500_000);
    fill('2026-10-03', 503_000);
    expect(getOdometerBounds('2026-09-20')).toEqual({ before: 500_000, after: 503_000, afterDate: '2026-10-03' });
    // The latest reading (503,000) is NOT the floor for a September receipt.
    expect(getOdometerBounds('2026-09-20').before).toBeLessThan(501_500);
  });

  it('inserting a fill mid-chain re-measures the fill after it', () => {
    fill('2026-09-01', 500_000);
    fill('2026-10-03', 503_000);
    expect(milesByDate()['2026-10-03']).toBe(3000);

    fill('2026-09-20', 501_500);
    expect(milesByDate()).toEqual({ '2026-09-01': 0, '2026-09-20': 1500, '2026-10-03': 1500 });
  });

  it('fuel CPM stays honest — no "+1 mile" workaround entries', () => {
    fill('2026-09-01', 500_000);
    fill('2026-09-10', 501_000);           // $600 / 1,000 mi
    fill('2026-10-03', 503_000);           // $600 / 2,000 mi (covers a missing fill)
    fill('2026-09-20', 502_000);           // the missing receipt, entered late
    // Every fill now covers 1,000 mi at $600 → exactly $0.60/mi.
    expect(getLatestFuelCPM()).toBeCloseTo(0.60, 6);
  });

  it('deleting a fill makes the next one measure from the fill before', () => {
    fill('2026-09-01', 500_000);
    const mid = fill('2026-09-15', 501_500);
    fill('2026-10-01', 503_000);
    deleteFuelEntry(mid);
    expect(milesByDate()['2026-10-01']).toBe(3000);
  });

  it('editing a reading re-derives miles, MPG and CPM for it and its successor', () => {
    fill('2026-09-01', 500_000);
    const id = fill('2026-09-15', 501_000);
    fill('2026-10-01', 503_000);
    const e = getAllFuelEntries().find((r) => r.id === id)!;
    updateFuelEntry(id, { ...e, odometer_reading: 501_500 });
    const rows = Object.fromEntries(getAllFuelEntries().map((r) => [r.date, r]));
    expect(rows['2026-09-15'].miles_driven).toBe(1500);
    expect(rows['2026-09-15'].mpg).toBeCloseTo(10, 6);
    expect(rows['2026-10-01'].miles_driven).toBe(1500);
    expect(rows['2026-10-01'].cost_per_mile).toBeCloseTo(0.4, 6);
  });

  it('a mistyped reading gets 0 miles instead of resetting the chain', () => {
    fill('2026-09-01', 500_000);
    fill('2026-09-10', 50_100);            // dropped a digit
    fill('2026-09-20', 501_000);
    expect(milesByDate()).toEqual({ '2026-09-01': 0, '2026-09-10': 0, '2026-09-20': 1000 });
  });
});

describe('fuel state default', () => {
  it('remembers where the driver last fueled instead of assuming Texas', () => {
    expect(getLastFuelState()).toBeNull();
    fill('2026-09-01', 500_000, { state: 'OH' });
    fill('2026-09-10', 501_000, { state: 'PA' });
    fill('2026-08-01', 499_000, { state: 'IN' });   // back-dated — not the latest
    expect(getLastFuelState()).toBe('PA');
  });
});

describe('Fuel tab month average', () => {
  it('is miles-weighted and ignores fills with no miles yet', () => {
    fill('2026-10-01', 500_000, { dollars: 500 });   // baseline fill: 0 miles
    fill('2026-10-05', 501_000, { dollars: 620 });   // $0.62/mi
    expect(getFuelStats().avgCPMMonthly).toBeCloseTo(0.62, 6);   // was $0.31
  });
});
