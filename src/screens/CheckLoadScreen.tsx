import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Switch, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import { calcBreakEven } from '../db/database';
import {
  getFairMarketRate, calcDeadheadCost, LoadType,
} from '../utils/marketRates';

interface Props {
  onClose: () => void;
  onLogLoad?: () => void;
}

const LOAD_TYPES: LoadType[] = [
  'dry_van', 'reefer', 'flatbed', 'step_deck', 'intermodal',
  'tanker', 'hazmat', 'rgn', 'power_only', 'auto_transport',
];

type Verdict = 'green' | 'amber' | 'red';

function money(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function CheckLoadScreen({ onClose, onLogLoad }: Props) {
  const { t } = useTranslation();

  const [pay, setPay]           = useState('');
  const [miles, setMiles]       = useState('');
  const [pickup, setPickup]     = useState('');
  const [delivery, setDelivery] = useState('');
  const [loadType, setLoadType] = useState<LoadType>('dry_van');
  const [typeOpen, setTypeOpen] = useState(false);
  const [backhaul, setBackhaul] = useState(false);

  // Break-even is fixed for the session (derived from saved expenses + fuel + miles).
  const { breakEvenRPM, fuelCPM, fixedCPM } = useMemo(() => calcBreakEven(), []);

  const grossPay  = parseFloat(pay)   || 0;
  const loadMiles = parseFloat(miles) || 0;
  const hasInputs = grossPay > 0 && loadMiles > 0;

  const fuelCost  = loadMiles * fuelCPM;
  const fixedCost = loadMiles * fixedCPM;
  const netPay    = grossPay - fuelCost - fixedCost;
  const netRPM    = loadMiles > 0 ? netPay / loadMiles : 0;
  const deltaRPM  = netRPM - breakEvenRPM;

  const hasBreakEven = breakEvenRPM > 0;

  let verdict: Verdict = 'red';
  if (hasBreakEven) {
    if (netRPM >= breakEvenRPM * 1.15)   verdict = 'green';
    else if (netRPM > breakEvenRPM)      verdict = 'amber';
    else                                 verdict = 'red';
  } else {
    verdict = netPay > 0 ? 'green' : 'red';
  }

  const isBackhaulRescue = backhaul && verdict === 'red';

  const fair = hasInputs ? getFairMarketRate(loadMiles, loadType, grossPay) : null;
  const deadheadCost = calcDeadheadCost(loadMiles, fuelCPM, fixedCPM);

  const verdictColor =
    isBackhaulRescue ? Colors.secondary :
    verdict === 'green' ? Colors.primary :
    verdict === 'amber' ? Colors.secondary :
    Colors.danger;

  const verdictLabel =
    isBackhaulRescue ? t('checkLoad.result.backhaul') :
    verdict === 'red' ? t('checkLoad.result.notWorthIt') :
    t('checkLoad.result.worthIt');

  const verdictIcon: React.ComponentProps<typeof Ionicons>['name'] =
    isBackhaulRescue ? 'swap-horizontal' :
    verdict === 'red' ? 'close-circle' :
    'checkmark-circle';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('checkLoad.title').toUpperCase()}</Text>
            <Text style={styles.title}>{t('checkLoad.subtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Load pay */}
          <Text style={styles.fieldLabel}>{t('checkLoad.loadPay')}</Text>
          <View style={styles.inputCard}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.bigInput}
              value={pay}
              onChangeText={setPay}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Miles */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('common.miles').toUpperCase()}</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.bigInput}
              value={miles}
              onChangeText={setMiles}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.inputSuffix}>mi</Text>
          </View>

          {/* Pickup */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.pickup')}</Text>
          <View style={styles.inputCard}>
            <Ionicons name="ellipse-outline" size={16} color={Colors.textSecondary} style={styles.addrIcon} />
            <TextInput
              style={styles.addrInput}
              value={pickup}
              onChangeText={setPickup}
              placeholder={t('checkLoad.addressPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />
          </View>

          {/* Delivery */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.delivery')}</Text>
          <View style={styles.inputCard}>
            <Ionicons name="location" size={16} color={Colors.primary} style={styles.addrIcon} />
            <TextInput
              style={styles.addrInput}
              value={delivery}
              onChangeText={setDelivery}
              placeholder={t('checkLoad.addressPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />
          </View>
          <Text style={styles.addrHint}>{t('checkLoad.addressEncourage')}</Text>

          {/* Load type */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.loadType')}</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setTypeOpen(true)} activeOpacity={0.8}>
            <Text style={styles.dropdownText}>{t(`addLoad.loadTypes.${loadType}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>

          {/* Backhaul toggle */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('checkLoad.backhaul')}</Text>
              <Text style={styles.toggleHint}>{t('checkLoad.backhaulHint')}</Text>
            </View>
            <Switch
              value={backhaul}
              onValueChange={setBackhaul}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
              thumbColor={backhaul ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {/* ── Result ── */}
          {hasInputs && (
            <View style={[styles.resultCard, { borderColor: verdictColor }]}>
              <View style={styles.verdictRow}>
                <Ionicons name={verdictIcon} size={20} color={verdictColor} />
                <Text style={[styles.verdictLabel, { color: verdictColor }]}>{verdictLabel}</Text>
              </View>

              <Text style={styles.netLabel}>{t('checkLoad.result.netPay')}</Text>
              <Text style={[styles.netValue, { color: netPay >= 0 ? Colors.primary : Colors.danger }]}>
                {netPay < 0 ? '-' : ''}${money(Math.abs(netPay))}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t('checkLoad.result.ratePerMile')}</Text>
                  <Text style={styles.statValue}>${netRPM.toFixed(3)}</Text>
                </View>
                <View style={styles.statSep} />
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t('checkLoad.result.breakEven')}</Text>
                  <Text style={styles.statValue}>{hasBreakEven ? `$${breakEvenRPM.toFixed(3)}` : '—'}</Text>
                </View>
              </View>

              {hasBreakEven && (
                <View style={[styles.deltaPill, { backgroundColor: deltaRPM >= 0 ? Colors.primaryDim : Colors.dangerDim }]}>
                  <Ionicons
                    name={deltaRPM >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={deltaRPM >= 0 ? Colors.primary : Colors.danger}
                  />
                  <Text style={[styles.deltaText, { color: deltaRPM >= 0 ? Colors.primary : Colors.danger }]}>
                    {deltaRPM >= 0
                      ? t('checkLoad.result.aboveBreakEven', { amount: `$${Math.abs(deltaRPM).toFixed(3)}` })
                      : t('checkLoad.result.belowBreakEven', { amount: `$${Math.abs(deltaRPM).toFixed(3)}` })}
                  </Text>
                </View>
              )}

              {/* Backhaul reframe */}
              {isBackhaulRescue && (
                <View style={styles.backhaulNote}>
                  <Ionicons name="information-circle" size={16} color={Colors.secondary} />
                  <Text style={styles.backhaulText}>
                    {t('checkLoad.result.deadheadSaving', { amount: `$${money(deadheadCost)}` })}
                  </Text>
                </View>
              )}

              {/* Fair market */}
              {fair && (
                <View style={styles.fairRow}>
                  <Text style={styles.fairLabel}>
                    {t('checkLoad.result.fairMarket', { type: t(`addLoad.loadTypes.${loadType}`) })}
                  </Text>
                  <Text style={styles.fairValue}>
                    ${money(fair.minTotal)}–${money(fair.maxTotal)}
                  </Text>
                </View>
              )}

              {!hasBreakEven && (
                <Text style={styles.setupNote}>{t('checkLoad.noBreakEven')}</Text>
              )}
            </View>
          )}

          {/* Log this load */}
          <TouchableOpacity
            style={[styles.logBtn, !hasInputs && styles.logBtnDisabled]}
            onPress={() => { onLogLoad?.(); onClose(); }}
            disabled={!hasInputs}
            activeOpacity={0.85}
          >
            <Text style={[styles.logBtnText, !hasInputs && styles.logBtnTextDisabled]}>
              {t('checkLoad.result.logLoad')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={hasInputs ? Colors.background : Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeTextBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeTextBtnLabel}>{t('checkLoad.result.close')}</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Load type dropdown */}
      <Modal
        visible={typeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTypeOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('checkLoad.loadType')}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {LOAD_TYPES.map((type) => {
                const selected = type === loadType;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, selected && styles.typeOptionActive]}
                    onPress={() => { setLoadType(type); setTypeOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeOptionText, selected && styles.typeOptionTextActive]}>
                      {t(`addLoad.loadTypes.${type}`)}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.screenH, paddingTop: 12, paddingBottom: 16,
  },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, maxWidth: 260 },
  closeBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  fieldLabel: { ...SectionLabel, marginBottom: 10 },
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 14,
  },
  dollarSign:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary, marginRight: 6 },
  bigInput:    { flex: 1, fontFamily: FontFamily.bold, fontSize: 28, color: Colors.textPrimary, padding: 0 },
  inputSuffix: { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textSecondary },

  addrIcon:  { marginRight: 10 },
  addrInput: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary, padding: 0 },
  addrHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 16,
  },
  dropdownText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  // Load type dropdown sheet
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
  modalTitle:  { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12 },
  modalScroll: { maxHeight: 380 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  typeOptionActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  typeOptionText:       { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  typeOptionTextActive: { fontFamily: FontFamily.semiBold, color: Colors.primary },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18,
  },
  toggleText:  { flex: 1, marginRight: 12 },
  toggleLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  toggleHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  resultCard: {
    backgroundColor: Colors.surface, borderWidth: 2, borderRadius: Radius.xl,
    padding: Spacing.cardPad, marginTop: 24,
  },
  verdictRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  verdictLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.body },

  netLabel: { ...SectionLabel, marginBottom: 6 },
  netValue: { fontFamily: FontFamily.bold, fontSize: FontSize.heroLarge, lineHeight: 56, letterSpacing: -1.5, marginBottom: 16 },

  statsRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statCell:  { flex: 1 },
  statSep:   { width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 16 },
  statLabel: { ...SectionLabel, fontSize: 10, marginBottom: 4 },
  statValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  deltaText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label },

  backhaulNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: 12, marginTop: 14,
  },
  backhaulText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textPrimary, lineHeight: 20 },

  fairRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  fairLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, flex: 1, marginRight: 12 },
  fairValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  setupNote: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 14, lineHeight: 18 },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 24,
  },
  logBtnDisabled:     { backgroundColor: Colors.surfaceHigh },
  logBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
  logBtnTextDisabled: { color: Colors.textTertiary },

  closeTextBtn:      { alignItems: 'center', paddingVertical: 16 },
  closeTextBtnLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textSecondary },
});
