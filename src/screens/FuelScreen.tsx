import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

export default function FuelScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>TRACKING</Text>
            <Text style={styles.headerTitle}>Fuel</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={Colors.primary} />
            <Text style={styles.addBtnText}>Log Entry</Text>
          </TouchableOpacity>
        </View>

        {/* CPM Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>CURRENT FUEL COST PER MILE</Text>
          <Text style={styles.heroNumber}>$—.———</Text>
          <Text style={styles.heroSub}>Log your first fill-up to calculate</Text>
        </View>

        {/* Chart placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CPM TREND</Text>
          <View style={styles.chartCard}>
            <Ionicons name="trending-up-outline" size={32} color={Colors.textSecondary} />
            <Text style={styles.chartPlaceholder}>Cost-per-mile trend will appear here</Text>
            <Text style={styles.chartSub}>Requires at least 2 fuel entries</Text>
          </View>
        </View>

        {/* Past entries */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAST ENTRIES</Text>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="flash-outline" size={24} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No fuel entries yet</Text>
            <Text style={styles.emptySub}>Every fill-up updates your real cost-per-mile.</Text>
          </View>
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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  addBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.primary },

  heroCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 24,
  },
  heroLabel:  { ...SectionLabel, marginBottom: 10 },
  heroNumber: {
    fontFamily: FontFamily.bold, fontSize: FontSize.hero,
    color: Colors.textPrimary, lineHeight: 52, letterSpacing: -1, marginBottom: 4,
  },
  heroSub: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  section:      { marginBottom: 24 },
  sectionLabel: { ...SectionLabel, marginBottom: 12 },

  chartCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, height: 160,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  chartPlaceholder: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  chartSub:         { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary },

  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 40, paddingHorizontal: Spacing.cardPad,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 50, height: 50, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 4 },
  emptySub:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center' },
});
