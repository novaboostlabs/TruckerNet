import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('truckernet.db');

export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      truck_payment REAL NOT NULL DEFAULT 0,
      insurance REAL NOT NULL DEFAULT 0,
      eld_payment REAL NOT NULL DEFAULT 0,
      maintenance_monthly REAL NOT NULL DEFAULT 0,
      parking_monthly REAL NOT NULL DEFAULT 0,
      other_expenses REAL NOT NULL DEFAULT 0,
      estimated_monthly_miles REAL NOT NULL DEFAULT 1,
      fixed_cost_per_mile REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      dollars_spent REAL NOT NULL,
      gallons REAL NOT NULL,
      miles_driven REAL NOT NULL,
      cost_per_mile REAL NOT NULL,
      price_per_gallon REAL NOT NULL DEFAULT 0,
      state_purchased TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loads (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      pickup_city TEXT NOT NULL,
      pickup_state TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_state TEXT NOT NULL,
      equipment_type TEXT NOT NULL DEFAULT 'dry_van',
      total_miles REAL NOT NULL DEFAULT 0,
      gross_pay REAL NOT NULL DEFAULT 0,
      additional_costs REAL NOT NULL DEFAULT 0,
      weight_lbs REAL NOT NULL DEFAULT 0,
      bol_number TEXT NOT NULL DEFAULT '',
      broker_name TEXT NOT NULL DEFAULT '',
      broker_mc TEXT NOT NULL DEFAULT '',
      is_deadhead INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      benchmark_fair_pay REAL,
      fuel_cost_for_load REAL NOT NULL DEFAULT 0,
      fixed_cost_for_load REAL NOT NULL DEFAULT 0,
      net_pay REAL NOT NULL DEFAULT 0,
      gross_rate_per_mile REAL NOT NULL DEFAULT 0,
      net_rate_per_mile REAL NOT NULL DEFAULT 0,
      verdict TEXT
    );

    CREATE TABLE IF NOT EXISTS state_mileage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      load_id TEXT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      miles REAL NOT NULL,
      is_manually_edited INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migrations for existing databases
  try { db.execSync(`ALTER TABLE fixed_expenses ADD COLUMN maintenance_monthly REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE fixed_expenses ADD COLUMN parking_monthly REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE fuel_entries ADD COLUMN price_per_gallon REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN equipment_type TEXT NOT NULL DEFAULT 'dry_van'`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN additional_costs REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN broker_name TEXT NOT NULL DEFAULT ''`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN broker_mc TEXT NOT NULL DEFAULT ''`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN gross_rate_per_mile REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN net_rate_per_mile REAL NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN verdict TEXT`); } catch {}
  try { db.execSync(`ALTER TABLE loads ADD COLUMN benchmark_fair_pay REAL`); } catch {}
}

export default db;
