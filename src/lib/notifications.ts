import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from './i18n';
import {
  getSetting, setSetting, hasFuelEntryToday,
  getGoalMilestonesHit, markGoalMilestoneHit,
  daysSinceExpenseReview, getTotalMonthlyExpenses,
  getStaleCategoryAlerts,
  getWeekPnL, calcBreakEven,
  getBestLoadThisWeek, consecutiveWeeksOverBreakEven,
  getLastLoadDate, avgLoadsPerWeek, getLoadCount,
} from '../db/database';

// Notification copy is localized via the active i18n language. These fire from
// background/scheduled contexts (no React tree), so we use the i18n instance
// directly rather than the useTranslation hook.
const tn = (key: string, opts?: Record<string, unknown>) => i18n.t(`notifications.${key}`, opts);

const CHANNEL_ID = 'truckernet_default';

// Show notifications even when app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'TruckerNet',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied')  return false; // already denied — don't re-prompt
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function notificationsEnabled(): boolean {
  return getSetting('notifications_enabled') !== 'false';
}

// ── Weekly P&L summary — data-rich, rescheduled on every app open ────────────
// We cancel and reschedule this on every app entry so the notification always
// carries the driver's latest week numbers rather than a generic placeholder.
// It fires Sunday at 6pm — a natural "wrap up the week" moment.

export async function scheduleWeeklyPnL(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('weekly_pnl').catch(() => {});
  if (!notificationsEnabled()) return;

  // Build personalised content from live DB data.
  const { net, miles } = getWeekPnL();
  const { breakEvenRPM } = calcBreakEven();
  const best = getBestLoadThisWeek();
  const loadCount = getLoadCount();

  let title: string;
  let body: string;

  if (loadCount === 0 || miles === 0) {
    // Brand-new driver with no loads yet — friendly nudge to log their first.
    title = tn('weeklyPnlTitle');
    body  = tn('weeklyPnlBodyEmpty');
  } else {
    const netFmt = `$${Math.round(Math.abs(net)).toLocaleString('en-US')}`;
    const sign   = net >= 0 ? '+' : '−';
    title = tn('weeklyPnlTitleData', { net: `${sign}${netFmt}` });

    const parts: string[] = [];
    if (breakEvenRPM > 0 && miles > 0) {
      const rpm = net / miles;
      const delta = Math.abs(rpm - breakEvenRPM).toFixed(2);
      parts.push(rpm >= breakEvenRPM
        ? tn('weeklyPnlAbove', { delta })
        : tn('weeklyPnlBelow', { delta }));
    }
    if (best) {
      parts.push(tn('weeklyPnlBest', {
        from: best.pickup_city,
        to:   best.delivery_city,
        rpm:  best.net_rate_per_mile.toFixed(2),
      }));
    }
    body = parts.length > 0 ? parts.join(' · ') : tn('weeklyPnlBodyGeneric');
  }

  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly_pnl',
    content: {
      title,
      body,
      data: { action: 'open_dashboard' },
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,   // 1 = Sunday
      hour:    18,
      minute:  0,
    },
  });
}

// ── Break-even streak notifications ─────────────────────────────────────────
// Fires an immediate notification when the driver hits a streak milestone.
// Called after every load save; checks whether the new load completed a streak.

const STREAK_MILESTONES = [2, 3, 5, 10, 15, 20, 26, 52];
const STREAK_KEY = 'last_streak_notified';   // avoid re-notifying the same streak

export async function checkAndNotifyStreak(): Promise<void> {
  if (!notificationsEnabled()) return;

  const streak = consecutiveWeeksOverBreakEven();
  if (streak < 2) return;
  if (!STREAK_MILESTONES.includes(streak)) return;

  // Don't fire again for a streak we already notified.
  const lastNotified = parseInt(getSetting(STREAK_KEY) ?? '0', 10);
  if (lastNotified >= streak) return;

  // Store BEFORE scheduling so a fast re-entry doesn't double-fire.
  try { setSetting(STREAK_KEY, String(streak)); } catch { /* non-fatal */ }

  await Notifications.scheduleNotificationAsync({
    identifier: `streak_${streak}`,
    content: {
      title: tn('streakTitle', { weeks: streak }),
      body:  tn('streakBody',  { weeks: streak }),
      data:  { action: 'open_dashboard' },
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: null,  // immediate
  }).catch(() => {});
}

// ── Idle nudge ───────────────────────────────────────────────────────────────
// Fires once after 7 days without a load, but ONLY for drivers who typically
// log ≥1 load/week (so we never bug someone who just started or is on break).

const IDLE_ID = 'idle_nudge';
const IDLE_DAYS = 7;

export async function scheduleIdleNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDLE_ID).catch(() => {});
  if (!notificationsEnabled()) return;

  // Only set up the nudge for regular loggers (avg ≥1 load/week).
  const avg = avgLoadsPerWeek();
  if (avg < 0.75) return;

  const lastDate = getLastLoadDate();
  if (!lastDate) return;

  const daysSince = Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24));

  // Already idle — schedule the nudge N days from the last load.
  const fireAt = new Date(lastDate + 'T12:00:00');
  fireAt.setDate(fireAt.getDate() + IDLE_DAYS);
  fireAt.setHours(10, 0, 0, 0);

  if (fireAt.getTime() <= Date.now()) return; // already past — don't nag retroactively

  await Notifications.scheduleNotificationAsync({
    identifier: IDLE_ID,
    content: {
      title: tn('idleTitle'),
      body:  tn('idleBody'),
      data:  { action: 'open_add_load' },
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  }).catch(() => {});
}

// ── IFTA quarter-end reminders ───────────────────────────────────────────────
// Fires 2 weeks before each filing deadline (Apr 30, Jul 31, Oct 31, Jan 31).

export async function scheduleIFTAReminders(): Promise<void> {
  const now  = Date.now();
  const year = new Date().getFullYear();

  const reminders = [
    { id: 'ifta_q1', date: new Date(year,     3, 16, 9, 0) },  // Apr 16
    { id: 'ifta_q2', date: new Date(year,     6, 17, 9, 0) },  // Jul 17
    { id: 'ifta_q3', date: new Date(year,     9, 17, 9, 0) },  // Oct 17
    { id: 'ifta_q4', date: new Date(year + 1, 0, 17, 9, 0) },  // Jan 17 next yr
  ];

  for (const { id, date } of reminders) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    if (date.getTime() <= now) continue;  // already past this year
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: tn('iftaTitle'),
        body:  tn('iftaBody'),
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  }
}

// ── In-progress load reminder ────────────────────────────────────────────────
// Fires 8 hours after a load is marked in_progress. Cancelled on completion.

export async function scheduleLoadReminder(loadId: string): Promise<void> {
  if (!notificationsEnabled()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    identifier: `load_reminder_${loadId}`,
    content: {
      title: tn('loadProgressTitle'),
      body:  tn('loadProgressBody'),
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
}

export async function cancelLoadReminder(loadId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`load_reminder_${loadId}`).catch(() => {});
}

// ── Fuel fill-up reminder ────────────────────────────────────────────────────
// Fires at 8 pm if the driver hasn't logged a fill-up yet today.
// One-time DATE trigger (not repeating) so we can cancel it conditionally.
// setupNotifications() re-evaluates and re-schedules on every app launch.

const FUEL_REMINDER_ID = 'fuel_reminder';

export async function scheduleFuelReminderIfNeeded(): Promise<void> {
  if (!notificationsEnabled()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Already logged a fill-up today — cancel any pending reminder and bail.
  if (hasFuelEntryToday()) {
    await cancelFuelReminder();
    return;
  }

  // Target: 8 pm local time. If it's already past 8 pm, aim for tomorrow.
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);

  // Cancel any stale reminder before re-scheduling (idempotent).
  await cancelFuelReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: FUEL_REMINDER_ID,
    content: {
      title: tn('fuelTitle'),
      body:  tn('fuelBody'),
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

export async function cancelFuelReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FUEL_REMINDER_ID).catch(() => {});
}

// ── Master setup ─────────────────────────────────────────────────────────────

export async function setupNotifications(): Promise<void> {
  if (!notificationsEnabled()) return;

  await ensureAndroidChannel();
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Promise.all([
    scheduleWeeklyPnL(),
    scheduleIFTAReminders(),
    scheduleFuelReminderIfNeeded(),
    scheduleExpenseReviewReminder(),
    scheduleIdleNudge(),
  ]);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Income goal milestone alerts ─────────────────────────────────────────────

export async function checkAndNotifyGoalMilestone(
  currentNet: number,
  goal: { amount: number; period: 'weekly' | 'monthly' },
): Promise<void> {
  if (!notificationsEnabled()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (currentNet <= 0 || goal.amount <= 0) return;

  const pct = (currentNet / goal.amount) * 100;
  const hit = getGoalMilestonesHit(goal.period);
  const period = goal.period === 'weekly' ? tn('periodWeek') : tn('periodMonth');
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  if (pct >= 100 && !hit.includes(100)) {
    markGoalMilestoneHit(100, goal.period);
    await Notifications.scheduleNotificationAsync({
      identifier: 'goal_100',
      content: {
        title: tn('goalReachedTitle'),
        body: tn('goalReachedBody', { net: fmt(currentNet), period, goal: fmt(goal.amount) }),
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: null,
    });
  } else if (pct >= 75 && !hit.includes(75)) {
    markGoalMilestoneHit(75, goal.period);
    await Notifications.scheduleNotificationAsync({
      identifier: 'goal_75',
      content: {
        title: tn('goal75Title'),
        body: tn('goal75Body', { net: fmt(currentNet), period, remaining: fmt(goal.amount - currentNet) }),
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: null,
    });
  }
}

// ── Expense review reminder ──────────────────────────────────────────────────
// Fires 30 days after the driver's last expense review (adaptive timer).
// No-ops when: no expenses entered, notifications disabled, or not yet due.

const EXPENSE_REVIEW_ID = 'expense_review';

/**
 * Schedule (or reschedule) the next expense-review reminder for 30 days
 * after the driver's last review. Call this:
 *   - After setupNotifications() on app entry
 *   - After the driver completes a review (so it resets the 30-day timer)
 */
export async function scheduleExpenseReviewReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(EXPENSE_REVIEW_ID).catch(() => {});
  if (!notificationsEnabled()) return;
  if (getTotalMonthlyExpenses() <= 0) return; // nothing to review

  // If specific categories are already overdue, fire tomorrow morning instead
  // of waiting 30 days — the category-aware signal takes priority.
  const stale = getStaleCategoryAlerts();
  if (stale.length > 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      identifier: EXPENSE_REVIEW_ID,
      content: {
        title: tn('expenseReviewTitle'),
        body:  tn('expenseReviewBody'),
        data:  { action: 'expense_review' },
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: tomorrow,
      },
    });
    return;
  }

  const days = daysSinceExpenseReview();
  // days === null → never reviewed (onboarding just completed, timer just started)
  const daysUntilDue = days === null ? 30 : Math.max(0, 30 - days);
  const fireAt = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);
  fireAt.setHours(10, 0, 0, 0); // 10 AM on the due date

  if (fireAt.getTime() <= Date.now()) {
    // Already due — fire tomorrow morning to avoid immediate interrupt.
    fireAt.setDate(fireAt.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: EXPENSE_REVIEW_ID,
    content: {
      title: tn('expenseReviewTitle'),
      body:  tn('expenseReviewBody'),
      data:  { action: 'expense_review' },
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

/** Call after the driver completes a review to reset the 30-day timer. */
export async function rescheduleExpenseReviewAfterCompletion(): Promise<void> {
  // Give the DB write a moment to commit before rescheduling.
  await scheduleExpenseReviewReminder();
}
