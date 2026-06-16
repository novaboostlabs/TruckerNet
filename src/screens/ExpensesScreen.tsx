import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import db from '../db/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';

interface ExpensesForm {
  truckPayment:        string;
  insurance:           string;
  eldPayment:          string;
  maintenanceMonthly:  string;
  parkingMonthly:      string;
  otherExpenses:       string;
  estimatedMonthlyMiles: string;
}

const EMPTY_FORM: ExpensesForm = {
  truckPayment: '', insurance: '', eldPayment: '',
  maintenanceMonthly: '', parkingMonthly: '', otherExpenses: '',
  estimatedMonthlyMiles: '',
};

export default function ExpensesScreen() {
  const { user } = useAuth();
  const [form, setForm] = useState<ExpensesForm>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadSavedExpenses(); }, [user]);

  function loadSavedExpenses() {
    const row = db.getFirstSync<{
      truck_payment: number; insurance: number; eld_payment: number;
      maintenance_monthly: number; parking_monthly: number;
      other_expenses: number; estimated_monthly_miles: number;
    }>('SELECT * FROM fixed_expenses WHERE id = 1');

    if (row) {
      setForm({
        truckPayment:          row.truck_payment > 0 ? String(row.truck_payment) : '',
        insurance:             row.insurance > 0 ? String(row.insurance) : '',
        eldPayment:            row.eld_payment > 0 ? String(row.eld_payment) : '',
        maintenanceMonthly:    row.maintenance_monthly > 0 ? String(row.maintenance_monthly) : '',
        parkingMonthly:        row.parking_monthly > 0 ? String(row.parking_monthly) : '',
        otherExpenses:         row.other_expenses > 0 ? String(row.other_expenses) : '',
        estimatedMonthlyMiles: row.estimated_monthly_miles > 1 ? String(row.estimated_monthly_miles) : '',
      });
    }
  }

  function n(val: string): number {
    const parsed = parseFloat(val);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  function calcFixedCPM(): number {
    const total = n(form.truckPayment) + n(form.insurance) + n(form.eldPayment)
      + n(form.maintenanceMonthly) + n(form.parkingMonthly) + n(form.otherExpenses);
    const miles = n(form.estimatedMonthlyMiles);
    return miles <= 0 ? 0 : total / miles;
  }

  function totalMonthly(): number {
    return n(form.truckPayment) + n(form.insurance) + n(form.eldPayment)
      + n(form.maintenanceMonthly) + n(form.parkingMonthly) + n(form.otherExpenses);
  }

  function pct(val: string): string {
    const total = totalMonthly();
    if (total === 0) return '0%';
    return ((n(val) / total) * 100).toFixed(0) + '%';
  }

  async function saveExpenses() {
    const cpm = calcFixedCPM();
    db.runSync(
      `INSERT INTO fixed_expenses (id, truck_payment, insurance, eld_payment,
        maintenance_monthly, parking_monthly, other_expenses,
        estimated_monthly_miles, fixed_cost_per_mile)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         truck_payment = excluded.truck_payment, insurance = excluded.insurance,
         eld_payment = excluded.eld_payment, maintenance_monthly = excluded.maintenance_monthly,
         parking_monthly = excluded.parking_monthly, other_expenses = excluded.other_expenses,
         estimated_monthly_miles = excluded.estimated_monthly_miles,
         fixed_cost_per_mile = excluded.fixed_cost_per_mile`,
      [n(form.truckPayment), n(form.insurance), n(form.eldPayment),
       n(form.maintenanceMonthly), n(form.parkingMonthly), n(form.otherExpenses),
       n(form.estimatedMonthlyMiles), cpm]
    );

    if (user) {
      supabase.from('fixed_expenses').upsert({
        user_id: user.id,
        truck_payment: n(form.truckPayment), insurance: n(form.insurance),
        eld_payment: n(form.eldPayment), maintenance_monthly: n(form.maintenanceMonthly),
        parking_monthly: n(form.parkingMonthly), other_monthly: n(form.otherExpenses),
        estimated_monthly_miles: n(form.estimatedMonthlyMiles),
        fixed_cost_per_mile: cpm, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.warn('Supabase sync error:', error.message);
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const cpm   = calcFixedCPM();
  const total = totalMonthly();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerLabel}>SETTINGS</Text>
              <Text style={styles.headerTitle}>Expenses</Text>
            </View>
          </View>

          {/* CPM hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>FIXED COST PER MILE</Text>
            <Text style={[styles.heroNumber, cpm > 0 && styles.heroNumberActive]}>
              ${cpm.toFixed(3)}
            </Text>
            {total > 0 && (
              <Text style={styles.heroSub}>
                ${total.toLocaleString()} / mo ÷ {n(form.estimatedMonthlyMiles).toLocaleString()} mi
              </Text>
            )}
            {cpm === 0 && (
              <Text style={styles.heroSub}>Enter your expenses below to calculate</Text>
            )}
          </View>

          {/* Monthly expenses section */}
          <Text style={styles.sectionLabel}>MONTHLY EXPENSES</Text>
          <View style={styles.card}>
            {[
              { label: 'Truck Payment', key: 'truckPayment'       as keyof ExpensesForm },
              { label: 'Insurance',     key: 'insurance'           as keyof ExpensesForm },
              { label: 'ELD',           key: 'eldPayment'          as keyof ExpensesForm },
              { label: 'Maintenance',   key: 'maintenanceMonthly'  as keyof ExpensesForm },
              { label: 'Parking',       key: 'parkingMonthly'      as keyof ExpensesForm },
              { label: 'Other',         key: 'otherExpenses'       as keyof ExpensesForm },
            ].map(({ label, key }, i, arr) => (
              <React.Fragment key={key}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    {form[key].length > 0 && (
                      <View style={styles.pctPill}>
                        <Text style={styles.pctText}>{pct(form[key])}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.currencyPrefix}>$</Text>
                    <TextInput
                      style={styles.rowInput}
                      value={form[key]}
                      onChangeText={(v) => setForm({ ...form, [key]: v })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Miles section */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.section }]}>MONTHLY MILES</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Estimated Miles / Month</Text>
              <TextInput
                style={styles.rowInput}
                value={form.estimatedMonthlyMiles}
                onChangeText={(v) => setForm({ ...form, estimatedMonthlyMiles: v })}
                keyboardType="decimal-pad"
                placeholder="e.g. 10,000"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          {/* Breakdown */}
          {total > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: Spacing.section }]}>BREAKDOWN</Text>
              <View style={styles.card}>
                {[
                  { label: 'Truck Payment', val: form.truckPayment },
                  { label: 'Insurance',     val: form.insurance },
                  { label: 'ELD',           val: form.eldPayment },
                  { label: 'Maintenance',   val: form.maintenanceMonthly },
                  { label: 'Parking',       val: form.parkingMonthly },
                  { label: 'Other',         val: form.otherExpenses },
                ].filter(x => n(x.val) > 0).map(({ label, val }, i, arr) => (
                  <React.Fragment key={label}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{label}</Text>
                      <View style={styles.breakdownRight}>
                        <Text style={styles.breakdownPct}>{pct(val)}</Text>
                        <Text style={styles.breakdownAmount}>${n(val).toLocaleString()}</Text>
                      </View>
                    </View>
                    {i < arr.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total / Month</Text>
                  <Text style={styles.totalValue}>${total.toLocaleString()}</Text>
                </View>
              </View>
            </>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSaved]}
            onPress={saveExpenses}
            activeOpacity={0.85}
          >
            {saved
              ? <><Ionicons name="checkmark" size={18} color={Colors.background} /><Text style={styles.saveBtnText}>Saved</Text></>
              : <Text style={styles.saveBtnText}>Save Expenses</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  header: { paddingTop: 16, paddingBottom: 24 },
  headerLabel: { ...SectionLabel, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary },

  heroCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: Spacing.cardPad, marginBottom: 28,
  },
  heroLabel:        { ...SectionLabel, marginBottom: 10 },
  heroNumber:       { fontFamily: FontFamily.bold, fontSize: FontSize.hero, color: Colors.textSecondary, lineHeight: 52, letterSpacing: -1, marginBottom: 4 },
  heroNumberActive: { color: Colors.primary },
  heroSub:          { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  sectionLabel: { ...SectionLabel, marginBottom: 10 },

  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.cardPad, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  rowLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  pctPill: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pctText:   { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },
  rowRight:  { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, marginRight: 2 },
  rowInput: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.body,
    color: Colors.textPrimary, textAlign: 'right', minWidth: 80,
  },

  divider: { height: 1, backgroundColor: Colors.borderSubtle },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  breakdownLabel:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  breakdownRight:  { flexDirection: 'row', gap: 14, alignItems: 'center' },
  breakdownPct:    { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },
  breakdownAmount: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, minWidth: 72, textAlign: 'right' },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  totalLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  totalValue: { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.primary },

  saveBtn: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  saveBtnSaved: { backgroundColor: Colors.success },
  saveBtnText:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background, letterSpacing: 0.2 },
});
