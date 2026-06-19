import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import { setSetting } from '../../db/database';

interface Props { onNext: () => void; }

export default function OnboardingFuelScreen({ onNext }: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [focused, setFocused] = useState(false);

  const weekly = parseFloat(amount) || 0;
  const monthly = weekly * 4.333;

  function handleNext() {
    if (weekly > 0) setSetting('weekly_fuel_cost', String(weekly));
    onNext();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={[styles.progressDot, s === 1 && styles.progressDotActive]} />
            ))}
          </View>

          <Text style={styles.stepLabel}>{t('onboarding.step', { current: 1, total: 4 })}</Text>

          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="flash" size={32} color={Colors.primary} />
          </View>

          {/* Heading */}
          <Text style={styles.heading}>{t('onboarding.fuel.title')}</Text>
          <Text style={styles.subheading}>{t('onboarding.fuel.subtitle')}</Text>

          {/* Input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{t('onboarding.fuel.label')}</Text>
            <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
              <Text style={styles.prefix}>$</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={t('onboarding.fuel.placeholder')}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
              />
              <Text style={styles.suffix}>/ week</Text>
            </View>
            <Text style={styles.hint}>{t('onboarding.fuel.hint')}</Text>
          </View>

          {/* Live monthly calculation */}
          {weekly > 0 && (
            <View style={styles.calcCard}>
              <Text style={styles.calcLabel}>ESTIMATED MONTHLY FUEL</Text>
              <Text style={styles.calcValue}>${monthly.toFixed(0)}<Text style={styles.calcSub}> / mo</Text></Text>
            </View>
          )}

          <View style={styles.spacer} />

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.button, !amount && styles.buttonDim]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {amount ? t('common.next') : t('common.skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  flex:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 24 },

  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive: { backgroundColor: Colors.primary },

  stepLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 32 },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },

  heading:    { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 10 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },

  inputBlock: { marginBottom: 20 },
  inputLabel: { ...SectionLabel, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 18,
    gap: 8,
  },
  inputWrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  prefix:  { fontFamily: FontFamily.bold, fontSize: FontSize.hero, color: Colors.textSecondary },
  input:   { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.hero, color: Colors.textPrimary, letterSpacing: -1 },
  suffix:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  hint:    { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 10, paddingHorizontal: 4 },

  calcCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  calcLabel: { ...SectionLabel, fontSize: 10, marginBottom: 6 },
  calcValue: { fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -0.5 },
  calcSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  spacer: { flex: 1 },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17,
  },
  buttonDim:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
});
