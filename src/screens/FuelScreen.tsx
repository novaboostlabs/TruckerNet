import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import FuelEntryScreen from './FuelEntryScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import { getDateLocale } from '../lib/i18n';
import { getFuelStats, getFuelEntryCount, FuelStats, FuelEntryDisplay } from '../db/database';

const EMPTY_STATS: FuelStats = {
  latestCPM: 0, rollingCount: 0, latestDate: '', latestState: '',
  avgCPMMonthly: 0, totalSpentMonth: 0, totalGallonsMonth: 0,
  last5: [], allEntries: [],
};

function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });
}

export default function FuelScreen() {
  const { t } = useTranslation();
  const [showEntry, setShowEntry] = useState(false);
  const [stats, setStats] = useState<FuelStats>(() =>
    getFuelEntryCount() > 0 ? getFuelStats() : EMPTY_STATS
  );

  const refresh = useCallback(() => {
    setStats(getFuelEntryCount() > 0 ? getFuelStats() : EMPTY_STATS);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const entries      = stats.allEntries;
  const trendEntries = [...stats.last5].reverse();
  const maxCPM = Math.max(...trendEntries.map(e => e.cost_per_mile), 0.001);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Modal visible={showEntry} animationType="slide" presentationStyle="pageSheet">
        <FuelEntryScreen
          onSaved={() => { setShowEntry(false); refresh(); }}
          onCancel={() => setShowEntry(false)}
        />
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('fuel.eyebrow')}</Text>
            <Text style={styles.title}>{t('fuel.title')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setShowEntry(true)}>
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addBtnText}>{t('fuel.logFillup')}</Text>
          </TouchableOpacity>
        </View>

        {/* CPM Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{t('fuel.currentCPM')}</Text>
          <Text style={[styles.heroNumber, { color: stats.latestCPM > 0 ? Colors.primary : Colors.textSecondary }]}>
            ${stats.latestCPM.toFixed(3)}
          </Text>
          <Text style={styles.heroSub}>
            {stats.rollingCount > 0
              ? t('fuel.heroAvg', { count: stats.rollingCount, date: formatDate(stats.latestDate) })
              : entries.length > 0
                ? t('fuel.heroBaseline')
                : t('fuel.heroEmpty')}
          </Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('fuel.avgThisMonth')}</Text>
              <Text style={styles.heroStatValue}>${stats.avgCPMMonthly.toFixed(3)}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('fuel.totalSpent')}</Text>
              <Text style={styles.heroStatValue}>${stats.totalSpentMonth.toFixed(2)}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('fuel.totalGallons')}</Text>
              <Text style={styles.heroStatValue}>{stats.totalGallonsMonth.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        {/* CPM Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('fuel.cpmTrend', { count: trendEntries.length })}</Text>
          <View style={styles.chartCard}>
            {trendEntries.length > 0 ? (
              <View style={styles.chartBars}>
                {trendEntries.map((e, i) => {
                  const height = Math.max(Math.round((e.cost_per_mile / (maxCPM * 1.2)) * 80), 4);
                  const isLatest = i === trendEntries.length - 1;
                  return (
                    <View key={e.id} style={styles.chartBarWrap}>
                      <Text style={styles.chartBarLabel}>${e.cost_per_mile.toFixed(3)}</Text>
                      <View style={[styles.chartBar, { height, backgroundColor: isLatest ? Colors.primary : Colors.surfaceHigh }]} />
                      <Text style={styles.chartBarDate}>{formatDate(e.date)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyChart}>{t('fuel.noChartData')}</Text>
            )}
          </View>
        </View>

        {/* Fill-up history */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('fuel.fillupHistory')}</Text>
          {entries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flash-outline" size={32} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>{t('fuel.noEntries')}</Text>
              <Text style={styles.emptyHint}>{t('fuel.noEntriesHint')}</Text>
            </View>
          ) : (
            <View style={styles.entriesCard}>
              {entries.map((e, i) => (
                <React.Fragment key={e.id}>
                  <View style={styles.entryRow}>
                    <View style={styles.entryLeft}>
                      <Text style={styles.entryDate}>{formatDate(e.date)} · {e.state}</Text>
                      <Text style={styles.entryDetail}>
                        {e.gallons.toFixed(1)} gal · ${e.price_per_gallon.toFixed(2)}/gal
                        {e.mpg > 0 ? ` · ${e.mpg.toFixed(1)} mpg` : ''}
                      </Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.entryCPM}>
                        ${e.cost_per_mile.toFixed(3)}<Text style={styles.entryCPMUnit}>/mi</Text>
                      </Text>
                      <Text style={styles.entrySpent}>${e.dollars_spent.toFixed(2)}</Text>
                    </View>
                  </View>
                  {i < entries.length - 1 && <View style={styles.entryDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
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

  heroCard:        { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 20 },
  heroEyebrow:     { ...SectionLabel, marginBottom: 10 },
  heroNumber:      { fontFamily: FontFamily.bold, fontSize: FontSize.hero, lineHeight: 52, letterSpacing: -1, marginBottom: 4 },
  heroSub:         { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 18 },
  heroDivider:     { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 16 },
  heroStats:       { flexDirection: 'row' },
  heroStat:        { flex: 1 },
  heroStatDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  heroStatLabel:   { ...SectionLabel, fontSize: 9, marginBottom: 4 },
  heroStatValue:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  section:      { marginBottom: 20 },
  sectionLabel: { ...SectionLabel, marginBottom: 12 },

  chartCard:    { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.cardPad },
  chartBars:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 8 },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartBarLabel: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.textSecondary, marginBottom: 4 },
  chartBar:     { width: '100%', borderRadius: Radius.sm, minHeight: 4 },
  chartBarDate: { fontFamily: FontFamily.regular, fontSize: 9, color: Colors.textSecondary, marginTop: 4 },
  emptyChart:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 24 },

  emptyCard:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 32, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  entriesCard:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  entryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.cardPad },
  entryLeft:    { flex: 1 },
  entryDate:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  entryDetail:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryRight:   { alignItems: 'flex-end' },
  entryCPM:     { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.primary, marginBottom: 2 },
  entryCPMUnit: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entrySpent:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
});
