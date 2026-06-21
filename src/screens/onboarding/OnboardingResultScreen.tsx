import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import { calcBreakEven, getSetting, getTotalMonthlyExpenses, getMonthlyMiles } from '../../db/database';

interface Props { onComplete: () => void; onBack: () => void; }

export default function OnboardingResultScreen({ onComplete, onBack }: Props) {
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

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  function handleStart() {
    onComplete(); // RootNavigator handles setting 'onboarding_completed'
  }

  const rpm = result.breakEvenRPM;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

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

          <View style={styles.rateCard}>
            <Text style={styles.rateLabel}>BREAK-EVEN RATE</Text>
            <Text style={styles.rateNumber}>
              {rpm > 0 ? `$${rpm.toFixed(3)}` : '$—.———'}
            </Text>
            <Text style={styles.rateUnit}>per mile</Text>
          </View>

          <Text style={styles.subtitle}>{t('onboarding.result.subtitle')}</Text>
        </Animated.View>

        {/* Formula explanation */}
        <View style={styles.formulaCard}>
          <Text style={styles.formulaTitle}>{t('onboarding.result.explanation')}</Text>

          <View style={styles.formulaRow}>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>FUEL / MO</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyFuel > 0 ? `$${Math.round(monthlyFuel).toLocaleString()}` : '—'}
              </Text>
            </View>
            <Text style={styles.formulaPlus}>+</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>FIXED / MO</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyFixed > 0 ? `$${Math.round(monthlyFixed).toLocaleString()}` : '—'}
              </Text>
            </View>
            <Text style={styles.formulaPlus}>÷</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaItemLabel}>MILES / MO</Text>
              <Text style={styles.formulaItemValue}>
                {monthlyMiles > 0 ? Math.round(monthlyMiles).toLocaleString() : '—'}
              </Text>
            </View>
          </View>

          {/* CPM breakdown */}
          {rpm > 0 && (
            <View style={styles.cpmRow}>
              <View style={styles.cpmCell}>
                <Text style={styles.cpmLabel}>FUEL CPM</Text>
                <Text style={styles.cpmValue}>${result.fuelCPM.toFixed(3)}</Text>
              </View>
              <View style={styles.cpmSep} />
              <View style={styles.cpmCell}>
                <Text style={styles.cpmLabel}>FIXED CPM</Text>
                <Text style={styles.cpmValue}>${result.fixedCPM.toFixed(3)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Nudge if no data */}
        {rpm === 0 && (
          <View style={styles.nudgeCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.secondary} />
            <Text style={styles.nudgeText}>
              Add your expenses and miles to calculate your break-even rate. You can do this anytime in the app.
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('onboarding.result.startTracking')}</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.background} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 24 },

  backBtn: { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive: { backgroundColor: Colors.primary },
  stepLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 32 },

  heroBlock:  { alignItems: 'center', marginBottom: 28 },
  heroTitle:  { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 20, textAlign: 'center' },

  rateCard: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radius.xl, paddingVertical: 28, paddingHorizontal: 48,
    alignItems: 'center', marginBottom: 16, width: '100%',
  },
  rateLabel:  { ...SectionLabel, marginBottom: 8 },
  rateNumber: { fontFamily: FontFamily.bold, fontSize: 56, color: Colors.primary, lineHeight: 64, letterSpacing: -2 },
  rateUnit:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, marginTop: 4 },

  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  formulaCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad, marginBottom: 16,
  },
  formulaTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 16 },
  formulaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  formulaItem:  { flex: 1, alignItems: 'center' },
  formulaItemLabel: { ...SectionLabel, fontSize: 9, marginBottom: 4 },
  formulaItemValue: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textPrimary },
  formulaPlus: { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textSecondary },

  cpmRow:  { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  cpmCell: { flex: 1 },
  cpmSep:  { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  cpmLabel: { ...SectionLabel, fontSize: 9, marginBottom: 4 },
  cpmValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  nudgeCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  nudgeText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, lineHeight: 20 },

  spacer: { flex: 1 },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
  },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
});
