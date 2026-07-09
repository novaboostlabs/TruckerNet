import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import db, { getLatestOdometer, localDateISO } from '../db/database';
import { useAuth } from '../contexts/AuthContext';
import { pushFuel } from '../lib/sync/fuelSync';
import { scanFuelReceipt } from '../lib/ocr';
import { getDateLocale } from '../lib/i18n';
import { cancelFuelReminder } from '../lib/notifications';
import { capture } from '../lib/analytics';
import * as haptics from '../lib/haptics';
import GridBackground from '../components/GridBackground';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

const US_STATE_NAMES: [string, string][] = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];

interface Props {
  onSaved: () => void;
  onCancel: () => void;
  // When launched from a tapped History calendar day, the fill-up defaults to
  // that day rather than today.
  initialDate?: string;
}

export default function FuelEntryScreen({ onSaved, onCancel, initialDate }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user } = useAuth();

  const [dollarsSpent,    setDollarsSpent]    = useState('');
  const [gallons,         setGallons]         = useState('');
  const [odometer,        setOdometer]        = useState('');
  const [statePurchased,  setStatePurchased]  = useState('TX');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [scanning,        setScanning]        = useState(false);
  const [scanned,         setScanned]         = useState(false);

  const [lastOdometer, setLastOdometer] = useState(0);
  const [fuelDate, setFuelDate] = useState(initialDate ?? localDateISO());

  useEffect(() => {
    const last = getLatestOdometer();
    setLastOdometer(last);
  }, []);

  function shiftFuelDate(days: number) {
    const d = new Date(fuelDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const next = localDateISO(d);
    if (next > localDateISO()) return; // no future fill-ups
    setFuelDate(next);
  }
  const isToday = fuelDate === localDateISO();
  const fuelDateDisplay = new Date(fuelDate + 'T12:00:00').toLocaleDateString(getDateLocale(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

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
      Alert.alert(t('fuel.form.missingInfoTitle'), t('fuel.form.missingInfo'));
      return;
    }
    if (dollars > 2000) {
      Alert.alert(t('fuel.form.checkAmountTitle'), t('fuel.form.checkAmount'));
      return;
    }
    if (gals > 500) {
      Alert.alert(t('fuel.form.checkGallonsTitle'), t('fuel.form.checkGallons'));
      return;
    }
    if (odomReading > 2_000_000) {
      Alert.alert(t('fuel.form.checkOdometerTitle'), t('fuel.form.checkOdometerHigh'));
      return;
    }
    if (odomReading <= lastOdometer && lastOdometer > 0) {
      Alert.alert(t('fuel.form.checkOdometerTitle'), t('fuel.form.checkOdometerLow', { miles: lastOdometer.toLocaleString() }));
      return;
    }

    setSaving(true);
    try {
      db.runSync(
        `INSERT INTO fuel_entries (id, date, dollars_spent, gallons, miles_driven, cost_per_mile, price_per_gallon, mpg, odometer_reading, state_purchased)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          fuelDate,
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
      capture('fuel_logged', { dollars, gallons: gals, state: statePurchased, mpg });
      // Back up to the cloud (local-first: never blocks the UI; no-op for guests).
      if (user) pushFuel(user.id);
      // Fill-up logged — cancel tonight's reminder so the driver isn't nagged.
      cancelFuelReminder().catch(() => {});
      haptics.success();
      onSaved();
    } catch (e) {
      console.error('Error saving fuel entry:', e);
      haptics.error();
      Alert.alert(t('fuel.form.saveErrorTitle'), t('fuel.form.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function runScan(source: 'camera' | 'library') {
    setScanning(true);
    try {
      const res = await scanFuelReceipt(source);
      if (!res.ok) {
        if (res.error === 'cancelled') return;
        const map = {
          permission:      ['permissionTitle', 'permissionMsg'],
          not_configured:  ['notAvailableTitle', 'notAvailableMsg'],
          failed:          ['failedTitle', 'failedMsg'],
        } as const;
        const [titleKey, msgKey] = map[res.error];
        Alert.alert(t(`fuel.form.scan.${titleKey}`), t(`fuel.form.scan.${msgKey}`));
        return;
      }
      // Auto-fill what we got; the user reviews before saving.
      const { dollars, gallons, pricePerGallon, state } = res.data;
      if (dollars != null) setDollarsSpent(String(dollars));
      // Derive gallons from $ ÷ price if the receipt only showed price/gal.
      if (gallons != null) setGallons(String(gallons));
      else if (dollars != null && pricePerGallon) setGallons((dollars / pricePerGallon).toFixed(2));
      if (state && US_STATE_NAMES.some(([a]) => a === state)) setStatePurchased(state);
      setScanned(true);
    } catch {
      Alert.alert(t('fuel.form.scan.failedTitle'), t('fuel.form.scan.failedMsg'));
    } finally {
      setScanning(false);
    }
  }

  function handleScan() {
    Alert.alert(
      t('fuel.form.scan.chooseTitle'),
      t('fuel.form.scan.chooseMessage'),
      [
        { text: t('fuel.form.scan.takePhoto'),     onPress: () => runScan('camera') },
        { text: t('fuel.form.scan.chooseLibrary'), onPress: () => runScan('library') },
        { text: t('common.cancel'),                style: 'cancel' },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('fuel.logFillup')}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Scan receipt */}
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
            onPress={handleScan}
            disabled={scanning}
            activeOpacity={0.85}
          >
            <Ionicons
              name={scanning ? 'hourglass-outline' : 'scan-outline'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.scanBtnText}>
              {scanning ? t('fuel.form.scan.scanning') : t('fuel.form.scan.scanButton')}
            </Text>
          </TouchableOpacity>

          {scanned && !scanning && (
            <View style={styles.scanHint}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
              <Text style={styles.scanHintText}>{t('fuel.form.scan.scannedHint')}</Text>
            </View>
          )}

          {/* Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('fuel.form.detailsSection')}</Text>
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
                  <Text style={styles.suffix}>{t('fuel.form.galUnit')}</Text>
                </View>
              </Field>

              {/* Price per gallon live calc */}
              {pricePerGallon > 0 && (
                <Text style={styles.liveCalc}>{t('fuel.form.perGallonLive', { price: pricePerGallon.toFixed(3) })}</Text>
              )}
            </View>
          </View>

          {/* Odometer */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('fuel.form.odometerSection')}</Text>
            <View style={styles.card}>
              <Field label={t('fuel.form.currentMiles')} required>
                <View style={styles.suffixRow}>
                  <TextInput
                    style={[styles.fieldInput, { textAlign: 'right' }]}
                    value={odometer}
                    onChangeText={setOdometer}
                    keyboardType="number-pad"
                    placeholder="487,892"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Text style={styles.suffix}>{t('fuel.form.miUnit')}</Text>
                </View>
              </Field>

              {lastOdometer > 0 && (
                <View style={styles.odometerHint}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.odometerHintText}>
                    {t('fuel.form.lastRecorded', { miles: lastOdometer.toLocaleString() })}
                    {milesDriven > 0 && t('fuel.form.milesDrivenNote', { driven: milesDriven.toLocaleString() })}
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

          {/* State picker Modal */}
          <Modal
            visible={showStatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowStatePicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowStatePicker(false)}
            >
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{t('fuel.form.statePickerTitle')}</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                  {US_STATE_NAMES.map(([abbr, name]) => (
                    <TouchableOpacity
                      key={abbr}
                      style={[styles.stateRow, abbr === statePurchased && styles.stateRowActive]}
                      onPress={() => { setStatePurchased(abbr); setShowStatePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stateRowName, abbr === statePurchased && styles.stateRowNameActive]}>
                        {name}
                      </Text>
                      <Text style={[styles.stateRowAbbr, abbr === statePurchased && styles.stateRowAbbrActive]}>
                        {abbr}
                      </Text>
                      {abbr === statePurchased && (
                        <Ionicons name="checkmark" size={16} color={Colors.primary} style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 32 }} />
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* State */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('fuel.form.state')}</Text>
            <TouchableOpacity
              style={styles.stateSelector}
              onPress={() => setShowStatePicker(true)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.stateSelectorText}>
                  {US_STATE_NAMES.find(([a]) => a === statePurchased)?.[1] ?? statePurchased}
                </Text>
                <Text style={styles.stateSelectorAbbr}>{statePurchased}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Live calculations */}
          {(costPerMile > 0 || mpg > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('fuel.form.calculationsSection')}</Text>
              <View style={styles.calcCard}>
                {costPerMile > 0 && (
                  <CalcRow label={t('fuel.form.calculations.costPerMile')} value={`$${costPerMile.toFixed(3)}`} highlight />
                )}
                {mpg > 0 && (
                  <CalcRow label={t('fuel.form.calculations.mpg')} value={`${mpg.toFixed(1)} MPG`} />
                )}
                {milesDriven > 0 && (
                  <CalcRow label={t('fuel.form.calculations.milesDriven')} value={`${milesDriven.toLocaleString()} mi`} />
                )}
                {pricePerGallon > 0 && (
                  <CalcRow label={t('fuel.form.calculations.pricePerGallon')} value={`$${pricePerGallon.toFixed(3)}`} />
                )}
              </View>
            </View>
          )}

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('addLoad.date')}</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateArrow} onPress={() => shiftFuelDate(-1)} activeOpacity={0.6}>
                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.dateCenter}>
                <Text style={styles.dateText}>{fuelDateDisplay}</Text>
                {isToday ? (
                  <View style={styles.dateTodayBadge}>
                    <Text style={styles.dateTodayBadgeText}>{t('addLoad.today')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setFuelDate(localDateISO())} activeOpacity={0.7}>
                    <Text style={styles.dateTodayLink}>{t('addLoad.backToToday')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.dateArrow} onPress={() => shiftFuelDate(1)} disabled={isToday} activeOpacity={0.6}>
                <Ionicons name="chevron-forward" size={20} color={isToday ? Colors.textTertiary : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color={Colors.onPrimary} />
            <Text style={styles.saveBtnText}>
              {saving ? t('common.saving') : t('fuel.form.save')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors: Colors } = useTheme();
  const fieldStyles = useMemo(() => makeFieldStyles(Colors), [Colors]);
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
  const { colors: Colors } = useTheme();
  const calcStyles = useMemo(() => makeCalcStyles(Colors), [Colors]);
  return (
    <View style={calcStyles.row}>
      <Text style={calcStyles.label}>{label}</Text>
      <Text style={[calcStyles.value, highlight && calcStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 16, paddingBottom: 24,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, paddingVertical: 15,
    marginBottom: 16,
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.primary },
  scanHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: -6, marginBottom: 18, paddingHorizontal: 2,
  },
  scanHintText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 17 },

  section:      { marginBottom: 20 },
  sectionLabel: { ...sectionLabel(Colors), marginBottom: 10 },

  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.cardPad,
  },
  divider: { height: 1, backgroundColor: Colors.borderSubtle },

  prefixRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  suffixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  prefix:    { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },
  suffix:    { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, minWidth: 32 },
  fieldInput: { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

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
    borderRadius: Radius.md, paddingHorizontal: Spacing.cardPad, paddingVertical: 14,
  },
  stateSelectorText: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  stateSelectorAbbr: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 16, maxHeight: '75%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textPrimary,
    marginBottom: 12, paddingHorizontal: 4,
  },
  stateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  stateRowActive:     { backgroundColor: Colors.primaryDim, borderRadius: Radius.sm, paddingHorizontal: 8 },
  stateRowName:       { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  stateRowNameActive: { color: Colors.primary, fontFamily: FontFamily.monoSemiBold },
  stateRowAbbr:       { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginRight: 4 },
  stateRowAbbrActive: { color: Colors.primary },

  calcCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden',
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.onPrimary },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6,
  },
  dateArrow:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  dateCenter: { flex: 1, alignItems: 'center', gap: 3 },
  dateText:   { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  dateTodayBadge: {
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  dateTodayBadgeText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary },
  dateTodayLink:      { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.primary },
});

const makeFieldStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { paddingVertical: 14 },
  label:     { ...sectionLabel(Colors), fontSize: 10, marginBottom: 8 },
  required:  { color: Colors.danger },
});

const makeCalcStyles = (Colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: Spacing.cardPad,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  label:          { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  value:          { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  valueHighlight: { color: Colors.primary, fontFamily: FontFamily.monoBold },
});
