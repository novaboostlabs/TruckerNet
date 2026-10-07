// Test-only stand-in for src/db/sqlite.native.ts. Same surface as the app's
// `db` wrapper, backed by Node's built-in SQLite (node:sqlite) instead of
// expo-sqlite, so the real src/db/database.ts — SQL and all — runs under
// Vitest against a real in-memory database. Wired in by vitest.config.ts.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

let raw = new DatabaseSync(':memory:');

/** Fresh empty database. Call before initDatabase() in each test. */
export function resetTestDb(): void {
  raw.close();
  raw = new DatabaseSync(':memory:');
}

// expo-sqlite coerces booleans to 1/0, and the app's native wrapper maps
// undefined → null; node:sqlite rejects both, so normalize here to match.
const bind = (params?: unknown[]): SQLInputValue[] =>
  (params ?? []).map((p) =>
    p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : (p as SQLInputValue),
  );

export const db = {
  execSync: (sql: string): void => { raw.exec(sql); },
  runSync: (sql: string, params?: unknown[]) => raw.prepare(sql).run(...bind(params)),
  getFirstSync: <T>(sql: string, params?: unknown[]): T | null =>
    ((raw.prepare(sql).get(...bind(params)) as T | undefined) ?? null),
  getAllSync: <T>(sql: string, params?: unknown[]): T[] =>
    raw.prepare(sql).all(...bind(params)) as T[],
  withTransactionSync: (fn: () => void): void => {
    raw.exec('BEGIN');
    try { fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
  },
};
