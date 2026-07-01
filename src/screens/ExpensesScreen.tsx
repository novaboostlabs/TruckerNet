import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import {
  getUserExpenses, replaceUserExpenses, getWeeklyMiles, setMonthlyMiles,
  getTaxSetAside, setSetting, TaxSetAside,
} from '../db/database';
import { toMonthlyAmount, ExpenseFrequency } from '../utils/marketRates';
import { useAuth } from '../contexts/AuthContext';
import { pushExpenses } from '../lib/sync/expensesSync';
import * as haptics from '../lib/haptics';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ExpenseEntry {
  id: string;
  label: string;
  category: string;
  amount: string;
  frequency: ExpenseFrequency;
  icon?: IoniconName;
  subtitle?: string;
}

interface Draft {
  label: string;
  amount: string;
  frequency: ExpenseFrequency;
}

const FREQUENCIES: ExpenseFrequency[] = ['daily','weekly','biweekly','monthly','quarterly','semiannual','annual'];

// Same essentials as onboarding, in the same order.
const FIXED_EXPENSES: { category: string; icon: IoniconName }[] = [
  { category: 'truck',       icon: 'car-outline'              },
  { category: 'insurance',   icon: 'shield-checkmark-outline' },
  { category: 'maintenance', icon: 'construct-outline'        },
  { category: 'eld',         icon: 'hardware-chip-outline'    },
  { category: 'loadboard',   icon: 'grid-outline'             },
  { category: 'parking',     icon: 'location-outline'         },
];

const FIXED_CATEGORIES = new Set(FIXED_EXPENSES.map(f => f.category));

function emptyDraft(): Draft {
  return { label: '', amount: '', frequency: 'monthly' };
}

type FreqTarget = { kind: 'fixed'; id: string } | { kind: 'draft' } | null;

export default function ExpensesScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { user } = useAuth();

  const freqLabel = (f: ExpenseFrequency) => t(`onboarding.expenses.frequencies.${f}`);

  const [fixed, setFixed]   = useState<ExpenseEntry[]>([]);
  const [others, setOthers] = useState<ExpenseEntry[]>([]);
  const [draft, setDraft]   = useState<Draft>(emptyDraft());
  const [monthlyMilesInput, setMonthlyMilesInput] = useState('');
  const [freqTarget, setFreqTarget] = useState<FreqTarget>(null);
  const [saved, setSaved]   = useState(false);

  // ── Tax set-aside (income-tax) — recomputed whenever the tab gains focus so it
  //    reflects the latest loads + expenses feeding the estimate ──
  const [taxData, setTaxData] = useState<TaxSetAside>(() => getTaxSetAside());
  const [taxRate, setTaxRate] = useState<number>(() => Math.round(getTaxSetAside().rate * 100));

  useFocusEffect(useCallback(() => { setTaxData(getTaxSetAside()); }, []));

  const applyTaxRate = useCallback((r: number) => {
    setSetting('tax_rate', String(r));
    setTaxRate(r);
    setTaxData(getTaxSetAside());
  }, []);

  // ── Load existing values from user_expenses on mount ──
  useEffect(() => {
    const saved = getUserExpenses();

    const fixedRows: ExpenseEntry[] = FIXED_EXPENSES.map((f) => {
      const match = saved.find((e) => e.category === f.category);
      return {
        id:        match?.id ?? uuid(),
        label:     t(`onboarding.expenses.fixedLabels.${f.category}`),
        subtitle:  t(`onboarding.expenses.fixedSubtitles.${f.category}`),
        icon:      f.icon,
        category:  f.category,
        amount:    match ? String(match.amount) : '',
        frequency: (match?.frequency as ExpenseFrequency) ?? 'monthly',
      };
    });

    const otherRows: ExpenseEntry[] = saved
      .filter((e) => !FIXED_CATEGORIES.has(e.category))
      .map((e) => ({
        id:        e.id,
        label:     e.label,
        category:  e.category || 'other',
        amount:    String(e.amount),
        frequency: (e.frequency as ExpenseFrequency) ?? 'monthly',
      }));

    setFixed(fixedRows);
    setOthers(otherRows);

    const weekly = getWeeklyMiles();
    if (weekly > 0) setMonthlyMilesInput(String(Math.round(weekly * 4.333)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFixed(id: string, value: string) {
    setFixed((prev) => prev.map((e) => e.id === id ? { ...e, amount: value } : e));
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function selectFrequency(freq: ExpenseFrequency) {
    if (!freqTarget) return;
    if (freqTarget.kind === 'draft') {
      setDraft((prev) => ({ ...prev, frequency: freq }));
    } else {
      const { id } = freqTarget;
      setFixed((prev) => prev.map((e) => e.id === id ? { ...e, frequency: freq } : e));
    }
    setFreqTarget(null);
  }

  const activeFreq: ExpenseFrequency = !freqTarget
    ? 'monthly'
    : freqTarget.kind === 'draft'
      ? draft.frequency
      : fixed.find((e) => e.id === freqTarget.id)?.frequency ?? 'monthly';

  const draftValid = draft.label.trim().length > 0 && parseFloat(draft.amount) > 0;

  function commitDraft() {
    if (!draftValid) return;
    setOthers((prev) => [
      ...prev,
      { id: uuid(), label: draft.label.trim(), category: 'other', amount: draft.amount, frequency: draft.frequency },
    ]);
    setDraft(emptyDraft());
  }

  function removeOther(id: string) {
    setOthers((prev) => prev.filter((e) => e.id !== id));
  }

  function monthlyOf(amount: string, frequency: ExpenseFrequency): number {
    return toMonthlyAmount(parseFloat(amount) || 0, frequency);
  }

  function totalMonthly(): number {
    let sum = 0;
    for (const e of fixed)  sum += monthlyOf(e.amount, e.frequency);
    for (const e of others) sum += monthlyOf(e.amount, e.frequency);
    if (parseFloat(draft.amount) > 0) sum += monthlyOf(draft.amount, draft.frequency);
    return sum;
  }

  const total       = totalMonthly();
  const monthlyMiles = parseFloat(monthlyMilesInput) || 0;
  const fixedCPM    = monthlyMiles > 0 ? total / monthlyMiles : 0;

  function handleSave() {
    const collected: ExpenseEntry[] = [
      ...fixed.filter((e) => parseFloat(e.amount) > 0),
      ...others,
    ];
    if (draftValid) {
      collected.push({ id: uuid(), label: draft.label.trim(), category: 'other', amount: draft.amount, frequency: draft.frequency });
    }

    replaceUserExpenses(
      collected.map((e) => {
        const amt = parseFloat(e.amount) || 0;
        return {
          id:                 e.id,
          label:              e.label.trim(),
          category:           e.category,
          amount:             amt,
          frequency:          e.frequency,
          monthly_equivalent: toMonthlyAmount(amt, e.frequency),
        };
      })
    );

    if (monthlyMiles > 0) setMonthlyMiles(monthlyMiles);

    // Clear the consumed draft so it isn't double-counted on a second save.
    if (draftValid) setDraft(emptyDraft());

    // Back up to the cloud (local-first: never blocks the UI; no-op for guests).
    if (user) pushExpenses(user.id);

    haptics.success();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Reusable amount + frequency-dropdown row (plain function to preserve focus).
  function renderAmountRow({
    amount, onAmount, frequency, onOpenFreq, trailing,
  }: {
    amount: string;
    onAmount: (v: string) => void;
    frequency: ExpenseFrequency;
    onOpenFreq: () => void;
    trailing?: React.ReactNode;
  }) {
    return (
      <View style={styles.amountRow}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={onAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity style={styles.freqChip} onPress={onOpenFreq} activeOpacity={0.8}>
          <Text style={styles.freqText}>{freqLabel(frequency)}</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.primary} />
        </TouchableOpacity>
        {trailing}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerLabel}>{t('expenses.eyebrow')}</Text>
              <Text style={styles.headerTitle}>{t('expenses.title')}</Text>
              <AccentRule style={{ marginTop: 8 }} />
            </View>
          </View>

          {/* Fixed CPM hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{t('expenses.fixedCPM')}</Text>
            <Text style={[styles.heroNumber, fixedCPM > 0 && styles.heroNumberActive]}>
              ${fixedCPM.toFixed(3)}
            </Text>
            {total > 0 && monthlyMiles > 0 ? (
              <Text style={styles.heroSub}>
                ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('expenses.perMo')} ÷ {monthlyMiles.toLocaleString()} mi
              </Text>
            ) : (
              <Text style={styles.heroSub}>{t('expenses.heroEmpty')}</Text>
            )}
          </View>

          {/* ── Tax set-aside breakdown ── */}
          <Text style={styles.sectionTitle}>{t('expenses.tax.title')}</Text>
          <Text style={styles.sectionHint}>{t('expenses.tax.explainer')}</Text>
          <View style={styles.taxCard}>
            {/* Rate selector */}
            <View style={styles.taxRateRow}>
              <Text style={styles.taxRateLabel}>{t('expenses.tax.rateLabel')}</Text>
              <View style={styles.taxChips}>
                {[15, 20, 25, 30].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.taxChip, taxRate === r && styles.taxChipActive]}
                    onPress={() => applyTaxRate(r)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.taxChipText, taxRate === r && styles.taxChipTextActive]}>{r}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* This-quarter hero set-aside */}
            <View style={styles.taxHero}>
              <Text style={styles.taxHeroLabel}>{t('expenses.tax.quarterLabel')}</Text>
              <Text style={styles.taxHeroValue}>${taxData.quarterSetAside.toLocaleString('en-US')}</Text>
              <Text style={styles.taxHeroBase}>
                {t('expenses.tax.ofNet', { net: `$${taxData.quarterNet.toLocaleString('en-US')}` })}
              </Text>
            </View>

            {/* YTD row */}
            <View style={styles.taxYtdRow}>
              <Text style={styles.taxYtdLabel}>{t('expenses.tax.ytdLabel')}</Text>
              <Text style={styles.taxYtdValue}>
                ${taxData.ytdSetAside.toLocaleString('en-US')}
                <Text style={styles.taxYtdBase}> {t('expenses.tax.ofNet', { net: `$${taxData.ytdNet.toLocaleString('en-US')}` })}</Text>
              </Text>
            </View>

            <Text style={styles.taxDisclaimer}>{t('expenses.tax.disclaimer')}</Text>
          </View>

          {/* ── Essentials ── */}
          <Text style={styles.sectionTitle}>{t('onboarding.expenses.fixedSection')}</Text>
          <Text style={styles.sectionHint}>{t('onboarding.expenses.fixedHint')}</Text>

          <View style={styles.expenseList}>
            {fixed.map((expense) => {
              const monthly = monthlyOf(expense.amount, expense.frequency);
              const showEquiv = parseFloat(expense.amount) > 0 && expense.frequency !== 'monthly';
              return (
                <View key={expense.id} style={styles.expenseCard}>
                  <View style={styles.labelRow}>
                    <View style={styles.rowIcon}>
                      <Ionicons name={expense.icon ?? 'cash-outline'} size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.labelTextWrap}>
                      <Text style={styles.fixedLabel}>{expense.label}</Text>
                      {!!expense.subtitle && <Text style={styles.fixedSubtitle}>{expense.subtitle}</Text>}
                    </View>
                  </View>
                  <View style={styles.expenseDivider} />
                  {renderAmountRow({
                    amount: expense.amount,
                    onAmount: (v) => updateFixed(expense.id, v),
                    frequency: expense.frequency,
                    onOpenFreq: () => setFreqTarget({ kind: 'fixed', id: expense.id }),
                  })}
                  {showEquiv && <Text style={styles.monthlyEquiv}>= ${monthly.toFixed(2)}/mo</Text>}
                </View>
              );
            })}
          </View>

          {/* ── Other expenses ── */}
          <Text style={styles.sectionTitle}>{t('onboarding.expenses.otherSection')}</Text>
          <Text style={styles.sectionHint}>{t('onboarding.expenses.otherHint')}</Text>

          <View style={styles.expenseList}>
            {others.map((expense) => {
              const monthly = monthlyOf(expense.amount, expense.frequency);
              return (
                <View key={expense.id} style={styles.completedCard}>
                  <View style={styles.completedInfo}>
                    <Text style={styles.completedLabel}>{expense.label}</Text>
                    <Text style={styles.completedMeta}>
                      ${(parseFloat(expense.amount) || 0).toFixed(2)} · {freqLabel(expense.frequency)}
                      {expense.frequency !== 'monthly' ? ` · $${monthly.toFixed(2)}/mo` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeOther(expense.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Draft input row */}
            <View style={styles.expenseCard}>
              <View style={styles.labelRow}>
                <View style={styles.rowIcon}>
                  <Ionicons name="add-outline" size={18} color={Colors.primary} />
                </View>
                <TextInput
                  style={styles.labelInput}
                  value={draft.label}
                  onChangeText={(v) => updateDraft('label', v)}
                  placeholder={t('onboarding.expenses.otherPlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  returnKeyType="done"
                  onSubmitEditing={commitDraft}
                />
              </View>
              <View style={styles.expenseDivider} />
              {renderAmountRow({
                amount: draft.amount,
                onAmount: (v) => updateDraft('amount', v),
                frequency: draft.frequency,
                onOpenFreq: () => setFreqTarget({ kind: 'draft' }),
                trailing: (
                  <TouchableOpacity
                    style={[styles.addRowBtn, !draftValid && styles.addRowBtnDisabled]}
                    onPress={commitDraft}
                    disabled={!draftValid}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={22} color={draftValid ? Colors.background : Colors.textTertiary} />
                  </TouchableOpacity>
                ),
              })}
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !draftValid && styles.addBtnDisabled]}
              onPress={commitDraft}
              disabled={!draftValid}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color={draftValid ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.addBtnText, !draftValid && styles.addBtnTextDisabled]}>
                {t('onboarding.expenses.addOther')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Monthly miles ── */}
          <Text style={styles.sectionTitle}>{t('expenses.monthlyMiles')}</Text>
          <Text style={styles.sectionHint}>Your average miles per month — used to calculate cost per mile.</Text>
          <View style={styles.milesCard}>
            <Ionicons name="speedometer-outline" size={20} color={Colors.primary} />
            <TextInput
              style={styles.milesInput}
              value={monthlyMilesInput}
              onChangeText={setMonthlyMilesInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 10,000"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.milesSuffix}>{t('expenses.milesPerMo')}</Text>
          </View>

          {/* Total */}
          {total > 0 && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('expenses.totalMonthly')}</Text>
              <Text style={styles.totalValue}>
                ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <Text style={styles.totalSub}>{t('expenses.perMo')}</Text>
              </Text>
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSaved]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            {saved
              ? <><Ionicons name="checkmark" size={18} color={Colors.onPrimary} /><Text style={styles.saveBtnText}>{t('expenses.saved')}</Text></>
              : <Text style={styles.saveBtnText}>{t('expenses.save')}</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Frequency dropdown */}
      <Modal visible={!!freqTarget} transparent animationType="fade" onRequestClose={() => setFreqTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFreqTarget(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('onboarding.expenses.selectFrequency')}</Text>
            {FREQUENCIES.map((f) => {
              const selected = f === activeFreq;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqOption, selected && styles.freqOptionActive]}
                  onPress={() => selectFrequency(f)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.freqOptionText, selected && styles.freqOptionTextActive]}>{freqLabel(f)}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 16 },

  header: { paddingTop: 16, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: { ...sectionLabel(Colors), marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.primaryMid,
  },
  replayBtnText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.primary },

  heroCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 28,
  },
  heroLabel:        { ...sectionLabel(Colors), marginBottom: 10 },
  heroNumber:       { fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, color: Colors.textSecondary, lineHeight: 52, letterSpacing: -1, marginBottom: 4 },
  heroNumberActive: { color: Colors.primary },
  heroSub:          { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  sectionTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 4 },
  sectionHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 14, lineHeight: 18 },

  // ── Tax set-aside section ──
  taxCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 24,
  },
  taxRateRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  taxRateLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.2 },
  taxChips:     { flexDirection: 'row', gap: 6 },
  taxChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
  },
  taxChipActive:     { backgroundColor: Colors.secondaryDim, borderColor: Colors.secondary },
  taxChipText:       { fontFamily: FontFamily.monoBold, fontSize: FontSize.caption, color: Colors.textSecondary },
  taxChipTextActive: { color: Colors.secondary },

  taxHero:      { alignItems: 'center', paddingVertical: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 16 },
  taxHeroLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 9, color: Colors.labelColor, letterSpacing: 1.2, marginBottom: 6 },
  taxHeroValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.secondary, letterSpacing: -1 },
  taxHeroBase:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textTertiary, marginTop: 4 },

  taxYtdRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  taxYtdLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.2 },
  taxYtdValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary },
  taxYtdBase:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary },

  taxDisclaimer: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textTertiary, fontStyle: 'italic', lineHeight: 15 },

  expenseList: { gap: 12, marginBottom: 24 },
  expenseCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 4,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  labelTextWrap: { flex: 1 },
  fixedLabel:    { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  fixedSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 2 },
  labelInput:    { flex: 1, fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, paddingVertical: 0 },

  expenseDivider: { height: 1, backgroundColor: Colors.borderSubtle },
  amountRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dollarSign:  { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },
  amountInput: { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, paddingVertical: 0 },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border,
  },
  freqText:     { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },
  monthlyEquiv: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, paddingBottom: 12 },

  addRowBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  addRowBtnDisabled: { backgroundColor: Colors.surfaceHigh },

  completedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
  },
  completedInfo:  { flex: 1 },
  completedLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  completedMeta:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 16, borderStyle: 'dashed',
  },
  addBtnDisabled:     { opacity: 0.6 },
  addBtnText:         { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.primary },
  addBtnTextDisabled: { color: Colors.textTertiary },

  milesCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 24,
  },
  milesInput:  { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, paddingVertical: 0 },
  milesSuffix: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  totalCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 24,
  },
  totalLabel: { ...sectionLabel(Colors), fontSize: 10, marginBottom: 6 },
  totalValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -0.5 },
  totalSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  saveBtn: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  saveBtnSaved: { backgroundColor: Colors.success },
  saveBtnText:  { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.onPrimary, letterSpacing: 0.2 },

  // Frequency dropdown
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 14 },
  modalTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12 },
  freqOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  freqOptionActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  freqOptionText:       { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  freqOptionTextActive: { fontFamily: FontFamily.monoSemiBold, color: Colors.primary },
});
