// In-app App Store / Play Store rating prompt.
//
// Ratings are the single biggest lever on store ranking and install-conversion,
// and the listing launched with none — so this fires EARLY, at the app's first
// "the app just did its job" moment, rather than waiting for heavy usage.
//
// DELIBERATE (user decision 2026-07-31): the prompt fires on ANY verdict, good
// or bad. A red verdict is still the app working — it just saved the driver
// from accepting a losing load, which is its own aha moment. The only
// requirement is that a real result was actually shown.
//
// Why asking this early is safe here: onboarding already demands expenses,
// weekly miles, and a break-even sanity gate BEFORE a driver can reach Check
// Load. Anyone who reaches a verdict has invested real effort — they are not a
// tire-kicker 30 seconds into a free download.
//
// NOTE on copy: there is none to write. StoreReview.requestReview() shows the
// OS's own standardized rating sheet — Apple does not allow custom text in it,
// and wrapping it in a custom "enjoying the app?" pre-prompt is explicitly
// discouraged by Apple's HIG (and can be rejected). The system sheet is the
// whole UX.
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { getSetting, setSetting } from '../db/database';

const COUNT_KEY   = 'review_prompt_count';
const LAST_AT_KEY = 'review_prompt_last_at';

/** iOS allows 3/year; stay under it so we never spend an ask the OS would eat. */
const MAX_LIFETIME_ASKS = 2;
/** Don't re-ask the same driver for a long while. */
const MIN_DAYS_BETWEEN = 120;

function readInt(key: string): number {
  return parseInt(getSetting(key) ?? '0', 10) || 0;
}

function daysSinceLastAsk(): number {
  const last = getSetting(LAST_AT_KEY);
  if (!last) return Infinity;
  const then = new Date(last).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 86_400_000;
}

/**
 * Ask for a store review after the app just demonstrably did its job (a Check
 * Load verdict was shown, or a load was completed). Safe to call
 * unconditionally from anywhere — every gate fails closed and this never
 * throws into the caller.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    // Web has no store to review, and expo-store-review is a native module.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    if (readInt(COUNT_KEY) >= MAX_LIFETIME_ASKS) return;
    if (daysSinceLastAsk() < MIN_DAYS_BETWEEN) return;

    // isAvailableAsync: the platform supports it at all.
    // hasAction: the OS will actually surface something right now.
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    await StoreReview.requestReview();

    // Record the ask even though iOS never reports whether the sheet appeared or
    // whether the driver rated — an unrecorded ask would re-prompt on the very
    // next win.
    setSetting(COUNT_KEY, String(readInt(COUNT_KEY) + 1));
    setSetting(LAST_AT_KEY, new Date().toISOString());
  } catch {
    // A rating prompt must never break the flow that triggered it.
  }
}
