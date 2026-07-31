// In-app App Store / Play Store rating prompt.
//
// Ratings are the single biggest lever on store ranking and install-conversion,
// and a listing with no ratings converts badly — but a prompt shown at the wrong
// moment burns a scarce resource. iOS itself caps requestReview() at 3 prompts
// per user per year and silently no-ops after that, so every ask that lands on a
// frustrated or confused driver is permanently wasted.
//
// Hence: only ask right after a genuinely GOOD moment (a completed load that
// actually made money), never on launch, never mid-task, never after an error or
// a dismissed paywall, and never to someone who hasn't used the app enough to
// have an opinion worth leaving.
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { getSetting, setSetting, getLoadCount } from '../db/database';

const COUNT_KEY    = 'review_prompt_count';
const LAST_AT_KEY  = 'review_prompt_last_at';

/** iOS allows 3/year; stay under it so we never spend an ask the OS would eat. */
const MAX_LIFETIME_ASKS = 2;
/** Don't re-ask the same driver for a long while. */
const MIN_DAYS_BETWEEN  = 120;
/** Enough real usage that the driver has a real opinion. */
const MIN_LOADS         = 3;

function askCount(): number {
  return parseInt(getSetting(COUNT_KEY) ?? '0', 10) || 0;
}

function daysSinceLastAsk(): number {
  const last = getSetting(LAST_AT_KEY);
  if (!last) return Infinity;
  const then = new Date(last).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 86_400_000;
}

/**
 * Ask for a store review, but only if this is a good moment AND the driver has
 * earned-the-right-to-be-asked criteria. Safe to call unconditionally — every
 * gate fails closed and nothing here ever throws into the caller.
 *
 * @param profitable whether the triggering load actually made money. A losing
 *   load is the worst possible moment to ask, so we hard-skip it.
 */
export async function maybeRequestReview(profitable: boolean): Promise<void> {
  try {
    // Web has no store to review, and expo-store-review is a native module.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    // Only ever ask on a win.
    if (!profitable) return;

    if (askCount() >= MAX_LIFETIME_ASKS) return;
    if (daysSinceLastAsk() < MIN_DAYS_BETWEEN) return;
    if (getLoadCount() < MIN_LOADS) return;

    // isAvailableAsync: platform supports it at all.
    // hasAction: the OS will actually surface something right now.
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction()))        return;

    await StoreReview.requestReview();

    // Record the ask even though iOS never tells us whether the sheet appeared
    // or whether the driver rated — an un-recorded ask would let us re-prompt
    // on the very next completed load.
    setSetting(COUNT_KEY, String(askCount() + 1));
    setSetting(LAST_AT_KEY, new Date().toISOString());
  } catch {
    // A rating prompt must never be able to break completing a load.
  }
}
