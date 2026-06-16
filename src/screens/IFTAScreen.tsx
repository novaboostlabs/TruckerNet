import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const DEMO_DATA: Record<Quarter, { state: string; miles: number; gallons: number }[]> = {
  Q1: [],
  Q2: [
    { state: 'TX', miles: 2840, gallons: 74.3 },
    { state: 'IL', miles: 1421, gallons: 37.2 },
    { state: 'GA', miles:  662, gallons: 17.4 },
    { state: 'TN', miles:  560, gallons: 14.7 },
    { state: 'OK', miles:  380, gallons:  9.9 },
    { state: 'FL', miles:  340, gallons:  8.9 },
  ],
  Q3: [],
  Q4: [],
};

export default function IFTAScreen() {
  const [quarter, setQuarter] = useState<Quarter>('Q2');
  const rows = DEMO_DATA[quarter];
  const totalMiles   = rows.reduce((s, r) => s + r.miles,   0);
  const totalGallons = rows.reduce((s, r) => s + r.gallons, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>COMPLIANCE</Text>
            <Text style={styles.title}>IFTA</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.exportText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Quarter selector */}
        <View style={styles.quarterBlock}>
          <Text style={styles.quarterYear}>2026</Text>
          <View style={styles.quarterRow}>
            {QUARTERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quarterChip, quarter === q && styles.quarterChipActive]}
                onPress={() => setQuarter(q)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quarterChipText, quarter === q && styles.quarterChipTextActive]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {rows.length > 0 ? (
          <>
            {/* Summary stats */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>TOTAL MILES</Text>
                <Text style={styles.summaryValue}>{totalMiles.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>TOTAL GALLONS</Text>
                <Text style={styles.summaryValue}>{totalGallons.toFixed(1)}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeader, { flex: 1 }]}>STATE</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>MILES</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>GALLONS</Text>
              </View>

              {rows.map((row, i) => (
                <React.Fragment key={row.state}>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <Text style={styles.stateCode}>{row.state}</Text>
                    </View>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {row.miles.toLocaleString()}
                    </Text>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {row.gallons.toFixed(1)}
                    </Text>
                  </View>
                  {i < rows.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}

              {/* Totals row */}
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { flex: 1 }]}>TOTAL</Text>
                <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                  {totalMiles.toLocaleString()}
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
            <Text style={styles.emptyTitle}>No data for {quarter} 2026</Text>
            <Text style={styles.emptySub}>Log loads and fuel entries to auto-build your IFTA report.</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          Figures are estimates based on logged data. Verify all totals before filing your IFTA return.
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

  quarterBlock: { marginBottom: 20 },
  quarterYear:  { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 10 },
  quarterRow:   { flexDirection: 'row', gap: 8 },
  quarterChip: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  quarterChipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  quarterChipText:       { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textSecondary },
  quarterChipTextActive: { color: Colors.primary },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  summaryLabel: { ...SectionLabel, fontSize: 10, marginBottom: 6 },
  summaryValue: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  tableCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.cardPad,
    paddingVertical: 12, backgroundColor: Colors.surfaceHigh,
  },
  tableHeader: { ...SectionLabel, fontSize: 10, marginBottom: 0 },
  tableRow:    { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, alignItems: 'center' },
  tableCell:   {},
  stateCode:   { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  tableCellText: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  rowDivider:  { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
  totalsRow:   {
    flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surfaceHigh,
  },
  totalsLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textSecondary },
  totalsValue: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textPrimary },

  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 44, paddingHorizontal: Spacing.cardPad,
    alignItems: 'center', marginBottom: 20,
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptySub:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  disclaimer: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textTertiary, textAlign: 'center', lineHeight: 18,
  },
});
