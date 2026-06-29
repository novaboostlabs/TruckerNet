import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  net:      number;
  goal:     number;
  period:   'weekly' | 'monthly';
  variant?: 'compact' | 'hero';
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

export default function GoalProgressCard({ net, goal, period, variant = 'compact' }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const pct     = Math.max(0, Math.min((net / goal) * 100, 100));
  const reached = net >= goal;
  const days    = daysLeftInPeriod(period);
  const fmt     = (n: number) => `$${Math.max(0, Math.round(n)).toLocaleString('en-US')}`;
  const remaining = Math.max(0, goal - net);

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

  const subtext = reached
    ? t('dashboard.goalReached')
    : fresh
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

        <Text style={[styles.heroNet, { color: barColor }]}>{fmt(net)}</Text>
        <Text style={styles.heroOf}>
          {t('dashboard.goalOf', { goal: fmt(goal) })}
          {!reached && ` · ${t('dashboard.goalToGo', { amount: fmt(remaining) })}`}
        </Text>

        {/* Progress bar */}
        <View style={[styles.track, styles.heroTrack]}>
          <View style={[styles.fill, styles.heroFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>

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

      {/* Progress bar */}
      <View style={styles.track}>
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
