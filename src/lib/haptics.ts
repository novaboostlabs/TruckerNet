// TruckerNet haptic feedback — one central module.
//
// Every touch in the app that deserves physical feedback calls one of these
// functions. Keeps haptic style consistent and makes it trivial to tune the
// whole app from one place. All calls are fire-and-forget: the catch block
// silences errors on simulators / platforms where haptics aren't supported.

import * as Haptics from 'expo-haptics';

/** Light tap — row presses, tab switches, chip selections. */
export function tapLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — dropdown opens, CTA button presses, autocomplete picks. */
export function tapMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy tap — save confirmed, load logged. Punctuates completion. */
export function tapHeavy(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Success — load saved, expense saved, fuel logged. Double-pulse of joy. */
export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — verdict "not worth it" (red), lowball flag, below break-even. */
export function warning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error — validation fail, save error. */
export function error(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Verdict — fires success or warning based on the load verdict. */
export function verdict(v: 'green' | 'amber' | 'red'): void {
  if (v === 'green') success();
  else if (v === 'amber') warning();
  else error();
}
