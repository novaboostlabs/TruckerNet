import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import {
  addGeneralExpense, addSingleLoadExpense, getRecentLoads, LoadSummary,
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
}

function cap(raw: string, max: number): string {
  const n = parseFloat(raw);
  return (!isNaN(n) && n > max) ? String(max) : raw;
}

export default function AddExpenseScreen({ onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user } = useAuth();

  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState('repair');
  const [note,     setNote]     = useState('');
  const [date,     setDate]     = useState(() => new Date().toISOString().split('T')[0]);
  const [loadSel,  setLoadSel]  = useState<LoadSummary | null>(null);
  const [loadPickerOpen, setLoadPickerOpen] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const recentLoads = useMemo(() => getRecentLoads(15), []);
  const amt = parseFloat(amount) || 0;
  const canSave = amt > 0;

  const isToday = date === new Date().toISOString().split('T')[0];
  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString(getDateLocale(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  function shiftDate(days: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split('T')[0];
    if (iso <= new Date().toISOString().split('T')[0]) setDate(iso);
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

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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

          {/* Attach to load (optional) */}
          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>
            {t('addExpense.attachLabel')} <Text style={styles.optional}>({t('common.optional')})</Text>
          </Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setLoadPickerOpen(true)} activeOpacity={0.8}>
            <Ionicons name="cube-outline" size={18} color={loadSel ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.dropdownText, !loadSel && styles.dropdownPlaceholder]} numberOfLines={1}>
              {loadSel ? `${loadSel.pickup_city} → ${loadSel.delivery_city}` : t('addExpense.attachNone')}
            </Text>
            {loadSel && (
              <TouchableOpacity onPress={() => setLoadSel(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.attachHint}>{t('addExpense.attachHint')}</Text>

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

      {/* Load picker sheet */}
      <Modal visible={loadPickerOpen} transparent animationType="fade" onRequestClose={() => setLoadPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLoadPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('addExpense.attachLabel')}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {recentLoads.length === 0 ? (
                <Text style={styles.emptyLoads}>{t('addExpense.noLoads')}</Text>
              ) : recentLoads.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={styles.loadOption}
                  onPress={() => { setLoadSel(l); setLoadPickerOpen(false); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loadOptionRoute} numberOfLines={1}>{l.pickup_city} → {l.delivery_city}</Text>
                    <Text style={styles.loadOptionMeta}>{l.total_miles.toLocaleString()} mi</Text>
                  </View>
                  {loadSel?.id === l.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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

  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 15,
  },
  dropdownText: { flex: 1, fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  dropdownPlaceholder: { fontFamily: FontFamily.regular, color: Colors.textTertiary },
  attachHint: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 28,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  saveBtnDisabled:     { backgroundColor: Colors.surfaceHigh, shadowOpacity: 0, elevation: 0 },
  saveBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  saveBtnTextDisabled: { color: Colors.textTertiary },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 14 },
  modalTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.4 },
  modalScroll: { maxHeight: 360 },
  loadOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  loadOptionRoute: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  loadOptionMeta:  { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },
  emptyLoads: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, paddingVertical: 20, textAlign: 'center' },
});
