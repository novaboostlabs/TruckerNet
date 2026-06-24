import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import db, { getUserExpenses } from '../../db/database';
import { toMonthlyAmount, ExpenseFrequency } from '../../utils/marketRates';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

interface Props { onNext: () => void; onBack: () => void; }

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

// Mandatory, pre-labeled expenses every owner-operator carries.
// Labels & subtitles resolve from i18n (fixedLabels / fixedSubtitles).
const FIXED_EXPENSES: { category: string; icon: IoniconName }[] = [
  { category: 'truck',       icon: 'car-outline'              },
  { category: 'insurance',   icon: 'shield-checkmark-outline' },
  { category: 'maintenance', icon: 'construct-outline'        },
  { category: 'eld',         icon: 'hardware-chip-outline'    },
  { category: 'loadboard',   icon: 'grid-outline'             },
  { category: 'parking',     icon: 'location-outline'         },
];

function emptyDraft(): Draft {
  return { label: '', amount: '', frequency: 'monthly' };
}

// Which row the frequency dropdown is currently editing.
type FreqTarget = { kind: 'fixed'; id: string } | { kind: 'draft' } | null;

export default function OnboardingExpensesScreen({ onNext, onBack }: Props) {
  const { t } = useTranslation();

  const freqLabel = (f: ExpenseFrequency) => t(`onboarding.expenses.frequencies.${f}`);

  // Pre-populate from saved user_expenses so Replay Setup edits existing data
  // rather than wiping it (blank-start was the cross-session conflict root cause).
  const [fixed, setFixed] = useState<ExpenseEntry[]>(() => {
    const saved = getUserExpenses();
    return FIXED_EXPENSES.map((f) => {
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
  });
  const [others, setOthers] = useState<ExpenseEntry[]>(() => {
    const fixedCats = new Set(FIXED_EXPENSES.map((f) => f.category));
    return getUserExpenses()
      .filter((e) => !fixedCats.has(e.category))
      .map((e) => ({
        id:        e.id,
        label:     e.label,
        category:  e.category || 'other',
        amount:    String(e.amount),
        frequency: (e.frequency as ExpenseFrequency) ?? 'monthly',
      }));
  });
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [freqTarget, setFreqTarget] = useState<FreqTarget>(null);

  function capAmount(raw: string): string {
    const n = parseFloat(raw);
    return (!isNaN(n) && n > 50000) ? '50000' : raw;
  }

  function updateFixed(id: string, value: string) {
    setFixed((prev) => prev.map((e) => e.id === id ? { ...e, amount: capAmount(value) } : e));
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: field === 'amount' ? capAmount(value) : value }));
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
      {
        id: uuid(),
        label: draft.label.trim(),
        category: 'other',
        amount: draft.amount,
        frequency: draft.frequency,
      },
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

  function handleNext() {
    // Everything the driver filled in, including a draft "Other" row they
    // typed but didn't explicitly add.
    const collected: ExpenseEntry[] = [
      ...fixed.filter((e) => parseFloat(e.amount) > 0),
      ...others,
    ];
    if (draftValid) {
      collected.push({
        id: uuid(),
        label: draft.label.trim(),
        category: 'other',
        amount: draft.amount,
        frequency: draft.frequency,
      });
    }

    // Always replace — even if collected is empty (user cleared everything).
    // Without this, old expenses survive if the user removes all entries on replay.
    db.runSync('DELETE FROM user_expenses');
    if (collected.length > 0) {
      const now = new Date().toISOString();
      for (let i = 0; i < collected.length; i++) {
        const e = collected[i];
        const amt = parseFloat(e.amount);
        const monthly = toMonthlyAmount(amt, e.frequency);
        db.runSync(
          `INSERT INTO user_expenses (id, label, category, amount, frequency, monthly_equivalent, is_active, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [e.id, e.label.trim(), e.category, amt, e.frequency, monthly, i, now]
        );
      }
    }
    onNext();
  }

  const total = totalMonthly();

  // A reusable amount + frequency-dropdown row. Called as a plain function
  // (not <JSX/>) so the inputs keep focus across re-renders.
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Progress */}
          <View style={styles.progressRow}>
            {[1,2,3,4].map((s) => (
              <View key={s} style={[styles.progressDot, s <= 2 && styles.progressDotActive]} />
            ))}
          </View>

          <Text style={styles.stepLabel}>{t('onboarding.step', { current: 2, total: 4 })}</Text>

          <View style={styles.iconCircle}>
            <Ionicons name="wallet" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>{t('onboarding.expenses.title')}</Text>
          <Text style={styles.subheading}>{t('onboarding.expenses.subtitle')}</Text>

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
                  {showEquiv && (
                    <Text style={styles.monthlyEquiv}>= ${monthly.toFixed(2)}/mo</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* ── Other expenses ── */}
          <Text style={styles.sectionTitle}>{t('onboarding.expenses.otherSection')}</Text>
          <Text style={styles.sectionHint}>{t('onboarding.expenses.otherHint')}</Text>

          <View style={styles.expenseList}>
            {/* Completed "Other" entries stacked above the input */}
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
                  <TouchableOpacity
                    onPress={() => removeOther(expense.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* The always-present draft input row */}
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

          {/* Total */}
          {total > 0 && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('onboarding.expenses.totalMonthly')}</Text>
              <Text style={styles.totalValue}>${total.toFixed(0)}<Text style={styles.totalSub}>{t('onboarding.expenses.perMo')}</Text></Text>
            </View>
          )}

          {/* Next */}
          <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('common.next')}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Frequency dropdown */}
      <Modal
        visible={!!freqTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setFreqTarget(null)}
      >
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
                  <Text style={[styles.freqOptionText, selected && styles.freqOptionTextActive]}>
                    {freqLabel(f)}
                  </Text>
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

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 16 },

  backBtn: { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive: { backgroundColor: Colors.primary },
  stepLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 32 },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  heading:    { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 10 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },

  sectionTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 4 },
  sectionHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 14, lineHeight: 18 },

  expenseList: { gap: 12, marginBottom: 24 },
  expenseCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 4,
  },
  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  labelTextWrap: { flex: 1 },
  fixedLabel:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  fixedSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 2 },
  labelInput:    { flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, paddingVertical: 0 },

  expenseDivider: { height: 1, backgroundColor: Colors.borderSubtle },
  amountRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dollarSign:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },
  amountInput: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, paddingVertical: 0 },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border,
  },
  freqText:     { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },
  monthlyEquiv: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, paddingBottom: 12 },

  addRowBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addRowBtnDisabled: { backgroundColor: Colors.surfaceHigh },

  completedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14,
  },
  completedInfo:  { flex: 1 },
  completedLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  completedMeta:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 16, borderStyle: 'dashed',
  },
  addBtnDisabled:     { opacity: 0.6 },
  addBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.primary },
  addBtnTextDisabled: { color: Colors.textTertiary },

  totalCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.lg, padding: Spacing.cardPad, marginBottom: 24,
  },
  totalLabel: { ...SectionLabel, fontSize: 10, marginBottom: 6 },
  totalValue: { fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -0.5 },
  totalSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
  },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },

  // Frequency dropdown
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 14,
  },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12 },
  freqOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  freqOptionActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  freqOptionText:   { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  freqOptionTextActive: { fontFamily: FontFamily.semiBold, color: Colors.primary },
});
