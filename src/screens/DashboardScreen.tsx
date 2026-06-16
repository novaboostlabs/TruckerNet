import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, Card, SectionLabel } from '../theme/theme';

export default function DashboardScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>GOOD MORNING</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Break-even hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>BREAK-EVEN RATE</Text>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>Live</Text>
            </View>
          </View>
          <Text style={styles.heroNumber}>$—.——</Text>
          <Text style={styles.heroSub}>per mile</Text>

          {/* CPM breakdown */}
          <View style={styles.heroDivider} />
          <View style={styles.cpmRow}>
            <View style={styles.cpmCell}>
              <Text style={styles.cpmLabel}>FUEL CPM</Text>
              <Text style={styles.cpmValue}>$—.———</Text>
            </View>
            <View style={styles.cpmDivider} />
            <View style={styles.cpmCell}>
              <Text style={styles.cpmLabel}>FIXED CPM</Text>
              <Text style={styles.cpmValue}>$—.———</Text>
            </View>
          </View>
        </View>

        {/* ── Period cards ── */}
        <View style={styles.periodRow}>
          <View style={[styles.periodCard, styles.periodCardHalf]}>
            <Text style={styles.periodLabel}>THIS WEEK</Text>
            <Text style={styles.periodNumber}>$—</Text>
            <Text style={styles.periodSub}>net pay</Text>
          </View>
          <View style={[styles.periodCard, styles.periodCardHalf]}>
            <Text style={styles.periodLabel}>THIS MONTH</Text>
            <Text style={styles.periodNumber}>$—</Text>
            <Text style={styles.periodSub}>net pay</Text>
          </View>
        </View>

        {/* ── Quick Eval button ── */}
        <TouchableOpacity style={styles.evalButton} activeOpacity={0.8}>
          <Ionicons name="flash" size={16} color={Colors.background} />
          <Text style={styles.evalButtonText}>Quick Eval — Is This Load Worth It?</Text>
        </TouchableOpacity>

        {/* ── Recent Loads ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>RECENT LOADS</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* Empty state */}
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="trail-sign-outline" size={28} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No loads yet</Text>
            <Text style={styles.emptySub}>Tap + to log your first load and see your real net pay.</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Floating action button ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color={Colors.background} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerLabel: { ...SectionLabel, marginBottom: 4 },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.title,
    color: Colors.textPrimary,
    lineHeight: 34,
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.cardPad,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: { ...SectionLabel, marginBottom: 0 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  heroBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  heroNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.heroLarge,
    color: Colors.primary,
    lineHeight: 60,
    letterSpacing: -1,
  },
  heroSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  heroDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 20 },
  cpmRow: { flexDirection: 'row', alignItems: 'center' },
  cpmCell: { flex: 1 },
  cpmDivider: { width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 16 },
  cpmLabel: { ...SectionLabel, fontSize: 10, marginBottom: 4 },
  cpmValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
  },

  // Period row
  periodRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  periodCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.cardPad,
  },
  periodCardHalf: { flex: 1 },
  periodLabel: { ...SectionLabel, fontSize: 10, marginBottom: 8 },
  periodNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.cardNumber,
    color: Colors.textPrimary,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  periodSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Quick Eval button
  evalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    marginBottom: 32,
  },
  evalButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.background,
    letterSpacing: 0.1,
  },

  // Section
  section: { marginBottom: 24 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: { ...SectionLabel, marginBottom: 0 },
  sectionLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.primary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 40,
    paddingHorizontal: Spacing.cardPad,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.subtitle,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32, right: Spacing.screenH,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
