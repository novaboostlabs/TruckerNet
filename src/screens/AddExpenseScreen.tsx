import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import {
  addGeneralExpense, addSingleLoadExpense, getLoadForExpenseDate, LoadSummary, localDateISO,
} from '../db/database';
import { useAuth } from '../contexts/AuthContext';
import { pushLoads } from '../lib/sync/loadsSync';
import { pushGeneralExpenses } from '../lib/sync/generalExpensesSync';
import { capture } from '../lib/analytics';
import * as haptics from '../lib/haptics';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: { key: string; icon: IconName }[] = [
  { key: 'repair',      icon: 'construct-outline' },
  { key: 'parking',     icon: 'car-outline' },
  { key: 'fine',        icon: 'alert-circle-outline' },
  { key: 'maintenance', icon: 'build-outline' },
  { key: 'supplies',    icon: 'cube-outline' },
  { key: 'other',       icon: 'ellipsis-horizontal-outline' },
];

interface Props {
  onClose: () => void;
  onSaved: () => void;
  // When launched from a tapped History calendar day, the expense defaults to
  // that day rather than today.
  initialDate?: string;
}

function cap(raw: string, max: number): string {
  const n = parseFloat(raw);
  return (!isNaN(n) && n > max) ? String(max) : raw;
}

export default function AddExpenseScreen({ onClose, onSaved, initialDate }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user } = useAuth();

  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState('repair');
  const [note,     setNote]     = useState('');
  const [date,     setDate]     = useState(() => initialDate ?? localDateISO());
  // Opt-in link to the load this expense belongs to. We suggest exactly one
  // load (the most recent on/before this date) instead of a long all-time list.
  const [linkLoad, setLinkLoad] = useState(false);
  const [saving,   setSaving]   = useState(false);

  // The single most-likely load for this expense's date. Recomputes as the date
  // changes so the suggestion always matches the day the driver is logging for.
  const suggestedLoad = useMemo<LoadSummary | null>(() => getLoadForExpenseDate(date), [date]);
  const loadSel = linkLoad ? suggestedLoad : null;
  const amt = parseFloat(amount) || 0;
  const canSave = amt > 0;

  const isToday = date === localDateISO();
  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString(getDateLocale(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  function shiftDate(days: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const iso = localDateISO(d);
    if (iso <= localDateISO()) setDate(iso);
  }

  function handleSave() {
    if (!canSave) {
      Alert.alert(t('addExpense.missingTitle'), t('addExpense.missingBody'));
      return;
    }
    setSaving(true);
    try {
      const label = note.trim() || t(`addExpense.cats.${category}`);
      if (loadSel) {
        // Attached → reduces that load's net (and ripples to week/month).
        addSingleLoadExpense(loadSel.id, { label, category, amount: amt });
        if (user) pushLoads(user.id);
      } else {
        // Standalone → reduces the period (week/month) net directly.
        addGeneralExpense({ label, category, amount: amt, date });
        if (user) pushGeneralExpenses(user.id);
      }
      capture('expense_added', { category, amount: amt, attached: !!loadSel });
      haptics.success();
      onSaved();
      onClose();
    } catch {
      haptics.error();
      Alert.alert(t('addExpense.saveErrorTitle'), t('addExpense.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('addExpense.eyebrow')}</Text>
            <Text style={styles.title}>{t('addExpense.title')}</Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

          {/* Amount */}
          <Text style={styles.fieldLabel}>{t('addExpense.amountLabel')}</Text>
          <View style={styles.inputCard}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.bigInput}
              value={amount}
              onChangeText={(v) => setAmount(cap(v, 100000))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
          </View>

          {/* Category */}
          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>{t('addExpense.categoryLabel')}</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const sel = c.key === category;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, sel && styles.catChipActive]}
                  onPress={() => setCategory(c.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={c.icon} size={16} color={sel ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.catChipText, sel && styles.catChipTextActive]}>
                    {t(`addExpense.cats.${c.key}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>
            {t('addExpense.noteLabel')} <Text style={styles.optional}>({t('common.optional')})</Text>
          </Text>
          <TextInput
            style={styles.textField}
            value={note}
            onChangeText={setNote}
            placeholder={t('addExpense.notePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
          />

          {/* Date */}
          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>{t('addExpense.dateLabel')}</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDate(-1)} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.dateText}>{dateDisplay}</Text>
            <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDate(1)} disabled={isToday} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={20} color={isToday ? Colors.textTertiary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Attach to load (optional) — we suggest the one load this expense
              most likely belongs to (most recent on/before this date) and let
              the driver opt in with a tap, instead of scrolling an all-time list. */}
          {suggestedLoad && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 22 }]}>
                {t('addExpense.attachLabel')} <Text style={styles.optional}>({t('common.optional')})</Text>
              </Text>
              <TouchableOpacity
                style={[styles.linkRow, linkLoad && styles.linkRowActive]}
                onPress={() => setLinkLoad(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={linkLoad ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={linkLoad ? Colors.primary : Colors.textTertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkRoute} numberOfLines={1}>
                    {suggestedLoad.pickup_city} → {suggestedLoad.delivery_city}
                  </Text>
                  <Text style={styles.linkMeta}>
                    {t('addExpense.linkSuggestion', { miles: Math.round(suggestedLoad.total_miles).toLocaleString() })}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.attachHint}>
                {linkLoad ? t('addExpense.linkHintOn') : t('addExpense.linkHintOff')}
              </Text>
            </>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={20} color={canSave ? Colors.onPrimary : Colors.textTertiary} />
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>{t('addExpense.save')}</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.screenH, paddingTop: 12, paddingBottom: 16,
  },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 4 },
  title:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, letterSpacing: -0.4 },
  closeBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  fieldLabel: { ...sectionLabel(Colors), marginBottom: 10 },
  optional:   { fontFamily: FontFamily.regular, fontSize: FontSize.micro, color: Colors.textTertiary, letterSpacing: 0.5, textTransform: 'none' },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 14,
  },
  dollarSign: { fontFamily: FontFamily.monoSemiBold, fontSize: 28, color: Colors.textSecondary, marginRight: 6 },
  bigInput:   { flex: 1, fontFamily: FontFamily.monoBold, fontSize: 28, color: Colors.textPrimary, padding: 0 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 10,
  },
  catChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  catChipText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textSecondary, letterSpacing: 0.2 },
  catChipTextActive: { color: Colors.primary },

  textField: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6,
  },
  dateArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  dateText:  { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
  },
  linkRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  linkRoute: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  linkMeta:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  attachHint: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 28,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  saveBtnDisabled:     { backgroundColor: Colors.surfaceHigh, shadowOpacity: 0, elevation: 0 },
  saveBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  saveBtnTextDisabled: { color: Colors.textTertiary },
});
