import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { calcBreakEven, getSetting, getTotalMonthlyExpenses, getMonthlyMiles } from '../../db/database';
import { capture } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';
import AnimatedNumber from '../../components/anim/AnimatedNumber';
import FadeInSlide from '../../components/anim/FadeInSlide';
import PressableScale from '../../components/anim/PressableScale';
import * as haptics from '../../lib/haptics';

interface Props { onComplete: () => void; onBack: () => void; }

export default function OnboardingResultScreen({ onComplete, onBack }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const [result, setResult]   = useState({ breakEvenRPM: 0, fuelCPM: 0, fixedCPM: 0 });
  const [monthlyFuel, setMonthlyFuel]   = useState(0);
  const [monthlyFixed, setMonthlyFixed] = useState(0);
  const [monthlyMiles, setMonthlyMiles] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const r = calcBreakEven();
    setResult(r);

    // Derive the three formula inputs from the same values calcBreakEven() used,
    // so the displayed breakdown always matches the headline number.
    const monthly = getMonthlyMiles(); // weekly_miles × 4.333
    setMonthlyMiles(monthly);
    setMonthlyFuel(r.fuelCPM * monthly);       // fuelCPM × miles = $ fuel/mo
    setMonthlyFixed(getTotalMonthlyExpenses()); // sum of user_expenses

    // Animate the hero card in, then fire a success haptic timed to land as the
    // break-even number finishes counting up — the payoff moment of onboarding.
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
    if (r.breakEvenRPM > 0) {
      const h = setTimeout(() => haptics.success(), 1150);
      return () => clearTimeout(h);
    }
  }, []);

  function handleStart() {
    capture('onboarding_result_completed', {
      break_even_rpm: result.breakEvenRPM,
      has_break_even: result.breakEvenRPM > 0,
    });
    onComplete(); // RootNavigator handles setting 'onboarding_completed'
  }

  const rpm = result.breakEvenRPM;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      {/* Scrollable so "Start Tracking" is always reachable on any aspect ratio. */}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Progress — all filled */}
        <View style={styles.progressRow}>
          {[1,2,3,4].map((s) => (
            <View key={s} style={[styles.progressDot, styles.progressDotActive]} />
          ))}
        </View>

        <Text style={styles.stepLabel}>{t('onboarding.step', { current: 4, total: 4 })}</Text>

        {/* Hero result */}
        <Animated.View style={[styles.heroBlock, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.heroTitle}>{t('onboarding.result.title')}</Text>
          <AccentRule style={{ alignSelf: 'center', marginBottom: 20 }} />

          <View style={styles.rateCard}>
            <Text style={styles.rateLabel}>{t('dashboard.breakEven')}</Text>
            {rpm > 0 ? (
              <AnimatedNumber
                value={rpm}
                from={0}
                format={(n) => `$${n.toFixed(3)}`}
                style={styles.rateNumber}
                delay={350}
                duration={950}
              />
            ) : (
              <Text style={styles.rateNumber}>$—.———</Text>
            )}
            <Text style={styles.rateUnit}>{t('common.perMile')}</Text>
          </View>

          <Text style={styles.subtitle}>{t('onboarding.result.subtitle')}</Text>
        </Animated.View>

        {/* Formula explanation — slides in just after the number settles */}
        <FadeInSlide delay={900} style={styles.formulaCard}>
          <Text style={styles.formulaTitle}>{t('onboarding.result.explanation')}</Text>

          <View style={styles.formulaRow}>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>{t('onboarding.result.fuelMo')}</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyFuel > 0 ? `$${Math.round(monthlyFuel).toLocaleString()}` : '—'}
              </Text>
            </View>
            <Text style={styles.formulaPlus}>+</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>{t('onboarding.result.fixedMo')}</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyFixed > 0 ? `$${Math.round(monthlyFixed).toLocaleString()}` : '—'}
              </Text>
            </View>
            <Text style={styles.formulaPlus}>÷</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>{t('onboarding.result.milesMo')}</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyMiles > 0 ? Math.round(monthlyMiles).toLocaleString() : '—'}
              </Text>
            </View>
          </View>

          {/* CPM breakdown */}
          {rpm > 0 && (
            <View style={styles.cpmRow}>
              <View style={styles.cpmCell}>
                <Text style={styles.cpmLabel}>{t('dashboard.fuelCPM')}</Text>
                <Text style={styles.cpmValue}>${result.fuelCPM.toFixed(3)}</Text>
              </View>
              <View style={styles.cpmSep} />
              <View style={styles.cpmCell}>
                <Text style={styles.cpmLabel}>{t('dashboard.fixedCPM')}</Text>
                <Text style={styles.cpmValue}>${result.fixedCPM.toFixed(3)}</Text>
              </View>
            </View>
          )}
        </FadeInSlide>

        {/* Nudge if no data */}
        {rpm === 0 && (
          <View style={styles.nudgeCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.secondary} />
            <Text style={styles.nudgeText}>
              {t('onboarding.result.nudge')}
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        <PressableScale style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>{t('onboarding.result.startTracking')}</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 24 },

  backBtn: { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive: { backgroundColor: Colors.primary },
  stepLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.labelColor, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 32 },

  heroBlock:  { alignItems: 'center', marginBottom: 28 },
  heroTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 14, textAlign: 'center', letterSpacing: -0.4 },

  rateCard: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 28, paddingHorizontal: 48,
    alignItems: 'center', marginBottom: 16, width: '100%',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  rateLabel:  { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 8 },
  rateNumber: { fontFamily: FontFamily.monoBold, fontSize: 56, color: Colors.primary, lineHeight: 64, letterSpacing: -2 },
  rateUnit:   { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary, marginTop: 4 },

  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  formulaCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.cardPad, marginBottom: 16,
  },
  formulaTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.labelColor, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 },
  formulaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  formulaItem:  { flex: 1, alignItems: 'center' },
  formulaItemLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 9, marginBottom: 4 },
  formulaItemValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.textPrimary },
  formulaPlus: { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textSecondary },

  cpmRow:  { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  cpmCell: { flex: 1 },
  cpmSep:  { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  cpmLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 9, marginBottom: 4 },
  cpmValue: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  nudgeCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.secondaryDim, borderWidth: 1, borderColor: Colors.secondary + '40',
    borderRadius: Radius.md, padding: Spacing.cardPad,
  },
  nudgeText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, lineHeight: 20 },

  spacer: { flex: 1 },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
});
