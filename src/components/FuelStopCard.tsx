import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { FuelStopPlan } from '../lib/fuelOptimizer';

/**
 * "Where to Fuel" — tax-adjusted fuel-stop recommendation for the current
 * route. Rendered in Add Load once the per-state mileage split exists.
 * The hook: the cheapest-looking pump is often NOT the cheapest gallon,
 * because IFTA credits pump tax against miles driven.
 */
export default function FuelStopCard({ plan }: { plan: FuelStopPlan }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  const showSavings = plan.flipped && plan.estSavingsPerFill >= 10;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="flash" size={14} color={Colors.primary} />
        <Text style={styles.headerLabel}>{t('addLoad.fuelStop.title')}</Text>
      </View>

      {/* Recommendation */}
      <Text style={styles.bestLine}>
        {t('addLoad.fuelStop.fuelIn')}{' '}
        <Text style={styles.bestState}>{plan.best.state}</Text>
        <Text style={styles.bestEffective}>
          {'  '}${plan.best.effectivePrice.toFixed(2)}/gal {t('addLoad.fuelStop.afterTax')}
        </Text>
      </Text>

      {/* The counterintuitive part — only when the tax math flips the answer */}
      {showSavings && (
        <View style={styles.savingsPill}>
          <Ionicons name="trending-down" size={13} color={Colors.primary} />
          <Text style={styles.savingsText}>
            {t('addLoad.fuelStop.savings', {
              naive: plan.naive.state,
              amount: `$${plan.estSavingsPerFill}`,
            })}
          </Text>
        </View>
      )}

      {/* Per-state effective prices, cheapest first */}
      <View style={styles.tableWrap}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableHeaderCell}>{t('addLoad.fuelStop.colState')}</Text>
          <Text style={styles.tableHeaderCell}>{t('addLoad.fuelStop.colPump')}</Text>
          <Text style={styles.tableHeaderCell}>{t('addLoad.fuelStop.colTax')}</Text>
          <Text style={styles.tableHeaderCell}>{t('addLoad.fuelStop.colReal')}</Text>
        </View>
        {plan.options.map((o, i) => (
          <View key={o.state} style={styles.row}>
            <Text style={[styles.rowState, i === 0 && styles.rowTextBest]}>
              {o.state}
              {o.yourPrice && <Text style={styles.yourPriceMark}> ●</Text>}
            </Text>
            <Text style={styles.rowPump}>${o.pumpPrice.toFixed(2)}</Text>
            <Text style={styles.rowTax}>−${o.taxPerGallon.toFixed(2)}</Text>
            <Text style={[styles.rowEffective, i === 0 && styles.rowTextBest]}>
              ${o.effectivePrice.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        {plan.usedYourPrices
          ? t('addLoad.fuelStop.disclaimerPersonal', { asOf: plan.dataAsOf })
          : t('addLoad.fuelStop.disclaimer', { asOf: plan.dataAsOf })}
      </Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 20,
  },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  headerLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 0 },

  bestLine:      { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  bestState:     { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.primary, letterSpacing: -0.3 },
  bestEffective: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary },

  savingsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 10,
  },
  savingsText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.primary, flexShrink: 1 },

  tableWrap: { marginTop: 14 },
  tableHeaderRow: {
    flexDirection: 'row', paddingBottom: 6, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  tableHeaderCell: {
    flex: 1, fontFamily: FontFamily.monoSemiBold, fontSize: 10,
    color: Colors.labelColor, letterSpacing: 1.0, textTransform: 'uppercase',
  },
  row:          { flexDirection: 'row', paddingVertical: 5 },
  rowState:     { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.textPrimary },
  yourPriceMark:{ fontFamily: FontFamily.monoRegular, fontSize: 8, color: Colors.primary },
  rowPump:      { flex: 1, fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary },
  rowTax:       { flex: 1, fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary },
  rowEffective: { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.textPrimary },
  rowTextBest:  { color: Colors.primary },

  disclaimer: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, lineHeight: 16, marginTop: 12,
  },
});
