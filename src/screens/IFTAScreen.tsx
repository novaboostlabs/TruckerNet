import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getLoadCount, getIFTAData, hasIFTAData, IFTARow } from '../db/database';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { capture } from '../lib/analytics';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';

// Free users see the first couple of states as a real-data teaser; the rest of
// the per-state breakdown (what they actually file) is blurred behind the gate.
const FREE_VISIBLE_ROWS = 2;

// Placeholder breakdown shown (blurred, behind the gate) to a FREE user who has
// no IFTA data yet — so the tab always advertises itself as a premium feature,
// the same way the dashboard Analytics section always shows its locked teaser.
const SAMPLE_ROWS: IFTARow[] = [
  { state: 'TX', miles: 1840, gallons: 283.1 },
  { state: 'TN', miles: 620,  gallons: 95.4 },
  { state: 'MO', miles: 560,  gallons: 86.2 },
  { state: 'OK', miles: 410,  gallons: 63.1 },
  { state: 'IL', miles: 380,  gallons: 58.5 },
];

type Quarter = 1 | 2 | 3 | 4;
const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;


function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1;
  return (m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4) as Quarter;
}

function generateCSV(rows: IFTARow[], year: number, q: Quarter): string {
  const lines = [
    `IFTA Report - Q${q} ${year}`,
    'State,Miles,Gallons',
    ...rows.map(r => `${r.state},${r.miles.toFixed(1)},${r.gallons.toFixed(1)}`),
    '',
    `TOTAL,${rows.reduce((s, r) => s + r.miles, 0).toFixed(1)},${rows.reduce((s, r) => s + r.gallons, 0).toFixed(1)}`,
    '',
    'Figures are estimates. Verify all totals before filing your IFTA return.',
  ];
  return lines.join('\n');
}

const QUARTER_MONTHS: Record<Quarter, string> = {
  1: 'Jan 1 – Mar 31',
  2: 'Apr 1 – Jun 30',
  3: 'Jul 1 – Sep 30',
  4: 'Oct 1 – Dec 31',
};

// Escape any user-derived string before interpolating it into the PDF HTML.
// The state values originate from user-entered/OCR'd data, so even though the
// PDF is the user's own, escaping keeps a stray "<" or "&" from corrupting the
// document (defense-in-depth against HTML injection).
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generatePDFHtml(rows: IFTARow[], year: number, q: Quarter): string {
  const totalMiles   = rows.reduce((s, r) => s + r.miles,   0);
  const totalGallons = rows.reduce((s, r) => s + r.gallons, 0);
  const avgMPG       = totalGallons > 0 ? totalMiles / totalGallons : 0;
  const dateRange    = QUARTER_MONTHS[q];
  const generated    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const rowsHtml = rows.map(r => `
    <tr>
      <td class="state">${esc(r.state)}</td>
      <td class="num">${Math.round(r.miles).toLocaleString()}</td>
      <td class="num">${r.gallons.toFixed(1)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2.5px solid #E8A020; }
  .brand { font-size: 11px; font-weight: 700; color: #E8A020; letter-spacing: 2px; margin-bottom: 6px; }
  .title { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .subtitle { font-size: 12px; color: #888; }
  .generated { font-size: 10px; color: #aaa; text-align: right; line-height: 1.6; }
  .stats { display: flex; gap: 14px; margin-bottom: 28px; }
  .stat { flex: 1; background: #f6f6f6; border-radius: 8px; padding: 14px 16px; }
  .stat-label { font-size: 9px; font-weight: 700; color: #aaa; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; }
  .stat-value { font-size: 20px; font-weight: 700; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead tr { background: #f0f0f0; }
  th { padding: 10px 14px; font-size: 9px; font-weight: 700; color: #888; letter-spacing: 1.5px; text-transform: uppercase; text-align: left; }
  th.num { text-align: right; }
  td { padding: 12px 14px; border-bottom: 1px solid #efefef; }
  td.state { font-weight: 700; font-size: 14px; color: #111; }
  td.num { text-align: right; color: #333; }
  .totals td { font-weight: 700; background: #f6f6f6; border-top: 2px solid #ddd; border-bottom: none; font-size: 13px; color: #111; }
  .disclaimer { font-size: 9.5px; color: #aaa; line-height: 1.6; border-top: 1px solid #eee; padding-top: 16px; }
  .amber { color: #E8A020; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TRUCKERNET</div>
      <div class="title">IFTA Quarterly Report</div>
      <div class="subtitle"><span class="amber">Q${q} ${year}</span> &nbsp;·&nbsp; ${dateRange}</div>
    </div>
    <div class="generated">Generated<br>${generated}</div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Total Miles</div>
      <div class="stat-value">${Math.round(totalMiles).toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Gallons</div>
      <div class="stat-value">${totalGallons.toFixed(1)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Avg MPG</div>
      <div class="stat-value">${avgMPG > 0 ? avgMPG.toFixed(2) : '—'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">States</div>
      <div class="stat-value">${rows.length}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>State</th>
        <th class="num">Miles</th>
        <th class="num">Gallons</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="totals">
        <td>TOTAL</td>
        <td class="num">${Math.round(totalMiles).toLocaleString()}</td>
        <td class="num">${totalGallons.toFixed(1)}</td>
      </tr>
    </tbody>
  </table>

  <div class="disclaimer">
    These figures are estimates based on your logged loads and fuel entries in TruckerNet.
    Verify all totals against your actual fuel receipts and odometer records before filing your IFTA return.
    TruckerNet is not a licensed tax-filing service.
  </div>
</body>
</html>`;
}

export default function IFTAScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  const { present: presentPaywall } = usePaywall();
  const thisYear    = new Date().getFullYear();
  const thisQuarter = currentQuarter();

  const [year,    setYear]    = useState(thisYear);
  const [quarter, setQuarter] = useState<Quarter>(thisQuarter);

  const [rows, setRows] = useState<IFTARow[]>(() => getIFTAData(thisYear, thisQuarter));

  const loadData = useCallback((y: number, q: Quarter) => {
    setRows(getIFTAData(y, q));
  }, []);

  useEffect(() => { loadData(year, quarter); }, [year, quarter, loadData]);

  useFocusEffect(useCallback(() => {
    loadData(year, quarter);
    capture('ifta_viewed', { year, quarter, is_pro: isPro });
  }, [year, quarter, loadData, isPro]));

  const hasData      = rows.length > 0;

  // Free users ALWAYS see IFTA as a locked premium feature (like the dashboard
  // Analytics gate): tease their real states when they have data, or a sample
  // breakdown when they don't — so the tab never looks empty/free.
  const usingSample  = !isPro && !hasData;
  const displayRows  = usingSample ? SAMPLE_ROWS : rows;

  const totalMiles   = displayRows.reduce((s, r) => s + r.miles,   0);
  const totalGallons = displayRows.reduce((s, r) => s + r.gallons, 0);

  // Free tier: the breakdown is a teaser. First rows show; the rest + totals +
  // export sit behind the upgrade gate.
  const gated        = !isPro && displayRows.length > 0;
  const visibleRows  = gated ? displayRows.slice(0, FREE_VISIBLE_ROWS) : displayRows;
  const hiddenRows   = gated ? displayRows.slice(FREE_VISIBLE_ROWS)    : [];

  async function exportCSV() {
    const csv = generateCSV(rows, year, quarter);
    try {
      await Share.share({ message: csv, title: `IFTA_Q${quarter}_${year}.csv` });
    } catch {
      Alert.alert(t('ifta.exportFailedTitle'), t('ifta.exportFailedMsg'));
    }
  }

  async function exportPDF() {
    try {
      const html = generatePDFHtml(rows, year, quarter);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `IFTA_Q${quarter}_${year}.pdf`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('ifta.exportFailedTitle'), t('ifta.exportFailedMsg'));
      }
    } catch {
      Alert.alert(t('ifta.exportFailedTitle'), t('ifta.exportFailedMsg'));
    }
  }

  function handleExport() {
    capture('ifta_export_tapped', { quarter, year, is_pro: !gated });
    if (gated) { presentPaywall('export'); return; }
    if (!hasData) {
      Alert.alert(t('ifta.exportNoDataTitle'), t('ifta.exportNoDataMsg', { quarter: `Q${quarter}`, year }));
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('ifta.exportPDF'), t('ifta.exportCSV'), t('common.cancel')],
          cancelButtonIndex: 2,
          title: `Q${quarter} ${year} IFTA Report`,
        },
        (idx) => {
          if (idx === 0) exportPDF();
          if (idx === 1) exportCSV();
        },
      );
    } else {
      Alert.alert(
        `Q${quarter} ${year} IFTA Report`,
        t('ifta.exportChoose'),
        [
          { text: t('ifta.exportPDF'), onPress: exportPDF },
          { text: t('ifta.exportCSV'), onPress: exportCSV },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GridBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('ifta.eyebrow')}</Text>
            <Text style={styles.title}>{t('ifta.title')}</Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.exportText}>{t('ifta.export')}</Text>
          </TouchableOpacity>
        </View>

        {/* Year + Quarter selector */}
        <View style={styles.selectorBlock}>
          <View style={styles.yearRow}>
            <TouchableOpacity
              onPress={() => setYear(y => y - 1)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.yearLabel}>{year}</Text>
            <TouchableOpacity
              onPress={() => setYear(y => y + 1)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={year >= new Date().getFullYear()}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={year >= new Date().getFullYear() ? Colors.textTertiary : Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.quarterRow}>
            {([1, 2, 3, 4] as Quarter[]).map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quarterChip, quarter === q && styles.quarterChipActive]}
                onPress={() => setQuarter(q)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quarterChipText, quarter === q && styles.quarterChipTextActive]}>
                  {QUARTER_LABELS[q - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {(isPro && !hasData) ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={26} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{t('ifta.noData', { quarter: `Q${quarter}`, year })}</Text>
            <Text style={styles.emptySub}>
              {t('ifta.noDataHint')}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary stats */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('ifta.totalMiles')}</Text>
                <Text style={styles.summaryValue}>{Math.round(totalMiles).toLocaleString()}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('ifta.totalGallons')}</Text>
                <Text style={styles.summaryValue}>{totalGallons.toFixed(1)}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeader, { flex: 1 }]}>{t('ifta.state')}</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>{t('ifta.miles')}</Text>
                <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>{t('ifta.gallons')}</Text>
              </View>

              {visibleRows.map((row, i) => (
                <React.Fragment key={row.state}>
                  <View style={styles.tableRow}>
                    <Text style={[styles.stateCode, { flex: 1 }]}>{row.state}</Text>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {Math.round(row.miles).toLocaleString()}
                    </Text>
                    <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                      {row.gallons.toFixed(1)}
                    </Text>
                  </View>
                  {i < visibleRows.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}

              {gated ? (
                /* Blurred teaser: remaining states + the filing totals sit
                   behind an upgrade overlay so free users feel the value. */
                <View>
                  <View style={styles.rowDivider} />
                  <View style={styles.gatedContent} pointerEvents="none">
                    {hiddenRows.map((row, i) => (
                      <React.Fragment key={row.state}>
                        <View style={styles.tableRow}>
                          <Text style={[styles.stateCode, { flex: 1 }]}>{row.state}</Text>
                          <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                            {Math.round(row.miles).toLocaleString()}
                          </Text>
                          <Text style={[styles.tableCellText, { flex: 2, textAlign: 'right' }]}>
                            {row.gallons.toFixed(1)}
                          </Text>
                        </View>
                        {i < hiddenRows.length - 1 && <View style={styles.rowDivider} />}
                      </React.Fragment>
                    ))}
                    <View style={styles.totalsRow}>
                      <Text style={[styles.totalsLabel, { flex: 1 }]}>{t('ifta.total')}</Text>
                      <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                        {Math.round(totalMiles).toLocaleString()}
                      </Text>
                      <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                        {totalGallons.toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.gateOverlay}
                    activeOpacity={0.85}
                    onPress={() => presentPaywall('ifta')}
                  >
                    <View style={styles.gateLockCircle}>
                      <Ionicons name="lock-closed" size={18} color={Colors.secondary} />
                    </View>
                    <Text style={styles.gateTitle}>{t('ifta.lockedTitle')}</Text>
                    <Text style={styles.gateSub}>
                      {usingSample
                        ? t('ifta.lockedSubSample')
                        : t('ifta.lockedSub', { count: displayRows.length })}
                    </Text>
                    <View style={styles.gateCta}>
                      <Text style={styles.gateCtaText}>{t('ifta.lockedCta')}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.totalsRow}>
                  <Text style={[styles.totalsLabel, { flex: 1 }]}>{t('ifta.total')}</Text>
                  <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                    {Math.round(totalMiles).toLocaleString()}
                  </Text>
                  <Text style={[styles.totalsValue, { flex: 2, textAlign: 'right' }]}>
                    {totalGallons.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>
          {t('ifta.disclaimer')}
        </Text>

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
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border,
  },
  exportText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  selectorBlock: { marginBottom: 20 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  yearLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, minWidth: 56, textAlign: 'center' },

  quarterRow:           { flexDirection: 'row', gap: 8 },
  quarterChip:          { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  quarterChipActive:    { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  quarterChipText:      { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textSecondary },
  quarterChipTextActive: { color: Colors.primary },

  summaryRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard:  { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.cardPad },
  summaryLabel: { ...sectionLabel(Colors), fontSize: 10, marginBottom: 6 },
  summaryValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  tableCard:      { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden', marginBottom: 20 },
  tableHeaderRow: { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 12, backgroundColor: Colors.surfaceHigh },
  tableHeader:    { ...sectionLabel(Colors), fontSize: 10, marginBottom: 0 },
  tableRow:       { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, alignItems: 'center' },
  stateCode:      { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  tableCellText:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  rowDivider:     { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },
  totalsRow:      { flexDirection: 'row', paddingHorizontal: Spacing.cardPad, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surfaceHigh },
  totalsLabel:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.textSecondary },
  totalsValue:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.textPrimary },

  // Pro gate (IFTA teaser)
  gatedContent: { opacity: 0.12 },
  gateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.cardPad,
    backgroundColor: Colors.surface + 'D0',
  },
  gateLockCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1, borderColor: Colors.secondary + '40',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  gateTitle: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  gateSub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17, marginBottom: 14, maxWidth: 260 },
  gateCta: { backgroundColor: Colors.secondary, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 9 },
  gateCtaText: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.onPrimary },

  emptyCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 44, paddingHorizontal: Spacing.cardPad, alignItems: 'center', marginBottom: 20 },
  emptyIcon: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 6 },
  emptySub:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  disclaimer: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
});
