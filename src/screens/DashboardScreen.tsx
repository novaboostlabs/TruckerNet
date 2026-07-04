import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal, Animated, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import {
  calcBreakEven, BreakEvenSource, getLoadCount, getWeekPnL, getMonthPnL,
  expensesAreStale, daysSinceExpenseReview, getStaleCategoryAlerts, StaleCategoryAlert,
  getTaxSetAside, TaxSetAside,
  getRecentLoads, getActiveLoad, getUpcomingLoad, LoadSummary, getIncomeGoal,
  getWeekPendingPnL, getMonthPendingPnL, PendingPnL,
  getWeeklyNetTrend, getCostBreakdown, WeekTrendPoint, CostBreakdown,
  getSetting, deleteLoad,
} from '../db/database';
import GoalProgressCard from '../components/GoalProgressCard';
import AnalyticsSection from '../components/AnalyticsSection';
import FreeUsageMeter from '../components/FreeUsageMeter';
import FirstLoadCelebration from '../components/FirstLoadCelebration';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';
import ExpenseReviewBanner from '../components/ExpenseReviewBanner';
import ExpenseReviewModal from '../components/ExpenseReviewModal';
import TaxSetAsideCard from '../components/TaxSetAsideCard';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import CheckLoadScreen from './CheckLoadScreen';
import AddLoadScreen, { AddLoadPrefill } from './AddLoadScreen';
import FuelEntryScreen from './FuelEntryScreen';
import AddExpenseScreen from './AddExpenseScreen';
import SettingsScreen from './SettingsScreen';
import LoadDetailScreen from './LoadDetailScreen';
import SwipeableRow from '../components/SwipeableRow';
import { pushLoads } from '../lib/sync/loadsSync';
import { startLoad, completeLoad } from '../lib/loadLifecycle';


interface LoadRow {
  id: string; from: string; to: string;
  miles: number; gross: number; net: number; rpm: number; positive: boolean;
  status: string;
}

// Pill shown on rows for loads that aren't finished yet.
const STATUS_PILL_I18N: Record<string, string> = { upcoming: 'upcoming', in_progress: 'inProgress' };

interface DashData {
  breakEvenRPM: number; fuelCPM: number; fixedCPM: number;
  milesSource: BreakEvenSource;
  weekNet: number; weekGross: number; weekMiles: number; weekLoads: number;
  monthNet: number; monthGross: number; monthMiles: number; monthLoads: number;
  loads: LoadRow[];
  activeLoad: LoadSummary | null;
  upcomingLoad: LoadSummary | null;
  weekPending: PendingPnL;
  monthPending: PendingPnL;
  hasRealLoads: boolean;
  incomeGoal: { amount: number; period: 'weekly' | 'monthly' } | null;
  driverName: string;
  tax: TaxSetAside;
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
    status:   s.status,
  };
}

function readDashData(): DashData {
  const { breakEvenRPM, fuelCPM, fixedCPM, milesSource } = calcBreakEven();
  const count = getLoadCount();
  const empty  = { net: 0, gross: 0, miles: 0, loads: 0 };
  const noPending: PendingPnL = { net: 0, loads: 0 };
  const week   = count > 0 ? getWeekPnL()        : empty;
  const month  = count > 0 ? getMonthPnL()       : empty;
  const weekPending  = count > 0 ? getWeekPendingPnL()  : noPending;
  const monthPending = count > 0 ? getMonthPendingPnL() : noPending;
  const recent = count > 0 ? getRecentLoads(5).map(loadFromSummary) : [];
  const active = count > 0 ? getActiveLoad()     : null;
  // The upcoming card only shows when nothing is actively running — one clear
  // "current load" slot, never two competing cards.
  const upcoming = count > 0 && !active ? getUpcomingLoad() : null;

  return {
    breakEvenRPM, fuelCPM, fixedCPM, milesSource,
    weekNet:   week.net,  weekGross:  week.gross,  weekMiles:  week.miles,  weekLoads:  week.loads,
    monthNet:  month.net, monthGross: month.gross, monthMiles: month.miles, monthLoads: month.loads,
    loads:     recent,
    activeLoad: active,
    upcomingLoad: upcoming,
    weekPending,
    monthPending,
    hasRealLoads: count > 0,
    incomeGoal: getIncomeGoal(),
    tax: getTaxSetAside(),
    driverName: (getSetting('profile_name') ?? '').trim(),
  };
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function DashboardScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { present: presentPaywall } = usePaywall();
  const navigation = useNavigation<any>();
  const [data,          setData]          = useState<DashData>(() => readDashData());
  const [trend,         setTrend]         = useState<WeekTrendPoint[]>([]);
  const [breakdown,     setBreakdown]     = useState<CostBreakdown>({ fuel: 0, fixed: 0, expenses: 0, net: 0, gross: 0 });
  const [showCheckLoad, setShowCheckLoad] = useState(false);
  const [showAddLoad,   setShowAddLoad]   = useState(false);
  const [showFuelEntry,  setShowFuelEntry]  = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [settingsSection, setSettingsSection] = useState<'goal' | undefined>();
  const [showReview,     setShowReview]     = useState(false);
  const [detailLoadId,   setDetailLoadId]   = useState<string | null>(null);
  const [detailEdit,     setDetailEdit]     = useState(false);
  const [expensesStale,  setExpensesStale]  = useState(() => expensesAreStale());
  const [daysSinceReview, setDaysSinceReview] = useState(() => daysSinceExpenseReview());
  const [staleAlerts,    setStaleAlerts]    = useState<StaleCategoryAlert[]>(() => getStaleCategoryAlerts());
  const [addLoadPrefill, setAddLoadPrefill] = useState<AddLoadPrefill | undefined>();
  const [firstLoadNet,  setFirstLoadNet]  = useState<number | null>(null);

  // Speed-dial FAB
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const toggleFab = useCallback((open: boolean) => {
    setFabOpen(open);
    Animated.spring(fabAnim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [fabAnim]);

  // Run a FAB action: close the dial first, then fire it next frame.
  const runFabAction = useCallback((fn: () => void) => {
    toggleFab(false);
    setTimeout(fn, 120);
  }, [toggleFab]);

  const refresh = useCallback(() => {
    setData(readDashData());
    setTrend(getWeeklyNetTrend(12));
    setBreakdown(getCostBreakdown());
    setExpensesStale(expensesAreStale());
    setDaysSinceReview(daysSinceExpenseReview());
    setStaleAlerts(getStaleCategoryAlerts());
  }, []);

  // Refresh on mount AND every time the tab regains focus (e.g. returning from
  // Replay Setup or another tab), so the dashboard never shows stale numbers.
  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function openAddLoad(prefill?: AddLoadPrefill) {
    setAddLoadPrefill(prefill);
    setShowAddLoad(true);
  }

  function openLoad(id: string, edit = false) {
    setDetailEdit(edit);
    setDetailLoadId(id);
  }

  function confirmDeleteLoad(row: LoadRow) {
    Alert.alert(
      t('loadDetail.deleteTitle'),
      t('loadDetail.deleteBody', { route: `${row.from.split(',')[0]} → ${row.to.split(',')[0]}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteLoad(row.id);
            refresh();
            if (user) pushLoads(user.id);
          },
        },
      ],
    );
  }

  const d = data;
  // Zero is neutral, not a win: never render +$0 in success-green. The +/green
  // treatment is earned only by a genuinely positive number.
  const signedNet = (n: number) => (n > 0 ? `+$${fmt(n)}` : n < 0 ? `-$${fmt(Math.abs(n))}` : `$${fmt(0)}`);
  const netColor  = (n: number) => (n > 0 ? Colors.primary : n < 0 ? Colors.danger : Colors.textSecondary);
  const beReady   = d.breakEvenRPM > 0;

  // Weekly avg gross RPM vs break-even — powers the fallback hero's verdict line.
  const weekGrossRpm = d.weekMiles > 0 ? d.weekGross / d.weekMiles : 0;
  const vsBreakEven  = weekGrossRpm - d.breakEvenRPM;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <GridBackground />

      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SettingsScreen
          initialSection={settingsSection}
          onClose={() => { setShowSettings(false); setSettingsSection(undefined); refresh(); }}
          onNavigateToExpenses={() => {
            setShowSettings(false);
            setSettingsSection(undefined);
            navigation.navigate('Expenses');
          }}
        />
      </Modal>

      <Modal visible={detailLoadId !== null} animationType="slide" presentationStyle="pageSheet">
        {detailLoadId && (
          <LoadDetailScreen
            loadId={detailLoadId}
            startInEdit={detailEdit}
            onClose={() => { setDetailLoadId(null); refresh(); }}
          />
        )}
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
          onFirstLoad={(net) => {
            // Let the Add Load sheet finish its dismiss animation before the
            // celebration appears, so iOS doesn't swallow the second modal.
            setTimeout(() => setFirstLoadNet(net), 400);
          }}
          prefill={addLoadPrefill}
        />
      </Modal>

      <Modal visible={showFuelEntry} animationType="slide" presentationStyle="pageSheet">
        <FuelEntryScreen
          onSaved={() => { setShowFuelEntry(false); refresh(); }}
          onCancel={() => setShowFuelEntry(false)}
        />
      </Modal>

      <Modal visible={showAddExpense} animationType="slide" presentationStyle="pageSheet">
        <AddExpenseScreen
          onClose={() => setShowAddExpense(false)}
          onSaved={() => { setShowAddExpense(false); refresh(); }}
        />
      </Modal>

      <ExpenseReviewModal
        visible={showReview}
        onClose={() => { setShowReview(false); refresh(); }}
        onGoToExpenses={() => { setShowReview(false); navigation.navigate('Expenses'); }}
      />

      <FirstLoadCelebration
        visible={firstLoadNet !== null}
        netPay={firstLoadNet ?? 0}
        onDismiss={() => setFirstLoadNet(null)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Terminal wordmark ── */}
        <View style={styles.terminalBar}>
          <Text style={styles.terminalMark}>TRUCKERNET // OPS</Text>
        </View>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>
              {d.driverName ? t('dashboard.welcomeBack') : t('dashboard.eyebrow')}
            </Text>
            <Text style={styles.headerTitle}>
              {d.driverName ? d.driverName.split(' ')[0] : t('dashboard.title')}
            </Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Current load card: Active gets "Mark Complete", Upcoming gets "Start Load".
               Tapping the card opens the load detail. ── */}
        {(d.activeLoad || d.upcomingLoad) && (() => {
          const cur = (d.activeLoad ?? d.upcomingLoad)!;
          const isActive = !!d.activeLoad;
          return (
            <TouchableOpacity
              style={styles.activeCard}
              activeOpacity={0.85}
              onPress={() => openLoad(cur.id)}
            >
              <View style={styles.activeTopRow}>
                <View style={[styles.activePill, !isActive && styles.upcomingPill]}>
                  <View style={[styles.activeDot, !isActive && { backgroundColor: Colors.secondary }]} />
                  <Text style={[styles.activePillText, !isActive && { color: Colors.secondary }]}>
                    {isActive ? t('dashboard.inProgress') : t('dashboard.upcoming')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
              </View>
              <Text style={styles.activeRoute} numberOfLines={1}>
                {cur.pickup_city} → {cur.delivery_city}
              </Text>
              <Text style={styles.activeMeta}>
                {fmt(cur.total_miles)} mi · ${fmt(cur.gross_pay)} {t('common.gross')}
              </Text>
              <TouchableOpacity
                style={styles.activeActionBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (isActive) completeLoad(cur.id, user?.id);
                  else startLoad(cur.id, user?.id);
                  refresh();
                }}
              >
                <Ionicons name={isActive ? 'checkmark-circle' : 'play'} size={16} color={Colors.onPrimary} />
                <Text style={styles.activeActionText}>
                  {isActive ? t('dashboard.markComplete') : t('dashboard.startLoad')}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })()}

        {/* ── ZONE 1: Hero — the single most important number ── */}
        {d.incomeGoal ? (
          <GoalProgressCard
            variant="hero"
            net={d.incomeGoal.period === 'weekly' ? d.weekNet : d.monthNet}
            goal={d.incomeGoal.amount}
            period={d.incomeGoal.period}
            pending={(d.incomeGoal.period === 'weekly' ? d.weekPending : d.monthPending).net}
            pendingLoads={(d.incomeGoal.period === 'weekly' ? d.weekPending : d.monthPending).loads}
          />
        ) : (
          <View style={styles.weekHero}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>{t('dashboard.thisWeek')}</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('dashboard.live')}</Text>
              </View>
            </View>

            <Text style={[styles.weekHeroNet, { color: netColor(d.weekNet) }]}>
              {signedNet(d.weekNet)}
            </Text>
            <Text style={styles.weekHeroUnit}>{t('dashboard.netPay')}</Text>

            {/* Booked-but-undelivered money — kept separate from earned net */}
            {d.weekPending.net > 0 && (
              <View style={styles.pendingRow}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingText}>
                  {t('dashboard.weekPendingLine', { amount: `$${fmt(d.weekPending.net)}`, count: d.weekPending.loads })}
                </Text>
              </View>
            )}

            {d.weekLoads === 0 ? (
              d.weekPending.net > 0 ? null : <Text style={styles.weekHeroEmpty}>{t('dashboard.weekEmpty')}</Text>
            ) : (
              <>
                <View style={styles.heroDivider} />
                <View style={styles.weekMetaRow}>
                  <Text style={styles.weekRpm}>${weekGrossRpm.toFixed(2)}/mi</Text>
                  <Text style={[styles.weekVs, { color: vsBreakEven >= 0 ? Colors.primary : Colors.danger }]}>
                    {vsBreakEven >= 0 ? '+' : '-'}${Math.abs(vsBreakEven).toFixed(2)}{' '}
                    {vsBreakEven >= 0 ? t('dashboard.aboveBreakEven') : t('dashboard.belowBreakEven')}
                  </Text>
                </View>
                <Text style={styles.weekSubMeta}>
                  {d.weekLoads} {d.weekLoads === 1 ? t('common.load') : t('common.loads')} · {fmt(d.weekMiles)} {t('common.miles')} · ${fmt(d.weekGross)} {t('common.gross')}
                </Text>

                {/* ── Month secondary inside the hero — eliminates the duplicate period cards ── */}
                <View style={styles.heroDivider} />
                <View style={styles.heroMonthRow}>
                  <Text style={styles.heroMonthLabel}>{t('dashboard.thisMonth')}</Text>
                  <Text style={[styles.heroMonthNet, { color: netColor(d.monthNet) }]}>
                    {signedNet(d.monthNet)}
                  </Text>
                  <Text style={styles.heroMonthGross}>{t('dashboard.ofGross', { amount: `$${fmt(d.monthGross)}` })}</Text>
                </View>
              </>
            )}

            {/* Nudge to set an income goal (this fallback only shows when no goal is set) */}
            <TouchableOpacity
              style={styles.goalNudge}
              onPress={() => { setSettingsSection('goal'); setShowSettings(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="flag-outline" size={13} color={Colors.primary} />
              <Text style={styles.goalNudgeText}>{t('dashboard.setGoalNudge')}</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── ZONE 2: Daily action — the primary CTA, right after the numbers ── */}
        <TouchableOpacity style={styles.evalButton} activeOpacity={0.8} onPress={() => setShowCheckLoad(true)}>
          <Ionicons name="flash" size={15} color={Colors.onPrimary} />
          <Text style={styles.evalText}>{t('dashboard.checkLoadBtn')}</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.onPrimary} />
        </TouchableOpacity>

        {/* ── ZONE 3: Reference — break-even strip ── */}
        <TouchableOpacity
          style={styles.beStrip}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Expenses')}
        >
          <View style={styles.beIcon}>
            <Ionicons name="speedometer-outline" size={18} color={Colors.textSecondary} />
          </View>
          <View style={styles.beTextWrap}>
            <Text style={styles.beTopLine}>
              <Text style={styles.beLabel}>{t('dashboard.breakEven')}  </Text>
              <Text style={styles.beValue}>
                {d.breakEvenRPM > 0 ? `$${d.breakEvenRPM.toFixed(3)}/mi` : '—'}
              </Text>
            </Text>
            <Text style={beReady ? styles.beSub : styles.beSetup}>
              {beReady
                ? `${t('dashboard.fuelCPM')} $${d.fuelCPM.toFixed(2)} · ${t('dashboard.fixedCPM')} $${d.fixedCPM.toFixed(2)} · ${t(`dashboard.milesSource_${d.milesSource}`)}`
                : t('dashboard.breakEvenSetup')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* ── ZONE 4: Recent loads (universally useful — before the Pro-gated charts) ── */}
        {/* Expense review banner sits here so it's seen but doesn't interrupt hero */}
        {expensesStale && (
          <ExpenseReviewBanner
            alerts={staleAlerts}
            daysSince={daysSinceReview}
            onPress={() => setShowReview(true)}
          />
        )}

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
                  <SwipeableRow
                    onEdit={() => openLoad(load.id, true)}
                    onDelete={() => confirmDeleteLoad(load)}
                  >
                    <TouchableOpacity
                      style={[styles.loadRow, { backgroundColor: Colors.surface }]}
                      activeOpacity={0.7}
                      onPress={() => openLoad(load.id)}
                    >
                      <View style={styles.loadLeft}>
                        <View style={styles.loadRouteRow}>
                          <Text style={styles.loadRoute} numberOfLines={1}>
                            {load.from.split(',')[0]} → {load.to.split(',')[0]}
                          </Text>
                          {!!STATUS_PILL_I18N[load.status] && (
                            <View style={styles.statusPill}>
                              <Text style={styles.statusPillText}>{t(`addLoad.statuses.${STATUS_PILL_I18N[load.status]}`)}</Text>
                            </View>
                          )}
                        </View>
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
                  </SwipeableRow>
                  {i < d.loads.length - 1 && <View style={styles.loadDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── ZONE 5: Analytics + supporting cards (Pro-gated, below the fold) ── */}
        <AnalyticsSection
          trend={trend}
          breakdown={breakdown}
          isPro={isPro}
          onUpgrade={() => presentPaywall('analytics')}
        />

        {/* Free-tier usage meter (renders nothing for Pro) */}
        <FreeUsageMeter refreshKey={d.monthLoads} />

        {/* Tax set-aside (shown when there's net income to set aside) */}
        {d.tax.ytdNet > 0 && (
          <TaxSetAsideCard
            data={d.tax}
            onSettings={() => setShowSettings(true)}
          />
        )}

      </ScrollView>

      {/* ── Speed-dial FAB ── */}
      {fabOpen && (
        <Pressable style={styles.fabBackdrop} onPress={() => toggleFab(false)} />
      )}
      <View style={styles.fabWrap} pointerEvents="box-none">
        {[
          { key: 'load',    icon: 'cube-outline' as const,    label: t('dashboard.fabAddLoad'),    onPress: () => runFabAction(() => openAddLoad()) },
          { key: 'fuel',    icon: 'flash-outline' as const,   label: t('dashboard.fabAddFuel'),    onPress: () => runFabAction(() => setShowFuelEntry(true)) },
          { key: 'expense', icon: 'wallet-outline' as const,  label: t('dashboard.fabAddExpense'), onPress: () => runFabAction(() => setShowAddExpense(true)) },
        ].map((action, i) => (
          <Animated.View
            key={action.key}
            pointerEvents={fabOpen ? 'auto' : 'none'}
            style={[
              styles.fabActionRow,
              {
                opacity: fabAnim,
                transform: [
                  { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20 + i * 8, 0] }) },
                  { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                ],
              },
            ]}
          >
            <View style={styles.fabActionLabel}>
              <Text style={styles.fabActionLabelText}>{action.label}</Text>
            </View>
            <TouchableOpacity style={styles.fabActionBtn} activeOpacity={0.85} onPress={action.onPress}>
              <Ionicons name={action.icon} size={20} color={Colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        ))}

        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => toggleFab(!fabOpen)}>
          <Animated.View style={{ transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <Ionicons name="add" size={26} color={Colors.onPrimary} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 120 },

  terminalBar: {
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
    paddingTop: 14, paddingBottom: 12,
  },
  terminalMark: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: Colors.labelColor, letterSpacing: 1.8 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingTop: 18, paddingBottom: 24,
  },
  headerEyebrow: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 4 },
  headerTitle:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, letterSpacing: -0.6 },
  settingsBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Active load
  activeCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 14,
  },
  activeTopRow:    { marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  activeDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  activePillText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary, letterSpacing: 0.5 },
  activeRoute:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 4, letterSpacing: -0.4 },
  activeMeta:     { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary },
  upcomingPill: {
    backgroundColor: Colors.secondaryDim, borderColor: Colors.secondary + '50',
  },
  activeActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 11, marginTop: 14,
  },
  activeActionText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.onPrimary },

  // Weekly-net fallback hero
  weekHero: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroEyebrow: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 0 },
  // Neutral status chip — teal is reserved for the net number + primary action.
  // A small teal dot preserves the "live" semantic without competing for attention.
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  liveText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.textSecondary, letterSpacing: 0.5 },
  weekHeroNet: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.heroLarge,
    lineHeight: 60, letterSpacing: -2, marginTop: 4,
  },
  weekHeroUnit:  { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 18, letterSpacing: 0.5 },
  pendingRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -8, marginBottom: 14 },
  pendingDot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary + '55' },
  pendingText: { flex: 1, fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 16 },
  weekHeroEmpty: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },
  goalNudge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 16, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid, borderRadius: Radius.pill,
  },
  goalNudgeText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary },
  heroDivider:   { height: 1, backgroundColor: Colors.borderSubtle, marginBottom: 14 },
  weekMetaRow:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  weekRpm:       { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, letterSpacing: -0.5 },
  weekVs:        { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label },
  weekSubMeta:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },

  // Month secondary row — collapsed into the hero card
  heroMonthRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 2,
  },
  heroMonthLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.micro, color: Colors.labelColor, letterSpacing: 1.4, flex: 1 },
  heroMonthNet:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, letterSpacing: -0.5, marginHorizontal: 12 },
  heroMonthGross: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },

  // Break-even reference strip
  beStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
  },
  beIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  beTextWrap: { flex: 1 },
  beTopLine:  { },
  beLabel:    { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.micro, color: Colors.labelColor, letterSpacing: 1.2 },
  beValue:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  beSub:      { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 2 },
  beSetup:    { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary, marginTop: 2 },

  // Check Load CTA
  evalButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, marginBottom: 28,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  evalText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.onPrimary, flex: 1, textAlign: 'center' },

  // Section
  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel:  { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 0 },
  sectionAction: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 32, alignItems: 'center',
  },
  emptyTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6, letterSpacing: -0.3 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Loads card
  loadsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  loadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.cardPad,
  },
  loadLeft:    { flex: 1, marginRight: 12 },
  loadRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusPill: {
    backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '45',
    borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
  },
  statusPillText: { fontFamily: FontFamily.monoSemiBold, fontSize: 9, color: Colors.secondary, letterSpacing: 0.5 },
  loadRoute:   { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3, letterSpacing: -0.3, flexShrink: 1 },
  loadMeta:    { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight:   { alignItems: 'flex-end' },
  loadNet:     { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },

  // Speed-dial FAB
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  fabWrap: {
    position: 'absolute', bottom: 28, right: Spacing.screenH,
    alignItems: 'flex-end',
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  fabActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  fabActionLabel: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 7,
  },
  fabActionLabelText: {
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textPrimary, letterSpacing: 0.2,
  },
  fabActionBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});
