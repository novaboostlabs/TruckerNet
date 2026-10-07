// Calendar-quarter helpers for IFTA. (Estimated income tax uses IRS payment
// periods instead — see getTaxSetAside in db/database.ts. Don't mix them.)

export type Quarter = 1 | 2 | 3 | 4;

export function currentQuarter(now: Date = new Date()): Quarter {
  const m = now.getMonth() + 1;
  return (m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4) as Quarter;
}

/**
 * The IFTA quarter to open on. In the month after a quarter ends its return is
 * due (Jan/Apr/Jul/Oct 31), so that's the one the driver is working on — the
 * Oct 17 "IFTA due" reminder used to land on an empty Q4 instead of Q3.
 */
export function filingQuarter(now: Date = new Date()): { year: number; quarter: Quarter } {
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (m === 1) return { year: y - 1, quarter: 4 };
  if (m === 4 || m === 7 || m === 10) return { year: y, quarter: ((m - 1) / 3) as Quarter };
  return { year: y, quarter: currentQuarter(now) };
}
