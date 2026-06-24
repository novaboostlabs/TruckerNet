import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, hasFuelEntryToday } from '../db/database';

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

// ── Weekly P&L summary ───────────────────────────────────────────────────────

export async function scheduleWeeklyPnL(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('weekly_pnl').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly_pnl',
    content: {
      title: 'Your Week in Numbers 📊',
      body:  'See how much you made this week — tap to check your P&L.',
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
        title: 'IFTA Filing Reminder ⏰',
        body:  'Your quarterly IFTA report is due in 2 weeks. Tap to review and export.',
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
      title: 'Load Still In Progress',
      body:  "Still on the road? Tap to mark your load complete when you arrive.",
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
      title: "Log your fill-up ⛽",
      body:  "Don't forget to add today's fuel — keeps your CPM and IFTA accurate.",
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
  ]);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
