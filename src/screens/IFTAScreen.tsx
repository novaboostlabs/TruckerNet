import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, CardStyle, SectionHeaderStyle } from '../theme/theme';

export default function IFTAScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>IFTA</Text>
      <Text style={styles.screenSubtitle}>
        Quarterly fuel tax reporting, automated from your logged loads and fuel entries.
      </Text>

      {/* Quarter selector placeholder */}
      <View style={styles.quarterRow}>
        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.quarterChip, q === 'Q2' && styles.quarterChipActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.quarterChipText,
                q === 'Q2' && styles.quarterChipTextActive,
              ]}
            >
              {q}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>STATE</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>MILES</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>GALLONS</Text>
      </View>

      {/* Empty state */}
      <View style={[styles.card, { paddingVertical: 40, alignItems: 'center' }]}>
        <Text style={styles.emptyText}>No data for this quarter.</Text>
        <Text style={styles.emptySub}>Log loads and fuel entries to populate this report.</Text>
      </View>

      {/* Export button (Pro only placeholder) */}
      <TouchableOpacity style={styles.exportButton} activeOpacity={0.8}>
        <Text style={styles.exportButtonText}>Export CSV — Pro Only</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        These figures are estimates based on your logged data. Verify all totals before filing your IFTA return.
      </Text>
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
    marginBottom: 4,
  },
  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  quarterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quarterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  quarterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '1A',
  },
  quarterChipText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  quarterChipTextActive: {
    color: Colors.accent,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    ...SectionHeaderStyle,
    marginBottom: 0,
  },
  card: {
    ...CardStyle,
    marginBottom: 12,
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
    textAlign: 'center',
  },
  exportButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  exportButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
});
