import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

type Filter = 'week' | 'month' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('month');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>RECORDS</Text>
            <Text style={styles.headerTitle}>History</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => setFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary totals */}
        <View style={styles.totalsCard}>
          {[
            { label: 'GROSS',   value: '$—' },
            { label: 'NET',     value: '$—' },
            { label: 'MILES',   value: '—' },
            { label: 'AVG RPM', value: '$—' },
          ].map(({ label, value }, i, arr) => (
            <React.Fragment key={label}>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={styles.totalValue}>{value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.totalDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Empty state */}
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="time-outline" size={26} color={Colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No loads recorded</Text>
          <Text style={styles.emptySub}>Every load you log will appear here with full profit breakdown.</Text>
        </View>
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
    width: 40, height: 40, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: {
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterChipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  filterChipText:       { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary, fontFamily: FontFamily.semiBold },

  totalsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, flexDirection: 'row',
    paddingVertical: 18, paddingHorizontal: 16,
    marginBottom: 20,
  },
  totalCell:    { flex: 1, alignItems: 'center', gap: 4 },
  totalLabel:   { ...SectionLabel, fontSize: 9, marginBottom: 0 },
  totalValue:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  totalDivider: { width: 1, backgroundColor: Colors.border },

  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 48, paddingHorizontal: Spacing.cardPad,
    alignItems: 'center',
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
});
