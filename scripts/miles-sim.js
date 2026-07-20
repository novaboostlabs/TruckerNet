// Pure-JS mirror of getMonthlyMilesDetail() to sanity-check the algorithm
// against realistic driver scenarios (no RN/SQLite needed).

const WINDOW = 90, MIN_SPAN = 21, FULL_CONF = 60, LOADS_CAP = 0.8, MAX_PER_DAY = 1200;
const clamp01 = n => Math.max(0, Math.min(1, n));

function calc({ weeklyMiles = 0, odo = null, loads = null }) {
  const estimate = weeklyMiles * 4.333;
  let best = null;

  if (odo && odo.n >= 2 && odo.miles > 0 && odo.spanDays >= MIN_SPAN
      && odo.miles / odo.spanDays <= MAX_PER_DAY) {
    best = { monthly: (odo.miles / odo.spanDays) * 30, source: 'odometer',
             conf: clamp01(odo.spanDays / FULL_CONF) };
  }
  if (!best && loads && loads.count >= 5 && loads.miles > 0 && loads.spanDays >= MIN_SPAN
      && loads.miles / loads.spanDays <= MAX_PER_DAY) {
    best = { monthly: (loads.miles / loads.spanDays) * 30, source: 'loads_90d',
             conf: clamp01(loads.spanDays / FULL_CONF) * LOADS_CAP };
  }
  if (!best) return { monthlyMiles: Math.round(estimate), source: 'estimate', conf: 0 };
  if (estimate <= 0) return { monthlyMiles: Math.round(best.monthly), source: best.source, conf: 1 };
  return {
    monthlyMiles: Math.round(best.conf * best.monthly + (1 - best.conf) * estimate),
    source: best.source, conf: +best.conf.toFixed(2),
  };
}

// Fixed costs used for the break-even illustration
const FIXED = 7000, FUEL_CPM = 0.53;
const show = (name, r, note = '') => {
  const cpm = r.monthlyMiles > 0 ? FIXED / r.monthlyMiles : 0;
  console.log(
    `${name.padEnd(46)} ${String(r.monthlyMiles).padStart(6)} mi/mo  ` +
    `fixed $${cpm.toFixed(3).padStart(6)}  BE $${(cpm + FUEL_CPM).toFixed(2).padStart(5)}  ` +
    `[${r.source}, conf ${r.conf}] ${note}`
  );
};

console.log('\n=== THE USER\'S CASE: 5 loads, under-logged, no odometer ===');
// estimate 2500/wk = 10,833/mo. Logged 5 loads = 3,000 mi over 28 days.
show('OLD behavior (hard switch, no blend)',
  { monthlyMiles: Math.round(3000 / 28 * 30), source: 'loads_90d(old)', conf: 1 }, '← the $2.18 problem');
show('NEW (blended, loads only)',
  calc({ weeklyMiles: 2500, loads: { count: 5, miles: 3000, spanDays: 28 } }));
show('NEW + they log fuel (odometer truth)',
  calc({ weeklyMiles: 2500, odo: { n: 6, miles: 9800, spanDays: 30 } }), '← real miles win');

console.log('\n=== THE BURST CASE YOU RAISED: 5 loads in one week ===');
show('5 loads / 6 days (OLD: extrapolates a burst)',
  { monthlyMiles: Math.round(4000 / 7 * 30), source: 'loads_90d(old)', conf: 1 }, '← 17k mi/mo!');
show('5 loads / 6 days (NEW: fails 21d gate)',
  calc({ weeklyMiles: 2500, loads: { count: 5, miles: 4000, spanDays: 6 } }), '← falls back to estimate');

console.log('\n=== COVERAGE RAMP (loads, 500 mi/wk pace vs 2500 est) ===');
[21, 30, 45, 60, 90].forEach(d =>
  show(`  ${String(d).padStart(2)} days of coverage`,
    calc({ weeklyMiles: 2500, loads: { count: 8, miles: 1000 / 7 * d, spanDays: d } })));

console.log('\n=== ODOMETER RAMP (truthful 9,000 mi/mo driver, est 10,833) ===');
[21, 30, 45, 60].forEach(d =>
  show(`  ${String(d).padStart(2)} days of coverage`,
    calc({ weeklyMiles: 2500, odo: { n: 5, miles: 9000 / 30 * d, spanDays: d } })));

console.log('\n=== GUARDS ===');
show('Odometer typo (dropped digit → 400k delta)',
  calc({ weeklyMiles: 2500, odo: { n: 3, miles: 400000, spanDays: 30 } }), '← rejected, uses estimate');
show('Brand-new driver (no data at all)',
  calc({ weeklyMiles: 2500 }));
show('Real data but never onboarded (no estimate)',
  calc({ weeklyMiles: 0, odo: { n: 4, miles: 9000, spanDays: 30 } }), '← trusts real fully');
console.log('');
