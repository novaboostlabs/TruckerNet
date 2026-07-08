import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { getSetting, setSetting } from '../../db/database';
import { capture } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';

interface Props {
  onNext: () => void;
  /** Signed-in review mode (Replay Setup): heading reads "Review…" so the
   *  prefilled numbers clearly mean "edit your setup", not stale data. */
  replay?: boolean;
  /** Opens the 4-slide walkthrough and returns here — shown on first-time
   *  onboarding only, for anyone wondering why the app is asking for costs. */
  onShowWalkthrough?: () => void;
}

export default function OnboardingFuelScreen({ onNext, replay = false, onShowWalkthrough }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const [amount,  setAmount]  = useState(() => getSetting('weekly_fuel_cost') ?? '');
  const [focused, setFocused] = useState(false);

  const weekly  = parseFloat(amount) || 0;
  const monthly = weekly * 4.333;

  function handleAmountChange(v: string) {
    const n = parseFloat(v);
    if (!isNaN(n) && n > 5000) return; // cap at $5,000/week
    setAmount(v);
  }

  // Fuel is the single biggest input to break-even — it can't be skipped or the
  // whole app runs on a made-up number.
  function handleNext() {
    if (weekly <= 0) return;
    setSetting('weekly_fuel_cost', String(weekly));
    onNext();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Scrollable content — everything except the button */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={[styles.progressDot, s === 1 && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>{t('onboarding.step', { current: 1, total: 4 })}</Text>
            {onShowWalkthrough && (
              <TouchableOpacity
                style={styles.walkthroughRow}
                onPress={onShowWalkthrough}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.walkthroughLink}>{t('walkthrough.previewLink')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.iconCircle}>
            <Ionicons name="flash" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>
            {replay ? t('onboarding.fuel.reviewTitle') : t('onboarding.fuel.title')}
          </Text>
          <AccentRule style={{ marginTop: 10, marginBottom: 16 }} />
          <Text style={styles.subheading}>
            {replay ? t('onboarding.reviewSubtitle') : t('onboarding.fuel.subtitle')}
          </Text>

          {/* Big input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{t('onboarding.fuel.label')}</Text>
            <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
              <Text style={styles.prefix}>$</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder={t('onboarding.fuel.placeholder')}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <Text style={styles.suffix}>{t('onboarding.fuel.perWeek')}</Text>
            </View>
            <Text style={styles.hint}>{t('onboarding.fuel.hint')}</Text>
          </View>

          {/* Live monthly calculation */}
          {weekly > 0 && (
            <View style={styles.calcCard}>
              <Text style={styles.calcLabel}>{t('onboarding.fuel.estMonthly')}</Text>
              <Text style={styles.calcValue}>
                ${monthly.toFixed(0)}
                <Text style={styles.calcSub}> {t('onboarding.fuel.perMo')}</Text>
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Button sits OUTSIDE the ScrollView but INSIDE KAV — keyboard pushes it up */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            style={[styles.button, !weekly && styles.buttonDim]}
            onPress={handleNext}
            disabled={!weekly}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, !weekly && styles.buttonTextDim]}>{t('common.next')}</Text>
            <Ionicons name="arrow-forward" size={18} color={weekly ? Colors.onPrimary : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.background },
  flex:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 12 },

  progressRow:      { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot:      { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive:{ backgroundColor: Colors.primary },

  stepRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  stepLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.labelColor, letterSpacing: 1.4, textTransform: 'uppercase' },
  walkthroughRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walkthroughLink: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },

  iconCircle: {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },

  heading:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 0, letterSpacing: -0.6 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },

  inputBlock:       { marginBottom: 20 },
  inputLabel:       { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 18, gap: 8,
  },
  inputWrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  prefix: { fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, color: Colors.textSecondary },
  input:  { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, color: Colors.textPrimary, letterSpacing: -1 },
  suffix: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },
  hint:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 10, paddingHorizontal: 4 },

  calcCard:  {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, padding: Spacing.cardPad,
  },
  calcLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 10, marginBottom: 6 },
  calcValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -1 },
  calcSub:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },

  // Button anchored above keyboard
  buttonWrap: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  buttonDim:     { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, shadowOpacity: 0, elevation: 0 },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  buttonTextDim: { color: Colors.textSecondary },
});
