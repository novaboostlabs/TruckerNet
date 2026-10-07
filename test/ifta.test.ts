import { describe, expect, it } from 'vitest';
import { getIFTAData } from '../src/db/database';
import { filingQuarter } from '../src/lib/quarters';
import { fuelEntry, load } from './support/fixtures';

describe('IFTA quarter data', () => {
  it('splits miles and fuel at the quarter boundary by local date', () => {
    load({ date: '2026-09-30', gross_pay: 2000, total_miles: 800 }, [{ state: 'OH', miles: 500 }, { state: 'PA', miles: 300 }]);
    load({ date: '2026-10-01', gross_pay: 2000, total_miles: 700 }, [{ state: 'PA', miles: 700 }]);
    fuelEntry({ date: '2026-09-30', gallons: 120, state_purchased: 'OH' });
    fuelEntry({ date: '2026-10-01', gallons: 110, state_purchased: 'PA' });

    expect(getIFTAData(2026, 3)).toEqual([
      { state: 'OH', miles: 500, gallons: 120 },
      { state: 'PA', miles: 300, gallons: 0 },
    ]);
    expect(getIFTAData(2026, 4)).toEqual([{ state: 'PA', miles: 700, gallons: 110 }]);
  });

  it('counts deadhead legs (IFTA taxes every mile) but not loads not yet driven', () => {
    load({ date: '2026-08-03', gross_pay: 0, total_miles: 200, is_deadhead: 1 }, [{ state: 'IN', miles: 200 }]);
    load({ date: '2026-08-04', gross_pay: 1500, total_miles: 600, status: 'upcoming' }, [{ state: 'IL', miles: 600 }]);
    expect(getIFTAData(2026, 3)).toEqual([{ state: 'IN', miles: 200, gallons: 0 }]);
  });
});

describe('IFTA tab opens on the quarter being filed', () => {
  const at = (iso: string) => filingQuarter(new Date(`${iso}T12:00:00`));
  it('in the month a return is due, the previous quarter', () => {
    expect(at('2026-10-07')).toEqual({ year: 2026, quarter: 3 });   // Q3 due Oct 31
    expect(at('2026-04-20')).toEqual({ year: 2026, quarter: 1 });
    expect(at('2026-07-01')).toEqual({ year: 2026, quarter: 2 });
    expect(at('2027-01-15')).toEqual({ year: 2026, quarter: 4 });   // across the year
  });
  it('otherwise the current quarter', () => {
    expect(at('2026-11-02')).toEqual({ year: 2026, quarter: 4 });
    expect(at('2026-03-31')).toEqual({ year: 2026, quarter: 1 });
  });
});
