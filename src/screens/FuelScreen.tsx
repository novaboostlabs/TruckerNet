import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, CardStyle, SectionHeaderStyle } from '../theme/theme';

export default function FuelScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Fuel</Text>

      {/* Current CPM hero */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>CURRENT FUEL COST PER MILE</Text>
        <Text style={styles.heroNumber}>$—.———</Text>
        <Text style={styles.sub}>Log a fuel entry to calculate</Text>
      </View>

      {/* Log button */}
      <TouchableOpacity style={styles.logButton} activeOpacity={0.8}>
        <Text style={styles.logButtonText}>+ Log Fuel Entry</Text>
      </TouchableOpacity>

      {/* Chart placeholder */}
      <Text style={[styles.sectionHeader, { marginTop: 24 }]}>CPM TREND</Text>
      <View style={[styles.card, styles.chartPlaceholder]}>
        <Text style={styles.placeholderText}>Chart coming in Phase 3</Text>
      </View>

      {/* Past entries placeholder */}
      <Text style={styles.sectionHeader}>PAST ENTRIES</Text>
      <View style={[styles.card, { paddingVertical: 32, alignItems: 'center' }]}>
        <Text style={styles.placeholderText}>No fuel entries yet.</Text>
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
  card: {
    ...CardStyle,
    marginBottom: 12,
    alignItems: 'center',
    paddingVertical: 20,
  },
  sectionHeader: {
    ...SectionHeaderStyle,
  },
  heroNumber: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.heroNumber,
    color: Colors.accent,
    marginTop: 4,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: '#0F0F0F',
  },
  chartPlaceholder: {
    height: 140,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
});
