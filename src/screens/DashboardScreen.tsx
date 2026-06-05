import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, CardStyle, SectionHeaderStyle } from '../theme/theme';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      {/* Break-even rate hero card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>BREAK-EVEN RATE</Text>
        <Text style={styles.heroNumber}>$—.——</Text>
        <Text style={styles.sub}>per mile</Text>
      </View>

      {/* This Week */}
      <View style={styles.row}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.sectionHeader}>THIS WEEK</Text>
          <Text style={styles.cardNumber}>$—</Text>
          <Text style={styles.sub}>net pay</Text>
        </View>

        {/* This Month */}
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.sectionHeader}>THIS MONTH</Text>
          <Text style={styles.cardNumber}>$—</Text>
          <Text style={styles.sub}>net pay</Text>
        </View>
      </View>

      {/* Recent loads placeholder */}
      <Text style={styles.sectionHeader}>RECENT LOADS</Text>
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No loads logged yet.</Text>
        <Text style={styles.emptySub}>Tap + to add your first load.</Text>
      </View>

      {/* Floating action button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
  card: {
    ...CardStyle,
    marginBottom: 12,
    alignItems: 'center',
    paddingVertical: 20,
  },
  halfCard: {
    flex: 1,
    marginHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 12,
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
  cardNumber: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.cardNumber,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    ...CardStyle,
    alignItems: 'center',
    paddingVertical: 32,
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
  fab: {
    position: 'absolute',
    bottom: 32,
    right: Spacing.screenH,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabIcon: {
    fontFamily: FontFamily.semiBold,
    fontSize: 28,
    color: '#0F0F0F',
    lineHeight: 32,
  },
});
