import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import db, { getLatestOdometer } from '../db/database';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

interface Props {
  onSaved: () => void;
  onCancel: () => void;
}

export default function FuelEntryScreen({ onSaved, onCancel }: Props) {
  const { t } = useTranslation();

  const [dollarsSpent,    setDollarsSpent]    = useState('');
  const [gallons,         setGallons]         = useState('');
  const [odometer,        setOdometer]        = useState('');
  const [statePurchased,  setStatePurchased]  = useState('TX');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [saving,          setSaving]          = useState(false);

  const [lastOdometer, setLastOdometer] = useState(0);

  useEffect(() => {
    const last = getLatestOdometer();
    setLastOdometer(last);
  }, []);

  // Live calculations
  const dollars   = parseFloat(dollarsSpent) || 0;
  const gals      = parseFloat(gallons)      || 0;
  const odomReading = parseFloat(odometer.replace(/,/g, '')) || 0;

  const milesDriven    = lastOdometer > 0 && odomReading > lastOdometer
    ? odomReading - lastOdometer : 0;
  const pricePerGallon = gals > 0 ? dollars / gals : 0;
  const mpg            = gals > 0 && milesDriven > 0 ? milesDriven / gals : 0;
  const costPerMile    = milesDriven > 0 ? dollars / milesDriven : 0;

  const canSave = dollars > 0 && gals > 0 && odomReading > 0;

  function handleSave() {
    if (!canSave) {
      Alert.alert('Missing info', 'Please enter amount spent, gallons, and your current odometer reading.');
      return;
    }
    if (odomReading <= lastOdometer && lastOdometer > 0) {
      Alert.alert('Check odometer', `Your last recorded reading was ${lastOdometer.toLocaleString()} mi. New reading must be higher.`);
      return;
    }

    setSaving(true);
    try {
      db.runSync(
        `INSERT INTO fuel_entries (id, date, dollars_spent, gallons, miles_driven, cost_per_mile, price_per_gallon, mpg, odometer_reading, state_purchased)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          new Date().toISOString().split('T')[0],
          dollars,
          gals,
          milesDriven,
          costPerMile,
          pricePerGallon,
          mpg,
          odomReading,
          statePurchased,
        ]
      );
      onSaved();
    } catch (e) {
      console.error('Error saving fuel entry:', e);
      Alert.alert('Error', 'Could not save fuel entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Log Fill-up</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FILL-UP DETAILS</Text>
            <View style={styles.card}>

              {/* Dollars spent */}
              <Field label={t('fuel.form.dollarsSpent')} required>
                <View style={styles.prefixRow}>
                  <Text style={styles.prefix}>$</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dollarsSpent}
                    onChangeText={setDollarsSpent}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </Field>

              <View style={styles.divider} />

              {/* Gallons */}
              <Field label={t('fuel.form.gallons')} required>
                <View style={styles.suffixRow}>
                  <TextInput
                    style={[styles.fieldInput, { textAlign: 'right' }]}
                    value={gallons}
                    onChangeText={setGallons}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Text style={styles.suffix}>gal</Text>
                </View>
              </Field>

              {/* Price per gallon live calc */}
              {pricePerGallon > 0 && (
                <Text style={styles.liveCalc}>= ${pricePerGallon.toFixed(3)} per gallon</Text>
              )}
            </View>
          </View>

          {/* Odometer */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ODOMETER READING</Text>
            <View style={styles.card}>
              <Field label="CURRENT MILES ON TRUCK" required>
                <View style={styles.suffixRow}>
                  <TextInput
                    style={[styles.fieldInput, { textAlign: 'right' }]}
                    value={odometer}
                    onChangeText={setOdometer}
                    keyboardType="number-pad"
                    placeholder="487,892"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Text style={styles.suffix}>mi</Text>
                </View>
              </Field>

              {lastOdometer > 0 && (
                <View style={styles.odometerHint}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.odometerHintText}>
                    Last recorded: {lastOdometer.toLocaleString()} mi
                    {milesDriven > 0 && ` — ${milesDriven.toLocaleString()} miles driven`}
                  </Text>
                </View>
              )}
              {lastOdometer === 0 && (
                <Text style={styles.odometerFirst}>
                  {t('fuel.form.odometerFirst')}
                </Text>
              )}
            </View>
          </View>

          {/* State */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STATE PURCHASED</Text>
            <TouchableOpacity
              style={styles.stateSelector}
              onPress={() => setShowStatePicker(!showStatePicker)}
              activeOpacity={0.8}
            >
              <Text style={styles.stateSelectorText}>{statePurchased}</Text>
              <Ionicons
                name={showStatePicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>

            {showStatePicker && (
              <View style={styles.stateGrid}>
                {US_STATES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.stateChip, s === statePurchased && styles.stateChipActive]}
                    onPress={() => { setStatePurchased(s); setShowStatePicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stateChipText, s === statePurchased && styles.stateChipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Live calculations */}
          {(costPerMile > 0 || mpg > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CALCULATIONS</Text>
              <View style={styles.calcCard}>
                {costPerMile > 0 && (
                  <CalcRow label="Cost per mile" value={`$${costPerMile.toFixed(3)}`} highlight />
                )}
                {mpg > 0 && (
                  <CalcRow label="Miles per gallon" value={`${mpg.toFixed(1)} MPG`} />
                )}
                {milesDriven > 0 && (
                  <CalcRow label="Miles driven" value={`${milesDriven.toLocaleString()} mi`} />
                )}
                {pricePerGallon > 0 && (
                  <CalcRow label="Price per gallon" value={`$${pricePerGallon.toFixed(3)}`} />
                )}
              </View>
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color={Colors.background} />
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : t('fuel.form.save')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>
        {label}
        {required && <Text style={fieldStyles.required}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function CalcRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={calcStyles.row}>
      <Text style={calcStyles.label}>{label}</Text>
      <Text style={[calcStyles.value, highlight && calcStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 16, paddingBottom: 24,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  section:      { marginBottom: 20 },
  sectionLabel: { ...SectionLabel, marginBottom: 10 },

  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.cardPad,
  },
  divider: { height: 1, backgroundColor: Colors.borderSubtle },

  prefixRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  suffixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  prefix:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },
  suffix:    { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, minWidth: 32 },
  fieldInput: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  liveCalc: {
    fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary,
    paddingHorizontal: 0, paddingBottom: 12,
  },

  odometerHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 14,
  },
  odometerHintText: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, flex: 1 },
  odometerFirst:    { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, paddingBottom: 14 },

  stateSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.cardPad, paddingVertical: 16,
  },
  stateSelectorText: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  stateGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 12,
  },
  stateChip: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh,
  },
  stateChipActive:    { backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid },
  stateChipText:      { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  stateChipTextActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  calcCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
});

const fieldStyles = StyleSheet.create({
  container: { paddingVertical: 14 },
  label:     { ...SectionLabel, fontSize: 10, marginBottom: 8 },
  required:  { color: Colors.danger },
});

const calcStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: Spacing.cardPad,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  label:          { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  value:          { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  valueHighlight: { color: Colors.primary, fontFamily: FontFamily.bold },
});
