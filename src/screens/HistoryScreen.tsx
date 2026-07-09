import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import {
  getHistoryLoads, getHistoryTotals, getHistoryLoadsDateRange, getHistoryTotalsDateRange,
  searchHistoryLoads, getGeneralExpensesDateRange, getAllGeneralExpenses, deleteGeneralExpense,
  getFuelEntriesDateRange, getAllFuelEntries,
  deleteLoad,
  HistoryFilter, HistoryLoad, HistoryTotals, GeneralExpense, FuelEntryRow, localDateISO,
} from '../db/database';
import { pushLoads } from '../lib/sync/loadsSync';
import SwipeableRow from '../components/SwipeableRow';
import { useAuth } from '../contexts/AuthContext';
import { pushGeneralExpenses } from '../lib/sync/generalExpensesSync';
import MonthCalendar from '../components/MonthCalendar';
import WeekCalendar  from '../components/WeekCalendar';
import { MarksByDate } from '../components/dayMarks';
import LoadDetailScreen from './LoadDetailScreen';
import AddLoadScreen from './AddLoadScreen';
import AddExpenseScreen from './AddExpenseScreen';
import FuelEntryScreen from './FuelEntryScreen';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';

// ── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string { return localDateISO(d); }
const TODAY = isoDate(new Date());

interface PeriodBounds { start: string; end: string; label: string; }

function getWeekBounds(date: Date): PeriodBounds {
  const d   = new Date(date);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(12, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });
  return { start: isoDate(mon), end: isoDate(sun), label: `${fmt(mon)} – ${fmt(sun)}` };
}

function getMonthBounds(date: Date): PeriodBounds {
  const y = date.getFullYear(), m = date.getMonth();
  const start = new Date(y, m, 1), end = new Date(y, m + 1, 0);
  return {
    start: isoDate(start), end: isoDate(end),
    label: start.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' }),
  };
}

const isCurrentWeek  = (d: Date) => getWeekBounds(d).start === getWeekBounds(new Date()).start;
const isCurrentMonth = (d: Date) => { const t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth(); };

function shiftDate(date: Date, filter: HistoryFilter, dir: -1 | 1): Date {
  const d = new Date(date);
  if (filter === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });
}
function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}
// Money to the cent — never fractions of a cent (computed net/gross can carry
// long decimals from per-mile cost math).
function money2(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoadRow {
  id: string; date: string; rawDate: string; from: string; to: string;
  miles: number; gross: number; net: number; rpm: number; positive: boolean;
  status: string;
}
function toRow(l: HistoryLoad): LoadRow {
  return {
    id: l.id, date: formatDate(l.date), rawDate: l.date,
    from: `${l.pickup_city}, ${l.pickup_state}`,
    to:   `${l.delivery_city}, ${l.delivery_state}`,
    miles: l.total_miles, gross: l.gross_pay,
    net: l.net_pay, rpm: l.net_rate_per_mile, positive: l.net_pay >= 0,
    status: l.status,
  };
}

// Small status pill for loads that aren't finished yet — keeps the list honest
// now that Upcoming/In Progress are first-class lifecycle stages.
const STATUS_PILL_I18N: Record<string, string> = { upcoming: 'upcoming', in_progress: 'inProgress' };

const EMPTY_TOTALS: HistoryTotals = { gross: 0, net: 0, miles: 0, rpm: 0, count: 0 };

const EXP_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  repair: 'construct-outline', parking: 'car-outline', fine: 'alert-circle-outline',
  maintenance: 'build-outline', supplies: 'cube-outline', other: 'ellipsis-horizontal-outline',
};

function loadDataForPeriod(filter: HistoryFilter, date: Date) {
  if (filter === 'all') {
    return {
      loads: getHistoryLoads('all').map(toRow),
      totals: getHistoryTotals('all'),
      expenses: getAllGeneralExpenses(),
      fuel: getAllFuelEntries(),
    };
  }
  const { start, end } = filter === 'week' ? getWeekBounds(date) : getMonthBounds(date);
  return {
    loads:  getHistoryLoadsDateRange(start, end).map(toRow),
    totals: getHistoryTotalsDateRange(start, end),
    expenses: getGeneralExpensesDateRange(start, end),
    fuel: getFuelEntriesDateRange(start, end),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const [filter,        setFilter]        = useState<HistoryFilter>('month');
  const [periodDate,    setPeriodDate]     = useState(() => new Date());
  const [loads,         setLoads]          = useState<LoadRow[]>(() => {
    const { start, end } = getMonthBounds(new Date());
    return getHistoryLoadsDateRange(start, end).map(toRow);
  });
  const [totals,        setTotals]         = useState<HistoryTotals>(() => {
    const { start, end } = getMonthBounds(new Date());
    return getHistoryTotalsDateRange(start, end);
  });
  const [genExpenses,   setGenExpenses]    = useState<GeneralExpense[]>(() => {
    const { start, end } = getMonthBounds(new Date());
    return getGeneralExpensesDateRange(start, end);
  });
  const [fuelEntries,   setFuelEntries]    = useState<FuelEntryRow[]>(() => {
    const { start, end } = getMonthBounds(new Date());
    return getFuelEntriesDateRange(start, end);
  });
  const [selectedDay,   setSelectedDay]   = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [selectedEdit,   setSelectedEdit]   = useState(false);
  // Log an entry directly onto the selected calendar day — no tapping the Add
  // Load date arrow 20 times to reach a back-dated day. A chooser picks which
  // kind (load / fuel / expense); each opens its screen pre-set to that day.
  const [addLoadDate,    setAddLoadDate]    = useState<string | null>(null);
  const [addFuelDate,    setAddFuelDate]    = useState<string | null>(null);
  const [addExpenseDate, setAddExpenseDate] = useState<string | null>(null);
  const [dayMenuOpen,    setDayMenuOpen]    = useState(false);

  // ── Search ────────────────────────────────────────────────────────────────────
  const [searchActive,  setSearchActive]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const searchRef = useRef<TextInput>(null);

  const searchResults = useMemo<LoadRow[]>(() => {
    if (!searchActive || searchQuery.trim().length < 2) return [];
    return searchHistoryLoads(searchQuery.trim()).map(toRow);
  }, [searchActive, searchQuery]);

  function openSearch() {
    setSearchActive(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function closeSearch() {
    setSearchActive(false);
    setSearchQuery('');
  }

  const refresh = useCallback((f: HistoryFilter, d: Date) => {
    const result = loadDataForPeriod(f, d);
    setLoads(result.loads);
    setTotals(result.totals);
    setGenExpenses(result.expenses);
    setFuelEntries(result.fuel);
  }, []);

  function openLoad(id: string, edit = false) {
    setSelectedEdit(edit);
    setSelectedLoadId(id);
  }

  function confirmDeleteLoad(load: { id: string; from: string; to: string }) {
    Alert.alert(
      t('loadDetail.deleteTitle'),
      t('loadDetail.deleteBody', { route: `${load.from.split(',')[0]} → ${load.to.split(',')[0]}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: () => {
            deleteLoad(load.id);
            if (user) pushLoads(user.id);
            refresh(filter, periodDate);
          },
        },
      ],
    );
  }

  function handleDeleteExpense(id: string) {
    Alert.alert(t('history.deleteExpenseTitle'), t('history.deleteExpenseBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: () => {
          deleteGeneralExpense(id);
          if (user) pushGeneralExpenses(user.id);
          refresh(filter, periodDate);
        },
      },
    ]);
  }

  useEffect(() => { refresh(filter, periodDate); }, [filter, periodDate, refresh]);
  useFocusEffect(useCallback(() => { refresh(filter, periodDate); }, [filter, periodDate, refresh]));

  // Handle params from Dashboard period card taps
  useFocusEffect(useCallback(() => {
    const params = route.params as any;
    if (params?.filter) {
      setFilter(params.filter);
      setPeriodDate(new Date());
      setSelectedDay(null);
      navigation.setParams({ filter: undefined });
    }
  }, [route.params, navigation]));

  // Period bounds — declared first; other memos depend on this
  const bounds          = filter === 'week' ? getWeekBounds(periodDate) : filter === 'month' ? getMonthBounds(periodDate) : null;
  const atCurrentPeriod = filter === 'week' ? isCurrentWeek(periodDate) : filter === 'month' ? isCurrentMonth(periodDate) : true;

  // Shared period navigation — used by the arrows AND the swipe gesture.
  // Browsing past weeks/months is FREE (user decision 2026-07-08): looking at
  // your own history is table-stakes, not a premium feature. The free tier's
  // real limit is the 15-loads/month cap at log time.
  const goPrevPeriod = useCallback(() => {
    setPeriodDate(d => shiftDate(d, filter, -1));
    setSelectedDay(null);
  }, [filter]);

  const goNextPeriod = useCallback(() => {
    if (atCurrentPeriod) return;
    setPeriodDate(d => shiftDate(d, filter, 1));
    setSelectedDay(null);
  }, [atCurrentPeriod, filter]);

  // Horizontal swipe over the period navigator + calendar pages weeks/months,
  // matching what drivers expect from any calendar app. Vertical scrolling wins
  // (failOffsetY) so the gesture never fights the list.
  const periodSwipe = useMemo(() => (
    Gesture.Pan()
      .activeOffsetX([-24, 24])
      .failOffsetY([-16, 16])
      .runOnJS(true)
      .onEnd((e) => {
        if (e.translationX >= 40)       goPrevPeriod(); // swipe right → earlier
        else if (e.translationX <= -40) goNextPeriod(); // swipe left → later
      })
  ), [goPrevPeriod, goNextPeriod]);

  // Which entry types exist on each date — drives the multi-colour calendar dots.
  const marksByDate = useMemo<MarksByDate>(() => {
    const map: MarksByDate = {};
    const mark = (d: string, k: 'load' | 'fuel' | 'expense') => {
      (map[d] ??= {})[k] = true;
    };
    for (const l of loads)       mark(l.rawDate, 'load');
    for (const f of fuelEntries) mark(f.date,    'fuel');
    for (const e of genExpenses) mark(e.date,    'expense');
    return map;
  }, [loads, fuelEntries, genExpenses]);

  // 7 ISO dates Mon→Sun for the current week view
  const weekDates = useMemo(() => {
    if (filter !== 'week' || !bounds) return [] as string[];
    const dates: string[] = [];
    const d = new Date(bounds.start + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      dates.push(localDateISO(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [filter, bounds]);

  // Loads + one-off expenses filtered by selected day (or all if none selected)
  const visibleLoads = useMemo(() => (
    selectedDay ? loads.filter(l => l.rawDate === selectedDay) : loads
  ), [loads, selectedDay]);

  const visibleExpenses = useMemo(() => (
    selectedDay ? genExpenses.filter(e => e.date === selectedDay) : genExpenses
  ), [genExpenses, selectedDay]);

  const visibleFuel = useMemo(() => (
    selectedDay ? fuelEntries.filter(f => f.date === selectedDay) : fuelEntries
  ), [fuelEntries, selectedDay]);

  // Merged, date-sorted timeline of loads + one-off expenses + fuel fill-ups.
  // Fuel rows are informational: a load's net already accounts for fuel via
  // cost-per-mile, so a fill-up is NOT subtracted again from the period net.
  type TimelineItem =
    | { kind: 'load'; date: string; key: string; load: LoadRow }
    | { kind: 'expense'; date: string; key: string; exp: GeneralExpense }
    | { kind: 'fuel'; date: string; key: string; fuel: FuelEntryRow };
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...visibleLoads.map((l): TimelineItem => ({ kind: 'load', date: l.rawDate, key: 'l_' + l.id, load: l })),
      ...visibleExpenses.map((e): TimelineItem => ({ kind: 'expense', date: e.date, key: 'e_' + e.id, exp: e })),
      ...visibleFuel.map((f): TimelineItem => ({ kind: 'fuel', date: f.date, key: 'f_' + f.id, fuel: f })),
    ];
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return items;
  }, [visibleLoads, visibleExpenses, visibleFuel]);

  const visibleTotals: HistoryTotals = useMemo(() => {
    if (!selectedDay) return totals;
    const base = visibleLoads.reduce(
      (acc, l) => ({
        gross: acc.gross + l.gross,
        net:   acc.net   + l.net,
        miles: acc.miles + l.miles,
        count: acc.count + 1,
        rpm:   0,
      }),
      { ...EMPTY_TOTALS }
    );
    // One-off expenses on the selected day reduce that day's net too.
    const expSum = visibleExpenses.reduce((s, e) => s + e.amount, 0);
    return { ...base, net: base.net - expSum };
  }, [selectedDay, visibleLoads, visibleExpenses, totals]);

  function changeFilter(f: HistoryFilter) {
    setFilter(f);
    setSelectedDay(null);

    if (f === 'all') return; // all-time has no period — keep periodDate as-is

    if (filter === 'all') {
      // coming from all-time: reset to today
      setPeriodDate(new Date());
      return;
    }

    // week ↔ month: preserve the period context.
    // If switching month→week with a day selected, jump to that day's week.
    // Otherwise keep periodDate (it's within the displayed month/week already).
    if (filter === 'month' && f === 'week' && selectedDay) {
      setPeriodDate(new Date(selectedDay + 'T12:00:00'));
    }
    // week→month: periodDate is within the displayed week, so getMonthBounds
    // will show the correct month automatically — no change needed.
  }

  const selectedDayLabel = selectedDay
    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString(getDateLocale(), { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  const loadsLabel = selectedDay
    ? `${t('history.loads', { count: visibleTotals.count })} · ${selectedDayLabel}`
    : `${t('history.loads', { count: totals.count })} · ${bounds?.label ?? t('history.allTime')}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GridBackground />

      {/* Load detail modal */}
      <Modal visible={!!selectedLoadId} animationType="slide" presentationStyle="pageSheet">
        {selectedLoadId && (
          <LoadDetailScreen
            loadId={selectedLoadId}
            startInEdit={selectedEdit}
            onClose={() => { setSelectedLoadId(null); refresh(filter, periodDate); }}
          />
        )}
      </Modal>

      {/* Add-load-on-this-day modal */}
      <Modal visible={!!addLoadDate} animationType="slide" presentationStyle="pageSheet">
        {addLoadDate && (
          <AddLoadScreen
            prefill={{ date: addLoadDate }}
            onClose={() => setAddLoadDate(null)}
            onSaved={() => { setAddLoadDate(null); refresh(filter, periodDate); }}
          />
        )}
      </Modal>

      {/* Add-fuel-on-this-day modal */}
      <Modal visible={!!addFuelDate} animationType="slide" presentationStyle="pageSheet">
        {addFuelDate && (
          <FuelEntryScreen
            initialDate={addFuelDate}
            onCancel={() => setAddFuelDate(null)}
            onSaved={() => { setAddFuelDate(null); refresh(filter, periodDate); }}
          />
        )}
      </Modal>

      {/* Add-expense-on-this-day modal */}
      <Modal visible={!!addExpenseDate} animationType="slide" presentationStyle="pageSheet">
        {addExpenseDate && (
          <AddExpenseScreen
            initialDate={addExpenseDate}
            onClose={() => setAddExpenseDate(null)}
            onSaved={() => { setAddExpenseDate(null); refresh(filter, periodDate); }}
          />
        )}
      </Modal>

      {/* Day-entry chooser — pick which kind of entry to log on the tapped day */}
      <Modal visible={dayMenuOpen} transparent animationType="fade" onRequestClose={() => setDayMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setDayMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>
              {selectedDay ? t('history.addEntryOn', { day: selectedDayLabel }) : t('history.addEntryDay')}
            </Text>
            {([
              { key: 'load',    icon: 'cube-outline',  color: Colors.primary,   open: setAddLoadDate },
              { key: 'fuel',    icon: 'water-outline', color: Colors.secondary, open: setAddFuelDate },
              { key: 'expense', icon: 'wallet-outline', color: Colors.danger,   open: setAddExpenseDate },
            ] as const).map(({ key, icon, color, open }) => (
              <TouchableOpacity
                key={key}
                style={styles.menuRow}
                activeOpacity={0.75}
                onPress={() => { setDayMenuOpen(false); if (selectedDay) open(selectedDay); }}
              >
                <View style={[styles.menuIcon, { borderColor: color + '55', backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={styles.menuRowText}>{t(`history.entryType.${key}`)}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        {searchActive ? (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{t('history.eyebrow')}</Text>
              <Text style={styles.title}>{t('history.title')}</Text>
              <AccentRule style={{ marginTop: 8 }} />
            </View>
            <TouchableOpacity onPress={openSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Filter chips — hidden during search */}
        {!searchActive && (
        <View style={styles.filterRow}>
          {(['week', 'month', 'all'] as HistoryFilter[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => changeFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>
                {key === 'week' ? t('history.week') : key === 'month' ? t('history.month') : t('history.allTime')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        )}

        {/* Period navigator + calendar — swipe left/right to page periods */}
        {!searchActive && filter !== 'all' && (
          <GestureDetector gesture={periodSwipe}>
            <View collapsable={false}>
              <View style={styles.periodNav}>
                <TouchableOpacity style={styles.periodArrow} onPress={goPrevPeriod} activeOpacity={0.6}>
                  <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.periodLabel}>{bounds?.label}</Text>
                <TouchableOpacity style={styles.periodArrow} onPress={goNextPeriod} disabled={atCurrentPeriod} activeOpacity={0.6}>
                  <Ionicons name="chevron-forward" size={20} color={atCurrentPeriod ? Colors.textTertiary : Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Monthly calendar */}
              {filter === 'month' && (
                <View style={styles.calendarCard}>
                  <MonthCalendar
                    year={periodDate.getFullYear()}
                    month={periodDate.getMonth()}
                    marksByDate={marksByDate}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    today={TODAY}
                  />
                  {selectedDay && (
                    <TouchableOpacity style={styles.clearDayBtn} onPress={() => setSelectedDay(null)} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={14} color={Colors.textTertiary} />
                      <Text style={styles.clearDayText}>{t('history.showAll')} · {bounds?.label}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Weekly calendar */}
              {filter === 'week' && weekDates.length === 7 && (
                <View style={styles.calendarCard}>
                  <WeekCalendar
                    weekDates={weekDates}
                    marksByDate={marksByDate}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    today={TODAY}
                  />
                  {selectedDay && (
                    <TouchableOpacity style={styles.clearDayBtn} onPress={() => setSelectedDay(null)} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={14} color={Colors.textTertiary} />
                      <Text style={styles.clearDayText}>{t('history.showAll')} · {bounds?.label}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </GestureDetector>
        )}

        {/* Summary totals — hidden during search */}
        {!searchActive && <View style={styles.totalsCard}>
          {[
            { label: t('history.gross'),  value: fmtMoney(visibleTotals.gross) },
            { label: t('history.net'),    value: fmtMoney(visibleTotals.net), isNet: true },
            { label: t('history.miles'),  value: Math.round(visibleTotals.miles).toLocaleString() },
            { label: t('history.avgRPM'), value: `$${(visibleTotals.miles > 0 ? visibleTotals.net / visibleTotals.miles : 0).toFixed(2)}` },
          ].map(({ label, value, isNet }, i, arr) => (
            <React.Fragment key={label}>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={[styles.totalValue, isNet && { color: Colors.primary }]}>{value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.totalDivider} />}
            </React.Fragment>
          ))}
        </View>}

        {/* Search results */}
        {searchActive && (
          <View style={styles.section}>
            {searchQuery.trim().length < 2 ? null : (
              <>
                <Text style={styles.sectionLabel}>
                  {t('history.searchResultsCount', { count: searchResults.length })}
                </Text>
                {searchResults.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="search-outline" size={32} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyTitle}>{t('history.searchNoResults', { query: searchQuery.trim() })}</Text>
                    <Text style={styles.emptyHint}>{t('history.searchNoResultsHint')}</Text>
                  </View>
                ) : (
                  <View style={styles.loadsCard}>
                    {searchResults.map((load, i) => (
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
                              <Text style={styles.loadMeta}>
                                {load.date} · {Math.round(load.miles).toLocaleString()} mi · ${load.rpm.toFixed(2)}/mi
                              </Text>
                            </View>
                            <View style={styles.loadRight}>
                              <Text style={[styles.loadNet, { color: load.positive ? Colors.primary : Colors.danger }]}>
                                {load.positive ? '+' : '-'}${money2(Math.abs(load.net))}
                              </Text>
                              <Text style={styles.loadGross}>${money2(load.gross)} {t('common.gross')}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                          </TouchableOpacity>
                        </SwipeableRow>
                        {i < searchResults.length - 1 && <View style={styles.loadDivider} />}
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Load list — hidden during search */}
        {!searchActive && (
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { flexShrink: 1 }]}>{loadsLabel}</Text>
            {selectedDay && (
              <TouchableOpacity
                style={styles.addDayBtn}
                onPress={() => setDayMenuOpen(true)}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={14} color={Colors.primary} />
                <Text style={styles.addDayBtnText}>{t('history.addEntryDay')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {timeline.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={32} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>
                {selectedDay ? t('history.noLoadsOnDay', { day: selectedDayLabel }) : t('history.noLoadsPeriod')}
              </Text>
              <Text style={styles.emptyHint}>
                {selectedDay
                  ? t('history.hintSelectedDay')
                  : filter === 'all'
                    ? t('history.hintAllTime')
                    : t('history.hintBrowse')}
              </Text>
              {selectedDay && (
                <TouchableOpacity
                  style={styles.emptyDayCta}
                  onPress={() => setDayMenuOpen(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color={Colors.onPrimary} />
                  <Text style={styles.emptyDayCtaText}>{t('history.addEntryDay')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.loadsCard}>
              {timeline.map((item, i) => (
                <React.Fragment key={item.key}>
                  {item.kind === 'load' ? (
                    <SwipeableRow
                      onEdit={() => openLoad(item.load.id, true)}
                      onDelete={() => confirmDeleteLoad(item.load)}
                    >
                      <TouchableOpacity
                        style={[styles.loadRow, { backgroundColor: Colors.surface }]}
                        activeOpacity={0.7}
                        onPress={() => openLoad(item.load.id)}
                      >
                        <View style={styles.loadLeft}>
                          <View style={styles.loadRouteRow}>
                            <Text style={styles.loadRoute} numberOfLines={1}>
                              {item.load.from.split(',')[0]} → {item.load.to.split(',')[0]}
                            </Text>
                            {!!STATUS_PILL_I18N[item.load.status] && (
                              <View style={styles.statusPill}>
                                <Text style={styles.statusPillText}>{t(`addLoad.statuses.${STATUS_PILL_I18N[item.load.status]}`)}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.loadMeta}>
                            {item.load.date} · {Math.round(item.load.miles).toLocaleString()} mi · ${item.load.rpm.toFixed(2)}/mi
                          </Text>
                        </View>
                        <View style={styles.loadRight}>
                          <Text style={[styles.loadNet, { color: item.load.positive ? Colors.primary : Colors.danger }]}>
                            {item.load.positive ? '+' : '-'}${money2(Math.abs(item.load.net))}
                          </Text>
                          <Text style={styles.loadGross}>${money2(item.load.gross)} {t('common.gross')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    </SwipeableRow>
                  ) : item.kind === 'expense' ? (
                    <TouchableOpacity
                      style={styles.loadRow}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteExpense(item.exp.id)}
                    >
                      <View style={styles.expIcon}>
                        <Ionicons name={EXP_ICONS[item.exp.category] ?? 'wallet-outline'} size={16} color={Colors.danger} />
                      </View>
                      <View style={styles.loadLeft}>
                        <Text style={styles.loadRoute} numberOfLines={1}>{item.exp.label}</Text>
                        <Text style={styles.loadMeta}>
                          {formatDate(item.exp.date)} · {t('history.expenseTag')}
                        </Text>
                      </View>
                      <Text style={[styles.loadNet, { color: Colors.danger }]}>
                        -${money2(Math.abs(item.exp.amount))}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.loadRow}>
                      <View style={styles.fuelIcon}>
                        <Ionicons name="water-outline" size={16} color={Colors.secondary} />
                      </View>
                      <View style={styles.loadLeft}>
                        <Text style={styles.loadRoute} numberOfLines={1}>
                          {t('history.fuelTag')}{item.fuel.state_purchased ? ` · ${item.fuel.state_purchased}` : ''}
                        </Text>
                        <Text style={styles.loadMeta}>
                          {formatDate(item.fuel.date)} · {item.fuel.gallons.toLocaleString()} {t('fuel.form.galUnit')}
                          {item.fuel.mpg > 0 ? ` · ${item.fuel.mpg.toFixed(1)} MPG` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.loadNet, { color: Colors.secondary }]}>
                        ${money2(Math.abs(item.fuel.dollars_spent))}
                      </Text>
                    </View>
                  )}
                  {i < timeline.length - 1 && <View style={styles.loadDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 16, marginBottom: 16,
  },
  searchInput: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 4 },
  title:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary },

  filterRow:            { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip:           { paddingVertical: 9, paddingHorizontal: 18, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterChipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  filterChipText:       { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary, fontFamily: FontFamily.monoSemiBold },

  periodNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 16,
  },
  periodArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  periodLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, flex: 1, textAlign: 'center' },

  calendarCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12,
    marginBottom: 16,
  },
  clearDayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginTop: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clearDayText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary },

  totalsCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, flexDirection: 'row',
    paddingVertical: 18, paddingHorizontal: 16, marginBottom: 24,
  },
  totalCell:    { flex: 1, alignItems: 'center', gap: 5 },
  totalLabel:   { ...sectionLabel(Colors), fontSize: 9, marginBottom: 0 },
  totalValue:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  totalDivider: { width: 1, backgroundColor: Colors.border },

  section:      { marginBottom: 24 },
  sectionLabel: { ...sectionLabel(Colors), marginBottom: 12 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addDayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 12,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  addDayBtnText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary },
  emptyDayCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 22, marginTop: 16,
  },
  emptyDayCtaText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.onPrimary },

  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 32, alignItems: 'center',
  },
  emptyTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  loadsCard:   { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  loadRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.cardPad },
  loadLeft:    { flex: 1, marginRight: 12 },
  loadRoute:   { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3, flexShrink: 1 },
  loadRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusPill: {
    backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '45',
    borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
  },
  statusPillText: { fontFamily: FontFamily.monoSemiBold, fontSize: 9, color: Colors.secondary, letterSpacing: 0.5 },
  loadMeta:    { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight:   { alignItems: 'flex-end' },
  loadNet:     { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
  expIcon: {
    width: 32, height: 32, borderRadius: Radius.sm, marginRight: 12,
    backgroundColor: Colors.danger + '18', borderWidth: 1, borderColor: Colors.danger + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  fuelIcon: {
    width: 32, height: 32, borderRadius: Radius.sm, marginRight: 12,
    backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '30',
    alignItems: 'center', justifyContent: 'center',
  },

  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  menuHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 14 },
  menuTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.4 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  menuIcon: {
    width: 38, height: 38, borderRadius: Radius.sm, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  menuRowText: { flex: 1, fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
});
