import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import AnimatedNumber from './anim/AnimatedNumber';

interface Props {
  net:      number;
  goal:     number;
  period:   'weekly' | 'monthly';
  variant?: 'compact' | 'hero';
  /** Net pay booked on upcoming/in-progress loads — shown as a translucent
   *  "once delivered" segment on the bar, never mixed into the earned number. */
  pending?:      number;
  pendingLoads?: number;
}

function daysLeftInPeriod(period: 'weekly' | 'monthly'): number {
  const now = new Date();
  if (period === 'monthly') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
  }
  // Days until end of Sunday-anchored week
  const dow = now.getDay(); // 0 = Sun
  return dow === 0 ? 0 : 7 - dow;
}

export default function GoalProgressCard({ net, goal, period, variant = 'compact', pending = 0, pendingLoads = 0 }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const pct     = Math.max(0, Math.min((net / goal) * 100, 100));
  const reached = net >= goal;
  const days    = daysLeftInPeriod(period);
  const fmt     = (n: number) => `$${Math.max(0, Math.round(n)).toLocaleString('en-US')}`;
  const remaining = Math.max(0, goal - net);

  // Booked-but-not-delivered money: projected % once the current load(s) finish.
  const hasPending   = pending > 0 && !reached;
  const projectedPct = Math.max(pct, Math.min(((net + pending) / goal) * 100, 100));

  // Distinguish a fresh period (nothing banked yet — the "Monday-zero" state) from
  // an actual loss. A new week shouldn't greet the driver with a red 0% bar.
  const inLoss = net < 0;
  const fresh  = net === 0;

  const barColor = reached
    ? Colors.primary
    : inLoss
      ? Colors.danger
      : fresh
        ? Colors.textSecondary
        : pct >= 50
          ? Colors.primary
          : Colors.secondary;

  const eyebrow = period === 'weekly'
    ? t('dashboard.goalEyebrowWeekly')
    : t('dashboard.goalEyebrowMonthly');

  // "Log your first load" reads wrong when a load is already rolling — a fresh
  // period with pending money falls through to the normal days-left copy.
  const subtext = reached
    ? t('dashboard.goalReached')
    : fresh && !hasPending
      ? t('dashboard.goalFresh')
      : days === 0
        ? t('dashboard.goalLastDay')
        : t('dashboard.goalDaysLeft', { count: days });

  // ── Hero variant: big net number, goal as the dashboard's primary card ──
  if (variant === 'hero') {
    return (
      <View style={styles.heroCard}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={[styles.heroPct, { color: barColor }]}>
            {reached ? '100%' : `${Math.round(pct)}%`}
          </Text>
        </View>

        <AnimatedNumber
          value={Math.max(0, Math.round(net))}
          from={0}
          format={(n) => `$${Math.round(n).toLocaleString('en-US')}`}
          style={[styles.heroNet, { color: barColor }]}
          duration={800}
        />
        <Text style={styles.heroOf}>
          {t('dashboard.goalOf', { goal: fmt(goal) })}
          {!reached && ` · ${t('dashboard.goalToGo', { amount: fmt(remaining) })}`}
        </Text>

        {/* Progress bar — earned solid; pending as a translucent extension */}
        <View style={[styles.track, styles.heroTrack]}>
          {hasPending && (
            <View style={[styles.pendingFill, styles.heroPendingFill, { width: `${projectedPct}%` as any, backgroundColor: Colors.primary + '38' }]} />
          )}
          <View style={[styles.fill, styles.heroFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>

        {hasPending && (
          <View style={styles.pendingRow}>
            <View style={styles.pendingDot} />
            <Text style={styles.pendingText}>
              {t('dashboard.goalPendingLine', {
                amount: fmt(pending),
                count:  pendingLoads,
                pct:    Math.round(projectedPct),
              })}
            </Text>
          </View>
        )}

        <Text style={styles.heroDays}>{subtext}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={[styles.pct, { color: barColor }]}>
          {reached ? '100%' : `${Math.round(pct)}%`}
        </Text>
      </View>

      {/* Progress bar — earned solid; pending as a translucent extension */}
      <View style={styles.track}>
        {hasPending && (
          <View style={[styles.pendingFill, { width: `${projectedPct}%` as any, backgroundColor: Colors.primary + '38' }]} />
        )}
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.amounts}>
          <Text style={[styles.current, { color: barColor }]}>{fmt(net)}</Text>
          <Text style={styles.ofGoal}>{t('dashboard.goalOf', { goal: fmt(goal) })}</Text>
        </Text>
        <Text style={styles.days}>{subtext}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.cardPad,
    marginBottom:    Spacing.gap,
  },

  // Hero variant
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.primaryMid,
    padding:         Spacing.cardPad,
    marginBottom:    14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
  },
  heroPct:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.body },
  heroNet:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.heroLarge, lineHeight: 60, letterSpacing: -2, marginTop: 4 },
  heroOf:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 18 },
  heroTrack:{ height: 8, borderRadius: 4, marginBottom: 12 },
  heroFill: { height: 8, borderRadius: 4 },
  heroDays: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textTertiary, letterSpacing: 0.3 },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   10,
  },
  eyebrow: {
    fontFamily:    FontFamily.monoSemiBold,
    fontSize:      FontSize.micro,
    color:         Colors.labelColor,
    letterSpacing: 1.6,
  },
  pct: {
    fontFamily: FontFamily.monoBold,
    fontSize:   FontSize.body,
  },
  track: {
    height:          6,
    backgroundColor: Colors.border,
    borderRadius:    3,
    overflow:        'hidden',
    marginBottom:    10,
  },
  fill: {
    height:       6,
    borderRadius: 3,
  },
  // Translucent projection layer under the earned fill
  pendingFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 3,
  },
  heroPendingFill: { borderRadius: 4 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary + '55' },
  pendingText: { flex: 1, fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 16 },
  footerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  amounts: {
    flexShrink: 1,
  },
  current: {
    fontFamily: FontFamily.monoBold,
    fontSize:   FontSize.body,
  },
  ofGoal: {
    fontFamily: FontFamily.monoRegular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  days: {
    fontFamily: FontFamily.monoRegular,
    fontSize:   FontSize.caption,
    color:      Colors.textTertiary,
    marginLeft: 8,
  },
});
