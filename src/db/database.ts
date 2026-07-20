import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from './sqlite';

/**
 * Today's date as YYYY-MM-DD in the device's LOCAL timezone.
 *
 * Never use `new Date().toISOString().split('T')[0]` for a calendar date — that
 * is UTC, so an evening entry in any US timezone rolls to "tomorrow" and can
 * land a load in the wrong IFTA quarter / week / month. All date-stamping and
 * period-boundary math must go through this helper.
 */
export function localDateISO(d: Date = new Date()): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- App-wide key-value settings (language, onboarding state, etc.)
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Flexible labeled expenses with frequency support
    -- Replaces the old flat fixed_expenses approach
    CREATE TABLE IF NOT EXISTS user_expenses (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      category          TEXT NOT NULL DEFAULT 'other',
      amount            REAL NOT NULL,
      frequency         TEXT NOT NULL DEFAULT 'monthly',
      monthly_equivalent REAL NOT NULL,
      is_active         INTEGER NOT NULL DEFAULT 1,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL
    );

    -- Legacy fixed expenses (kept for backwards compatibility during transition)
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id                     INTEGER PRIMARY KEY CHECK (id = 1),
      truck_payment          REAL NOT NULL DEFAULT 0,
      insurance              REAL NOT NULL DEFAULT 0,
      eld_payment            REAL NOT NULL DEFAULT 0,
      maintenance_monthly    REAL NOT NULL DEFAULT 0,
      parking_monthly        REAL NOT NULL DEFAULT 0,
      other_expenses         REAL NOT NULL DEFAULT 0,
      estimated_monthly_miles REAL NOT NULL DEFAULT 1,
      fixed_cost_per_mile    REAL NOT NULL DEFAULT 0
    );

    -- Fuel fill-up entries (updated: odometer reading added)
    CREATE TABLE IF NOT EXISTS fuel_entries (
      id               TEXT PRIMARY KEY,
      date             TEXT NOT NULL,
      dollars_spent    REAL NOT NULL,
      gallons          REAL NOT NULL,
      miles_driven     REAL NOT NULL,
      cost_per_mile    REAL NOT NULL,
      price_per_gallon REAL NOT NULL DEFAULT 0,
      mpg              REAL NOT NULL DEFAULT 0,
      odometer_reading REAL NOT NULL DEFAULT 0,
      state_purchased  TEXT NOT NULL
    );

    -- Loads
    CREATE TABLE IF NOT EXISTS loads (
      id                  TEXT PRIMARY KEY,
      date                TEXT NOT NULL,
      pickup_address      TEXT NOT NULL DEFAULT '',
      pickup_city         TEXT NOT NULL,
      pickup_state        TEXT NOT NULL,
      delivery_address    TEXT NOT NULL DEFAULT '',
      delivery_city       TEXT NOT NULL,
      delivery_state      TEXT NOT NULL,
      equipment_type      TEXT NOT NULL DEFAULT 'dry_van',
      total_miles         REAL NOT NULL DEFAULT 0,
      gross_pay           REAL NOT NULL DEFAULT 0,
      additional_costs    REAL NOT NULL DEFAULT 0,
      weight_lbs          REAL NOT NULL DEFAULT 0,
      bol_number          TEXT NOT NULL DEFAULT '',
      bol_photo_url       TEXT NOT NULL DEFAULT '',
      broker_name         TEXT NOT NULL DEFAULT '',
      broker_mc           TEXT NOT NULL DEFAULT '',
      is_deadhead         INTEGER NOT NULL DEFAULT 0,
      is_backhaul         INTEGER NOT NULL DEFAULT 0,
      status              TEXT NOT NULL DEFAULT 'completed',
      notes               TEXT NOT NULL DEFAULT '',
      benchmark_fair_pay_min REAL,
      benchmark_fair_pay_max REAL,
      fuel_cost_for_load  REAL NOT NULL DEFAULT 0,
      fixed_cost_for_load REAL NOT NULL DEFAULT 0,
      net_pay             REAL NOT NULL DEFAULT 0,
      gross_rate_per_mile REAL NOT NULL DEFAULT 0,
      net_rate_per_mile   REAL NOT NULL DEFAULT 0,
      verdict             TEXT,
      created_at          TEXT NOT NULL DEFAULT ''
    );

    -- State mileage breakdown per load (for IFTA)
    CREATE TABLE IF NOT EXISTS state_mileage (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      load_id           TEXT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
      state             TEXT NOT NULL,
      miles             REAL NOT NULL,
      is_manually_edited INTEGER NOT NULL DEFAULT 0
    );

    -- Per-load variable expenses: scale tickets, tolls, lumper fees, detention, etc.
    CREATE TABLE IF NOT EXISTS load_expenses (
      id         TEXT PRIMARY KEY,
      load_id    TEXT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'other',
      amount     REAL NOT NULL,
      date       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Standalone one-off expenses NOT tied to any load (repair, parking ticket,
    -- fine, etc.). They reduce the period (week/month) net directly. Load-attached
    -- one-offs live in load_expenses instead (so they reduce that load's net).
    CREATE TABLE IF NOT EXISTS general_expenses (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'other',
      amount     REAL NOT NULL,
      date       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Local tombstones for rows the user deleted while offline (or on this
    -- device). Push drains this to delete the same rows in the cloud, so a
    -- delete propagates WITHOUT letting a stale device blanket-wipe the cloud.
    -- No Supabase migration needed — this table is local-only.
    CREATE TABLE IF NOT EXISTS sync_deletes (
      entity  TEXT NOT NULL,
      row_id  TEXT NOT NULL,
      PRIMARY KEY (entity, row_id)
    );
  `);

  // ── Migrations: add new columns to existing tables safely ──
  const migrations = [
    // fuel_entries
    `ALTER TABLE fuel_entries ADD COLUMN mpg REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE fuel_entries ADD COLUMN odometer_reading REAL NOT NULL DEFAULT 0`,
    // loads
    `ALTER TABLE loads ADD COLUMN pickup_address TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE loads ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE loads ADD COLUMN is_backhaul INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'`,
    `ALTER TABLE loads ADD COLUMN benchmark_fair_pay_min REAL`,
    `ALTER TABLE loads ADD COLUMN benchmark_fair_pay_max REAL`,
    `ALTER TABLE loads ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    // legacy fixed_expenses
    `ALTER TABLE fixed_expenses ADD COLUMN maintenance_monthly REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE fixed_expenses ADD COLUMN parking_monthly REAL NOT NULL DEFAULT 0`,
    // loads legacy
    `ALTER TABLE loads ADD COLUMN equipment_type TEXT NOT NULL DEFAULT 'dry_van'`,
    `ALTER TABLE loads ADD COLUMN additional_costs REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN broker_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE loads ADD COLUMN broker_mc TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE loads ADD COLUMN gross_rate_per_mile REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN net_rate_per_mile REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN verdict TEXT`,
    `ALTER TABLE loads ADD COLUMN benchmark_fair_pay REAL`,
    `ALTER TABLE loads ADD COLUMN bol_photo_url TEXT NOT NULL DEFAULT ''`,
    // Tracks whether this load has already contributed to the community rate pool,
    // so re-saving/editing a completed load never double-counts (Slice 2 integrity).
    `ALTER TABLE loads ADD COLUMN rate_contributed INTEGER NOT NULL DEFAULT 0`,
    // Geocoded endpoint coordinates — power the personal "nearby lane" history
    // (loads whose pickup AND delivery are within ~50 mi of the current load).
    // Nullable: older loads + manually-typed addresses won't have them.
    `ALTER TABLE loads ADD COLUMN pickup_lat REAL`,
    `ALTER TABLE loads ADD COLUMN pickup_lng REAL`,
    `ALTER TABLE loads ADD COLUMN delivery_lat REAL`,
    `ALTER TABLE loads ADD COLUMN delivery_lng REAL`,
    // Category-aware expense aging: tracks when each expense row was last confirmed
    // (separate from created_at, which is overwritten by replaceUserExpenses).
    // NULL = use created_at as the baseline (first save = first confirmation).
    `ALTER TABLE user_expenses ADD COLUMN confirmed_at TEXT`,
  ];

  for (const sql of migrations) {
    try { db.execSync(sql); } catch { /* column already exists */ }
  }

  // ── One-time cleanup: remove legacy 'fuel' entries from user_expenses ──
  // Fuel cost is tracked via fuel_entries + weekly_fuel_cost setting, never
  // user_expenses. Any rows with category='fuel' silently inflated Fixed CPM.
  db.runSync(`DELETE FROM user_expenses WHERE category = 'fuel'`);

  // ── One-time data migration: convert legacy load IDs to real UUIDs ──
  // Old format was "load-<timestamp>-<rand>"; Supabase requires uuid columns.
  // Runs only when such rows exist; updates state_mileage FK in lockstep.
  const legacyLoads = db.getAllSync<{ id: string }>(
    `SELECT id FROM loads WHERE id LIKE 'load-%'`
  );
  if (legacyLoads.length > 0) {
    db.runSync('PRAGMA foreign_keys = OFF');
    for (const row of legacyLoads) {
      const newId = uuidv4();
      db.runSync('UPDATE loads SET id = ? WHERE id = ?', [newId, row.id]);
      db.runSync('UPDATE state_mileage SET load_id = ? WHERE load_id = ?', [newId, row.id]);
    }
    db.runSync('PRAGMA foreign_keys = ON');
  }
}

// ── Settings helpers ──

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

// ── Pending-delete queue (offline-safe delete propagation) ──
//
// When the user deletes a syncable row locally we record a tombstone here
// instead of relying on "delete every cloud row not present locally" (which
// let a stale device wipe another device's data). Push drains the queue.

export function queueDelete(entity: string, id: string): void {
  if (!id) return;
  db.runSync(
    'INSERT OR IGNORE INTO sync_deletes (entity, row_id) VALUES (?, ?)',
    [entity, id]
  );
}

export function getQueuedDeletes(entity: string): string[] {
  return db
    .getAllSync<{ row_id: string }>('SELECT row_id FROM sync_deletes WHERE entity = ?', [entity])
    .map((r) => r.row_id);
}

export function clearQueuedDeletes(entity: string, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`DELETE FROM sync_deletes WHERE entity = ? AND row_id IN (${placeholders})`, [entity, ...ids]);
}

// ── Fuel CPM helpers ──

export function getLatestFuelCPM(): number {
  // Rolling weighted average of the last 10 fill-ups (total $ ÷ total miles).
  // Weighted by miles so a 900-mile tank influences the average more than a
  // 50-mile top-off. Gets more accurate with every fill-up logged.
  const row = db.getFirstSync<{ avg_cpm: number; entry_count: number }>(
    `SELECT
       SUM(dollars_spent) / NULLIF(SUM(miles_driven), 0) AS avg_cpm,
       COUNT(*) AS entry_count
     FROM (
       SELECT dollars_spent, miles_driven
       FROM fuel_entries
       WHERE miles_driven > 0 AND dollars_spent > 0
       ORDER BY date DESC, rowid DESC
       LIMIT 10
     )`
  );
  if (row?.avg_cpm && row.avg_cpm > 0) return row.avg_cpm;

  // Fallback: onboarding estimate (weekly_fuel_cost ÷ weekly_miles).
  const weeklyFuel  = parseFloat(getSetting('weekly_fuel_cost') ?? '0') || 0;
  const weeklyMiles = parseFloat(getSetting('weekly_miles')    ?? '0') || 0;
  if (weeklyFuel > 0 && weeklyMiles > 0) return weeklyFuel / weeklyMiles;

  return 0;
}

/**
 * The onboarding fuel estimate (weekly_fuel_cost ÷ weekly_miles), or null if the
 * driver never entered it. This is the same figure `getLatestFuelCPM()` falls
 * back to when there are no real fill-ups yet — so the Fuel tab can show it as a
 * clearly-labeled "estimate" that drives break-even until real data replaces it.
 */
export interface FuelEstimate { cpm: number; weeklyCost: number; weeklyMiles: number; }

export function getFuelEstimate(): FuelEstimate | null {
  const weeklyCost  = parseFloat(getSetting('weekly_fuel_cost') ?? '0') || 0;
  const weeklyMiles = parseFloat(getSetting('weekly_miles')     ?? '0') || 0;
  if (weeklyCost <= 0 || weeklyMiles <= 0) return null;
  return { cpm: weeklyCost / weeklyMiles, weeklyCost, weeklyMiles };
}

export function hasFuelEntryToday(): boolean {
  const today = localDateISO();
  const row   = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fuel_entries WHERE date = ?',
    [today]
  );
  return (row?.count ?? 0) > 0;
}

export function getLatestOdometer(): number {
  const row = db.getFirstSync<{ odometer_reading: number }>(
    'SELECT odometer_reading FROM fuel_entries WHERE odometer_reading > 0 ORDER BY date DESC LIMIT 1'
  );
  return row?.odometer_reading ?? 0;
}

export interface FuelEntryRow {
  id: string;
  date: string;
  dollars_spent: number;
  gallons: number;
  miles_driven: number;
  cost_per_mile: number;
  price_per_gallon: number;
  mpg: number;
  odometer_reading: number;
  state_purchased: string;
}

const FUEL_COLUMNS =
  'id, date, dollars_spent, gallons, miles_driven, cost_per_mile, price_per_gallon, mpg, odometer_reading, state_purchased';

export function getAllFuelEntries(): FuelEntryRow[] {
  return db.getAllSync<FuelEntryRow>(
    `SELECT ${FUEL_COLUMNS} FROM fuel_entries ORDER BY date DESC`
  );
}

/** Fuel fill-ups within a date range — for the History period timeline/calendar. */
export function getFuelEntriesDateRange(start: string, end: string): FuelEntryRow[] {
  return db.getAllSync<FuelEntryRow>(
    `SELECT ${FUEL_COLUMNS} FROM fuel_entries
     WHERE date >= ? AND date <= ? ORDER BY date DESC, rowid DESC`,
    [start, end]
  );
}

/** Replace all local fuel entries with the given set. Transactional so a
 *  mid-loop failure rolls back rather than leaving an empty table. */
export function replaceFuelEntries(rows: FuelEntryRow[]): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM fuel_entries');
    for (const r of rows) insertOrReplaceFuel(r);
  });
}

/** Merge cloud fuel entries into the local set: upsert by id, KEEP local-only
 *  rows (unpushed local fill-ups). Non-destructive — used by cloud pull. */
export function mergeFuelEntries(rows: FuelEntryRow[]): void {
  const tombstoned = new Set(getQueuedDeletes('fuel_entries'));
  db.withTransactionSync(() => {
    for (const r of rows) {
      if (tombstoned.has(r.id)) continue; // don't resurrect a locally-deleted row
      insertOrReplaceFuel(r);
    }
  });
}

// Insert a fuel row only if it isn't already present locally. LOCAL WINS on a
// conflict: pull is additive (restores missing rows on a fresh device) but never
// overwrites a local edit with a staler cloud copy. Safe for replaceFuelEntries
// too — it DELETEs first, so no conflict ever fires there.
function insertOrReplaceFuel(r: FuelEntryRow): void {
  db.runSync(
    `INSERT INTO fuel_entries (${FUEL_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [
      r.id, r.date, r.dollars_spent, r.gallons, r.miles_driven,
      r.cost_per_mile, r.price_per_gallon, r.mpg, r.odometer_reading, r.state_purchased,
    ]
  );
}

// ── Expense helpers ──

export function getTotalMonthlyExpenses(): number {
  // Exclude 'fuel' category — fuel cost comes from fuel_entries / weekly_fuel_cost,
  // not from user_expenses. This matches getUserExpenses() so the two are always in sync.
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(monthly_equivalent), 0) as total
     FROM user_expenses WHERE is_active = 1 AND category != 'fuel'`
  );
  return row?.total ?? 0;
}

/**
 * Monthly mileage used for the break-even calculation.
 *
 * Priority order — gets more accurate automatically as the driver logs:
 *   1. Actual miles from completed loads in the last 90 days (if ≥ 5 loads).
 *      Rolling 90-day window so a slow month doesn't tank the estimate.
 *   2. Onboarding estimate (weekly_miles × 4.333) — until there's enough real
 *      data. A partial current-month sum is intentionally NOT used (see below).
 *
 * The 90-day window is intentional: one slow month shouldn't crater the
 * break-even; the rolling average is more representative of real operating pace.
 */
// ── Monthly-miles tuning constants ────────────────────────────────────────
const MILES_WINDOW_DAYS   = 90;   // how far back we look for real data
const MILES_MIN_SPAN_DAYS = 21;   // real data must COVER this much time to count
const MILES_FULL_CONF_DAYS = 60;  // coverage at/above this → full confidence
const MILES_LOADS_CONF_CAP = 0.8; // loads can't see unlogged miles → never 100%
const MILES_MAX_PER_DAY    = 1200; // typo guard (no truck sustains this)

export interface MonthlyMilesDetail {
  /** Final figure the break-even divides by (blended). */
  monthlyMiles: number;
  /** Which signal drove it. */
  source:       BreakEvenSource;
  /** 0–1: how much the real signal (vs the estimate) drove the result. */
  confidence:   number;
  /** The real signal's own monthly figure, pre-blend (0 when none). */
  realMonthly:  number;
  /** The driver's stated estimate (weekly_miles × 4.333). */
  estimate:     number;
}

/** Whole days between two YYYY-MM-DD dates (noon-anchored, so DST can't shift it). */
function daysBetweenISO(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Monthly miles for the break-even denominator, from the best signal available.
 *
 * Signals, best first:
 *   1. ODOMETER span across fuel entries — ground truth. This is the only source
 *      that counts miles the driver DIDN'T log (unlogged loads, deadhead,
 *      bobtail), so it can't be fooled by incomplete load logging. That matters:
 *      summing loads can't tell "I drove less" from "I logged less", and
 *      under-logging silently inflates break-even.
 *   2. COMPLETED LOADS — good, but structurally blind to unlogged miles, so its
 *      confidence is capped below the odometer's.
 *   3. STATED ESTIMATE (weekly_miles × 4.333) — always available, never learns.
 *
 * Two deliberate design choices:
 *   • Gate on TIME COVERAGE (≥21 days), not a load COUNT. Five loads says nothing
 *     about the period they cover — five in one week is not a month of data.
 *   • BLEND rather than switch: monthly = c·real + (1−c)·estimate, where c grows
 *     with coverage. A hard switch made the number jump ~3× the moment a 5th load
 *     was logged; blending eases real data in as it earns trust.
 *
 * Rates are measured over the period the data actually spans (first→last
 * observation), i.e. the driver's pace *while working* — so a stretch of
 * downtime doesn't crater the figure the app plans future loads against.
 */
export function getMonthlyMilesDetail(): MonthlyMilesDetail {
  const weeklyRow = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = "weekly_miles"',
  );
  const estimate = (parseFloat(weeklyRow?.value ?? '0') || 0) * 4.333;

  const windowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - MILES_WINDOW_DAYS);
    return localDateISO(d);
  })();

  let best: { monthly: number; source: BreakEvenSource; conf: number } | null = null;

  // ── Signal 1: odometer span (counts every mile the truck moved) ──
  const odo = db.getFirstSync<{ n: number; lo: number; hi: number; first_date: string; last_date: string }>(
    `SELECT COUNT(*) as n, MIN(odometer_reading) as lo, MAX(odometer_reading) as hi,
            MIN(date) as first_date, MAX(date) as last_date
     FROM fuel_entries
     WHERE odometer_reading > 0 AND date >= ?`,
    [windowStart],
  );
  if (odo && odo.n >= 2 && odo.hi > odo.lo && odo.first_date && odo.last_date) {
    const spanDays = daysBetweenISO(odo.first_date, odo.last_date);
    const miles    = odo.hi - odo.lo;
    // Guard a mistyped reading (e.g. a dropped digit) from wrecking break-even.
    if (spanDays >= MILES_MIN_SPAN_DAYS && miles / spanDays <= MILES_MAX_PER_DAY) {
      best = {
        monthly: (miles / spanDays) * 30,
        source:  'odometer',
        conf:    clamp01(spanDays / MILES_FULL_CONF_DAYS),
      };
    }
  }

  // ── Signal 2: completed loads (only when there's no usable odometer span) ──
  if (!best) {
    // Upcoming loads haven't been driven — their miles can't count as actuals.
    const rolling = db.getFirstSync<{ total_miles: number; load_count: number; first_date: string; last_date: string }>(
      `SELECT COALESCE(SUM(total_miles), 0) as total_miles, COUNT(*) as load_count,
              MIN(date) as first_date, MAX(date) as last_date
       FROM loads
       WHERE status = 'completed' AND date >= ?`,
      [windowStart],
    );
    if (rolling && rolling.load_count >= 5 && rolling.total_miles > 0 && rolling.first_date) {
      const spanDays = daysBetweenISO(rolling.first_date, rolling.last_date);
      if (spanDays >= MILES_MIN_SPAN_DAYS && rolling.total_miles / spanDays <= MILES_MAX_PER_DAY) {
        best = {
          monthly: (rolling.total_miles / spanDays) * 30,
          source:  'loads_90d',
          conf:    clamp01(spanDays / MILES_FULL_CONF_DAYS) * MILES_LOADS_CONF_CAP,
        };
      }
    }
  }

  // ── No usable real signal → the stated estimate ──
  if (!best) {
    return { monthlyMiles: estimate, source: 'estimate', confidence: 0, realMonthly: 0, estimate };
  }
  // Real data but no estimate to blend against (never onboarded) → trust it fully.
  if (estimate <= 0) {
    return {
      monthlyMiles: Math.round(best.monthly),
      source: best.source, confidence: 1, realMonthly: best.monthly, estimate: 0,
    };
  }

  const blended = best.conf * best.monthly + (1 - best.conf) * estimate;
  return {
    monthlyMiles: Math.round(blended),
    source:       best.source,
    confidence:   best.conf,
    realMonthly:  best.monthly,
    estimate,
  };
}

export function getMonthlyMiles(): number {
  return getMonthlyMilesDetail().monthlyMiles;
}

export function getWeeklyMiles(): number {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = "weekly_miles"');
  return parseFloat(row?.value ?? '0') || 0;
}

/** Persist monthly miles by storing the weekly equivalent (the source of truth). */
export function setMonthlyMiles(monthly: number): void {
  const weekly = monthly / 4.333;
  setSetting('weekly_miles', String(weekly));
}

export interface UserExpenseRow {
  id: string;
  label: string;
  category: string;
  amount: number;
  frequency: string;
  monthly_equivalent: number;
  // When this specific row was last confirmed accurate by the driver.
  // Falls back to created_at when NULL (onboarding entry = first confirmation).
  confirmed_at: string | null;
}

/** All active, non-fuel expenses — the same set the break-even engine sums. */
export function getUserExpenses(): UserExpenseRow[] {
  return db.getAllSync<UserExpenseRow>(
    `SELECT id, label, category, amount, frequency, monthly_equivalent,
            COALESCE(confirmed_at, created_at) as confirmed_at
     FROM user_expenses
     WHERE is_active = 1 AND category != 'fuel'
     ORDER BY sort_order ASC`
  );
}

/** Replace all expenses with the given set (fuel is tracked separately via fuel_entries).
 *  Saving/editing an expense row counts as a confirmation — confirmed_at is set to now. */
export function replaceUserExpenses(
  expenses: { id: string; label: string; category: string; amount: number; frequency: string; monthly_equivalent: number }[]
): void {
  db.withTransactionSync(() => {
    // Any row present locally but absent from the new set is a real user
    // deletion — queue a tombstone so push removes it from the cloud too
    // (rather than the old "delete every cloud row not present locally").
    const newIds = new Set(expenses.map((e) => e.id));
    const existing = db.getAllSync<{ id: string }>('SELECT id FROM user_expenses');
    for (const row of existing) {
      if (!newIds.has(row.id)) queueDelete('user_expenses', row.id);
    }

    db.runSync('DELETE FROM user_expenses');
    const now = new Date().toISOString();
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      db.runSync(
        `INSERT INTO user_expenses (id, label, category, amount, frequency, monthly_equivalent, is_active, sort_order, created_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [e.id, e.label, e.category, e.amount, e.frequency, e.monthly_equivalent, i, now, now]
      );
    }
  });
}

/** Merge cloud expenses into the local set: upsert by id, KEEP local-only rows.
 *  Non-destructive — used by cloud pull so an unpushed local expense survives. */
export function mergeUserExpenses(
  expenses: { id: string; label: string; category: string; amount: number; frequency: string; monthly_equivalent: number }[]
): void {
  // LOCAL WINS: only insert cloud rows that aren't already local (so a just-edited
  // expense is never overwritten by a staler cloud copy), and skip any row the
  // user just deleted locally (pending in the tombstone queue) so it can't resurrect.
  const tombstoned = new Set(getQueuedDeletes('user_expenses'));
  db.withTransactionSync(() => {
    const now = new Date().toISOString();
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      if (tombstoned.has(e.id)) continue;
      db.runSync(
        `INSERT INTO user_expenses (id, label, category, amount, frequency, monthly_equivalent, is_active, sort_order, created_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [e.id, e.label, e.category, e.amount, e.frequency, e.monthly_equivalent, i, now, now]
      );
    }
  });
}

// ── Break-even calculation ──

export type BreakEvenSource = 'odometer' | 'loads_90d' | 'loads_month' | 'estimate';

export function calcBreakEven(): {
  breakEvenRPM: number;
  fuelCPM:      number;
  fixedCPM:     number;
  milesSource:  BreakEvenSource;  // lets the UI tell the driver how accurate this is
} {
  const fuelCPM    = getLatestFuelCPM();
  const totalFixed = getTotalMonthlyExpenses();

  // Single source of truth: the miles AND the label come from the same call, so
  // they can never drift. (This previously re-derived the source with a copy of
  // getMonthlyMiles' rules — a mirror that had to be kept in sync by hand.)
  const { monthlyMiles, source: milesSource } = getMonthlyMilesDetail();
  if (monthlyMiles <= 0) return { breakEvenRPM: 0, fuelCPM, fixedCPM: 0, milesSource };

  const fixedCPM = totalFixed / monthlyMiles;
  return { breakEvenRPM: fuelCPM + fixedCPM, fuelCPM, fixedCPM, milesSource };
}

// ── P&L / Dashboard helpers ──

function weekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // back to Monday
  const mon = new Date(d);
  mon.setDate(diff);
  return localDateISO(mon);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

/** Quarter start date (1-indexed). */
function quarterStartDate(q: 1 | 2 | 3 | 4): string {
  const year = new Date().getFullYear();
  const month = [1, 4, 7, 10][q - 1];
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Current IRS estimated-tax quarter (1–4). */
function currentTaxQuarter(): 1 | 2 | 3 | 4 {
  const m = new Date().getMonth() + 1; // 1-12
  return (m <= 3 ? 1 : m <= 5 ? 2 : m <= 8 ? 3 : 4) as 1 | 2 | 3 | 4;
}

export interface TaxSetAside {
  rate:          number;   // 0–1 (e.g. 0.25)
  monthNet:      number;
  quarterNet:    number;
  ytdNet:        number;
  monthSetAside: number;
  quarterSetAside: number;
  ytdSetAside:   number;
  nextDeadline:  string;   // e.g. "Jun 16"
  nextDeadlineDate: string; // ISO YYYY-MM-DD
}

/** IRS quarterly estimated-tax due dates (month/day, 0-indexed month). */
const TAX_DEADLINES: [number, number][] = [
  [3, 15],   // Q1 due Apr 15
  [5, 16],   // Q2 due Jun 16
  [8, 15],   // Q3 Sep 15
  [0, 15],   // Q4 due Jan 15 (next year)
];

function nextDeadlineISO(): string {
  const now  = new Date();
  const year = now.getFullYear();
  for (let i = 0; i < TAX_DEADLINES.length; i++) {
    const [m, d] = TAX_DEADLINES[i];
    const due = new Date(i === 3 ? year + 1 : year, m, d);
    if (due.getTime() > now.getTime()) {
      return localDateISO(due);
    }
  }
  // Fallback: Jan 15 next year
  return `${year + 1}-01-15`;
}

function periodNet(startISO: string): number {
  const row = db.getFirstSync<{ net: number }>(
    `SELECT COALESCE(SUM(net_pay), 0) as net
     FROM loads WHERE status = 'completed' AND date >= ?`,
    [startISO],
  );
  // Subtract standalone expenses for the same period
  const exp = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE date >= ?`,
    [startISO],
  );
  return Math.max(0, (row?.net ?? 0) - (exp?.total ?? 0));
}

export function getTaxSetAside(): TaxSetAside {
  const rateRaw = parseFloat(getSetting('tax_rate') ?? '25');
  const rate    = Math.min(50, Math.max(5, isNaN(rateRaw) ? 25 : rateRaw)) / 100;

  const q = currentTaxQuarter();
  const monthNet   = periodNet(monthStart());
  const quarterNet = periodNet(quarterStartDate(q));
  const ytdNet     = periodNet(yearStart());

  const deadline     = nextDeadlineISO();
  const deadlineDate = new Date(deadline + 'T12:00:00');
  const nextDeadline = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Round every money figure to whole cents at the source — net sums carry long
  // decimals from per-mile cost math, and RN/Hermes doesn't reliably honour
  // toLocaleString's maximumFractionDigits, so we can't rely on the formatter.
  const cents = (n: number) => Math.round(n * 100) / 100;
  return {
    rate,
    monthNet:   cents(monthNet),
    quarterNet: cents(quarterNet),
    ytdNet:     cents(ytdNet),
    monthSetAside:   Math.round(monthNet   * rate),
    quarterSetAside: Math.round(quarterNet * rate),
    ytdSetAside:     Math.round(ytdNet     * rate),
    nextDeadline,
    nextDeadlineDate: deadline,
  };
}

// ── Value-based conversion stats ──────────────────────────────────────────────

export interface ValueMissedStats {
  /** Completed loads in the last 90 days that had a fair-market benchmark. */
  loadsWithBenchmark: number;
  /** Loads where gross_pay < benchmark_fair_pay_min (confirmed lowball). */
  lowballCount: number;
  /**
   * Conservative estimate of money left on the table:
   * sum(benchmark_fair_pay_min - gross_pay) for lowball loads.
   * Using MIN, not mid, so we never overstate.
   */
  estimatedLost: number;
  periodDays: number;
}

export function getValueMissedStats(periodDays = 90): ValueMissedStats {
  const since = (() => {
    const d = new Date(); d.setDate(d.getDate() - periodDays);
    return localDateISO(d);
  })();

  const rows = db.getAllSync<{
    gross_pay: number;
    benchmark_fair_pay_min: number | null;
  }>(
    `SELECT gross_pay, benchmark_fair_pay_min
     FROM loads
     WHERE status = 'completed'
       AND date >= ?
       AND benchmark_fair_pay_min IS NOT NULL
       AND benchmark_fair_pay_min > 0`,
    [since],
  );

  let lowballCount = 0;
  let estimatedLost = 0;

  for (const r of rows) {
    if (r.benchmark_fair_pay_min != null && r.gross_pay < r.benchmark_fair_pay_min) {
      lowballCount++;
      estimatedLost += r.benchmark_fair_pay_min - r.gross_pay;
    }
  }

  return {
    loadsWithBenchmark: rows.length,
    lowballCount,
    estimatedLost: Math.round(estimatedLost),
    periodDays,
  };
}

export function getLoadCount(): number {
  const row = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM loads');
  return row?.n ?? 0;
}

// Loads logged in the current calendar month — drives the free-tier 15-loads/mo
// gate. Cancelled loads still count (the user did the work of logging them).
export function getLoadCountThisMonth(): number {
  // Free-tier quota counts loads LOGGED this calendar month (created_at), not
  // the load's business date — otherwise back-dating a load onto a previous
  // month (History calendar → "Log load this day") bypasses the 15/month cap
  // entirely. created_at is a full ISO timestamp; lexicographic >= against the
  // YYYY-MM-DD month start is correct for ISO strings.
  const row = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) as n FROM loads WHERE created_at >= ?',
    [monthStart()]
  );
  return row?.n ?? 0;
}

// How many of this driver's loads have been shared to the community rate pool.
// Powers the "you're building the network" flywheel surface in Settings.
export function getRateContributionCount(): number {
  const row = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) as n FROM loads WHERE rate_contributed = 1'
  );
  return row?.n ?? 0;
}

export interface PeriodPnL { net: number; gross: number; miles: number; loads: number; }

// Sum of standalone one-off expenses on/after `start` (and optionally on/before `end`).
function sumGeneralExpenses(start: string, end?: string): number {
  const row = end
    ? db.getFirstSync<{ total: number }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM general_expenses WHERE date >= ? AND date <= ?`, [start, end])
    : db.getFirstSync<{ total: number }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM general_expenses WHERE date >= ?`, [start]);
  return row?.total ?? 0;
}

export function getWeekPnL(): PeriodPnL {
  // Upcoming loads are booked, not earned — they must not inflate the week's net.
  const row = db.getFirstSync<PeriodPnL>(
    `SELECT COALESCE(SUM(net_pay),0)     as net,
            COALESCE(SUM(gross_pay),0)   as gross,
            COALESCE(SUM(total_miles),0) as miles,
            COUNT(*)                     as loads
     FROM loads WHERE date >= ? AND status = 'completed'`,
    [weekStart()]
  );
  const base = row ?? { net: 0, gross: 0, miles: 0, loads: 0 };
  return { ...base, net: base.net - sumGeneralExpenses(weekStart()) };
}

export function getMonthPnL(): PeriodPnL {
  const row = db.getFirstSync<PeriodPnL>(
    `SELECT COALESCE(SUM(net_pay),0)     as net,
            COALESCE(SUM(gross_pay),0)   as gross,
            COALESCE(SUM(total_miles),0) as miles,
            COUNT(*)                     as loads
     FROM loads WHERE date >= ? AND status = 'completed'`,
    [monthStart()]
  );
  const base = row ?? { net: 0, gross: 0, miles: 0, loads: 0 };
  return { ...base, net: base.net - sumGeneralExpenses(monthStart()) };
}

// ── Pending (booked-but-not-delivered) money: upcoming + in-progress loads.
// Powers the "what your progress becomes once this load delivers" state on the
// income goal — earned and pending are never mixed into one number.
export interface PendingPnL { net: number; loads: number; }

function pendingSince(startISO: string): PendingPnL {
  const row = db.getFirstSync<PendingPnL>(
    `SELECT COALESCE(SUM(net_pay),0) as net, COUNT(*) as loads
     FROM loads WHERE date >= ? AND status IN ('upcoming','in_progress')`,
    [startISO]
  );
  return row ?? { net: 0, loads: 0 };
}

export function getWeekPendingPnL(): PendingPnL  { return pendingSince(weekStart()); }
export function getMonthPendingPnL(): PendingPnL { return pendingSince(monthStart()); }

export interface WeekTrendPoint { weekStart: string; net: number; gross: number; }

export function getWeeklyNetTrend(weeks = 12): WeekTrendPoint[] {
  // Build the Monday that is (weeks-1) full weeks ago.
  const now = new Date();
  const dow = now.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysToMon);
  thisMonday.setHours(12, 0, 0, 0);

  const firstMonday = new Date(thisMonday);
  firstMonday.setDate(thisMonday.getDate() - (weeks - 1) * 7);
  const startISO = localDateISO(firstMonday);

  // Query: group by ISO week Monday (date(date,'weekday 0','-6 days'))
  const rows = db.getAllSync<{ week_start: string; net: number; gross: number }>(
    `SELECT date(date,'weekday 0','-6 days') as week_start,
            COALESCE(SUM(net_pay),0)   as net,
            COALESCE(SUM(gross_pay),0) as gross
     FROM loads
     WHERE status = 'completed' AND date >= ?
     GROUP BY week_start
     ORDER BY week_start ASC`,
    [startISO]
  );

  // Build a map so we can fill in missing weeks with zeros.
  const map: Record<string, { net: number; gross: number }> = {};
  for (const r of rows) map[r.week_start] = { net: r.net, gross: r.gross };

  // Standalone one-off expenses grouped into the same ISO weeks — they lower net.
  const genRows = db.getAllSync<{ week_start: string; total: number }>(
    `SELECT date(date,'weekday 0','-6 days') as week_start, COALESCE(SUM(amount),0) as total
     FROM general_expenses WHERE date >= ? GROUP BY week_start`,
    [startISO]
  );
  const genMap: Record<string, number> = {};
  for (const r of genRows) genMap[r.week_start] = r.total;

  const result: WeekTrendPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(firstMonday);
    d.setDate(firstMonday.getDate() + i * 7);
    const iso = localDateISO(d);
    const wk = map[iso] ?? { net: 0, gross: 0 };
    result.push({ weekStart: iso, net: wk.net - (genMap[iso] ?? 0), gross: wk.gross });
  }
  return result;
}

export interface CostBreakdown {
  fuel: number; fixed: number; expenses: number; net: number; gross: number;
}

export function getCostBreakdown(): CostBreakdown {
  const row = db.getFirstSync<CostBreakdown>(
    `SELECT COALESCE(SUM(fuel_cost_for_load),0)  as fuel,
            COALESCE(SUM(fixed_cost_for_load),0) as fixed,
            COALESCE(SUM(additional_costs),0)    as expenses,
            COALESCE(SUM(net_pay),0)             as net,
            COALESCE(SUM(gross_pay),0)           as gross
     FROM loads
     WHERE status = 'completed' AND date >= date('now','start of month')`,
    []
  );
  const base = row ?? { fuel: 0, fixed: 0, expenses: 0, net: 0, gross: 0 };
  // Standalone one-off expenses this month move from net → the expenses slice.
  const general = sumGeneralExpenses(monthStart());
  return { ...base, expenses: base.expenses + general, net: base.net - general };
}

export interface LoadSummary {
  id:               string;
  pickup_city:      string;
  pickup_state:     string;
  delivery_city:    string;
  delivery_state:   string;
  total_miles:      number;
  gross_pay:        number;
  net_pay:          number;
  net_rate_per_mile: number;
  status:           string;
}

export function getRecentLoads(limit = 5): LoadSummary[] {
  return db.getAllSync<LoadSummary>(
    `SELECT id, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads ORDER BY date DESC, created_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * The single load an expense most likely belongs to: the most recent load on or
 * before the given date. Powers the smart "link this expense to a load?" prompt —
 * a driver logging a scale ticket or lumper fee is almost always attaching it to
 * the run they just finished, not some load from three weeks ago. Returns null
 * when there's no load at/before that date (nothing sensible to suggest).
 */
export function getLoadForExpenseDate(date: string): LoadSummary | null {
  return db.getFirstSync<LoadSummary>(
    `SELECT id, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads
     WHERE date <= ?
     ORDER BY date DESC, created_at DESC
     LIMIT 1`,
    [date]
  );
}

/** Best load this week by net pay — for the weekly summary notification. */
export function getBestLoadThisWeek(): {
  pickup_city: string; delivery_city: string;
  net_rate_per_mile: number; net_pay: number;
} | null {
  return db.getFirstSync(
    `SELECT pickup_city, delivery_city, net_rate_per_mile, net_pay
     FROM loads
     WHERE status = 'completed' AND date >= ?
     ORDER BY net_pay DESC LIMIT 1`,
    [weekStart()],
  ) ?? null;
}

/**
 * Consecutive weeks over break-even ending with this week.
 * Returns 0 when break-even isn't set or the current week is under.
 */
export function consecutiveWeeksOverBreakEven(): number {
  const { breakEvenRPM } = calcBreakEven();
  if (breakEvenRPM <= 0) return 0;

  // Walk backwards week by week (max 52).
  const now = new Date();
  let streak = 0;

  for (let i = 0; i < 52; i++) {
    const weekMon = new Date(now);
    const dow = weekMon.getDay();
    weekMon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) - i * 7);
    weekMon.setHours(0, 0, 0, 0);
    const sun = new Date(weekMon);
    sun.setDate(weekMon.getDate() + 6);

    const start = localDateISO(weekMon);
    const end   = localDateISO(sun);

    const row = db.getFirstSync<{ miles: number; net: number }>(
      `SELECT COALESCE(SUM(total_miles), 0) as miles,
              COALESCE(SUM(net_pay), 0) as net
       FROM loads WHERE status = 'completed' AND date >= ? AND date <= ?`,
      [start, end],
    );

    if (!row || row.miles <= 0) break;  // no loads — streak ends
    const rpm = row.net / row.miles;
    if (rpm < breakEvenRPM) break;      // under — streak ends
    streak++;
  }

  return streak;
}

/** Date of the most recently logged (completed or in-progress) load. */
export function getLastLoadDate(): string | null {
  const row = db.getFirstSync<{ date: string }>(
    `SELECT date FROM loads
     WHERE status != 'cancelled'
     ORDER BY date DESC, created_at DESC LIMIT 1`,
  );
  return row?.date ?? null;
}

/** Average loads per week over the last 4 weeks (proxy for "regular logger"). */
export function avgLoadsPerWeek(): number {
  const fourWeeksAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 28);
    return localDateISO(d);
  })();
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) as n FROM loads WHERE status != 'cancelled' AND date >= ?`,
    [fourWeeksAgo],
  );
  return (row?.n ?? 0) / 4;
}

export function getActiveLoad(): LoadSummary | null {
  return db.getFirstSync<LoadSummary>(
    `SELECT id, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads WHERE status = 'in_progress' ORDER BY date DESC, created_at DESC LIMIT 1`
  ) ?? null;
}

/** Soonest upcoming load — surfaces on the Dashboard with a "Start Load" action. */
export function getUpcomingLoad(): LoadSummary | null {
  return db.getFirstSync<LoadSummary>(
    `SELECT id, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads WHERE status = 'upcoming' ORDER BY date ASC, created_at ASC LIMIT 1`
  ) ?? null;
}

/** Status-only transition (Start Load / Mark Complete). Financials are unaffected. */
export function setLoadStatus(id: string, status: string): void {
  db.runSync('UPDATE loads SET status = ? WHERE id = ?', [status, id]);
}

// ── Personal lane history ──

export interface LaneHistory {
  count:    number;
  avgPay:   number;   // average GROSS pay on this lane
  lastPay:  number;
  lastDate: string;
  precise:  boolean;  // true = matched by nearby coords (~50 mi); false = state-level fallback
}

export interface LaneHistoryQuery {
  pickupLat?:   number | null;
  pickupLng?:   number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  originState:  string;
  destState:    string;
  equipment:    string;
  radiusMiles?: number;   // default 50
}

// Great-circle distance in miles.
function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * The driver's own history on this lane. First tries a precise "nearby" match —
 * past completed loads whose pickup AND delivery are both within ~50 mi of the
 * current load (using stored coordinates). Falls back to a state-pair match for
 * older loads / manually-typed addresses that have no coordinates.
 */
export function getPersonalLaneHistory(q: LaneHistoryQuery): LaneHistory | null {
  const radius = q.radiusMiles ?? 50;

  // ── 1) Precise nearby-coords match ──
  if (q.pickupLat != null && q.pickupLng != null && q.deliveryLat != null && q.deliveryLng != null) {
    const rows = db.getAllSync<{ gross_pay: number; date: string; pickup_lat: number; pickup_lng: number; delivery_lat: number; delivery_lng: number }>(
      `SELECT gross_pay, date, pickup_lat, pickup_lng, delivery_lat, delivery_lng
       FROM loads
       WHERE equipment_type = ? AND status = 'completed'
         AND pickup_lat IS NOT NULL AND delivery_lat IS NOT NULL`,
      [q.equipment],
    );
    const matches = rows.filter(r =>
      haversineMiles(q.pickupLat!, q.pickupLng!, r.pickup_lat, r.pickup_lng) <= radius &&
      haversineMiles(q.deliveryLat!, q.deliveryLng!, r.delivery_lat, r.delivery_lng) <= radius,
    );
    if (matches.length > 0) {
      const sorted = [...matches].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      const avg = matches.reduce((s, m) => s + m.gross_pay, 0) / matches.length;
      return {
        count: matches.length,
        avgPay: Math.round(avg),
        lastPay: Math.round(sorted[0].gross_pay),
        lastDate: sorted[0].date,
        precise: true,
      };
    }
  }

  // ── 2) State-pair fallback ──
  if (!q.originState || !q.destState) return null;
  const stats = db.getFirstSync<{ count: number; avg_pay: number }>(
    `SELECT COUNT(*) as count, AVG(gross_pay) as avg_pay
     FROM loads
     WHERE pickup_state = ? AND delivery_state = ? AND equipment_type = ?
       AND status = 'completed'`,
    [q.originState, q.destState, q.equipment],
  );
  if (!stats || stats.count === 0) return null;

  const last = db.getFirstSync<{ gross_pay: number; date: string }>(
    `SELECT gross_pay, date FROM loads
     WHERE pickup_state = ? AND delivery_state = ? AND equipment_type = ?
       AND status = 'completed'
     ORDER BY date DESC, created_at DESC LIMIT 1`,
    [q.originState, q.destState, q.equipment],
  );

  return {
    count:    stats.count,
    avgPay:   Math.round(stats.avg_pay ?? 0),
    lastPay:  Math.round(last?.gross_pay ?? 0),
    lastDate: last?.date ?? '',
    precise:  false,
  };
}

// ── IFTA helpers ──

export interface IFTARow {
  state:   string;
  miles:   number;
  gallons: number;
}

function quarterRange(year: number, q: number): [string, string] {
  const startMonth = (q - 1) * 3 + 1;          // Q1→1, Q2→4, Q3→7, Q4→10
  const endMonth   = startMonth + 2;
  const lastDay    = new Date(year, endMonth, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    `${year}-${pad(startMonth)}-01`,
    `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  ];
}

export function getIFTAData(year: number, q: number): IFTARow[] {
  const [start, end] = quarterRange(year, q);

  // IFTA reports miles actually driven — booked-but-not-started loads excluded.
  const milesRows = db.getAllSync<{ state: string; miles: number }>(
    `SELECT sm.state, SUM(sm.miles) as miles
     FROM state_mileage sm
     JOIN loads l ON sm.load_id = l.id
     WHERE l.date >= ? AND l.date <= ? AND l.status = 'completed'
     GROUP BY sm.state`,
    [start, end]
  );

  const gallonsRows = db.getAllSync<{ state: string; gallons: number }>(
    `SELECT state_purchased as state, SUM(gallons) as gallons
     FROM fuel_entries
     WHERE date >= ? AND date <= ?
     GROUP BY state_purchased`,
    [start, end]
  );

  const milesMap   = new Map(milesRows.map(r   => [r.state,   r.miles]));
  const gallonsMap = new Map(gallonsRows.map(r => [r.state, r.gallons]));
  const allStates  = new Set([...milesMap.keys(), ...gallonsMap.keys()]);

  return Array.from(allStates)
    .map(state => ({
      state,
      miles:   milesMap.get(state)   ?? 0,
      gallons: gallonsMap.get(state) ?? 0,
    }))
    .sort((a, b) => b.miles - a.miles);
}

export function hasIFTAData(year: number, q: number): boolean {
  const [start, end] = quarterRange(year, q);
  // Mirrors getIFTAData: only miles actually driven count toward the quarter.
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) as n FROM loads
     WHERE date >= ? AND date <= ? AND status = 'completed'`,
    [start, end]
  );
  return (row?.n ?? 0) > 0;
}

// ── History helpers ──

export type HistoryFilter = 'week' | 'month' | 'all';

export interface HistoryLoad {
  id: string;
  date: string;
  pickup_city: string;
  pickup_state: string;
  delivery_city: string;
  delivery_state: string;
  total_miles: number;
  gross_pay: number;
  net_pay: number;
  net_rate_per_mile: number;
  status: string;
}

export interface HistoryTotals {
  gross: number;
  net: number;
  miles: number;
  rpm: number;
  count: number;
}

function dateFilterClause(filter: HistoryFilter): [string, string[]] {
  if (filter === 'week')  return [`AND date >= ?`, [weekStart()]];
  if (filter === 'month') return [`AND date >= ?`, [monthStart()]];
  return ['', []];
}

export function getHistoryLoads(filter: HistoryFilter): HistoryLoad[] {
  const [clause, params] = dateFilterClause(filter);
  return db.getAllSync<HistoryLoad>(
    `SELECT id, date, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads WHERE status != 'cancelled' ${clause}
     ORDER BY date DESC, created_at DESC`,
    params
  );
}

export function getHistoryTotals(filter: HistoryFilter): HistoryTotals {
  const [clause, params] = dateFilterClause(filter);
  const row = db.getFirstSync<{ gross: number; net: number; miles: number; count: number }>(
    `SELECT COALESCE(SUM(gross_pay),0) as gross,
            COALESCE(SUM(net_pay),0)   as net,
            COALESCE(SUM(total_miles),0) as miles,
            COUNT(*) as count
     FROM loads WHERE status != 'cancelled' ${clause}`,
    params
  );
  const gross = row?.gross ?? 0;
  // getHistoryTotals is only used for the 'all' filter (week/month use the date-range
  // variant), so subtract every standalone one-off expense.
  const net   = (row?.net ?? 0) - sumGeneralExpenses('0000-01-01');
  const miles = row?.miles ?? 0;
  const count = row?.count ?? 0;
  return { gross, net, miles, rpm: miles > 0 ? net / miles : 0, count };
}

export function getHistoryLoadsDateRange(start: string, end: string): HistoryLoad[] {
  return db.getAllSync<HistoryLoad>(
    `SELECT id, date, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads WHERE status != 'cancelled' AND date >= ? AND date <= ?
     ORDER BY date DESC, created_at DESC`,
    [start, end]
  );
}

export function searchHistoryLoads(query: string): HistoryLoad[] {
  const q = `%${query}%`;
  return db.getAllSync<HistoryLoad>(
    `SELECT id, date, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads
     WHERE status != 'cancelled'
       AND (pickup_city LIKE ? OR delivery_city LIKE ?
            OR pickup_state LIKE ? OR delivery_state LIKE ?
            OR broker_name LIKE ? OR notes LIKE ?
            OR pickup_address LIKE ? OR delivery_address LIKE ?)
     ORDER BY date DESC, created_at DESC
     LIMIT 100`,
    [q, q, q, q, q, q, q, q]
  );
}

export function getHistoryTotalsDateRange(start: string, end: string): HistoryTotals {
  const row = db.getFirstSync<{ gross: number; net: number; miles: number; count: number }>(
    `SELECT COALESCE(SUM(gross_pay),0) as gross,
            COALESCE(SUM(net_pay),0)   as net,
            COALESCE(SUM(total_miles),0) as miles,
            COUNT(*) as count
     FROM loads WHERE status != 'cancelled' AND date >= ? AND date <= ?`,
    [start, end]
  );
  const gross = row?.gross ?? 0;
  const net   = (row?.net ?? 0) - sumGeneralExpenses(start, end);
  const miles = row?.miles ?? 0;
  const count = row?.count ?? 0;
  return { gross, net, miles, rpm: miles > 0 ? net / miles : 0, count };
}

// ── Load helpers ──

export interface LoadInsert {
  date?:               string;   // YYYY-MM-DD — defaults to today if omitted
  pickup_address:      string;
  pickup_city:         string;
  pickup_state:        string;
  delivery_address:    string;
  delivery_city:       string;
  delivery_state:      string;
  equipment_type:      string;
  total_miles:         number;
  gross_pay:           number;
  is_backhaul:         number;
  is_deadhead?:        number;   // empty/unpaid reposition leg (miles still count for IFTA)
  status:              string;
  benchmark_fair_pay_min?: number;
  benchmark_fair_pay_max?: number;
  fuel_cost_for_load:  number;
  fixed_cost_for_load: number;
  net_pay:             number;
  gross_rate_per_mile: number;
  net_rate_per_mile:   number;
  verdict?:            string;
  weight_lbs?:         number;
  bol_number?:         string;
  bol_photo_url?:      string;
  broker_name?:        string;
  broker_mc?:          string;
  notes?:              string;
  additional_costs?:   number;
  // Geocoded endpoint coordinates (when the address was picked from autocomplete).
  pickup_lat?:         number | null;
  pickup_lng?:         number | null;
  delivery_lat?:       number | null;
  delivery_lng?:       number | null;
}

export interface StateMileageInsert {
  state: string;
  miles: number;
  /** 1 when the driver overrode the auto route split by hand. */
  is_manually_edited?: number;
}

export interface LoadExpenseInsert {
  label:    string;
  category: string;
  amount:   number;
}

export interface LoadExpenseRow {
  id:         string;
  load_id:    string;
  label:      string;
  category:   string;
  amount:     number;
  date:       string;
  created_at: string;
}

/**
 * Recompute additional_costs, net_pay, net_rate_per_mile, and verdict on a
 * load after its load_expenses rows change. Called after every add/delete.
 */
function recalculateLoadFinancials(loadId: string): void {
  const load = db.getFirstSync<{
    gross_pay: number;
    fuel_cost_for_load: number;
    fixed_cost_for_load: number;
    total_miles: number;
  }>(
    `SELECT gross_pay, fuel_cost_for_load, fixed_cost_for_load, total_miles
     FROM loads WHERE id = ?`,
    [loadId]
  );
  if (!load) return;

  const expRow = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM load_expenses WHERE load_id = ?`,
    [loadId]
  );
  const additionalCosts = expRow?.total ?? 0;
  const netPay    = load.gross_pay - load.fuel_cost_for_load - load.fixed_cost_for_load - additionalCosts;
  const netRPM    = load.total_miles > 0 ? netPay         / load.total_miles : 0;
  const grossRPM  = load.total_miles > 0 ? load.gross_pay / load.total_miles : 0;

  const { breakEvenRPM } = calcBreakEven();
  let verdict: string | null = null;
  if (breakEvenRPM > 0) {
    if (netRPM >= breakEvenRPM * 1.15)   verdict = 'green';
    else if (netRPM >= breakEvenRPM)      verdict = 'amber';
    else                                  verdict = 'red';
  }

  db.runSync(
    `UPDATE loads
     SET additional_costs = ?, net_pay = ?, gross_rate_per_mile = ?, net_rate_per_mile = ?, verdict = ?
     WHERE id = ?`,
    [additionalCosts, netPay, grossRPM, netRPM, verdict, loadId]
  );
}

export interface LoadUpdate {
  gross_pay?:      number;
  status?:         string;
  equipment_type?: string;
  is_backhaul?:    number;
  weight_lbs?:     number;
  bol_number?:     string;
  broker_name?:    string;
  broker_mc?:      string;
  notes?:          string;
}

/**
 * Update editable fields on an existing load, then recalculate all derived
 * financials (net_pay, RPM, verdict) so the dashboard stays accurate.
 */
export function updateLoad(id: string, updates: LoadUpdate): void {
  db.runSync(
    `UPDATE loads
     SET gross_pay      = ?,
         status         = ?,
         equipment_type = ?,
         is_backhaul    = ?,
         weight_lbs     = ?,
         bol_number     = ?,
         broker_name    = ?,
         broker_mc      = ?,
         notes          = ?
     WHERE id = ?`,
    [
      updates.gross_pay      ?? 0,
      updates.status         ?? 'completed',
      updates.equipment_type ?? 'dry_van',
      updates.is_backhaul    ?? 0,
      updates.weight_lbs     ?? 0,
      updates.bol_number     ?? '',
      updates.broker_name    ?? '',
      updates.broker_mc      ?? '',
      updates.notes          ?? '',
      id,
    ]
  );
  recalculateLoadFinancials(id);
}

/** Mark a load as having contributed to the community rate pool (idempotency flag). */
export function markLoadRateContributed(id: string): void {
  db.runSync('UPDATE loads SET rate_contributed = 1 WHERE id = ?', [id]);
}

/** Add one expense to an existing load and update its financials immediately. */
export function addSingleLoadExpense(loadId: string, expense: LoadExpenseInsert): void {
  const now  = new Date().toISOString();
  const date = now.split('T')[0];
  db.runSync(
    `INSERT INTO load_expenses (id, load_id, label, category, amount, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), loadId, expense.label, expense.category, expense.amount, date, now]
  );
  recalculateLoadFinancials(loadId);
}

// ── Standalone (one-off) general expenses ──────────────────────────────────────

export interface GeneralExpense {
  id:       string;
  label:    string;
  category: string;
  amount:   number;
  date:     string;       // YYYY-MM-DD
}

export interface GeneralExpenseInsert {
  label:    string;
  category: string;
  amount:   number;
  date:     string;       // YYYY-MM-DD
}

/** Insert a standalone one-off expense (not tied to a load). Returns its id. */
export function addGeneralExpense(e: GeneralExpenseInsert): string {
  const id  = uuidv4();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO general_expenses (id, label, category, amount, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, e.label, e.category, e.amount, e.date, now]
  );
  return id;
}

export function deleteGeneralExpense(id: string): void {
  db.runSync('DELETE FROM general_expenses WHERE id = ?', [id]);
  queueDelete('general_expenses', id); // propagate the delete to the cloud on next push
}

export function getGeneralExpensesDateRange(start: string, end: string): GeneralExpense[] {
  return db.getAllSync<GeneralExpense>(
    `SELECT id, label, category, amount, date FROM general_expenses
     WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC`,
    [start, end]
  );
}

export function getAllGeneralExpenses(): GeneralExpense[] {
  return db.getAllSync<GeneralExpense>(
    `SELECT id, label, category, amount, date FROM general_expenses
     ORDER BY date DESC, created_at DESC`
  );
}

/** Replace the entire local general-expenses set. Transactional. */
export function replaceGeneralExpenses(rows: GeneralExpense[]): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM general_expenses');
    for (const r of rows) insertOrReplaceGeneralExpense(r);
  });
}

/** Merge cloud general-expenses into the local set: upsert by id, KEEP
 *  local-only rows. Non-destructive — used by cloud pull. */
export function mergeGeneralExpenses(rows: GeneralExpense[]): void {
  const tombstoned = new Set(getQueuedDeletes('general_expenses'));
  db.withTransactionSync(() => {
    for (const r of rows) {
      if (tombstoned.has(r.id)) continue; // don't resurrect a locally-deleted row
      insertOrReplaceGeneralExpense(r);
    }
  });
}

// Insert only if absent (LOCAL WINS on conflict). replaceGeneralExpenses DELETEs
// first, so no conflict ever fires there.
function insertOrReplaceGeneralExpense(r: GeneralExpense): void {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO general_expenses (id, label, category, amount, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [r.id, r.label, r.category, r.amount, r.date, now]
  );
}

/** Remove one expense from an existing load and update its financials immediately. */
export function deleteSingleLoadExpense(expenseId: string, loadId: string): void {
  db.runSync('DELETE FROM load_expenses WHERE id = ?', [expenseId]);
  recalculateLoadFinancials(loadId);
}

// ── Expense review tracking ────────────────────────────────────────────────────

// ── Category-aware aging rules ─────────────────────────────────────────────────
// How many days before each category is considered potentially stale.
// These mirror real-world change frequencies — insurance renews annually,
// parking can change monthly, truck payments are the most stable.
export const CATEGORY_AGING_DAYS: Record<string, number> = {
  insurance:   335,  // annual renewal — flag ~1 month before typical anniversary
  truck:       180,  // semi-annual check (payoff, refinance, new payment)
  eld:         335,  // annual subscription
  loadboard:   335,  // annual subscription
  maintenance: 90,   // quarterly sanity check
  parking:     60,   // can change with loads, seasons, or moves
  other:       90,   // catch-all: quarterly
};

/** How many days since this expense was last confirmed (or first entered). */
function daysSinceConfirmed(confirmedAt: string | null, createdAt?: string): number {
  const ref = confirmedAt ?? createdAt ?? new Date().toISOString();
  const d = new Date(ref);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export interface StaleCategoryAlert {
  expenseId:   string;
  label:       string;
  category:    string;
  amount:      number;
  frequency:   string;
  daysSince:   number;   // how long since last confirmed
  dueDays:     number;   // how many days past due (positive = overdue)
}

/**
 * Returns expenses whose category-specific aging threshold has been exceeded.
 * Sorted by how overdue they are (most overdue first).
 */
export function getStaleCategoryAlerts(): StaleCategoryAlert[] {
  const rows = db.getAllSync<UserExpenseRow & { created_at: string }>(
    `SELECT id, label, category, amount, frequency, monthly_equivalent,
            COALESCE(confirmed_at, created_at) as confirmed_at,
            created_at
     FROM user_expenses WHERE is_active = 1 AND category != 'fuel'`
  );

  const alerts: StaleCategoryAlert[] = [];
  for (const r of rows) {
    const threshold = CATEGORY_AGING_DAYS[r.category] ?? 90;
    const days = daysSinceConfirmed(r.confirmed_at);
    if (days >= threshold) {
      alerts.push({
        expenseId: r.id,
        label:     r.label,
        category:  r.category,
        amount:    r.amount,
        frequency: r.frequency,
        daysSince: days,
        dueDays:   days - threshold,
      });
    }
  }
  return alerts.sort((a, b) => b.dueDays - a.dueDays);
}

/**
 * Stamp a single expense row as confirmed-accurate today.
 * Call when the driver taps "✓" on that row in the review modal.
 */
export function confirmExpense(id: string): void {
  db.runSync(
    `UPDATE user_expenses SET confirmed_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

/**
 * Stamp ALL expense rows as confirmed today (driver tapped "All accurate").
 */
export function confirmAllExpenses(): void {
  db.runSync(`UPDATE user_expenses SET confirmed_at = ? WHERE is_active = 1`, [new Date().toISOString()]);
}

const REVIEW_KEY = 'last_expense_review';
const REVIEW_INTERVAL_DAYS = 30;

/**
 * Record that the driver just reviewed their recurring expenses.
 * Stamps today's date; resets the stale timer.
 */
export function markExpensesReviewed(): void {
  setSetting(REVIEW_KEY, localDateISO());
}

/**
 * How many days since the driver last reviewed their recurring expenses.
 * Returns null if never reviewed (onboarding completion acts as first review).
 */
export function daysSinceExpenseReview(): number | null {
  const raw = getSetting(REVIEW_KEY);
  if (!raw) return null;
  const last = new Date(raw + 'T12:00:00');
  const now  = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Whether expenses should prompt a review — true when:
 *   (a) any individual expense has exceeded its category-specific aging threshold, OR
 *   (b) the flat 30-day global review timer has expired (safety net).
 * Returns false when there are no recurring expenses.
 */
export function expensesAreStale(): boolean {
  if (getTotalMonthlyExpenses() <= 0) return false;
  // Category-aware check: any overdue individual expense?
  if (getStaleCategoryAlerts().length > 0) return true;
  // Flat safety net: hasn't been reviewed globally in 30 days?
  const days = daysSinceExpenseReview();
  if (days === null) return true;
  return days >= REVIEW_INTERVAL_DAYS;
}

export function getLoadExpenses(loadId: string): LoadExpenseRow[] {
  return db.getAllSync<LoadExpenseRow>(
    `SELECT id, load_id, label, category, amount, date, created_at
     FROM load_expenses WHERE load_id = ? ORDER BY created_at ASC`,
    [loadId]
  );
}

export function getAllLoadExpenses(): LoadExpenseRow[] {
  return db.getAllSync<LoadExpenseRow>(
    `SELECT id, load_id, label, category, amount, date, created_at FROM load_expenses`
  );
}

/** Delete + re-insert all expenses for a load (sync-safe replace). */
export function replaceLoadExpenses(loadId: string, expenses: LoadExpenseRow[]): void {
  db.runSync('DELETE FROM load_expenses WHERE load_id = ?', [loadId]);
  const now = new Date().toISOString();
  for (const e of expenses) {
    db.runSync(
      `INSERT INTO load_expenses (id, load_id, label, category, amount, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [e.id, loadId, e.label, e.category, e.amount, e.date, e.created_at ?? now]
    );
  }
}

export function saveLoad(
  load: LoadInsert,
  stateMileage: StateMileageInsert[],
  expenses: LoadExpenseInsert[] = [],
): string {
  const id   = uuidv4();
  const now  = new Date().toISOString();
  const date = load.date ?? localDateISO();

  db.withTransactionSync(() => {
  db.runSync(
    `INSERT INTO loads (
      id, date,
      pickup_address, pickup_city, pickup_state,
      delivery_address, delivery_city, delivery_state,
      equipment_type, total_miles, gross_pay, additional_costs,
      is_backhaul, status,
      benchmark_fair_pay_min, benchmark_fair_pay_max,
      fuel_cost_for_load, fixed_cost_for_load, net_pay,
      gross_rate_per_mile, net_rate_per_mile, verdict,
      weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc, notes,
      is_deadhead, created_at,
      pickup_lat, pickup_lng, delivery_lat, delivery_lng
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, date,
      load.pickup_address,  load.pickup_city,  load.pickup_state,
      load.delivery_address, load.delivery_city, load.delivery_state,
      load.equipment_type, load.total_miles, load.gross_pay, load.additional_costs ?? 0,
      load.is_backhaul, load.status,
      load.benchmark_fair_pay_min ?? null, load.benchmark_fair_pay_max ?? null,
      load.fuel_cost_for_load, load.fixed_cost_for_load, load.net_pay,
      load.gross_rate_per_mile, load.net_rate_per_mile, load.verdict ?? null,
      load.weight_lbs ?? 0, load.bol_number ?? '', load.bol_photo_url ?? '', load.broker_name ?? '',
      load.broker_mc ?? '', load.notes ?? '',
      load.is_deadhead ?? 0, now,
      load.pickup_lat ?? null, load.pickup_lng ?? null, load.delivery_lat ?? null, load.delivery_lng ?? null,
    ]
  );

  for (const sm of stateMileage) {
    db.runSync(
      'INSERT INTO state_mileage (load_id, state, miles, is_manually_edited) VALUES (?,?,?,?)',
      [id, sm.state, sm.miles, sm.is_manually_edited ?? 0]
    );
  }

  // Insert load expense rows (scale, toll, lumper, etc.)
  if (expenses.length > 0) {
    for (const e of expenses) {
      db.runSync(
        `INSERT INTO load_expenses (id, load_id, label, category, amount, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, e.label, e.category, e.amount, date, now]
      );
    }
  }
  });

  return id;
}

/**
 * Delete a load and everything attached to it. The FK CASCADE removes its
 * state_mileage + load_expenses rows; we queue a tombstone so the delete
 * propagates to the cloud on the next push (instead of resurrecting on pull).
 */
export function deleteLoad(id: string): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM loads WHERE id = ?', [id]);
    queueDelete('loads', id);
  });
}

// ── Loads + state_mileage sync helpers ──

export interface LoadRow {
  id: string;
  date: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  equipment_type: string;
  total_miles: number;
  gross_pay: number;
  additional_costs: number;
  weight_lbs: number;
  bol_number: string;
  bol_photo_url: string;
  broker_name: string;
  broker_mc: string;
  is_deadhead: number;
  is_backhaul: number;
  status: string;
  notes: string;
  benchmark_fair_pay_min: number | null;
  benchmark_fair_pay_max: number | null;
  fuel_cost_for_load: number;
  fixed_cost_for_load: number;
  net_pay: number;
  gross_rate_per_mile: number;
  net_rate_per_mile: number;
  verdict: string | null;
  created_at: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  /**
   * Idempotency marker for community rate-pool contribution (see
   * maybeContributeLoadRate). Synced to the cloud (2026-07-09) after a real
   * bug: it was device-local only, so a local DB wipe + cloud restore (sign
   * out/in, cross-account claim, reinstall — all routine, not edge cases)
   * reset it to 0 even though the load had already been contributed,
   * silently duplicating that load's data in the crowdsourced rate pool the
   * next time anything re-touched it. Now round-trips like every other field.
   */
  rate_contributed: number;
}

export interface StateMileageRow {
  load_id: string;
  state: string;
  miles: number;
  is_manually_edited: number;
}

export function getAllLoads(): LoadRow[] {
  return db.getAllSync<LoadRow>(
    `SELECT id, date, pickup_address, pickup_city, pickup_state,
            delivery_address, delivery_city, delivery_state,
            equipment_type, total_miles, gross_pay, additional_costs,
            weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
            is_deadhead, is_backhaul, status, notes,
            benchmark_fair_pay_min, benchmark_fair_pay_max,
            fuel_cost_for_load, fixed_cost_for_load, net_pay,
            gross_rate_per_mile, net_rate_per_mile, verdict, created_at,
            pickup_lat, pickup_lng, delivery_lat, delivery_lng, rate_contributed
     FROM loads ORDER BY date DESC, created_at DESC`
  );
}

export function getAllStateMileage(): StateMileageRow[] {
  return db.getAllSync<StateMileageRow>(
    `SELECT load_id, state, miles, is_manually_edited FROM state_mileage`
  );
}

/** Replace all local loads (+ their state_mileage rows) with the given sets.
 *  Transactional: a mid-loop failure rolls back rather than emptying the table. */
export function replaceLoads(
  loads: LoadRow[],
  stateMileage: StateMileageRow[]
): void {
  db.withTransactionSync(() => {
    // DELETE loads first — CASCADE removes child state_mileage rows automatically.
    db.runSync('DELETE FROM loads');
    for (const l of loads) upsertLoadRow(l);
    for (const sm of stateMileage) {
      db.runSync(
        'INSERT INTO state_mileage (load_id, state, miles, is_manually_edited) VALUES (?,?,?,?)',
        [sm.load_id, sm.state, sm.miles, sm.is_manually_edited]
      );
    }
  });
}

/** Merge cloud loads into the local set: upsert each load by id and KEEP
 *  local-only loads (unpushed local saves survive). For every merged load we
 *  refresh its state_mileage rows from the cloud set. Non-destructive — this
 *  is what cloud pull uses so re-authenticating never destroys local data. */
export function mergeLoads(
  loads: LoadRow[],
  stateMileage: StateMileageRow[]
): void {
  // LOCAL WINS: only add cloud loads that aren't already local (so a locally-edited
  // load and its state_mileage are never overwritten by a staler cloud copy), and
  // skip loads the user just deleted (tombstone queue) so they can't resurrect.
  const tombstoned = new Set(getQueuedDeletes('loads'));
  db.withTransactionSync(() => {
    const smByLoad = new Map<string, StateMileageRow[]>();
    for (const sm of stateMileage) {
      const arr = smByLoad.get(sm.load_id) ?? [];
      arr.push(sm);
      smByLoad.set(sm.load_id, arr);
    }
    for (const l of loads) {
      if (tombstoned.has(l.id)) continue;
      const exists = db.getFirstSync<{ x: number }>('SELECT 1 AS x FROM loads WHERE id = ?', [l.id]);
      if (exists) continue; // keep the local copy + its state rows untouched
      upsertLoadRow(l); // id is guaranteed absent → plain insert
      for (const sm of smByLoad.get(l.id) ?? []) {
        db.runSync(
          'INSERT INTO state_mileage (load_id, state, miles, is_manually_edited) VALUES (?,?,?,?)',
          [sm.load_id, sm.state, sm.miles, sm.is_manually_edited]
        );
      }
    }
  });
}

// Upsert a single load by id (ON CONFLICT DO UPDATE — never INSERT OR REPLACE,
// which would CASCADE-delete the load's state_mileage rows).
function upsertLoadRow(l: LoadRow): void {
  db.runSync(
    `INSERT INTO loads (
      id, date, pickup_address, pickup_city, pickup_state,
      delivery_address, delivery_city, delivery_state,
      equipment_type, total_miles, gross_pay, additional_costs,
      weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
      is_deadhead, is_backhaul, status, notes,
      benchmark_fair_pay_min, benchmark_fair_pay_max,
      fuel_cost_for_load, fixed_cost_for_load, net_pay,
      gross_rate_per_mile, net_rate_per_mile, verdict, created_at,
      pickup_lat, pickup_lng, delivery_lat, delivery_lng, rate_contributed
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      date=excluded.date, pickup_address=excluded.pickup_address, pickup_city=excluded.pickup_city,
      pickup_state=excluded.pickup_state, delivery_address=excluded.delivery_address,
      delivery_city=excluded.delivery_city, delivery_state=excluded.delivery_state,
      equipment_type=excluded.equipment_type, total_miles=excluded.total_miles,
      gross_pay=excluded.gross_pay, additional_costs=excluded.additional_costs,
      weight_lbs=excluded.weight_lbs, bol_number=excluded.bol_number, bol_photo_url=excluded.bol_photo_url,
      broker_name=excluded.broker_name, broker_mc=excluded.broker_mc, is_deadhead=excluded.is_deadhead,
      is_backhaul=excluded.is_backhaul, status=excluded.status, notes=excluded.notes,
      benchmark_fair_pay_min=excluded.benchmark_fair_pay_min, benchmark_fair_pay_max=excluded.benchmark_fair_pay_max,
      fuel_cost_for_load=excluded.fuel_cost_for_load, fixed_cost_for_load=excluded.fixed_cost_for_load,
      net_pay=excluded.net_pay, gross_rate_per_mile=excluded.gross_rate_per_mile,
      net_rate_per_mile=excluded.net_rate_per_mile, verdict=excluded.verdict, created_at=excluded.created_at,
      pickup_lat=excluded.pickup_lat, pickup_lng=excluded.pickup_lng,
      delivery_lat=excluded.delivery_lat, delivery_lng=excluded.delivery_lng,
      rate_contributed=excluded.rate_contributed`,
    [
      l.id, l.date, l.pickup_address, l.pickup_city, l.pickup_state,
      l.delivery_address, l.delivery_city, l.delivery_state,
      l.equipment_type, l.total_miles, l.gross_pay, l.additional_costs,
      l.weight_lbs, l.bol_number, l.bol_photo_url, l.broker_name, l.broker_mc,
      l.is_deadhead, l.is_backhaul, l.status, l.notes,
      l.benchmark_fair_pay_min ?? null, l.benchmark_fair_pay_max ?? null,
      l.fuel_cost_for_load, l.fixed_cost_for_load, l.net_pay,
      l.gross_rate_per_mile, l.net_rate_per_mile, l.verdict ?? null, l.created_at,
      l.pickup_lat ?? null, l.pickup_lng ?? null, l.delivery_lat ?? null, l.delivery_lng ?? null,
      l.rate_contributed ? 1 : 0,
    ]
  );
}

// ── Load detail (for Load Detail screen) ──

export interface LoadDetail {
  id:                     string;
  date:                   string;
  pickup_address:         string;
  pickup_city:            string;
  pickup_state:           string;
  delivery_address:       string;
  delivery_city:          string;
  delivery_state:         string;
  equipment_type:         string;
  total_miles:            number;
  gross_pay:              number;
  additional_costs:       number;
  is_backhaul:            number;
  status:                 string;
  weight_lbs:             number;
  bol_number:             string;
  bol_photo_url:          string;
  broker_name:            string;
  broker_mc:              string;
  notes:                  string;
  benchmark_fair_pay_min: number | null;
  benchmark_fair_pay_max: number | null;
  fuel_cost_for_load:     number;
  fixed_cost_for_load:    number;
  net_pay:                number;
  gross_rate_per_mile:    number;
  net_rate_per_mile:      number;
  verdict:                string | null;
  stateMileage:           { state: string; miles: number }[];
  loadExpenses:           { id: string; label: string; category: string; amount: number }[];
}

export function getLoadById(id: string): LoadDetail | null {
  const load = db.getFirstSync<any>(
    `SELECT id, date, pickup_address, pickup_city, pickup_state,
            delivery_address, delivery_city, delivery_state,
            equipment_type, total_miles, gross_pay, additional_costs,
            is_backhaul, status, weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
            notes, benchmark_fair_pay_min, benchmark_fair_pay_max,
            fuel_cost_for_load, fixed_cost_for_load, net_pay,
            gross_rate_per_mile, net_rate_per_mile, verdict, rate_contributed
     FROM loads WHERE id = ?`,
    [id]
  );
  if (!load) return null;
  const stateMileage = db.getAllSync<{ state: string; miles: number }>(
    `SELECT state, miles FROM state_mileage WHERE load_id = ? ORDER BY miles DESC`,
    [id]
  );
  const loadExpenses = db.getAllSync<{ id: string; label: string; category: string; amount: number }>(
    `SELECT id, label, category, amount FROM load_expenses WHERE load_id = ? ORDER BY created_at ASC`,
    [id]
  );
  return { ...load, stateMileage, loadExpenses };
}

/**
 * Wipe all user-specific data from local SQLite on sign-out so the next account
 * to sign in on this device starts clean. Device preferences (language) are
 * preserved. Per-user onboarding flags are keyed by user ID already so they
 * don't need clearing.
 */
export function clearAllUserData(): void {
  // Loads cascade to state_mileage via FK ON DELETE CASCADE.
  db.runSync('DELETE FROM loads');
  db.runSync('DELETE FROM fuel_entries');
  db.runSync('DELETE FROM user_expenses');
  db.runSync('DELETE FROM general_expenses');
  // Clear all user-specific settings.
  // Preserved: language, walkthrough_seen (device preferences that survive sign-out).
  // onboarding_completed:* per-user keys are preserved — they're keyed by user ID
  // so leaking them to a different account is harmless (wrong key is never matched).
  db.runSync(
    `DELETE FROM settings WHERE key IN (
      'weekly_miles', 'weekly_fuel_cost', 'guest_mode', 'has_real_account',
      'income_goal_amount', 'income_goal_period',
      'income_goal_milestones', 'income_goal_milestone_period',
      'profile_name', 'profile_equipment_type', 'profile_truck_number', 'profile_home_base',
      'data_owner_id'
    )`
  );
}

/**
 * Claim local data for a signing-in account (the Uber/Partiful "one source of
 * truth" model). Local data is owned by exactly one identity at a time:
 *   - guest / fresh device → owner is unset (''); its data may consolidate onto
 *     the first account that signs in (the cloud-empty push in syncXOnSignIn).
 *   - a real account → owner is its user id.
 *
 * If the local data belongs to a DIFFERENT real account (e.g. a session expired
 * without an explicit sign-out, then a second account signs in), we wipe it
 * FIRST so it can never be pushed up into — or merged with — the new account.
 * Returns true when a wipe occurred. Call this on every sign-in, before sync.
 */
export function claimDataOwnership(userId: string): boolean {
  const prev = getSetting('data_owner_id') ?? '';
  const mismatch = prev !== '' && prev !== userId;
  if (mismatch) clearAllUserData();   // different account's data — never consolidate it
  setSetting('data_owner_id', userId);
  return mismatch;
}

// ── Income goal ───────────────────────────────────────────────────────────────

export function getIncomeGoal(): { amount: number; period: 'weekly' | 'monthly' } | null {
  const amt = parseFloat(getSetting('income_goal_amount') ?? '0');
  if (!amt || amt <= 0) return null;
  const period = (getSetting('income_goal_period') ?? 'weekly') as 'weekly' | 'monthly';
  return { amount: amt, period };
}

export function setIncomeGoal(amount: number | null, period: 'weekly' | 'monthly'): void {
  setSetting('income_goal_amount', String(amount && amount > 0 ? amount : 0));
  setSetting('income_goal_period', period);
  // Reset milestone tracking whenever goal changes.
  setSetting('income_goal_milestones', '');
  setSetting('income_goal_milestone_period', '');
}

function goalPeriodKey(period: 'weekly' | 'monthly'): string {
  const now = new Date();
  if (period === 'monthly') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getGoalMilestonesHit(period: 'weekly' | 'monthly'): number[] {
  const storedPeriod = getSetting('income_goal_milestone_period') ?? '';
  if (storedPeriod !== goalPeriodKey(period)) return [];
  const raw = getSetting('income_goal_milestones') ?? '';
  return raw.split(',').map(Number).filter(Boolean);
}

export function markGoalMilestoneHit(milestone: 75 | 100, period: 'weekly' | 'monthly'): void {
  const key = goalPeriodKey(period);
  setSetting('income_goal_milestone_period', key);
  const existing = getGoalMilestonesHit(period);
  if (!existing.includes(milestone)) {
    setSetting('income_goal_milestones', [...existing, milestone].join(','));
  }
}

// ── Fuel stats for FuelScreen ──

export interface FuelEntryDisplay {
  id: string;
  date: string;
  state: string;
  gallons: number;
  price_per_gallon: number;
  dollars_spent: number;
  cost_per_mile: number;
  mpg: number;
}

export interface FuelStats {
  latestCPM:     number;   // rolling weighted avg of last 10 fill-ups
  rollingCount:  number;   // how many fill-ups in the rolling window
  latestDate:    string;   // YYYY-MM-DD of most recent entry, or ''
  latestState:   string;
  avgCPMMonthly: number;
  totalSpentMonth: number;
  totalGallonsMonth: number;
  last5:         FuelEntryDisplay[];   // newest first, for the trend chart
  allEntries:    FuelEntryDisplay[];   // newest first, for history list
}

export function getFuelStats(): FuelStats {
  const month = monthStart();

  const latestRow = db.getFirstSync<{ date: string; state_purchased: string }>(
    `SELECT date, state_purchased FROM fuel_entries ORDER BY date DESC, rowid DESC LIMIT 1`
  );

  // Rolling weighted CPM (same window as getLatestFuelCPM) + entry count for UI label
  const rollingRow = db.getFirstSync<{ avg_cpm: number; entry_count: number }>(
    `SELECT SUM(dollars_spent) / NULLIF(SUM(miles_driven), 0) AS avg_cpm,
            COUNT(*) AS entry_count
     FROM (SELECT dollars_spent, miles_driven FROM fuel_entries
           WHERE miles_driven > 0 AND dollars_spent > 0
           ORDER BY date DESC, rowid DESC LIMIT 10)`
  );

  const monthRow = db.getFirstSync<{ spent: number; gallons: number; avg_cpm: number }>(
    `SELECT COALESCE(SUM(dollars_spent), 0) as spent,
            COALESCE(SUM(gallons), 0)       as gallons,
            COALESCE(AVG(cost_per_mile), 0) as avg_cpm
     FROM fuel_entries WHERE date >= ?`,
    [month]
  );

  const last5 = db.getAllSync<FuelEntryDisplay>(
    `SELECT id, date, state_purchased as state, gallons, price_per_gallon,
            dollars_spent, cost_per_mile, mpg
     FROM fuel_entries ORDER BY date DESC, rowid DESC LIMIT 5`
  );

  const allEntries = db.getAllSync<FuelEntryDisplay>(
    `SELECT id, date, state_purchased as state, gallons, price_per_gallon,
            dollars_spent, cost_per_mile, mpg
     FROM fuel_entries ORDER BY date DESC, rowid DESC`
  );

  return {
    latestCPM:         rollingRow?.avg_cpm       ?? 0,
    rollingCount:      rollingRow?.entry_count   ?? 0,
    latestDate:        latestRow?.date            ?? '',
    latestState:       latestRow?.state_purchased ?? '',
    avgCPMMonthly:     monthRow?.avg_cpm          ?? 0,
    totalSpentMonth:   monthRow?.spent            ?? 0,
    totalGallonsMonth: monthRow?.gallons          ?? 0,
    last5,
    allEntries,
  };
}

export function getFuelEntryCount(): number {
  const row = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM fuel_entries');
  return row?.n ?? 0;
}

export default db;
