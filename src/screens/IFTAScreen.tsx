import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import { getLoadCount, getIFTAData, hasIFTAData, IFTARow } from '../db/database';

type Quarter = 1 | 2 | 3 | 4;
const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;


function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  return (m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4) as Quarter;
}

function generateCSV(rows: IFTARow[], year: number, q: Quarter): string {
  const lines = [
    `IFTA Report - Q${q} ${year}`,
    'State,Miles,Gallons',
    ...rows.map(r => `${r.state},${r.miles.toFixed(1)},${r.gallons.toFixed(1)}`),
    '',
    `TOTAL,${rows.reduce((s, r) => s + r.miles, 0).toFixed(1)},${rows.reduce((s, r) => s + r.gallons, 0).toFixed(1)}`,
    '',
    'Figures are estimates. Verify all totals before filing your IFTA return.',
  ];
  return lines.join('\n');
}

export default function IFTAScreen() {
  const { t } = useTranslation();
  const thisYear    = new Date().getFullYear();
  const thisQuarter = currentQuarter();

  const [year,    setYear]    = useState(thisYear);
  const [quarter, setQuarter] = useState<Quarter>(thisQuarter);

  const [rows, setRows] = useState<IFTARow[]>(() => getIFTAData(thisYear, thisQuarter));

  const loadData = useCallback((y: number, q: Quarter) => {
    setRows(getIFTAData(y, q));
  }, []);

  useEffect(() => { loadData(year, quarter); }, [year, quarter, loadData]);

  useFocusEffect(useCallback(() => { loadData(year, quarter); }, [year, quarter, loadData]));

  const totalMiles   = rows.reduce((s, r) => s + r.miles,   0);
  const totalGallons = rows.reduce((s, r) => s + r.gallons, 0);
  const hasData      = rows.length > 0;

  async function handleExport() {
    if (!hasData) {
      Alert.alert(t('ifta.exportNoDataTitle'), t('ifta.exportNoDataMsg', { quarter: `Q${quarter}`, year }));
      return;
    }
    const csv = generateCSV(rows, year, quarter);
    try {
      await Share.share({
        message: csv,
        title:   `IFTA_Q${quarter}_${year}.csv`,
      });
    } catch {
      Alert.alert(t('ifta.exportFailedTitle'), t('ifta.exportFailedMsg'));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('ifta.eyebrow')}</Text>
            <Text style={styles.title}>{t('ifta.title')}</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.exportText}>{t('ifta.exportCSV')}</Text>
          </TouchableOpacity>
        </View>

        {/* Year + Quarter selector */}
        <View style={styles.selectorBlock}>
          <View style={styles.yearRow}>
            <TouchableOpacity
              onPress={() => setYear(y => y - 1)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.yearLabel}>{year}</Text>
            <TouchableOpacity
              onPress={() => setYear(y => y + 1)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={year >= new Date().getFullYear()}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={year >= new Date().getFullYear() ? Colors.textTertiary : Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.quarterRow}>
            {([1, 2, 3, 4] as Quarter[]).map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quarterChip, quarter === q && styles.quarterChipActive]}
                onPress={() => setQuarter(q)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quarterChipText, quarter === q && styles.quarterChipTextActive]}>
                  {QUARTER_LABELS[q - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {hasData ? (
          <>
            {/* Summary stats */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('ifta.totalMiles')}</Text>
                <Text style={styles.summaryValue}>{Math.round(totalMiles).toLocaleString()}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('ifta.totalGallons')}</Text>
                <Text style={styles.summaryValue}>{totalGallons.toFixed(1)}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeader, { flex: 1 }]}>{t('ifta.state')}</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>{t('ifta.miles')}</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>{t('ifta.gallons')}</Text>
              </View>

              {rows.map((row, i) => (
                <React.Fragment key={row.state}>
                  <View style={styles.tableRow}>
                    <Text style={[styles.stateCode, { flex: 1 }]}>{row.state}</Text>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {Math.round(row.miles).toLocaleString()}
                    </Text>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {row.gallons.toFixed(1)}
                    </Text>
                  </View>
                  {i < rows.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}

              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { flex: 1 }]}>{t('ifta.total')}</Text>
                <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                  {Math.round(totalMiles).toLocaleString()}
                </Text>
                <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                  {totalGallons.toFixed(1)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={26} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{t('ifta.noData', { quarter: `Q${quarter}`, year })}</Text>
            <Text style={styles.emptySub}>
              {t('ifta.noDataHint')}
            </Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          {t('ifta.disclaimer')}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border,
  },
  exportText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  selectorBlock: { marginBottom: 20 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  yearLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, minWidth: 56, textAlign: 'center' },

  quarterRow:           { flexDirection: 'row', gap: 8 },
  quarterChip:          { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  quarterChipActive:    { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  quarterChipText:      { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textSecondary },
  quarterChipTextActive: { color: Colors.primary },

  summaryRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard:  { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.cardPad },
  summaryLabel: { ...SectionLabel, fontSize: 10, marginBottom: 6 },
  summaryValue: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  tableCard:      { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 20 },
  tableHeaderRow: { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 12, backgroundColor: Colors.surfaceHigh },
  tableHeader:    { ...SectionLabel, fontSize: 10, marginBottom: 0 },
  tableRow:       { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, alignItems: 'center' },
  stateCode:      { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  tableCellText:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  rowDivider:     { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
  totalsRow:      { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surfaceHigh },
  totalsLabel:    { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textSecondary },
  totalsValue:    { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textPrimary },

  emptyCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingVertical: 44, paddingHorizontal: Spacing.cardPad, alignItems: 'center', marginBottom: 20 },
  emptyIcon: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptySub:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  disclaimer: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
});
