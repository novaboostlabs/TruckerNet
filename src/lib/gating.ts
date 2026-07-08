import { getLoadCountThisMonth } from '../db/database';

/**
 * Free-tier limits and gating helpers for the Free ↔ Driver Pro paywall.
 * Pair these with `useSubscription().isPro` at each call site:
 * pro users bypass every gate.
 *
 * Spec: monetization-paywall-plan. Free tier = 15 loads LOGGED per calendar
 * month (counted by created_at, so back-dated loads still consume quota),
 * fair-market benchmark Pro-only, IFTA teaser/export Pro-only.
 * History past-period browsing is FREE (user decision 2026-07-08).
 */

/** Free accounts can log this many loads per calendar month. */
export const FREE_LOAD_LIMIT = 15;

/**
 * Whether a free user is allowed to log one more load this month.
 * Pro users should skip this check entirely (always allowed).
 */
export function canLogLoadFree(): boolean {
  return getLoadCountThisMonth() < FREE_LOAD_LIMIT;
}

/** Loads remaining this month for a free user (clamped at 0). */
export function freeLoadsRemaining(): number {
  return Math.max(0, FREE_LOAD_LIMIT - getLoadCountThisMonth());
}
