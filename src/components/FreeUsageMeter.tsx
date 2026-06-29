import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { FREE_LOAD_LIMIT, freeLoadsRemaining } from '../lib/gating';
import { getValueMissedStats } from '../db/database';

interface Props {
  /** Bump this whenever load data changes so the meter recomputes. */
  refreshKey?: number;
  /** Compact single-line variant for headers/forms (default is the full card). */
  compact?: boolean;
}

/**
 * Free-tier load usage meter. Renders nothing for Pro users. Creates honest
 * urgency *before* the driver hits the wall at load #16, and routes to the
 * paywall on tap. This is the primary free→paid conversion lever.
 */
export default function FreeUsageMeter({ refreshKey, compact = false }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  const { present: presentPaywall } = usePaywall();

  // Pro users have no limit — show nothing. (refreshKey participates so the
  // value recomputes whenever the parent signals a data change.)
  const remaining = React.useMemo(
    () => freeLoadsRemaining(),
    [refreshKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const valueMissed = React.useMemo(
    () => { const s = getValueMissedStats(30); return s.lowballCount > 0 ? s : null; },
    [refreshKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (isPro) return null;

  const used    = FREE_LOAD_LIMIT - remaining;
  const pct     = Math.max(0, Math.min((used / FREE_LOAD_LIMIT) * 100, 100));
  const reached = remaining <= 0;
  const low     = remaining > 0 && remaining <= 5;

  const accent = reached ? Colors.danger : low ? Colors.secondary : Colors.primary;

  const statusText = reached
    ? t('freeUsage.limitReached')
    : t('freeUsage.remaining', { count: remaining, total: FREE_LOAD_LIMIT });

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactRow}
        onPress={() => presentPaywall('loadLimit')}
        activeOpacity={0.75}
      >
        <Ionicons
          name={reached ? 'lock-closed' : 'flash-outline'}
          size={14}
          color={accent}
        />
        <Text style={[styles.compactText, { color: accent }]} numberOfLines={1}>
          {statusText}
        </Text>
        <Text style={styles.compactCta}>{t('freeUsage.upgrade')}</Text>
        <Ionicons name="chevron-forward" size={13} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, reached && styles.cardReached]}
      onPress={() => presentPaywall('loadLimit')}
      activeOpacity={0.8}
    >
      <View style={styles.headerRow}>
        <Text style={styles.plan}>{t('freeUsage.plan')}</Text>
        <View style={styles.upgradePill}>
          <Ionicons name="arrow-up-circle" size={13} color={Colors.secondary} />
          <Text style={styles.upgradePillText}>{t('freeUsage.upgrade')}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: accent }]} />
      </View>

      <Text style={[styles.status, { color: reached ? Colors.danger : Colors.textSecondary }]}>
        {statusText}
      </Text>

      {/* Value callout — shown when we have real lowball data */}
      {valueMissed && (
        <View style={styles.valueRow}>
          <Ionicons name="trending-down" size={13} color={Colors.danger} />
          <Text style={styles.valueText}>
            {t('freeUsage.valueMissed', {
              count: valueMissed.lowballCount,
              amount: `$${valueMissed.estimatedLost.toLocaleString('en-US')}`,
            })}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 14,
  },
  cardReached: { borderColor: Colors.danger + '50' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  plan: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.micro, color: Colors.labelColor, letterSpacing: 1.6 },
  upgradePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.secondary + '40',
  },
  upgradePillText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.secondary, letterSpacing: 0.3 },

  track: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  fill:  { height: 6, borderRadius: 3 },

  status: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: Colors.dangerDim, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  valueText: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.danger, lineHeight: 16,
  },

  // Compact
  compactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16,
  },
  compactText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.label },
  compactCta:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.secondary },
});
