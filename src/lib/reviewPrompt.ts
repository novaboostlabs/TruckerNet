// In-app App Store / Play Store rating prompt.
//
// Ratings are the single biggest lever on store ranking and install-conversion,
// and the listing launched with none — so this fires EARLY, at the app's first
// genuine "aha" moment, rather than waiting for heavy usage.
//
// The one hard rule: only ask on a WIN. iOS caps requestReview() at 3 prompts
// per user per year and silently no-ops after that, so a prompt shown to someone
// who just saw a bad number is permanently spent for nothing. A "win" is a Check
// Load that clears break-even, or a completed load that actually made money.
//
// Why asking this early is safe here: onboarding already demands expenses,
// weekly miles, and a break-even sanity gate BEFORE a driver can reach Check
// Load. Anyone who reaches a win has invested real effort — they are not a
// tire-kicker 30 seconds into a free download.
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { getSetting, setSetting } from '../db/database';

const COUNT_KEY   = 'review_prompt_count';
const LAST_AT_KEY = 'review_prompt_last_at';
const WINS_KEY    = 'review_prompt_wins';

/**
 * How many "win" moments before we ask. 1 = ask at the driver's very first good
 * verdict (current: maximum reach, which is what a 0-rating listing needs).
 * Raise to 2–3 later if prompts convert poorly — one-line change.
 */
const MIN_WINS = 1;
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
 * Record a good moment and, if the driver has had enough of them, ask for a
 * store review. Safe to call unconditionally from anywhere — every gate fails
 * closed and this never throws into the caller.
 *
 * @param isWin true only when the driver just saw a GOOD result (Check Load
 *   verdict of 'strong'/'fair', or a completed load with net_pay > 0). A
 *   non-win never asks and never counts.
 */
export async function maybeRequestReview(isWin: boolean): Promise<void> {
  try {
    // Web has no store to review, and expo-store-review is a native module.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!isWin) return;

    const wins = readInt(WINS_KEY) + 1;
    setSetting(WINS_KEY, String(wins));

    if (wins < MIN_WINS) return;
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
