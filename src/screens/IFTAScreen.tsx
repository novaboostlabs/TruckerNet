import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const CURRENT_YEAR = new Date().getFullYear();

export default function IFTAScreen() {
  const [quarter, setQuarter] = useState<Quarter>('Q2');
  const [year] = useState(CURRENT_YEAR);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>COMPLIANCE</Text>
            <Text style={styles.headerTitle}>IFTA</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Quarter selector */}
        <View style={styles.quarterBlock}>
          <Text style={styles.quarterYear}>{year}</Text>
          <View style={styles.quarterRow}>
            {QUARTERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quarterChip, quarter === q && styles.quarterChipActive]}
                onPress={() => setQuarter(q)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quarterChipText, quarter === q && styles.quarterChipTextActive]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCol, { flex: 1.2 }]}>STATE</Text>
          <Text style={[styles.tableCol, { flex: 2, textAlign: 'right' }]}>MILES</Text>
          <Text style={[styles.tableCol, { flex: 2, textAlign: 'right' }]}>GALLONS</Text>
        </View>

        {/* Empty state */}
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={26} color={Colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No data for {quarter} {year}</Text>
          <Text style={styles.emptySub}>
            Log loads and fuel entries and your IFTA report builds automatically.
          </Text>
        </View>

        {/* Disclaimer */}
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

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24,
  },
  headerLabel: { ...SectionLabel, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  exportBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  quarterBlock: { marginBottom: 24 },
  quarterYear:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textSecondary, marginBottom: 10 },
  quarterRow:   { flexDirection: 'row', gap: 8 },
  quarterChip: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  quarterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  quarterChipText:       { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textSecondary },
  quarterChipTextActive: { color: Colors.primary },

  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 4,
    paddingBottom: 10, marginBottom: 2,
  },
  tableCol: { ...SectionLabel, marginBottom: 0, fontSize: 10 },

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
  emptySub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.label,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 260,
  },

  disclaimer: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textTertiary, textAlign: 'center', lineHeight: 18,
  },
});
