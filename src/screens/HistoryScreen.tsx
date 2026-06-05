import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, CardStyle, SectionHeaderStyle } from '../theme/theme';

type Filter = 'week' | 'month' | 'all';

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('month');

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>History</Text>

      {/* Filter bar */}
      <View style={styles.filterRow}>
        {(['week', 'month', 'all'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && styles.filterChipTextActive,
              ]}
            >
              {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary totals */}
      <View style={styles.totalsCard}>
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>GROSS</Text>
          <Text style={styles.totalValue}>$—</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>NET</Text>
          <Text style={styles.totalValue}>$—</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>MILES</Text>
          <Text style={styles.totalValue}>—</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalCell}>
          <Text style={styles.totalLabel}>AVG RPM</Text>
          <Text style={styles.totalValue}>$—</Text>
        </View>
      </View>

      {/* Empty state */}
      <View style={[styles.card, { paddingVertical: 40, alignItems: 'center' }]}>
        <Text style={styles.emptyText}>No loads logged yet.</Text>
        <Text style={styles.emptySub}>Your completed loads will appear here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.screenH,
    paddingTop: 16,
  },
  screenTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 26,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '1A',
  },
  filterChipText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.accent,
    fontFamily: FontFamily.semiBold,
  },
  totalsCard: {
    ...CardStyle,
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 14,
  },
  totalCell: {
    flex: 1,
    alignItems: 'center',
  },
  totalLabel: {
    ...SectionHeaderStyle,
    marginBottom: 4,
    fontSize: 10,
  },
  totalValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  totalDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  card: {
    ...CardStyle,
  },
  emptyText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
