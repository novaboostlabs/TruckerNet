import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { setSetting, setIncomeGoal, getIncomeGoal, getSetting } from '../../db/database';
import { capture } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';

interface Props { onNext: () => void; onBack: () => void; }

const TAX_PRESETS = [15, 20, 25, 30];

export default function OnboardingGoalsScreen({ onNext, onBack }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  const existingGoal = getIncomeGoal();
  const [goal,   setGoal]   = useState(existingGoal ? String(Math.round(existingGoal.amount)) : '');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>(existingGoal?.period ?? 'weekly');
  const [rate,   setRate]   = useState<number>(() => {
    const v = parseFloat(getSetting('tax_rate') ?? '25');
    return !isNaN(v) && v >= 5 && v <= 50 ? Math.round(v) : 25;
  });
  const [goalFocused, setGoalFocused] = useState(false);

  const goalAmount = parseFloat(goal) || 0;

  function persist() {
    setIncomeGoal(goalAmount > 0 ? goalAmount : null, period);
    setSetting('tax_rate', String(rate));
  }

  function handleContinue() {
    persist();
    capture('onboarding_goals_set', { has_goal: goalAmount > 0, goal_period: period, tax_rate: rate });
    onNext();
  }

  function handleSkip() {
    // Still record the tax rate (defaulted to 25) so the set-aside works; no goal.
    setSetting('tax_rate', String(rate));
    capture('onboarding_goals_skipped');
    onNext();
  }

  function handleGoalChange(v: string) {
    const n = parseFloat(v);
    if (!isNaN(n) && n > 1000000) return; // sane cap
    setGoal(v);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.stepLabel}>{t('onboarding.goals.step')}</Text>

          <View style={styles.iconCircle}>
            <Ionicons name="flag" size={30} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>{t('onboarding.goals.title')}</Text>
          <AccentRule style={{ marginTop: 10, marginBottom: 16 }} />
          <Text style={styles.subheading}>{t('onboarding.goals.subtitle')}</Text>

          {/* ── Income goal ── */}
          <Text style={styles.inputLabel}>{t('onboarding.goals.goalLabel')}</Text>

          {/* Weekly / Monthly toggle */}
          <View style={styles.toggleRow}>
            {(['weekly', 'monthly'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
                  {t(`onboarding.goals.${p}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.inputWrap, goalFocused && styles.inputWrapFocused]}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={styles.input}
              value={goal}
              onChangeText={handleGoalChange}
              keyboardType="number-pad"
              placeholder={t('onboarding.goals.goalPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              onFocus={() => setGoalFocused(true)}
              onBlur={() => setGoalFocused(false)}
            />
            <Text style={styles.suffix}>
              {period === 'weekly' ? t('onboarding.goals.perWeek') : t('onboarding.goals.perMonth')}
            </Text>
          </View>
          <Text style={styles.hint}>{t('onboarding.goals.goalHint')}</Text>

          {/* ── Tax rate ── */}
          <Text style={[styles.inputLabel, { marginTop: 28 }]}>{t('onboarding.goals.taxLabel')}</Text>
          <View style={styles.chipRow}>
            {TAX_PRESETS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, rate === r && styles.chipActive]}
                onPress={() => setRate(r)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, rate === r && styles.chipTextActive]}>{r}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{t('onboarding.goals.taxHint')}</Text>
        </ScrollView>

        <View style={styles.buttonWrap}>
          <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('common.continue')}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>{t('onboarding.goals.skip')}</Text>
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

  backBtn:   { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  stepLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.labelColor, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 24 },

  iconCircle: {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },

  heading:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, letterSpacing: -0.6 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28 },

  inputLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 10 },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
  },
  toggleBtnActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  toggleText:      { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textSecondary },
  toggleTextActive:{ color: Colors.primary },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 16, gap: 6,
  },
  inputWrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  dollar: { fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, color: Colors.textSecondary, letterSpacing: -1 },
  input:  { flex: 1, fontFamily: FontFamily.monoBold, fontSize: FontSize.hero, color: Colors.textPrimary, letterSpacing: -1 },
  suffix: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },
  hint:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 10, paddingHorizontal: 4 },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
  },
  chipActive:     { backgroundColor: Colors.secondaryDim, borderColor: Colors.secondary },
  chipText:       { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.textSecondary },
  chipTextActive: { color: Colors.secondary },

  buttonWrap: { paddingHorizontal: Spacing.screenH, paddingTop: 12, paddingBottom: 12, backgroundColor: Colors.background },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  skipBtn:    { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  skipText:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textTertiary },
});
