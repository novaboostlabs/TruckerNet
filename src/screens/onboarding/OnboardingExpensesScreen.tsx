import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import db, { setSetting } from '../../db/database';
import { toMonthlyAmount, ExpenseFrequency, FREQUENCY_TO_MONTHLY } from '../../utils/marketRates';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

interface Props { onNext: () => void; }

interface ExpenseEntry {
  id: string;
  label: string;
  amount: string;
  frequency: ExpenseFrequency;
}

const FREQUENCIES: ExpenseFrequency[] = ['daily','weekly','biweekly','monthly','quarterly','semiannual','annual'];

const FREQ_LABELS: Record<ExpenseFrequency, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 wks',
  monthly: 'Monthly', quarterly: 'Quarterly', semiannual: '6 Months', annual: 'Annual',
};

const SUGGESTIONS: { label: string; category: string }[] = [
  { label: 'Truck Payment',        category: 'truck'       },
  { label: 'Insurance',            category: 'insurance'   },
  { label: 'ELD (e.g. KeepTruckin)', category: 'eld'       },
  { label: 'Load Board (e.g. DAT)', category: 'loadboard'  },
  { label: 'Maintenance Fund',     category: 'maintenance' },
  { label: 'Truck Parking',        category: 'parking'     },
];

function makeEntry(label = ''): ExpenseEntry {
  return { id: uuid(), label, amount: '', frequency: 'monthly' };
}

export default function OnboardingExpensesScreen({ onNext }: Props) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([makeEntry()]);

  function addExpense(label = '') {
    setExpenses((prev) => [...prev, makeEntry(label)]);
  }

  function updateExpense(id: string, field: keyof ExpenseEntry, value: string) {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function cycleFequency(id: string, current: ExpenseFrequency) {
    const idx  = FREQUENCIES.indexOf(current);
    const next = FREQUENCIES[(idx + 1) % FREQUENCIES.length];
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, frequency: next } : e));
  }

  function totalMonthly(): number {
    return expenses.reduce((sum, e) => {
      const amt = parseFloat(e.amount) || 0;
      return sum + toMonthlyAmount(amt, e.frequency);
    }, 0);
  }

  function handleNext() {
    // Save valid expenses to DB
    const valid = expenses.filter((e) => e.label.trim() && parseFloat(e.amount) > 0);
    if (valid.length > 0) {
      // Clear existing onboarding expenses
      db.runSync(`DELETE FROM user_expenses WHERE category != 'fuel'`);
      for (let i = 0; i < valid.length; i++) {
        const e = valid[i];
        const amt = parseFloat(e.amount);
        const monthly = toMonthlyAmount(amt, e.frequency);
        db.runSync(
          `INSERT INTO user_expenses (id, label, category, amount, frequency, monthly_equivalent, is_active, sort_order, created_at)
           VALUES (?, ?, 'expense', ?, ?, ?, 1, ?, ?)`,
          [e.id, e.label.trim(), amt, e.frequency, monthly, i, new Date().toISOString()]
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

          {/* Suggestions */}
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s.label}
                style={styles.suggestionChip}
                onPress={() => addExpense(s.label)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={13} color={Colors.primary} />
                <Text style={styles.suggestionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Expense rows */}
          <View style={styles.expenseList}>
            {expenses.map((expense, idx) => (
              <View key={expense.id} style={styles.expenseCard}>
                {/* Label row */}
                <View style={styles.labelRow}>
                  <TextInput
                    style={styles.labelInput}
                    value={expense.label}
                    onChangeText={(v) => updateExpense(expense.id, 'label', v)}
                    placeholder="Expense name (e.g. Truck Payment)"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    onPress={() => removeExpense(expense.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.expenseDivider} />

                {/* Amount + frequency row */}
                <View style={styles.amountRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={expense.amount}
                    onChangeText={(v) => updateExpense(expense.id, 'amount', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={styles.freqChip}
                    onPress={() => cycleFequency(expense.id, expense.frequency)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.freqText}>{FREQ_LABELS[expense.frequency]}</Text>
                    <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Monthly equivalent */}
                {parseFloat(expense.amount) > 0 && expense.frequency !== 'monthly' && (
                  <Text style={styles.monthlyEquiv}>
                    = ${toMonthlyAmount(parseFloat(expense.amount), expense.frequency).toFixed(2)}/mo
                  </Text>
                )}
              </View>
            ))}

            {/* Add expense button */}
            <TouchableOpacity style={styles.addBtn} onPress={() => addExpense()} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addBtnText}>{t('onboarding.expenses.addExpense')}</Text>
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

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.primaryMid,
  },
  suggestionText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },

  expenseList: { gap: 10, marginBottom: 20 },
  expenseCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 4,
  },
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

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 16, borderStyle: 'dashed',
  },
  addBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.primary },

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
