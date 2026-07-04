import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import FuelEntryScreen from './FuelEntryScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import { getFuelStats, getFuelEntryCount, getFuelEstimate, FuelStats, FuelEntryDisplay, FuelEstimate } from '../db/database';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';

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
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const [showEntry, setShowEntry] = useState(false);
  const [stats, setStats] = useState<FuelStats>(() =>
    getFuelEntryCount() > 0 ? getFuelStats() : EMPTY_STATS
  );
  // Setup estimate — shown (labeled) only until the first real fill-up exists.
  const [estimate, setEstimate] = useState<FuelEstimate | null>(() =>
    getFuelEntryCount() > 0 ? null : getFuelEstimate()
  );

  const refresh = useCallback(() => {
    const hasEntries = getFuelEntryCount() > 0;
    setStats(hasEntries ? getFuelStats() : EMPTY_STATS);
    setEstimate(hasEntries ? null : getFuelEstimate());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const entries      = stats.allEntries;
  const hasEntries   = entries.length > 0;
  const trendEntries = [...stats.last5].reverse();
  const maxCPM = Math.max(...trendEntries.map(e => e.cost_per_mile), 0.001);

  // Engine stats over the last 10 fill-ups (matches the rolling CPM window).
  const engine = useMemo(() => {
    const recent   = entries.slice(0, 10);
    const withMpg  = recent.filter(e => e.mpg > 0);
    const avgMpg   = withMpg.length ? withMpg.reduce((s, e) => s + e.mpg, 0) / withMpg.length : 0;
    const bestMpg  = withMpg.length ? Math.max(...withMpg.map(e => e.mpg)) : 0;
    const withPpg  = recent.filter(e => e.price_per_gallon > 0);
    const avgPrice = withPpg.length ? withPpg.reduce((s, e) => s + e.price_per_gallon, 0) / withPpg.length : 0;
    return { avgMpg, bestMpg, avgPrice };
  }, [entries]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GridBackground />
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
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setShowEntry(true)}>
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addBtnText}>{t('fuel.logFillup')}</Text>
          </TouchableOpacity>
        </View>

        {/* CPM Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{t('fuel.currentCPM')}</Text>
          <View style={styles.heroNumberRow}>
            <Text style={[styles.heroNumber, { color: (estimate ? estimate.cpm : stats.latestCPM) > 0 ? Colors.primary : Colors.textSecondary }]}>
              ${(estimate ? estimate.cpm : stats.latestCPM).toFixed(3)}
            </Text>
            {estimate && (
              <View style={styles.estBadge}>
                <Text style={styles.estBadgeText}>{t('fuel.estBadge')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroSub}>
            {estimate
              ? t('fuel.heroEstimate')
              : stats.rollingCount > 0
                ? t('fuel.heroAvg', { count: stats.rollingCount, date: formatDate(stats.latestDate) })
                : entries.length > 0
                  ? t('fuel.heroBaseline')
                  : t('fuel.heroEmpty')}
          </Text>

          <View style={styles.heroDivider} />

          {estimate ? (
            <Text style={styles.estNote}>
              {t('fuel.estimateNote', {
                cost: `$${Math.round(estimate.weeklyCost).toLocaleString()}`,
                miles: Math.round(estimate.weeklyMiles).toLocaleString(),
              })}
            </Text>
          ) : (
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
          )}
        </View>

        {/* ── First-run: sell the payoff instead of showing three empty boxes ── */}
        {!hasEntries ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('fuel.valueTitle')}</Text>
              <View style={styles.valueCard}>
                {([
                  { icon: 'speedometer-outline', title: t('fuel.valueMpg'),  sub: t('fuel.valueMpgSub')  },
                  { icon: 'trending-down-outline', title: t('fuel.valueCpm'), sub: t('fuel.valueCpmSub') },
                  { icon: 'map-outline',         title: t('fuel.valueIfta'), sub: t('fuel.valueIftaSub') },
                ] as const).map((row, i, arr) => (
                  <React.Fragment key={row.icon}>
                    <View style={styles.valueRow}>
                      <View style={styles.valueIcon}>
                        <Ionicons name={row.icon} size={19} color={Colors.primary} />
                      </View>
                      <View style={styles.valueTextWrap}>
                        <Text style={styles.valueRowTitle}>{row.title}</Text>
                        <Text style={styles.valueRowSub}>{row.sub}</Text>
                      </View>
                    </View>
                    {i < arr.length - 1 && <View style={styles.valueDivider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.logFirstBtn} activeOpacity={0.85} onPress={() => setShowEntry(true)}>
              <Ionicons name="flash" size={17} color={Colors.onPrimary} />
              <Text style={styles.logFirstText}>{t('fuel.logFirst')}</Text>
            </TouchableOpacity>
            {!!estimate && (
              <Text style={styles.estimateFootnote}>{t('fuel.estimateHint')}</Text>
            )}
          </>
        ) : (
          <>
            {/* Engine stats — MPG + pump price over the last 10 fill-ups */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('fuel.statsLabel')}</Text>
              <View style={styles.engineCard}>
                {([
                  { label: t('fuel.avgMpg'),   value: engine.avgMpg  > 0 ? engine.avgMpg.toFixed(1)        : '—' },
                  { label: t('fuel.bestMpg'),  value: engine.bestMpg > 0 ? engine.bestMpg.toFixed(1)       : '—' },
                  { label: t('fuel.avgPrice'), value: engine.avgPrice > 0 ? `$${engine.avgPrice.toFixed(2)}` : '—' },
                ]).map(({ label, value }, i, arr) => (
                  <React.Fragment key={label}>
                    <View style={styles.engineStat}>
                      <Text style={styles.engineStatLabel}>{label}</Text>
                      <Text style={styles.engineStatValue}>{value}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.engineDivider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* CPM Trend */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('fuel.cpmTrend', { count: trendEntries.length })}</Text>
              <View style={styles.chartCard}>
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
              </View>
            </View>

            {/* Fill-up history */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('fuel.fillupHistory')}</Text>
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
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 4 },
  title:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary },
  addBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  addBtnText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.primary },

  heroCard:        { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 20 },
  heroEyebrow:     { ...sectionLabel(Colors), marginBottom: 10 },
  heroNumberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  heroNumber:      { fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, lineHeight: 52, letterSpacing: -1 },
  estBadge:        { backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '50', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  estBadgeText:    { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.secondary, letterSpacing: 1.2 },
  estNote:         { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 18 },
  heroSub:         { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 18 },
  heroDivider:     { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 16 },
  heroStats:       { flexDirection: 'row' },
  heroStat:        { flex: 1 },
  heroStatDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  heroStatLabel:   { ...sectionLabel(Colors), fontSize: 9, marginBottom: 4 },
  heroStatValue:   { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  section:      { marginBottom: 20 },
  sectionLabel: { ...sectionLabel(Colors), marginBottom: 12 },

  chartCard:    { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.cardPad },
  chartBars:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 8 },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartBarLabel: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.textSecondary, marginBottom: 4 },
  chartBar:     { width: '100%', borderRadius: Radius.sm, minHeight: 4 },
  chartBarDate: { fontFamily: FontFamily.regular, fontSize: 9, color: Colors.textSecondary, marginTop: 4 },
  emptyChart:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 24 },

  emptyCard:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 32, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // First-run value card
  valueCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.cardPad,
  },
  valueRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  valueIcon: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  valueTextWrap: { flex: 1 },
  valueRowTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3, letterSpacing: -0.3 },
  valueRowSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 17 },
  valueDivider:  { height: 1, backgroundColor: Colors.borderSubtle },
  logFirstBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  logFirstText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  estimateFootnote: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: 14, lineHeight: 17, paddingHorizontal: 12 },

  // Engine stats strip
  engineCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  engineStat:      { flex: 1, alignItems: 'center' },
  engineStatLabel: { ...sectionLabel(Colors), fontSize: 9, marginBottom: 5 },
  engineStatValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, letterSpacing: -0.5 },
  engineDivider:   { width: 1, backgroundColor: Colors.border, marginHorizontal: 10 },

  entriesCard:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  entryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.cardPad },
  entryLeft:    { flex: 1 },
  entryDate:    { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  entryDetail:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryRight:   { alignItems: 'flex-end' },
  entryCPM:     { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.primary, marginBottom: 2 },
  entryCPMUnit: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entrySpent:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  entryDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
});
