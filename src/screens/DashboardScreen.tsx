import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

// ── Placeholder data (replace with real DB queries in Phase 2) ──
const DEMO = {
  breakEvenRPM:  1.847,
  fuelCPM:       0.412,
  fixedCPM:      1.435,
  weekNet:       2840,
  weekGross:     5620,
  monthNet:      11240,
  monthGross:    21800,
  loads: [
    { id: '1', from: 'Chicago, IL',  to: 'Dallas, TX',   miles: 921,  gross: 2100, net: 1432,  rpm: 2.28, positive: true  },
    { id: '2', from: 'Atlanta, GA',  to: 'Miami, FL',    miles: 662,  gross: 1850, net: 1198,  rpm: 2.79, positive: true  },
    { id: '3', from: 'Memphis, TN',  to: 'Houston, TX',  miles: 560,  gross:  980, net:  287,  rpm: 1.75, positive: false },
  ],
};

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>OVERVIEW</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Break-even hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>BREAK-EVEN RATE</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <Text style={styles.heroNumber}>${DEMO.breakEvenRPM.toFixed(3)}</Text>
          <Text style={styles.heroUnit}>per mile — below this you lose money</Text>

          <View style={styles.heroDivider} />

          <View style={styles.cpmRow}>
            <View style={styles.cpmCell}>
              <Text style={styles.cpmEyebrow}>FUEL CPM</Text>
              <Text style={styles.cpmValue}>${DEMO.fuelCPM.toFixed(3)}</Text>
            </View>
            <View style={styles.cpmSep} />
            <View style={styles.cpmCell}>
              <Text style={styles.cpmEyebrow}>FIXED CPM</Text>
              <Text style={styles.cpmValue}>${DEMO.fixedCPM.toFixed(3)}</Text>
            </View>
          </View>
        </View>

        {/* ── Period cards ── */}
        <View style={styles.periodRow}>
          <View style={[styles.periodCard, { flex: 1 }]}>
            <Text style={styles.periodEyebrow}>THIS WEEK</Text>
            <Text style={[styles.periodNet, { color: DEMO.weekNet >= 0 ? Colors.primary : Colors.danger }]}>
              +${fmt(DEMO.weekNet)}
            </Text>
            <Text style={styles.periodGross}>of ${fmt(DEMO.weekGross)} gross</Text>
          </View>

          <View style={[styles.periodCard, { flex: 1 }]}>
            <Text style={styles.periodEyebrow}>THIS MONTH</Text>
            <Text style={[styles.periodNet, { color: DEMO.monthNet >= 0 ? Colors.primary : Colors.danger }]}>
              +${fmt(DEMO.monthNet)}
            </Text>
            <Text style={styles.periodGross}>of ${fmt(DEMO.monthGross)} gross</Text>
          </View>
        </View>

        {/* ── Quick Eval CTA ── */}
        <TouchableOpacity style={styles.evalButton} activeOpacity={0.8}>
          <Ionicons name="flash" size={15} color={Colors.background} />
          <Text style={styles.evalText}>Quick Eval — Is This Load Worth It?</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.background} />
        </TouchableOpacity>

        {/* ── Recent Loads ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT LOADS</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.loadsCard}>
            {DEMO.loads.map((load, i) => (
              <React.Fragment key={load.id}>
                <TouchableOpacity style={styles.loadRow} activeOpacity={0.7}>
                  {/* Left: route */}
                  <View style={styles.loadLeft}>
                    <Text style={styles.loadRoute} numberOfLines={1}>
                      {load.from.split(',')[0]} → {load.to.split(',')[0]}
                    </Text>
                    <Text style={styles.loadMeta}>{fmt(load.miles)} mi · ${load.rpm.toFixed(2)}/mi</Text>
                  </View>

                  {/* Right: net pay */}
                  <View style={styles.loadRight}>
                    <Text style={[styles.loadNet, { color: load.positive ? Colors.primary : Colors.danger }]}>
                      {load.positive ? '+' : ''}${fmt(load.net)}
                    </Text>
                    <Text style={styles.loadGross}>${fmt(load.gross)} gross</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {i < DEMO.loads.length - 1 && <View style={styles.loadDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color={Colors.background} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 120 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24,
  },
  headerEyebrow: { ...SectionLabel, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  settingsBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.cardPad,
    marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroEyebrow: { ...SectionLabel, marginBottom: 0 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  liveText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption, color: Colors.primary },

  heroNumber: {
    fontFamily: FontFamily.bold, fontSize: FontSize.heroLarge,
    color: Colors.primary, lineHeight: 60, letterSpacing: -1.5,
  },
  heroUnit: {
    fontFamily: FontFamily.regular, fontSize: FontSize.label,
    color: Colors.textSecondary, marginBottom: 20, lineHeight: 20,
  },
  heroDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 18 },
  cpmRow:  { flexDirection: 'row', alignItems: 'center' },
  cpmCell: { flex: 1 },
  cpmSep:  { width: 1, height: 30, backgroundColor: Colors.border, marginHorizontal: 16 },
  cpmEyebrow: { ...SectionLabel, fontSize: 10, marginBottom: 4 },
  cpmValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  // Period cards
  periodRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  periodCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  periodEyebrow: { ...SectionLabel, fontSize: 10, marginBottom: 8 },
  periodNet: {
    fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber,
    lineHeight: 36, letterSpacing: -0.5,
  },
  periodGross: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, marginTop: 3,
  },

  // Quick Eval
  evalButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, marginBottom: 28,
  },
  evalText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.background, flex: 1, textAlign: 'center' },

  // Section
  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel:  { ...SectionLabel, marginBottom: 0 },
  sectionAction: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },

  // Loads card
  loadsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  loadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  loadLeft:  { flex: 1, marginRight: 12 },
  loadRoute: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  loadMeta:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight: { alignItems: 'flex-end' },
  loadNet:   { fontFamily: FontFamily.bold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: Spacing.screenH,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
});
