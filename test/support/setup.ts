import { afterEach, beforeEach, vi } from 'vitest';
import { resetTestDb } from './nodeSqlite';
import { initDatabase } from '../../src/db/database';

// Every test starts from an empty, migrated database at a fixed local time.
// Pin "now" per test with vi.setSystemTime when the date matters.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T12:00:00'));
  resetTestDb();
  initDatabase();
});

afterEach(() => {
  vi.useRealTimers();
});
