import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { BrokerScorecard, BrokerGrade } from '../lib/brokerScorecard';

interface Props {
  scorecard: BrokerScorecard | null;
  loading: boolean;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const GRADE_CONFIG: Record<BrokerGrade, { color: (c: ThemeColors) => string; bg: (c: ThemeColors) => string; icon: IoniconName; label: string }> = {
  A: { color: (c) => c.primary,   bg: (c) => c.primaryDim,   icon: 'checkmark-circle', label: 'Excellent' },
  B: { color: (c) => c.primary,   bg: (c) => c.primaryDim,   icon: 'thumbs-up-outline', label: 'Good' },
  C: { color: (c) => c.secondary, bg: (c) => c.secondaryDim, icon: 'remove-circle-outline', label: 'Average' },
  D: { color: (c) => c.danger,    bg: (c) => c.dangerDim,    icon: 'warning-outline',  label: 'Below avg' },
  F: { color: (c) => c.danger,    bg: (c) => c.dangerDim,    icon: 'close-circle',     label: 'Poor' },
};

export default function BrokerScorecardCard({ scorecard, loading }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.textSecondary} />
          <Text style={styles.loadingText}>Checking broker reputation…</Text>
        </View>
      </View>
    );
  }

  if (!scorecard) return null;

  const cfg   = GRADE_CONFIG[scorecard.grade];
  const color = cfg.color(Colors);
  const bg    = cfg.bg(Colors);

  const payDelta = scorecard.avgPayVsMarket != null
    ? Math.round((scorecard.avgPayVsMarket - 1) * 100)
    : null;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>BROKER SCORECARD</Text>
          <Text style={styles.brokerName} numberOfLines={1}>{scorecard.brokerName}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: bg, borderColor: color + '60' }]}>
          <Text style={[styles.gradeChar, { color }]}>{scorecard.grade}</Text>
        </View>
      </View>

      {/* Grade label + report count */}
      <View style={styles.subtitleRow}>
        <Ionicons name={cfg.icon} size={14} color={color} />
        <Text style={[styles.gradeLabel, { color }]}>{cfg.label}</Text>
        <Text style={styles.reportCount}>· {scorecard.reportCount} driver{scorecard.reportCount === 1 ? '' : 's'}</Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        {payDelta !== null && (
          <View style={styles.metric}>
            <Ionicons
              name={payDelta >= 0 ? 'trending-up' : 'trending-down'}
              size={15}
              color={payDelta >= 0 ? Colors.primary : Colors.danger}
            />
            <Text style={[styles.metricValue, { color: payDelta >= 0 ? Colors.primary : Colors.danger }]}>
              {payDelta >= 0 ? '+' : ''}{payDelta}% vs market
            </Text>
          </View>
        )}
        {scorecard.recommendPct !== null && (
          <View style={styles.metric}>
            <Ionicons name="thumbs-up-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.metricValue}>{Math.round(scorecard.recommendPct)}% recommend</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 14, marginTop: 12,
  },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  headerLeft: { flex: 1, marginRight: 12 },
  eyebrow: {
    fontFamily: FontFamily.monoSemiBold, fontSize: 9,
    color: Colors.labelColor, letterSpacing: 1.4, marginBottom: 3,
  },
  brokerName: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.body,
    color: Colors.textPrimary, letterSpacing: -0.3,
  },
  gradeBadge: {
    width: 44, height: 44, borderRadius: Radius.sm, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeChar: {
    fontFamily: FontFamily.monoBold, fontSize: 22, lineHeight: 26,
  },

  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  gradeLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label },
  reportCount: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },

  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricValue: {
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
});
