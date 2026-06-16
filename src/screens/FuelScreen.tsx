import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

const DEMO_ENTRIES = [
  { id: '1', date: 'Jun 14',  state: 'TX', gallons: 58.3, pricePerGal: 3.22, dollarsSpent: 187.73, cpm: 0.387 },
  { id: '2', date: 'Jun 11',  state: 'OK', gallons: 62.1, pricePerGal: 3.27, dollarsSpent: 203.07, cpm: 0.401 },
  { id: '3', date: 'Jun 8',   state: 'TN', gallons: 59.8, pricePerGal: 3.28, dollarsSpent: 196.14, cpm: 0.412 },
  { id: '4', date: 'Jun 4',   state: 'GA', gallons: 61.4, pricePerGal: 3.19, dollarsSpent: 195.87, cpm: 0.398 },
  { id: '5', date: 'Jun 1',   state: 'FL', gallons: 57.9, pricePerGal: 3.31, dollarsSpent: 191.65, cpm: 0.421 },
];

const CURRENT_CPM = 0.412;

export default function FuelScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TRACKING</Text>
            <Text style={styles.title}>Fuel</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addBtnText}>Log Fill-up</Text>
          </TouchableOpacity>
        </View>

        {/* CPM Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>CURRENT FUEL COST PER MILE</Text>
          <Text style={styles.heroNumber}>${CURRENT_CPM.toFixed(3)}</Text>
          <Text style={styles.heroSub}>Based on most recent fill-up · Jun 14, TX</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>AVG THIS MONTH</Text>
              <Text style={styles.heroStatValue}>$0.404</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>TOTAL SPENT</Text>
              <Text style={styles.heroStatValue}>$974.46</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>TOTAL GALLONS</Text>
              <Text style={styles.heroStatValue}>299.5</Text>
            </View>
          </View>
        </View>

        {/* Chart placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CPM TREND — LAST 5 FILL-UPS</Text>
          <View style={styles.chartCard}>
            {/* Fake sparkline bars */}
            <View style={styles.chartBars}>
              {[0.387, 0.401, 0.412, 0.398, 0.421].map((v, i) => {
                const max = 0.45;
                const height = Math.round((v / max) * 80);
                return (
                  <View key={i} style={styles.chartBarWrap}>
                    <Text style={styles.chartBarLabel}>${v.toFixed(3)}</Text>
                    <View style={[styles.chartBar, { height, backgroundColor: i === DEMO_ENTRIES.length - 1 ? Colors.primary : Colors.surfaceHigh }]} />
                    <Text style={styles.chartBarDate}>{DEMO_ENTRIES[i].date}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Past entries */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FILL-UP HISTORY</Text>
          <View style={styles.entriesCard}>
            {DEMO_ENTRIES.map((e, i) => (
              <React.Fragment key={e.id}>
                <View style={styles.entryRow}>
                  <View style={styles.entryLeft}>
                    <Text style={styles.entryDate}>{e.date} · {e.state}</Text>
                    <Text style={styles.entryDetail}>{e.gallons} gal · ${e.pricePerGal.toFixed(2)}/gal</Text>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={styles.entryCPM}>${e.cpm.toFixed(3)}<Text style={styles.entryCPMUnit}>/mi</Text></Text>
                    <Text style={styles.entrySpent}>${e.dollarsSpent.toFixed(2)}</Text>
                  </View>
                </View>
                {i < DEMO_ENTRIES.length - 1 && <View style={styles.entryDivider} />}
              </React.Fragment>
            ))}
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

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  addBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  addBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.primary },

  heroCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 20,
  },
  heroEyebrow: { ...SectionLabel, marginBottom: 10 },
  heroNumber:  { fontFamily: FontFamily.bold, fontSize: FontSize.hero, color: Colors.textPrimary, lineHeight: 52, letterSpacing: -1, marginBottom: 4 },
  heroSub:     { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 18 },
  heroDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 16 },
  heroStats:      { flexDirection: 'row' },
  heroStat:       { flex: 1 },
  heroStatDivider:{ width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  heroStatLabel:  { ...SectionLabel, fontSize: 9, marginBottom: 4 },
  heroStatValue:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  section:      { marginBottom: 20 },
  sectionLabel: { ...SectionLabel, marginBottom: 12 },

  chartCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 8 },
  chartBarWrap:  { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartBarLabel: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.textSecondary, marginBottom: 4 },
  chartBar:      { width: '100%', borderRadius: Radius.sm, minHeight: 4 },
  chartBarDate:  { fontFamily: FontFamily.regular, fontSize: 9, color: Colors.textSecondary, marginTop: 4 },

  entriesCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  entryLeft:    { flex: 1 },
  entryDate:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  entryDetail:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryRight:   { alignItems: 'flex-end' },
  entryCPM:     { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.primary, marginBottom: 2 },
  entryCPMUnit: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entrySpent:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
});
