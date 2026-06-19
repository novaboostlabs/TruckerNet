import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('truckernet.db');

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
  ];

  for (const sql of migrations) {
    try { db.execSync(sql); } catch { /* column already exists */ }
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

// ── Fuel CPM helpers ──

export function getLatestFuelCPM(): number {
  const row = db.getFirstSync<{ cost_per_mile: number }>(
    'SELECT cost_per_mile FROM fuel_entries ORDER BY date DESC LIMIT 1'
  );
  return row?.cost_per_mile ?? 0;
}

export function getLatestOdometer(): number {
  const row = db.getFirstSync<{ odometer_reading: number }>(
    'SELECT odometer_reading FROM fuel_entries WHERE odometer_reading > 0 ORDER BY date DESC LIMIT 1'
  );
  return row?.odometer_reading ?? 0;
}

// ── Expense helpers ──

export function getTotalMonthlyExpenses(): number {
  const row = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(monthly_equivalent), 0) as total FROM user_expenses WHERE is_active = 1'
  );
  return row?.total ?? 0;
}

export function getMonthlyMiles(): number {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = "weekly_miles"');
  const weekly = parseFloat(row?.value ?? '0');
  return weekly * 4.333;
}

// ── Break-even calculation ──

export function calcBreakEven(): { breakEvenRPM: number; fuelCPM: number; fixedCPM: number } {
  const fuelCPM      = getLatestFuelCPM();
  const totalFixed   = getTotalMonthlyExpenses();
  const monthlyMiles = getMonthlyMiles();

  if (monthlyMiles <= 0) return { breakEvenRPM: 0, fuelCPM, fixedCPM: 0 };

  const fixedCPM = totalFixed / monthlyMiles;
  return { breakEvenRPM: fuelCPM + fixedCPM, fuelCPM, fixedCPM };
}

export default db;
