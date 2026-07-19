import * as SQLite from 'expo-sqlite';

const raw = SQLite.openDatabaseSync('truckernet.db');

// undefined is not a bindable SQLite value — passing one throws Hermes'
// cryptic "value could not be coerced" at runtime (seen once in the wild via
// the Cloud backup error surface). Sanitize every param array in this ONE
// choke point so no call site can ever hit it again: undefined → null.
type Params = unknown[] | undefined;
const clean = (params: Params): Params =>
  params?.map((p) => (p === undefined ? null : p));

export const db = {
  execSync: (sql: string) => raw.execSync(sql),
  runSync: (sql: string, params?: unknown[]) =>
    params === undefined ? raw.runSync(sql) : raw.runSync(sql, clean(params) as SQLite.SQLiteBindParams),
  getFirstSync: <T>(sql: string, params?: unknown[]): T | null =>
    params === undefined
      ? (raw.getFirstSync<T>(sql) as T | null)
      : (raw.getFirstSync<T>(sql, clean(params) as SQLite.SQLiteBindParams) as T | null),
  getAllSync: <T>(sql: string, params?: unknown[]): T[] =>
    params === undefined
      ? (raw.getAllSync<T>(sql) as T[])
      : (raw.getAllSync<T>(sql, clean(params) as SQLite.SQLiteBindParams) as T[]),
  withTransactionSync: (fn: () => void): void => raw.withTransactionSync(fn),
};
