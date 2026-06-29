import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { WeekTrendPoint, CostBreakdown } from '../db/database';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = SCREEN_W - Spacing.screenH * 2;
const CHART_PAD = 16;
const BAR_CHART_W = CARD_W - CHART_PAD * 2;

// ── Net Pay Trend (12-week bar chart) ────────────────────────────────────────

const TREND_H     = 120;
const LABEL_H     = 18;
const BAR_CHART_H = TREND_H - LABEL_H;
const BAR_GAP     = 3;

function NetPayTrendChart({ data }: { data: WeekTrendPoint[] }) {
  const { colors: Colors } = useTheme();
  if (data.length === 0) return null;

  const n    = data.length;
  const barW = Math.max((BAR_CHART_W - (n - 1) * BAR_GAP) / n, 2);
  const maxAbs = Math.max(...data.map(d => Math.abs(d.net)), 1);
  const midY   = BAR_CHART_H / 2;

  return (
    <Svg width={BAR_CHART_W} height={TREND_H}>
      {/* Zero line */}
      <Line x1={0} y1={midY} x2={BAR_CHART_W} y2={midY}
            stroke={Colors.border} strokeWidth={1} />

      {data.map((d, i) => {
        const x      = i * (barW + BAR_GAP);
        const absH   = Math.max((Math.abs(d.net) / maxAbs) * (midY - 4), 2);
        const isPos  = d.net >= 0;
        const barY   = isPos ? midY - absH : midY;
        const color  = d.net === 0 ? Colors.border : isPos ? Colors.primary : Colors.danger;

        const dt    = new Date(d.weekStart + 'T12:00:00');
        const label = dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        const showLabel = n <= 8 || i % Math.ceil(n / 6) === 0;

        return (
          <G key={d.weekStart}>
            <Rect x={x} y={barY} width={barW} height={absH} fill={color} rx={2} />
            {showLabel && (
              <SvgText
                x={x + barW / 2} y={TREND_H - 2}
                fill={Colors.textTertiary}
                fontSize={8}
                fontFamily={FontFamily.monoRegular}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Cost Breakdown (stacked horizontal bar + legend) ─────────────────────────

const breakdownSegments = (c: ThemeColors) => ([
  { key: 'fuel',     color: c.secondary },
  { key: 'fixed',    color: '#6B7280' },
  { key: 'expenses', color: '#8B5CF6' },
  { key: 'net',      color: c.primary },
] as const);

function CostBreakdownChart({ breakdown }: { breakdown: CostBreakdown }) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const BREAKDOWN_SEGMENTS = breakdownSegments(Colors);
  const { fuel, fixed, expenses, net, gross } = breakdown;

  if (gross <= 0) {
    return (
      <View style={styles.breakdownEmpty}>
        <Text style={styles.breakdownEmptyText}>{t('analytics.noDataMonth')}</Text>
      </View>
    );
  }

  const values = { fuel, fixed, expenses, net: Math.max(net, 0) };
  const total  = Object.values(values).reduce((s, v) => s + v, 0) || 1;

  const BAR_H = 22;

  // Precompute cumulative x positions to avoid mutating state during render.
  let acc = 0;
  const segments = BREAKDOWN_SEGMENTS.map(seg => {
    const val  = values[seg.key];
    const segW = (val / total) * BAR_CHART_W;
    const x    = acc;
    acc += segW;
    return { ...seg, val, segW, x };
  });

  return (
    <View>
      {/* Stacked bar */}
      <View style={[styles.breakdownBarWrap, { borderRadius: 6, overflow: 'hidden' }]}>
        <Svg width={BAR_CHART_W} height={BAR_H}>
          {segments.map(seg => (
            <Rect key={seg.key} x={seg.x} y={0} width={seg.segW} height={BAR_H} fill={seg.color} />
          ))}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map(seg => {
          const pct = gross > 0 ? ((seg.val / gross) * 100).toFixed(0) : '0';
          return (
            <View key={seg.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{t(`analytics.cost_${seg.key}`)}</Text>
              <Text style={styles.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Pro gate overlay ──────────────────────────────────────────────────────────

function ProGate({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.gate}>
      <View style={styles.gateInner}>
        <Ionicons name="stats-chart-outline" size={28} color={Colors.secondary} />
        <Text style={styles.gateTitle}>{t('analytics.gateTitle')}</Text>
        <Text style={styles.gateSub}>{t('analytics.gateSub')}</Text>
        <TouchableOpacity style={styles.gateBtn} onPress={onUpgrade} activeOpacity={0.85}>
          <Text style={styles.gateBtnText}>{t('analytics.gateBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main AnalyticsSection ─────────────────────────────────────────────────────

interface Props {
  trend:     WeekTrendPoint[];
  breakdown: CostBreakdown;
  isPro:     boolean;
  onUpgrade: () => void;
}

export default function AnalyticsSection({ trend, breakdown, isPro, onUpgrade }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // Determine if there's any data at all to decide whether to render
  const hasTrendData = trend.some(w => w.net !== 0 || w.gross !== 0);

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{t('analytics.eyebrow')}</Text>

      {/* ── Chart 1: Net Pay Trend ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('analytics.trendTitle')}</Text>
        <Text style={styles.cardSub}>{t('analytics.trendSub')}</Text>

        <View style={styles.chartWrap}>
          {hasTrendData ? (
            <NetPayTrendChart data={trend} />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>{t('analytics.noDataTrend')}</Text>
            </View>
          )}
        </View>

        {!isPro && <ProGate onUpgrade={onUpgrade} />}
      </View>

      {/* ── Chart 2: Cost Breakdown ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('analytics.breakdownTitle')}</Text>
        <Text style={styles.cardSub}>{t('analytics.breakdownSub')}</Text>

        <View style={styles.chartWrap}>
          <CostBreakdownChart breakdown={breakdown} />
        </View>

        {!isPro && <ProGate onUpgrade={onUpgrade} />}
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  section: { marginBottom: 24 },
  eyebrow: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 12 },

  card: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.md,
    padding:         CHART_PAD,
    marginBottom:    Spacing.gap,
    overflow:        'hidden',
  },
  cardTitle: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize:   FontSize.body,
    color:      Colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
    marginBottom: 14,
  },
  chartWrap: { alignItems: 'flex-start' },

  emptyChart: {
    width: BAR_CHART_W, height: 80,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyChartText: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textTertiary,
  },

  // Cost breakdown
  breakdownBarWrap: { marginBottom: 12 },
  breakdownEmpty: {
    height: 60, alignItems: 'center', justifyContent: 'center',
  },
  breakdownEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.caption,
    color:      Colors.textTertiary,
  },

  legend: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
    marginTop:     4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  legendDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  legendLabel: {
    fontFamily: FontFamily.monoRegular,
    fontSize:   FontSize.caption,
    color:      Colors.textSecondary,
  },
  legendPct: {
    fontFamily: FontFamily.monoBold,
    fontSize:   FontSize.caption,
    color:      Colors.textPrimary,
  },

  // Pro gate
  gate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,8,0.88)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  gateInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  gateTitle: {
    fontFamily:  FontFamily.monoBold,
    fontSize:    FontSize.body,
    color:       Colors.textPrimary,
    marginTop:   10,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  gateSub: {
    fontFamily:  FontFamily.regular,
    fontSize:    FontSize.caption,
    color:       Colors.textSecondary,
    textAlign:   'center',
    marginBottom: 14,
  },
  gateBtn: {
    backgroundColor: Colors.primary,
    borderRadius:    Radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  gateBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize:   FontSize.label,
    color:      Colors.background,
  },
});
