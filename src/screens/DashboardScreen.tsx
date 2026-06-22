import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import {
  calcBreakEven, getLoadCount, getWeekPnL, getMonthPnL,
  getRecentLoads, getActiveLoad, LoadSummary,
} from '../db/database';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import CheckLoadScreen from './CheckLoadScreen';
import AddLoadScreen, { AddLoadPrefill } from './AddLoadScreen';
import SettingsScreen from './SettingsScreen';


interface LoadRow {
  id: string; from: string; to: string;
  miles: number; gross: number; net: number; rpm: number; positive: boolean;
}

interface DashData {
  breakEvenRPM: number; fuelCPM: number; fixedCPM: number;
  weekNet: number; weekGross: number;
  monthNet: number; monthGross: number;
  loads: LoadRow[];
  activeLoad: LoadSummary | null;
  hasRealLoads: boolean;
}

function loadFromSummary(s: LoadSummary): LoadRow {
  return {
    id:       s.id,
    from:     `${s.pickup_city}, ${s.pickup_state}`,
    to:       `${s.delivery_city}, ${s.delivery_state}`,
    miles:    s.total_miles,
    gross:    s.gross_pay,
    net:      s.net_pay,
    rpm:      s.net_rate_per_mile,
    positive: s.net_pay >= 0,
  };
}

function readDashData(): DashData {
  const { breakEvenRPM, fuelCPM, fixedCPM } = calcBreakEven();
  const count = getLoadCount();
  const week   = count > 0 ? getWeekPnL()        : { net: 0, gross: 0 };
  const month  = count > 0 ? getMonthPnL()       : { net: 0, gross: 0 };
  const recent = count > 0 ? getRecentLoads(5).map(loadFromSummary) : [];
  const active = count > 0 ? getActiveLoad()     : null;

  return {
    breakEvenRPM, fuelCPM, fixedCPM,
    weekNet:   week.net,  weekGross:  week.gross,
    monthNet:  month.net, monthGross: month.gross,
    loads:     recent,
    activeLoad: active,
    hasRealLoads: count > 0,
  };
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [data,          setData]          = useState<DashData>(() => readDashData());
  const [showCheckLoad, setShowCheckLoad] = useState(false);
  const [showAddLoad,   setShowAddLoad]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [addLoadPrefill, setAddLoadPrefill] = useState<AddLoadPrefill | undefined>();

  const refresh = useCallback(() => setData(readDashData()), []);

  // Refresh whenever the screen mounts (catches navigating back from other tabs)
  useEffect(() => { refresh(); }, [refresh]);

  function openAddLoad(prefill?: AddLoadPrefill) {
    setAddLoadPrefill(prefill);
    setShowAddLoad(true);
  }

  const d = data;
  const signedNet = (n: number) => (n >= 0 ? `+$${fmt(n)}` : `-$${fmt(Math.abs(n))}`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SettingsScreen
          onClose={() => setShowSettings(false)}
          onNavigateToExpenses={() => {
            setShowSettings(false);
            navigation.navigate('Expenses');
          }}
        />
      </Modal>

      <Modal visible={showCheckLoad} animationType="slide" presentationStyle="pageSheet">
        <CheckLoadScreen
          onClose={() => setShowCheckLoad(false)}
          onLogLoad={(prefill) => {
            setShowCheckLoad(false);
            openAddLoad(prefill);
          }}
        />
      </Modal>

      <Modal visible={showAddLoad} animationType="slide" presentationStyle="pageSheet">
        <AddLoadScreen
          onClose={() => setShowAddLoad(false)}
          onSaved={() => { setShowAddLoad(false); refresh(); }}
          prefill={addLoadPrefill}
        />
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>{t('dashboard.eyebrow')}</Text>
            <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Active load card (only when a load is In Progress) ── */}
        {d.activeLoad && (
          <View style={styles.activeCard}>
            <View style={styles.activeTopRow}>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>{t('dashboard.inProgress')}</Text>
              </View>
            </View>
            <Text style={styles.activeRoute} numberOfLines={1}>
              {d.activeLoad.pickup_city} → {d.activeLoad.delivery_city}
            </Text>
            <Text style={styles.activeMeta}>
              {fmt(d.activeLoad.total_miles)} mi · ${fmt(d.activeLoad.gross_pay)} {t('common.gross')}
            </Text>
          </View>
        )}

        {/* ── Break-even hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>{t('dashboard.breakEven')}</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('dashboard.live')}</Text>
            </View>
          </View>

          <Text style={styles.heroNumber}>
            {d.breakEvenRPM > 0 ? `$${d.breakEvenRPM.toFixed(3)}` : '—'}
          </Text>
          <Text style={styles.heroUnit}>{t('dashboard.breakEvenUnit')}</Text>

          <View style={styles.heroDivider} />

          <View style={styles.cpmRow}>
            <View style={styles.cpmCell}>
              <Text style={styles.cpmEyebrow}>{t('dashboard.fuelCPM')}</Text>
              <Text style={styles.cpmValue}>
                {d.fuelCPM > 0 ? `$${d.fuelCPM.toFixed(3)}` : '—'}
              </Text>
            </View>
            <View style={styles.cpmSep} />
            <View style={styles.cpmCell}>
              <Text style={styles.cpmEyebrow}>{t('dashboard.fixedCPM')}</Text>
              <Text style={styles.cpmValue}>
                {d.fixedCPM > 0 ? `$${d.fixedCPM.toFixed(3)}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Period cards ── */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodCard, { flex: 1 }]}
            onPress={() => navigation.navigate('History', { filter: 'week' })}
            activeOpacity={0.75}
          >
            <Text style={styles.periodEyebrow}>{t('dashboard.thisWeek')}</Text>
            <Text style={[styles.periodNet, { color: d.weekNet >= 0 ? Colors.primary : Colors.danger }]}>
              {signedNet(d.weekNet)}
            </Text>
            <Text style={styles.periodGross}>{t('dashboard.ofGross', { amount: `$${fmt(d.weekGross)}` })}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodCard, { flex: 1 }]}
            onPress={() => navigation.navigate('History', { filter: 'month' })}
            activeOpacity={0.75}
          >
            <Text style={styles.periodEyebrow}>{t('dashboard.thisMonth')}</Text>
            <Text style={[styles.periodNet, { color: d.monthNet >= 0 ? Colors.primary : Colors.danger }]}>
              {signedNet(d.monthNet)}
            </Text>
            <Text style={styles.periodGross}>{t('dashboard.ofGross', { amount: `$${fmt(d.monthGross)}` })}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Check Load CTA ── */}
        <TouchableOpacity style={styles.evalButton} activeOpacity={0.8} onPress={() => setShowCheckLoad(true)}>
          <Ionicons name="flash" size={15} color={Colors.background} />
          <Text style={styles.evalText}>{t('dashboard.checkLoadBtn')}</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.background} />
        </TouchableOpacity>

        {/* ── Recent Loads ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t('dashboard.recentLoads')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.sectionAction}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {d.loads.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={32} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>{t('dashboard.noLoads')}</Text>
              <Text style={styles.emptyHint}>{t('dashboard.noLoadsHint')}</Text>
            </View>
          ) : (
            <View style={styles.loadsCard}>
              {d.loads.map((load, i) => (
                <React.Fragment key={load.id}>
                  <TouchableOpacity style={styles.loadRow} activeOpacity={0.7}>
                    <View style={styles.loadLeft}>
                      <Text style={styles.loadRoute} numberOfLines={1}>
                        {load.from.split(',')[0]} → {load.to.split(',')[0]}
                      </Text>
                      <Text style={styles.loadMeta}>{fmt(load.miles)} mi · ${load.rpm.toFixed(2)}/mi</Text>
                    </View>
                    <View style={styles.loadRight}>
                      <Text style={[styles.loadNet, { color: load.positive ? Colors.primary : Colors.danger }]}>
                        {load.positive ? '+' : '-'}${fmt(Math.abs(load.net))}
                      </Text>
                      <Text style={styles.loadGross}>${fmt(load.gross)} {t('common.gross')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                  {i < d.loads.length - 1 && <View style={styles.loadDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openAddLoad()}>
        <Ionicons name="add" size={26} color={Colors.background} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 120 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24,
  },
  headerEyebrow: { ...SectionLabel, marginBottom: 4 },
  headerTitle:   { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },
  settingsBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Active load
  activeCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 14,
  },
  activeTopRow:    { marginBottom: 10 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  activeDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  activePillText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption, color: Colors.primary },
  activeRoute:    { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 4 },
  activeMeta:     { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroEyebrow: { ...SectionLabel, marginBottom: 0 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
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
  cpmRow:      { flexDirection: 'row', alignItems: 'center' },
  cpmCell:     { flex: 1 },
  cpmSep:      { width: 1, height: 30, backgroundColor: Colors.border, marginHorizontal: 16 },
  cpmEyebrow:  { ...SectionLabel, fontSize: 10, marginBottom: 4 },
  cpmValue:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  // Period cards
  periodRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  periodCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  periodEyebrow: { ...SectionLabel, fontSize: 10, marginBottom: 8 },
  periodNet:     { fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber, lineHeight: 36, letterSpacing: -0.5 },
  periodGross:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 3 },

  // Check Load CTA
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

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 32, alignItems: 'center',
  },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Loads card
  loadsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  loadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  loadLeft:    { flex: 1, marginRight: 12 },
  loadRoute:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  loadMeta:    { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight:   { alignItems: 'flex-end' },
  loadNet:     { fontFamily: FontFamily.bold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
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
