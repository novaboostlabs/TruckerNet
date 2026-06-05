import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import db from '../db/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  CardStyle,
  SectionHeaderStyle,
} from '../theme/theme';

interface ExpensesForm {
  truckPayment: string;
  insurance: string;
  eldPayment: string;
  maintenanceMonthly: string;
  parkingMonthly: string;
  otherExpenses: string;
  estimatedMonthlyMiles: string;
}

const EMPTY_FORM: ExpensesForm = {
  truckPayment: '',
  insurance: '',
  eldPayment: '',
  maintenanceMonthly: '',
  parkingMonthly: '',
  otherExpenses: '',
  estimatedMonthlyMiles: '',
};

export default function ExpensesScreen() {
  const { user } = useAuth();
  const [form, setForm] = useState<ExpensesForm>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSavedExpenses();
  }, [user]);

  function loadSavedExpenses() {
    const row = db.getFirstSync<{
      truck_payment: number;
      insurance: number;
      eld_payment: number;
      maintenance_monthly: number;
      parking_monthly: number;
      other_expenses: number;
      estimated_monthly_miles: number;
    }>('SELECT * FROM fixed_expenses WHERE id = 1');

    if (row) {
      setForm({
        truckPayment: row.truck_payment > 0 ? String(row.truck_payment) : '',
        insurance: row.insurance > 0 ? String(row.insurance) : '',
        eldPayment: row.eld_payment > 0 ? String(row.eld_payment) : '',
        maintenanceMonthly: row.maintenance_monthly > 0 ? String(row.maintenance_monthly) : '',
        parkingMonthly: row.parking_monthly > 0 ? String(row.parking_monthly) : '',
        otherExpenses: row.other_expenses > 0 ? String(row.other_expenses) : '',
        estimatedMonthlyMiles: row.estimated_monthly_miles > 1 ? String(row.estimated_monthly_miles) : '',
      });
    }
  }

  function n(val: string): number {
    const parsed = parseFloat(val);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  function calcFixedCPM(): number {
    const totalMonthly =
      n(form.truckPayment) +
      n(form.insurance) +
      n(form.eldPayment) +
      n(form.maintenanceMonthly) +
      n(form.parkingMonthly) +
      n(form.otherExpenses);
    const miles = n(form.estimatedMonthlyMiles);
    if (miles <= 0) return 0;
    return totalMonthly / miles;
  }

  function totalMonthly(): number {
    return (
      n(form.truckPayment) +
      n(form.insurance) +
      n(form.eldPayment) +
      n(form.maintenanceMonthly) +
      n(form.parkingMonthly) +
      n(form.otherExpenses)
    );
  }

  function pct(val: string): string {
    const total = totalMonthly();
    if (total === 0) return '0%';
    return ((n(val) / total) * 100).toFixed(1) + '%';
  }

  async function saveExpenses() {
    const cpm = calcFixedCPM();

    // Always write to local SQLite first
    db.runSync(
      `INSERT INTO fixed_expenses (
        id, truck_payment, insurance, eld_payment,
        maintenance_monthly, parking_monthly, other_expenses,
        estimated_monthly_miles, fixed_cost_per_mile
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         truck_payment = excluded.truck_payment,
         insurance = excluded.insurance,
         eld_payment = excluded.eld_payment,
         maintenance_monthly = excluded.maintenance_monthly,
         parking_monthly = excluded.parking_monthly,
         other_expenses = excluded.other_expenses,
         estimated_monthly_miles = excluded.estimated_monthly_miles,
         fixed_cost_per_mile = excluded.fixed_cost_per_mile`,
      [
        n(form.truckPayment),
        n(form.insurance),
        n(form.eldPayment),
        n(form.maintenanceMonthly),
        n(form.parkingMonthly),
        n(form.otherExpenses),
        n(form.estimatedMonthlyMiles),
        cpm,
      ]
    );

    // Sync to Supabase if authenticated (fire and forget)
    if (user) {
      supabase
        .from('fixed_expenses')
        .upsert({
          user_id: user.id,
          truck_payment: n(form.truckPayment),
          insurance: n(form.insurance),
          eld_payment: n(form.eldPayment),
          maintenance_monthly: n(form.maintenanceMonthly),
          parking_monthly: n(form.parkingMonthly),
          other_monthly: n(form.otherExpenses),
          estimated_monthly_miles: n(form.estimatedMonthlyMiles),
          fixed_cost_per_mile: cpm,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.warn('Supabase sync error:', error.message);
        });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const cpm = calcFixedCPM();
  const total = totalMonthly();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Fixed Expenses</Text>
        <Text style={styles.screenSubtitle}>
          Monthly costs used to calculate your fixed cost per mile.
        </Text>

        <View style={styles.cpmCard}>
          <Text style={styles.cpmLabel}>FIXED COST PER MILE</Text>
          <Text style={[styles.cpmValue, cpm > 0 && styles.cpmValueActive]}>
            ${cpm.toFixed(3)}
          </Text>
          {total > 0 && (
            <Text style={styles.cpmSub}>
              ${total.toLocaleString()} / mo ÷{' '}
              {n(form.estimatedMonthlyMiles).toLocaleString()} mi
            </Text>
          )}
        </View>

        <Text style={SectionHeaderStyle}>Monthly Expenses</Text>

        <View style={styles.card}>
          <ExpenseRow label="Truck Payment"  value={form.truckPayment}       onChange={(v) => setForm({ ...form, truckPayment: v })}       pct={pct(form.truckPayment)} />
          <Divider />
          <ExpenseRow label="Insurance"      value={form.insurance}          onChange={(v) => setForm({ ...form, insurance: v })}          pct={pct(form.insurance)} />
          <Divider />
          <ExpenseRow label="ELD"            value={form.eldPayment}         onChange={(v) => setForm({ ...form, eldPayment: v })}         pct={pct(form.eldPayment)} />
          <Divider />
          <ExpenseRow label="Maintenance"    value={form.maintenanceMonthly} onChange={(v) => setForm({ ...form, maintenanceMonthly: v })} pct={pct(form.maintenanceMonthly)} />
          <Divider />
          <ExpenseRow label="Parking"        value={form.parkingMonthly}     onChange={(v) => setForm({ ...form, parkingMonthly: v })}     pct={pct(form.parkingMonthly)} />
          <Divider />
          <ExpenseRow label="Other"          value={form.otherExpenses}      onChange={(v) => setForm({ ...form, otherExpenses: v })}      pct={pct(form.otherExpenses)} />
        </View>

        <Text style={[SectionHeaderStyle, { marginTop: Spacing.sectionGap }]}>
          Estimated Monthly Miles
        </Text>

        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Miles / Month</Text>
            <TextInput
              style={styles.input}
              value={form.estimatedMonthlyMiles}
              onChangeText={(v) => setForm({ ...form, estimatedMonthlyMiles: v })}
              keyboardType="decimal-pad"
              placeholder="e.g. 10000"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        </View>

        {total > 0 && (
          <>
            <Text style={[SectionHeaderStyle, { marginTop: Spacing.sectionGap }]}>
              Breakdown
            </Text>
            <View style={styles.card}>
              {n(form.truckPayment) > 0      && <BreakdownRow label="Truck Payment" amount={n(form.truckPayment)}       pct={pct(form.truckPayment)} />}
              {n(form.insurance) > 0         && <BreakdownRow label="Insurance"     amount={n(form.insurance)}          pct={pct(form.insurance)} />}
              {n(form.eldPayment) > 0        && <BreakdownRow label="ELD"           amount={n(form.eldPayment)}         pct={pct(form.eldPayment)} />}
              {n(form.maintenanceMonthly) > 0 && <BreakdownRow label="Maintenance"  amount={n(form.maintenanceMonthly)} pct={pct(form.maintenanceMonthly)} />}
              {n(form.parkingMonthly) > 0    && <BreakdownRow label="Parking"       amount={n(form.parkingMonthly)}     pct={pct(form.parkingMonthly)} />}
              {n(form.otherExpenses) > 0     && <BreakdownRow label="Other"         amount={n(form.otherExpenses)}      pct={pct(form.otherExpenses)} />}
              <Divider />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total / Month</Text>
                <Text style={styles.totalValue}>${total.toLocaleString()}</Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saved && styles.saveButtonSaved]}
          onPress={saveExpenses}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{saved ? 'Saved ✓' : 'Save Expenses'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ExpenseRow({ label, value, onChange, pct }: {
  label: string; value: string; onChange: (v: string) => void; pct: string;
}) {
  return (
    <View style={styles.inputRow}>
      <View style={styles.inputLabelGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        {value.length > 0 && <Text style={styles.pctBadge}>{pct}</Text>}
      </View>
      <View style={styles.inputWithPrefix}>
        <Text style={styles.currencyPrefix}>$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textSecondary}
        />
      </View>
    </View>
  );
}

function BreakdownRow({ label, amount, pct }: { label: string; amount: number; pct: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownRight}>
        <Text style={styles.breakdownPct}>{pct}</Text>
        <Text style={styles.breakdownAmount}>${amount.toLocaleString()}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 16 },
  screenTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 26,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sectionGap,
  },
  cpmCard: {
    ...CardStyle,
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: Spacing.sectionGap,
  },
  cpmLabel: { ...SectionHeaderStyle, marginBottom: 8 },
  cpmValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.heroNumber,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cpmValueActive: { color: Colors.accent },
  cpmSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: { ...CardStyle, marginBottom: Spacing.gap },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  inputLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  inputLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  pctBadge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  inputWithPrefix: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  input: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    textAlign: 'right',
    minWidth: 90,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  breakdownLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  breakdownRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  breakdownPct: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  breakdownAmount: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    minWidth: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accent,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sectionGap,
  },
  saveButtonSaved: { backgroundColor: Colors.success },
  saveButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: '#0F0F0F',
  },
});
