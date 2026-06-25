// Web stub — SharedArrayBuffer is unavailable in most browsers without COOP/COEP
// headers, so expo-sqlite's sync worker cannot run. The app is mobile-first;
// web gets an in-memory no-op so it renders without crashing.
const noop = () => {};
export const db = {
  execSync: noop as (sql: string) => void,
  runSync: noop as (sql: string, params?: unknown[]) => void,
  getFirstSync: <T>(_sql: string, _params?: unknown[]): T | null => null,
  getAllSync: <T>(_sql: string, _params?: unknown[]): T[] => [],
};
