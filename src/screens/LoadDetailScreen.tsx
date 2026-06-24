import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '../lib/i18n';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import {
  getLoadById, LoadDetail, addSingleLoadExpense, deleteSingleLoadExpense,
} from '../db/database';
import { useAuth } from '../contexts/AuthContext';
import { pushLoads } from '../lib/sync/loadsSync';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Maps DB status values to the camelCase keys under addLoad.statuses in i18n.
const STATUS_I18N: Record<string, string> = {
  completed:   'completed',
  upcoming:    'upcoming',
  in_progress: 'inProgress',
  cancelled:   'cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  completed:   Colors.primary,
  upcoming:    Colors.secondary,
  in_progress: Colors.secondary,
  cancelled:   Colors.danger,
};

const VERDICT_COLORS: Record<string, string> = {
  green: Colors.primary,
  amber: Colors.secondary,
  red:   Colors.danger,
};

function fmt(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.rowDivider} />;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  loadId: string;
  onClose: () => void;
}

// Quick-add expense categories (matches AddLoadScreen chips)
const EXPENSE_CATS = [
  { cat: 'scale',     labelKey: 'addLoad.expCat.scale',     defaultAmt: '11' },
  { cat: 'lumper',    labelKey: 'addLoad.expCat.lumper',     defaultAmt: '' },
  { cat: 'toll',      labelKey: 'addLoad.expCat.toll',       defaultAmt: '' },
  { cat: 'detention', labelKey: 'addLoad.expCat.detention',  defaultAmt: '' },
  { cat: 'other',     labelKey: 'addLoad.expCat.other',      defaultAmt: '' },
];

export default function LoadDetailScreen({ loadId, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [load,      setLoad]      = useState<LoadDetail | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editingExp, setEditingExp] = useState(false);

  // Pending expense being typed in (null = no add row showing)
  const [pending, setPending] = useState<{ label: string; amount: string; category: string } | null>(null);

  const refreshLoad = useCallback(() => {
    setLoad(getLoadById(loadId));
  }, [loadId]);

  useEffect(() => { refreshLoad(); }, [refreshLoad]);

  function handleAddChip(cat: string, defaultLabel: string, defaultAmt: string) {
    setPending({ label: defaultLabel, amount: defaultAmt, category: cat });
  }

  function handleConfirmExpense() {
    if (!pending) return;
    const amt = parseFloat(pending.amount);
    if (!amt || amt <= 0) { setPending(null); return; }
    addSingleLoadExpense(loadId, {
      label:    pending.label.trim() || pending.category,
      category: pending.category,
      amount:   amt,
    });
    refreshLoad();
    setPending(null);
    if (user) pushLoads(user.id);
  }

  function handleDeleteExpense(expenseId: string) {
    deleteSingleLoadExpense(expenseId, loadId);
    refreshLoad();
    if (user) pushLoads(user.id);
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const netPositive  = load.net_pay >= 0;
  const hasOptional  = load.weight_lbs > 0 || load.bol_number || load.broker_name || load.notes;
  const hasStateMi   = load.stateMileage.length > 0;
  const hasFair      = load.benchmark_fair_pay_min != null && load.benchmark_fair_pay_max != null;
  const statusColor  = STATUS_COLORS[load.status] ?? Colors.textSecondary;
  const verdictColor = load.verdict ? VERDICT_COLORS[load.verdict] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>{t('loadDetail.eyebrow')}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {load.pickup_city} → {load.delivery_city}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Date + status + verdict badges */}
        <View style={styles.badgeRow}>
          <Text style={styles.dateLabel}>{fmt(load.date)}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {STATUS_I18N[load.status] ? t(`addLoad.statuses.${STATUS_I18N[load.status]}`) : load.status}
              </Text>
            </View>
            {load.verdict && (
              <View style={[styles.badge, { backgroundColor: (verdictColor ?? Colors.primary) + '20', borderColor: (verdictColor ?? Colors.primary) + '50' }]}>
                <Text style={[styles.badgeText, { color: verdictColor ?? Colors.primary }]}>
                  {t(`loadDetail.verdict.${load.verdict}`)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Route card */}
        <View style={styles.routeCard}>
          <View style={styles.routeEndpoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.textSecondary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeCity}>{load.pickup_city}, {load.pickup_state}</Text>
              {!!load.pickup_address && (
                <Text style={styles.routeAddress} numberOfLines={1}>{load.pickup_address}</Text>
              )}
            </View>
          </View>
          <View style={styles.routeLineWrap}>
            <View style={styles.routeLine} />
            <Text style={styles.routeMiles}>{Math.round(load.total_miles).toLocaleString()} mi</Text>
          </View>
          <View style={styles.routeEndpoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeCity}>{load.delivery_city}, {load.delivery_state}</Text>
              {!!load.delivery_address && (
                <Text style={styles.routeAddress} numberOfLines={1}>{load.delivery_address}</Text>
              )}
            </View>
          </View>
        </View>

        {/* P&L card */}
        <Text style={styles.sectionHeader}>{t('loadDetail.payCosts')}</Text>
        <View style={styles.card}>
          <View style={styles.plHero}>
            <View style={styles.plHeroLeft}>
              <Text style={styles.plHeroLabel}>{t('loadDetail.netPay')}</Text>
              <Text style={[styles.plHeroValue, { color: netPositive ? Colors.primary : Colors.danger }]}>
                {netPositive ? '+' : '-'}${money(Math.abs(load.net_pay))}
              </Text>
            </View>
            <View style={styles.plHeroDivider} />
            <View style={styles.plHeroRight}>
              <Text style={styles.plHeroLabel}>{t('loadDetail.grossPay')}</Text>
              <Text style={styles.plHeroGross}>${money(load.gross_pay)}</Text>
            </View>
          </View>
          <Divider />
          <DetailRow label={t('loadDetail.fuelCost')}   value={`$${money(load.fuel_cost_for_load)}`} />
          <Divider />
          <DetailRow label={t('loadDetail.fixedCost')}  value={`$${money(load.fixed_cost_for_load)}`} />
          {/* ── Expense rows — editable ── */}
          {(load.loadExpenses?.length > 0 || editingExp) && (
            <>
              <Divider />
              {/* Edit / Done toggle */}
              <View style={styles.expEditHeader}>
                <Text style={styles.expEditLabel}>{t('loadDetail.deductions')}</Text>
                <TouchableOpacity
                  onPress={() => { setEditingExp(e => !e); setPending(null); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.expEditToggle}>
                    {editingExp ? t('common.done') : t('common.edit')}
                  </Text>
                </TouchableOpacity>
              </View>

              {load.loadExpenses.map((e) => (
                <View key={e.id} style={styles.expRow}>
                  <Text style={styles.expRowLabel} numberOfLines={1}>{e.label}</Text>
                  <Text style={styles.expRowAmount}>-${money(e.amount)}</Text>
                  {editingExp && (
                    <TouchableOpacity
                      onPress={() => handleDeleteExpense(e.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Pending add row */}
              {editingExp && pending && (
                <View style={styles.expPendingRow}>
                  <TextInput
                    style={styles.expPendingLabel}
                    value={pending.label}
                    onChangeText={(v) => setPending(p => p ? { ...p, label: v } : p)}
                    placeholder={t('addLoad.expCat.other')}
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <View style={styles.expPendingAmtWrap}>
                    <Text style={styles.expPendingDollar}>$</Text>
                    <TextInput
                      style={styles.expPendingAmt}
                      value={pending.amount}
                      onChangeText={(v) => setPending(p => p ? { ...p, amount: v } : p)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity onPress={handleConfirmExpense} style={styles.expConfirmBtn}>
                    <Ionicons name="checkmark" size={16} color={Colors.background} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPending(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Quick-add chips — visible in edit mode */}
              {editingExp && !pending && (
                <View style={styles.expChips}>
                  {EXPENSE_CATS.map(({ cat, labelKey, defaultAmt }) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.expChip}
                      onPress={() => handleAddChip(cat, t(labelKey), defaultAmt)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={12} color={Colors.textSecondary} />
                      <Text style={styles.expChipText}>{t(labelKey)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* "Add expense" entry point when no expenses yet and not editing */}
          {!editingExp && (load.loadExpenses?.length ?? 0) === 0 && (
            <>
              <Divider />
              <TouchableOpacity
                style={styles.expAddRow}
                onPress={() => setEditingExp(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.expAddRowText}>{t('loadDetail.addExpense')}</Text>
              </TouchableOpacity>
            </>
          )}

          {load.additional_costs > 0 && (
            <><Divider /><DetailRow label={t('loadDetail.deductionsTotal')} value={`-$${money(load.additional_costs)}`} valueColor={Colors.danger} /></>
          )}
          <Divider />
          <DetailRow label={t('loadDetail.grossRPM')}   value={`$${load.gross_rate_per_mile.toFixed(3)}/mi`} />
          <Divider />
          <DetailRow
            label={t('loadDetail.netRPM')}
            value={`$${load.net_rate_per_mile.toFixed(3)}/mi`}
            valueColor={netPositive ? Colors.primary : Colors.danger}
          />
          {hasFair && (
            <>
              <Divider />
              <DetailRow
                label={t('loadDetail.fairMarketRange')}
                value={`$${money(load.benchmark_fair_pay_min!)}–$${money(load.benchmark_fair_pay_max!)}`}
              />
            </>
          )}
        </View>

        {/* Load info */}
        <Text style={styles.sectionHeader}>{t('loadDetail.loadInfo')}</Text>
        <View style={styles.card}>
          <DetailRow label={t('loadDetail.equipmentType')}  value={t(`addLoad.loadTypes.${load.equipment_type}`)} />
          {load.is_backhaul === 1 && <><Divider /><DetailRow label={t('loadDetail.backhaul')}  value={t('loadDetail.yes')} valueColor={Colors.secondary} /></>}
          {hasOptional && (
            <>
              {load.weight_lbs > 0 && <><Divider /><DetailRow label={t('loadDetail.weight')} value={`${load.weight_lbs.toLocaleString()} lbs`} /></>}
              {!!load.bol_number   && <><Divider /><DetailRow label={t('loadDetail.bol')}   value={load.bol_number} /></>}
              {!!load.broker_name  && <><Divider /><DetailRow label={t('loadDetail.broker')}  value={load.broker_name + (load.broker_mc ? ` (MC ${load.broker_mc})` : '')} /></>}
              {!!load.notes        && <><Divider /><DetailRow label={t('loadDetail.notes')}   value={load.notes} /></>}
            </>
          )}
        </View>

        {/* BOL photo */}
        {!!load.bol_photo_url && (
          <>
            <Text style={styles.sectionHeader}>{t('loadDetail.bolPhoto')}</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPhotoOpen(true)}>
              <Image source={{ uri: load.bol_photo_url }} style={styles.bolPhoto} resizeMode="cover" />
            </TouchableOpacity>
          </>
        )}

        {/* State mileage */}
        {hasStateMi && (
          <>
            <Text style={styles.sectionHeader}>{t('loadDetail.stateMileage')}</Text>
            <View style={styles.card}>
              {load.stateMileage.map((row, i) => (
                <React.Fragment key={row.state}>
                  {i > 0 && <Divider />}
                  <DetailRow label={row.state} value={`${Math.round(row.miles).toLocaleString()} mi`} />
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen BOL photo viewer */}
      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <TouchableOpacity style={styles.viewerOverlay} activeOpacity={1} onPress={() => setPhotoOpen(false)}>
          {!!load.bol_photo_url && (
            <Image source={{ uri: load.bol_photo_url }} style={styles.viewerImage} resizeMode="contain" />
          )}
          <View style={styles.viewerClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.screenH, paddingTop: 20, paddingBottom: 12,
    gap: 12,
  },
  headerEyebrow: { ...SectionLabel, marginBottom: 3 },
  headerTitle:   { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },
  closeBtn: {
    width: 36, height: 36, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  bolPhoto: {
    width: '100%', height: 200,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 24,
    backgroundColor: Colors.surface,
  },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImage:   { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  dateLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, flex: 1 },
  badges:    { flexDirection: 'row', gap: 6 },
  badge: {
    borderWidth: 1, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption },

  routeCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad, marginBottom: 24,
  },
  routeEndpoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeCity: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  routeAddress: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  routeLineWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, paddingVertical: 6, gap: 10 },
  routeLine: { width: 2, height: 28, backgroundColor: Colors.border, borderRadius: 1 },
  routeMiles: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  sectionHeader: { ...SectionLabel, marginBottom: 10, paddingLeft: 4 },

  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, marginBottom: 24, overflow: 'hidden',
  },

  plHero: { flexDirection: 'row', alignItems: 'center', padding: Spacing.cardPad },
  plHeroLeft:   { flex: 1 },
  plHeroRight:  { flex: 1, alignItems: 'flex-end' },
  plHeroDivider: { width: 1, height: 40, backgroundColor: Colors.border, marginHorizontal: 16 },
  plHeroLabel:  { ...SectionLabel, fontSize: 9, marginBottom: 6 },
  plHeroValue:  { fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber, letterSpacing: -0.5 },
  plHeroGross:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  rowDivider:  { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.cardPad },

  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: Spacing.cardPad },
  detailLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  detailValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },

  // Expense editing
  expEditHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.cardPad,
  },
  expEditLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  expEditToggle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.primary },
  expRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: Spacing.cardPad,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  expRowLabel: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  expRowAmount: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.danger },
  expPendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: Spacing.cardPad,
    backgroundColor: Colors.surfaceHigh,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  expPendingLabel: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label,
    color: Colors.textPrimary, padding: 0,
  },
  expPendingAmtWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expPendingDollar: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  expPendingAmt: {
    width: 70, fontFamily: FontFamily.semiBold, fontSize: FontSize.label,
    color: Colors.textPrimary, textAlign: 'right', padding: 0,
  },
  expConfirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    padding: 5, alignItems: 'center', justifyContent: 'center',
  },
  expChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: Spacing.cardPad, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  expChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  expChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },
  expAddRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 12, paddingHorizontal: Spacing.cardPad,
  },
  expAddRowText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },
});
