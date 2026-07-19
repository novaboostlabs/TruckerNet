import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, Spacing, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import { TaxSetAside } from '../db/database';

interface Props {
  data: TaxSetAside;
  onSettings: () => void;   // tapping the rate opens Settings
}

function fmt(n: number): string {
  // Pre-round to cents: RN/Hermes doesn't reliably apply toLocaleString's
  // maximumFractionDigits, so rounding the number is what actually caps it.
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function TaxSetAsideCard({ data, onSettings }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  const pct = Math.round(data.rate * 100);

  // Countdown to next deadline.
  const daysLeft = Math.max(0, Math.round(
    (new Date(data.nextDeadlineDate + 'T12:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  ));
  const urgency = daysLeft <= 14;

  // Format the deadline in the ACTIVE language (was hardcoded en-US, so it read
  // "Jun 16" even in Spanish). Formatting here (not in the DB) avoids an import
  // cycle between i18n and the database module.
  const deadlineLabel = new Date(data.nextDeadlineDate + 'T12:00:00')
    .toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>{t('expenses.tax.cardEyebrow')}</Text>
          <Text style={styles.disclaimer}>{t('expenses.tax.cardDisclaimer')}</Text>
        </View>
        <TouchableOpacity style={styles.rateBtn} onPress={onSettings} activeOpacity={0.8}>
          <Text style={styles.rateBtnText}>{pct}%</Text>
          <Ionicons name="pencil-outline" size={12} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Three set-aside figures */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t('expenses.tax.thisMonth')}</Text>
          <Text style={[styles.metricValue, { color: Colors.secondary }]}>${fmt(data.monthSetAside)}</Text>
          <Text style={styles.metricBase}>{t('expenses.tax.cardOfNet', { amount: fmt(data.monthNet) })}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t('expenses.tax.thisQuarter')}</Text>
          <Text style={[styles.metricValue, { color: Colors.secondary }]}>${fmt(data.quarterSetAside)}</Text>
          <Text style={styles.metricBase}>{t('expenses.tax.cardOfNet', { amount: fmt(data.quarterNet) })}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t('expenses.tax.ytd')}</Text>
          <Text style={[styles.metricValue, { color: Colors.secondary }]}>${fmt(data.ytdSetAside)}</Text>
          <Text style={styles.metricBase}>{t('expenses.tax.cardOfNet', { amount: fmt(data.ytdNet) })}</Text>
        </View>
      </View>

      {/* Next deadline */}
      <View style={[styles.deadlineRow, urgency && styles.deadlineRowUrgent]}>
        <Ionicons
          name="calendar-outline"
          size={13}
          color={urgency ? Colors.danger : Colors.textSecondary}
        />
        <Text style={[styles.deadlineText, urgency && styles.deadlineTextUrgent]}>
          {urgency
            ? t('expenses.tax.deadlineUrgent', { date: deadlineLabel, count: daysLeft })
            : t('expenses.tax.deadline', { date: deadlineLabel, count: daysLeft })}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 14,
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerLeft: { flex: 1 },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 2 },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, fontStyle: 'italic' },

  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '40',
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  rateBtnText: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.secondary },

  metricsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  metric:     { flex: 1, alignItems: 'center' },
  divider:    { width: 1, backgroundColor: Colors.border, marginHorizontal: 4, alignSelf: 'stretch' },
  metricLabel: {
    fontFamily: FontFamily.monoSemiBold, fontSize: 9,
    color: Colors.labelColor, letterSpacing: 1.2, marginBottom: 4,
  },
  metricValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, marginBottom: 2 },
  metricBase:  { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, textAlign: 'center' },

  deadlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  deadlineRowUrgent: { backgroundColor: Colors.dangerDim, borderWidth: 1, borderColor: Colors.danger + '40' },
  deadlineText: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, lineHeight: 16,
  },
  deadlineTextUrgent: { color: Colors.danger, fontFamily: FontFamily.medium },
});
