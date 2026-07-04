// Load lifecycle transitions — Upcoming → In Progress → Completed.
// Centralized so the Dashboard card, Load Detail, and Add Load all run the
// exact same side effects (reminders, community rate contribution, goal
// milestone + streak notifications, cloud push) on every transition.
import { setLoadStatus, getIncomeGoal, getWeekPnL, getMonthPnL } from '../db/database';
import { maybeContributeLoadRate } from './rateReports';
import {
  scheduleLoadReminder, cancelLoadReminder,
  checkAndNotifyGoalMilestone, checkAndNotifyStreak, scheduleIdleNudge,
} from './notifications';
import { pushLoads } from './sync/loadsSync';
import { capture } from './analytics';
import * as haptics from './haptics';

/** Upcoming → In Progress. */
export function startLoad(loadId: string, userId?: string): void {
  setLoadStatus(loadId, 'in_progress');
  scheduleLoadReminder(loadId).catch(() => {});
  capture('load_started', { load_id: loadId });
  haptics.tapMedium();
  if (userId) pushLoads(userId);
}

/** In Progress (or Upcoming) → Completed. */
export function completeLoad(loadId: string, userId?: string): void {
  setLoadStatus(loadId, 'completed');
  cancelLoadReminder(loadId).catch(() => {});

  // Completed loads feed the anonymous community rate pool (idempotent).
  maybeContributeLoadRate(loadId);

  // Goal milestone + streak checks run off the fresh post-completion numbers.
  const goal = getIncomeGoal();
  if (goal) {
    const pnl = goal.period === 'weekly' ? getWeekPnL() : getMonthPnL();
    checkAndNotifyGoalMilestone(pnl.net, goal).catch(() => {});
  }
  checkAndNotifyStreak().catch(() => {});
  scheduleIdleNudge().catch(() => {});

  capture('load_completed', { load_id: loadId });
  haptics.success();
  if (userId) pushLoads(userId);
}
