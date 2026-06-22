import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import { getDateLocale } from '../lib/i18n';
import {
  getHistoryLoads, getHistoryTotals, getHistoryLoadsDateRange, getHistoryTotalsDateRange,
  HistoryFilter, HistoryLoad, HistoryTotals,
} from '../db/database';
import MonthCalendar from '../components/MonthCalendar';
import WeekCalendar  from '../components/WeekCalendar';
import LoadDetailScreen from './LoadDetailScreen';

// ── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string { return d.toISOString().split('T')[0]; }
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoadRow {
  id: string; date: string; rawDate: string; from: string; to: string;
  miles: number; gross: number; net: number; rpm: number; positive: boolean;
}
function toRow(l: HistoryLoad): LoadRow {
  return {
    id: l.id, date: formatDate(l.date), rawDate: l.date,
    from: `${l.pickup_city}, ${l.pickup_state}`,
    to:   `${l.delivery_city}, ${l.delivery_state}`,
    miles: l.total_miles, gross: l.gross_pay,
    net: l.net_pay, rpm: l.net_rate_per_mile, positive: l.net_pay >= 0,
  };
}

const EMPTY_TOTALS: HistoryTotals = { gross: 0, net: 0, miles: 0, rpm: 0, count: 0 };

function loadDataForPeriod(filter: HistoryFilter, date: Date) {
  if (filter === 'all') {
    return { loads: getHistoryLoads('all').map(toRow), totals: getHistoryTotals('all') };
  }
  const { start, end } = filter === 'week' ? getWeekBounds(date) : getMonthBounds(date);
  return {
    loads:  getHistoryLoadsDateRange(start, end).map(toRow),
    totals: getHistoryTotalsDateRange(start, end),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { t } = useTranslation();
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
  const [selectedDay,   setSelectedDay]   = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  const refresh = useCallback((f: HistoryFilter, d: Date) => {
    const result = loadDataForPeriod(f, d);
    setLoads(result.loads);
    setTotals(result.totals);
  }, []);

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

  // Group loads by date for calendar dots
  const loadsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of loads) map[l.rawDate] = (map[l.rawDate] ?? 0) + 1;
    return map;
  }, [loads]);

  // 7 ISO dates Mon→Sun for the current week view
  const weekDates = useMemo(() => {
    if (filter !== 'week' || !bounds) return [] as string[];
    const dates: string[] = [];
    const d = new Date(bounds.start + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [filter, bounds]);

  // Loads filtered by selected day (or all if none selected)
  const visibleLoads = useMemo(() => (
    selectedDay ? loads.filter(l => l.rawDate === selectedDay) : loads
  ), [loads, selectedDay]);

  const visibleTotals: HistoryTotals = useMemo(() => {
    if (!selectedDay) return totals;
    return visibleLoads.reduce(
      (acc, l) => ({
        gross: acc.gross + l.gross,
        net:   acc.net   + l.net,
        miles: acc.miles + l.miles,
        count: acc.count + 1,
        rpm:   0,
      }),
      { ...EMPTY_TOTALS }
    );
  }, [selectedDay, visibleLoads, totals]);

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

      {/* Load detail modal */}
      <Modal visible={!!selectedLoadId} animationType="slide" presentationStyle="pageSheet">
        {selectedLoadId && (
          <LoadDetailScreen
            loadId={selectedLoadId}
            onClose={() => setSelectedLoadId(null)}
          />
        )}
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('history.eyebrow')}</Text>
            <Text style={styles.title}>{t('history.title')}</Text>
          </View>
        </View>

        {/* Filter chips */}
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

        {/* Period navigator */}
        {filter !== 'all' && (
          <View style={styles.periodNav}>
            <TouchableOpacity style={styles.periodArrow} onPress={() => { setPeriodDate(d => shiftDate(d, filter, -1)); setSelectedDay(null); }} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.periodLabel}>{bounds?.label}</Text>
            <TouchableOpacity style={styles.periodArrow} onPress={() => { if (!atCurrentPeriod) { setPeriodDate(d => shiftDate(d, filter, 1)); setSelectedDay(null); } }} disabled={atCurrentPeriod} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={20} color={atCurrentPeriod ? Colors.textTertiary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Monthly calendar */}
        {filter === 'month' && (
          <View style={styles.calendarCard}>
            <MonthCalendar
              year={periodDate.getFullYear()}
              month={periodDate.getMonth()}
              loadsByDate={loadsByDate}
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
              loadsByDate={loadsByDate}
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

        {/* Summary totals */}
        <View style={styles.totalsCard}>
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
        </View>

        {/* Load list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{loadsLabel}</Text>

          {visibleLoads.length === 0 ? (
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
            </View>
          ) : (
            <View style={styles.loadsCard}>
              {visibleLoads.map((load, i) => (
                <React.Fragment key={load.id}>
                  <TouchableOpacity
                    style={styles.loadRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedLoadId(load.id)}
                  >
                    <View style={styles.loadLeft}>
                      <Text style={styles.loadRoute} numberOfLines={1}>
                        {load.from.split(',')[0]} → {load.to.split(',')[0]}
                      </Text>
                      <Text style={styles.loadMeta}>
                        {load.date} · {Math.round(load.miles).toLocaleString()} mi · ${load.rpm.toFixed(2)}/mi
                      </Text>
                    </View>
                    <View style={styles.loadRight}>
                      <Text style={[styles.loadNet, { color: load.positive ? Colors.primary : Colors.danger }]}>
                        {load.positive ? '+' : '-'}${Math.abs(load.net).toLocaleString()}
                      </Text>
                      <Text style={styles.loadGross}>${load.gross.toLocaleString()} {t('common.gross')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                  {i < visibleLoads.length - 1 && <View style={styles.loadDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 24 },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },

  filterRow:            { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip:           { paddingVertical: 9, paddingHorizontal: 18, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterChipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  filterChipText:       { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary, fontFamily: FontFamily.semiBold },

  periodNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 16,
  },
  periodArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  periodLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, flex: 1, textAlign: 'center' },

  calendarCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12,
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
    borderRadius: Radius.lg, flexDirection: 'row',
    paddingVertical: 18, paddingHorizontal: 16, marginBottom: 24,
  },
  totalCell:    { flex: 1, alignItems: 'center', gap: 5 },
  totalLabel:   { ...SectionLabel, fontSize: 9, marginBottom: 0 },
  totalValue:   { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  totalDivider: { width: 1, backgroundColor: Colors.border },

  section:      { marginBottom: 24 },
  sectionLabel: { ...SectionLabel, marginBottom: 12 },

  emptyCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 32, alignItems: 'center',
  },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  loadsCard:   { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  loadRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.cardPad },
  loadLeft:    { flex: 1, marginRight: 12 },
  loadRoute:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 3 },
  loadMeta:    { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadRight:   { alignItems: 'flex-end' },
  loadNet:     { fontFamily: FontFamily.bold, fontSize: FontSize.body, marginBottom: 2 },
  loadGross:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  loadDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
});
