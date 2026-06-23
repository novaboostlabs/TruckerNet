import * as SQLite from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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

/** Replace all local fuel entries with the given set (used by cloud pull). */
export function replaceFuelEntries(rows: FuelEntryRow[]): void {
  db.runSync('DELETE FROM fuel_entries');
  for (const r of rows) {
    db.runSync(
      `INSERT INTO fuel_entries (${FUEL_COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, r.date, r.dollars_spent, r.gallons, r.miles_driven,
        r.cost_per_mile, r.price_per_gallon, r.mpg, r.odometer_reading, r.state_purchased,
      ]
    );
  }
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

export function getMonthlyMiles(): number {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = "weekly_miles"');
  const weekly = parseFloat(row?.value ?? '0');
  return weekly * 4.333;
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
}

/** All active, non-fuel expenses — the same set the break-even engine sums. */
export function getUserExpenses(): UserExpenseRow[] {
  return db.getAllSync<UserExpenseRow>(
    `SELECT id, label, category, amount, frequency, monthly_equivalent
     FROM user_expenses
     WHERE is_active = 1 AND category != 'fuel'
     ORDER BY sort_order ASC`
  );
}

/** Replace all expenses with the given set (fuel is tracked separately via fuel_entries). */
export function replaceUserExpenses(
  expenses: { id: string; label: string; category: string; amount: number; frequency: string; monthly_equivalent: number }[]
): void {
  db.runSync('DELETE FROM user_expenses');
  const now = new Date().toISOString();
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    db.runSync(
      `INSERT INTO user_expenses (id, label, category, amount, frequency, monthly_equivalent, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [e.id, e.label, e.category, e.amount, e.frequency, e.monthly_equivalent, i, now]
    );
  }
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

// ── P&L / Dashboard helpers ──

function weekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // back to Monday
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function getLoadCount(): number {
  const row = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM loads');
  return row?.n ?? 0;
}

// Loads logged in the current calendar month — drives the free-tier 15-loads/mo
// gate. Cancelled loads still count (the user did the work of logging them).
export function getLoadCountThisMonth(): number {
  const row = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) as n FROM loads WHERE date >= ?',
    [monthStart()]
  );
  return row?.n ?? 0;
}

export function getWeekPnL(): { net: number; gross: number } {
  const row = db.getFirstSync<{ net: number; gross: number }>(
    `SELECT COALESCE(SUM(net_pay),0) as net, COALESCE(SUM(gross_pay),0) as gross
     FROM loads WHERE date >= ? AND status != 'cancelled'`,
    [weekStart()]
  );
  return row ?? { net: 0, gross: 0 };
}

export function getMonthPnL(): { net: number; gross: number } {
  const row = db.getFirstSync<{ net: number; gross: number }>(
    `SELECT COALESCE(SUM(net_pay),0) as net, COALESCE(SUM(gross_pay),0) as gross
     FROM loads WHERE date >= ? AND status != 'cancelled'`,
    [monthStart()]
  );
  return row ?? { net: 0, gross: 0 };
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

export function getActiveLoad(): LoadSummary | null {
  return db.getFirstSync<LoadSummary>(
    `SELECT id, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile, status
     FROM loads WHERE status = 'in_progress' ORDER BY date DESC, created_at DESC LIMIT 1`
  ) ?? null;
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

  const milesRows = db.getAllSync<{ state: string; miles: number }>(
    `SELECT sm.state, SUM(sm.miles) as miles
     FROM state_mileage sm
     JOIN loads l ON sm.load_id = l.id
     WHERE l.date >= ? AND l.date <= ? AND l.status != 'cancelled'
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
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) as n FROM loads
     WHERE date >= ? AND date <= ? AND status != 'cancelled'`,
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
            total_miles, gross_pay, net_pay, net_rate_per_mile
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
  const net   = row?.net   ?? 0;
  const miles = row?.miles ?? 0;
  const count = row?.count ?? 0;
  return { gross, net, miles, rpm: miles > 0 ? net / miles : 0, count };
}

export function getHistoryLoadsDateRange(start: string, end: string): HistoryLoad[] {
  return db.getAllSync<HistoryLoad>(
    `SELECT id, date, pickup_city, pickup_state, delivery_city, delivery_state,
            total_miles, gross_pay, net_pay, net_rate_per_mile
     FROM loads WHERE status != 'cancelled' AND date >= ? AND date <= ?
     ORDER BY date DESC, created_at DESC`,
    [start, end]
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
  const net   = row?.net   ?? 0;
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
}

export interface StateMileageInsert {
  state: string;
  miles: number;
}

export function saveLoad(load: LoadInsert, stateMileage: StateMileageInsert[]): string {
  const id   = uuidv4();
  const now  = new Date().toISOString();
  const date = load.date ?? now.split('T')[0];

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
      is_deadhead, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      0, now,
    ]
  );

  for (const sm of stateMileage) {
    db.runSync(
      'INSERT INTO state_mileage (load_id, state, miles) VALUES (?,?,?)',
      [id, sm.state, sm.miles]
    );
  }

  return id;
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
            gross_rate_per_mile, net_rate_per_mile, verdict, created_at
     FROM loads ORDER BY date DESC, created_at DESC`
  );
}

export function getAllStateMileage(): StateMileageRow[] {
  return db.getAllSync<StateMileageRow>(
    `SELECT load_id, state, miles, is_manually_edited FROM state_mileage`
  );
}

/** Replace all local loads (+ their state_mileage rows) with the given sets. */
export function replaceLoads(
  loads: LoadRow[],
  stateMileage: StateMileageRow[]
): void {
  // DELETE loads first — CASCADE removes child state_mileage rows automatically.
  db.runSync('DELETE FROM loads');

  for (const l of loads) {
    db.runSync(
      `INSERT INTO loads (
        id, date, pickup_address, pickup_city, pickup_state,
        delivery_address, delivery_city, delivery_state,
        equipment_type, total_miles, gross_pay, additional_costs,
        weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
        is_deadhead, is_backhaul, status, notes,
        benchmark_fair_pay_min, benchmark_fair_pay_max,
        fuel_cost_for_load, fixed_cost_for_load, net_pay,
        gross_rate_per_mile, net_rate_per_mile, verdict, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        l.id, l.date, l.pickup_address, l.pickup_city, l.pickup_state,
        l.delivery_address, l.delivery_city, l.delivery_state,
        l.equipment_type, l.total_miles, l.gross_pay, l.additional_costs,
        l.weight_lbs, l.bol_number, l.bol_photo_url, l.broker_name, l.broker_mc,
        l.is_deadhead, l.is_backhaul, l.status, l.notes,
        l.benchmark_fair_pay_min ?? null, l.benchmark_fair_pay_max ?? null,
        l.fuel_cost_for_load, l.fixed_cost_for_load, l.net_pay,
        l.gross_rate_per_mile, l.net_rate_per_mile, l.verdict ?? null, l.created_at,
      ]
    );
  }

  for (const sm of stateMileage) {
    db.runSync(
      'INSERT INTO state_mileage (load_id, state, miles, is_manually_edited) VALUES (?,?,?,?)',
      [sm.load_id, sm.state, sm.miles, sm.is_manually_edited]
    );
  }
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
}

export function getLoadById(id: string): LoadDetail | null {
  const load = db.getFirstSync<any>(
    `SELECT id, date, pickup_address, pickup_city, pickup_state,
            delivery_address, delivery_city, delivery_state,
            equipment_type, total_miles, gross_pay, additional_costs,
            is_backhaul, status, weight_lbs, bol_number, bol_photo_url, broker_name, broker_mc,
            notes, benchmark_fair_pay_min, benchmark_fair_pay_max,
            fuel_cost_for_load, fixed_cost_for_load, net_pay,
            gross_rate_per_mile, net_rate_per_mile, verdict
     FROM loads WHERE id = ?`,
    [id]
  );
  if (!load) return null;
  const stateMileage = db.getAllSync<{ state: string; miles: number }>(
    `SELECT state, miles FROM state_mileage WHERE load_id = ? ORDER BY miles DESC`,
    [id]
  );
  return { ...load, stateMileage };
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
  // Clear all user-specific settings.
  // Preserved: language (device preference), onboarding_completed:* (keyed by user id — harmless).
  db.runSync(
    `DELETE FROM settings WHERE key IN (
      'weekly_miles', 'weekly_fuel_cost', 'guest_mode', 'has_real_account'
    )`
  );
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
