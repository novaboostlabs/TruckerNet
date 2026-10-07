import { describe, expect, it } from 'vitest';
import {
  addSingleLoadExpense,
  claimDataOwnership,
  clearAllUserData,
  deleteLoad,
  getAllLoads,
  getLoadExpenses,
  getQueuedDeletes,
  getSetting,
  mergeLoads,
  queueDelete,
  setSetting,
  type LoadExpenseRow,
  type LoadRow,
} from '../src/db/database';
import { load } from './support/fixtures';

const cloudCopy = (id: string): LoadRow => ({ ...getAllLoads().find((l) => l.id === id)! });
const cloudExpense = (loadId: string, id: string, amount: number): LoadExpenseRow => ({
  id, load_id: loadId, label: 'Lumper', category: 'lumper', amount, date: '2026-10-01', created_at: '2026-10-01T00:00:00Z',
});

describe('cloud pull (mergeLoads) — local wins for a load and its child rows', () => {
  it('keeps an expense added offline instead of replacing it with the cloud set', () => {
    const id = load({ gross_pay: 2000, total_miles: 1000, net_pay: 800 });
    const stale = cloudCopy(id);                       // what the cloud has (no expense yet)
    addSingleLoadExpense(id, { label: 'Lumper', category: 'lumper', amount: 150 });

    mergeLoads([stale], [], []);                       // pull: cloud has zero expenses for it
    expect(getLoadExpenses(id).map((e) => e.amount)).toEqual([150]);
  });

  it('restores a cloud-only load with its expenses', () => {
    const id = load({ gross_pay: 2000, total_miles: 1000 });
    const row = cloudCopy(id);
    deleteLoad(id);
    // Simulate a fresh device: nothing local, no pending delete.
    clearAllUserData();

    mergeLoads([row], [{ load_id: id, state: 'TX', miles: 1000, is_manually_edited: 0 }], [cloudExpense(id, 'e1', 75)]);
    expect(getAllLoads().map((l) => l.id)).toEqual([id]);
    expect(getLoadExpenses(id).map((e) => e.amount)).toEqual([75]);
  });

  it('a load deleted locally but not yet pushed neither resurrects nor breaks the pull', () => {
    const id = load({ gross_pay: 2000, total_miles: 1000 });
    const row = cloudCopy(id);
    deleteLoad(id);                                    // tombstoned, push pending
    expect(() => mergeLoads([row], [], [cloudExpense(id, 'e1', 75)])).not.toThrow();
    expect(getAllLoads()).toEqual([]);
  });
});

describe('sign-out clears everything that belongs to the account', () => {
  it('including settings that local-wins pull would push into the next account', () => {
    for (const k of ['tax_rate', 'tax_rate_mode', 'truck_paid_off', 'share_rate_data', 'last_sync_at', 'data_owner_id']) {
      setSetting(k, 'x');
    }
    setSetting('language', 'es');
    queueDelete('loads', 'abc');

    clearAllUserData();

    for (const k of ['tax_rate', 'tax_rate_mode', 'truck_paid_off', 'share_rate_data', 'last_sync_at', 'data_owner_id']) {
      expect(getSetting(k), k).toBeNull();
    }
    expect(getSetting('language')).toBe('es');         // device preference survives
    expect(getQueuedDeletes('loads')).toEqual([]);
  });

  it('a different account signing in wipes data left by the previous one', () => {
    claimDataOwnership('user-a');
    load({ gross_pay: 2000, total_miles: 1000 });
    expect(claimDataOwnership('user-b')).toBe(true);
    expect(getAllLoads()).toEqual([]);
  });
});
