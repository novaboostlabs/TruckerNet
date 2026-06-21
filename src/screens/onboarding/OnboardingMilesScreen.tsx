import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../../theme/theme';
import { setSetting } from '../../db/database';

interface Props { onNext: () => void; onBack: () => void; }

export default function OnboardingMilesScreen({ onNext, onBack }: Props) {
  const { t }  = useTranslation();
  const [miles,   setMiles]   = useState('');
  const [focused, setFocused] = useState(false);

  const weekly  = parseFloat(miles) || 0;
  const monthly = weekly * 4.333;

  function handleMilesChange(v: string) {
    const n = parseFloat(v);
    if (!isNaN(n) && n > 15000) return; // cap at 15,000 mi/week
    setMiles(v);
  }

  function handleNext() {
    if (weekly <= 0) return;
    setSetting('weekly_miles', String(weekly));
    onNext();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Scrollable content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={[styles.progressDot, s <= 3 && styles.progressDotActive]} />
            ))}
          </View>

          <Text style={styles.stepLabel}>{t('onboarding.step', { current: 3, total: 4 })}</Text>

          <View style={styles.iconCircle}>
            <Ionicons name="navigate" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>{t('onboarding.miles.title')}</Text>
          <Text style={styles.subheading}>{t('onboarding.miles.subtitle')}</Text>

          {/* Input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{t('onboarding.miles.label')}</Text>
            <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
              <TextInput
                style={styles.input}
                value={miles}
                onChangeText={handleMilesChange}
                keyboardType="number-pad"
                placeholder={t('onboarding.miles.placeholder')}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <Text style={styles.suffix}>mi / week</Text>
            </View>
            <Text style={styles.hint}>{t('onboarding.miles.hint')}</Text>
          </View>

          {/* Live monthly calc */}
          {weekly > 0 && (
            <View style={styles.calcCard}>
              <Text style={styles.calcLabel}>ESTIMATED MONTHLY MILES</Text>
              <Text style={styles.calcValue}>
                {Math.round(monthly).toLocaleString()}
                <Text style={styles.calcSub}> mi / mo</Text>
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Button anchored above keyboard */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            style={[styles.button, !weekly && styles.buttonDim]}
            onPress={handleNext}
            disabled={!weekly}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, !weekly && styles.buttonTextDim]}>
              {t('common.next')}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={weekly ? Colors.background : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.background },
  flex:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 12 },

  backBtn: { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  progressRow:       { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot:       { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.surface },
  progressDotActive: { backgroundColor: Colors.primary },

  stepLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary, marginBottom: 32 },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },

  heading:    { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 10 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },

  inputBlock:       { marginBottom: 20 },
  inputLabel:       { ...SectionLabel, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 18, gap: 8,
  },
  inputWrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  input:  { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.hero, color: Colors.textPrimary, letterSpacing: -1 },
  suffix: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  hint:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 10, paddingHorizontal: 4 },

  calcCard:  {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.lg, padding: Spacing.cardPad,
  },
  calcLabel: { ...SectionLabel, fontSize: 10, marginBottom: 6 },
  calcValue: { fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber, color: Colors.primary, letterSpacing: -0.5 },
  calcSub:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },

  buttonWrap: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  button:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17 },
  buttonDim:     { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
  buttonTextDim: { color: Colors.textSecondary },
});
