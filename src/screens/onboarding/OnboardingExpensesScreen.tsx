import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import db from '../../db/database';
import { toMonthlyAmount, ExpenseFrequency } from '../../utils/marketRates';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

interface Props { onNext: () => void; }

interface ExpenseEntry {
  id: string;
  label: string;
  category: string;
  amount: string;
  frequency: ExpenseFrequency;
}

interface Draft {
  label: string;
  amount: string;
  frequency: ExpenseFrequency;
}

const FREQUENCIES: ExpenseFrequency[] = ['daily','weekly','biweekly','monthly','quarterly','semiannual','annual'];

const FREQ_LABELS: Record<ExpenseFrequency, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 wks',
  monthly: 'Monthly', quarterly: 'Quarterly', semiannual: '6 Months', annual: 'Annual',
};

// Mandatory, pre-labeled expenses every owner-operator carries.
// `tKey` resolves the display label; `category` is stored on the row.
const FIXED_EXPENSES: { category: string; tKey: string }[] = [
  { category: 'truck',       tKey: 'onboarding.expenses.financePayment'        },
  { category: 'insurance',   tKey: 'onboarding.expenses.suggestions.insurance' },
  { category: 'parking',     tKey: 'onboarding.expenses.suggestions.parking'   },
  { category: 'maintenance', tKey: 'onboarding.expenses.suggestions.maintenance' },
  { category: 'eld',         tKey: 'onboarding.expenses.suggestions.eld'       },
  { category: 'loadboard',   tKey: 'onboarding.expenses.suggestions.loadBoard' },
];

function nextFrequency(current: ExpenseFrequency): ExpenseFrequency {
  const idx = FREQUENCIES.indexOf(current);
  return FREQUENCIES[(idx + 1) % FREQUENCIES.length];
}

function emptyDraft(): Draft {
  return { label: '', amount: '', frequency: 'monthly' };
}

export default function OnboardingExpensesScreen({ onNext }: Props) {
  const { t } = useTranslation();

  const [fixed, setFixed] = useState<ExpenseEntry[]>(() =>
    FIXED_EXPENSES.map((f) => ({
      id: uuid(),
      label: t(f.tKey),
      category: f.category,
      amount: '',
      frequency: 'monthly' as ExpenseFrequency,
    }))
  );
  const [others, setOthers] = useState<ExpenseEntry[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  function updateFixed(id: string, field: 'amount', value: string) {
    setFixed((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  function cycleFixedFreq(id: string) {
    setFixed((prev) => prev.map((e) => e.id === id ? { ...e, frequency: nextFrequency(e.frequency) } : e));
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cycleDraftFreq() {
    setDraft((prev) => ({ ...prev, frequency: nextFrequency(prev.frequency) }));
  }

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
    // Pull together everything the driver actually filled in, including a
    // draft "Other" row they typed but didn't explicitly add.
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

    if (collected.length > 0) {
      // Replace any previously saved onboarding expenses (leave fuel alone).
      db.runSync(`DELETE FROM user_expenses WHERE category != 'fuel'`);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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
                  <Text style={styles.fixedLabel}>{expense.label}</Text>
                  <View style={styles.expenseDivider} />
                  <View style={styles.amountRow}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={expense.amount}
                      onChangeText={(v) => updateFixed(expense.id, 'amount', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                    />
                    <TouchableOpacity
                      style={styles.freqChip}
                      onPress={() => cycleFixedFreq(expense.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.freqText}>{FREQ_LABELS[expense.frequency]}</Text>
                      <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
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
                      ${(parseFloat(expense.amount) || 0).toFixed(2)} · {FREQ_LABELS[expense.frequency]}
                      {expense.frequency !== 'monthly' ? ` · $${monthly.toFixed(2)}/mo` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeOther(expense.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* The always-present draft input row */}
            <View style={styles.expenseCard}>
              <View style={styles.labelRow}>
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
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={draft.amount}
                  onChangeText={(v) => updateDraft('amount', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                />
                <TouchableOpacity
                  style={styles.freqChip}
                  onPress={cycleDraftFreq}
                  activeOpacity={0.8}
                >
                  <Text style={styles.freqText}>{FREQ_LABELS[draft.frequency]}</Text>
                  <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addRowBtn, !draftValid && styles.addRowBtnDisabled]}
                  onPress={commitDraft}
                  disabled={!draftValid}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color={draftValid ? Colors.background : Colors.textTertiary} />
                </TouchableOpacity>
              </View>
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
              <Text style={styles.totalLabel}>TOTAL MONTHLY EXPENSES</Text>
              <Text style={styles.totalValue}>${total.toFixed(0)}<Text style={styles.totalSub}>/mo</Text></Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 16 },

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

  expenseList: { gap: 10, marginBottom: 24 },
  expenseCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 4,
  },
  fixedLabel:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, paddingVertical: 12 },
  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  labelInput:  { flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  expenseDivider: { height: 1, backgroundColor: Colors.borderSubtle },
  amountRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  dollarSign:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },
  amountInput: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  freqText:     { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },
  monthlyEquiv: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, paddingBottom: 10 },

  addRowBtn: {
    width: 36, height: 36, borderRadius: 18,
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
});
