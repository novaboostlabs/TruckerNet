import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, SupportedLanguage, saveLanguage } from '../lib/i18n';
import i18n from '../lib/i18n';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors } from '../theme/theme';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { capture } from '../lib/analytics';

const THEME_OPTIONS: { value: ThemeMode; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'system', icon: 'phone-portrait-outline' },
  { value: 'light',  icon: 'sunny-outline' },
  { value: 'dark',   icon: 'moon-outline' },
];
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';

interface Props {
  onLanguageSelected: (lang: SupportedLanguage) => void;
}

export default function LanguagePickerScreen({ onLanguageSelected }: Props) {
  const { t } = useTranslation();
  const { colors: Colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [selected, setSelected] = useState<SupportedLanguage>('en');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [themeOpen,  setThemeOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const current = LANGUAGES.find((l) => l.code === selected) ?? LANGUAGES[0];
  const currentTheme = THEME_OPTIONS.find((o) => o.value === mode) ?? THEME_OPTIONS[0];

  function pickTheme(value: ThemeMode) {
    setMode(value);
    setThemeOpen(false);
  }

  // Switch the whole app's language the instant a choice is made, so this page
  // (and everything after it) renders in the chosen language immediately.
  function pick(lang: SupportedLanguage) {
    setSelected(lang);
    i18n.changeLanguage(lang);
    setPickerOpen(false);
  }

  async function handleContinue() {
    setSaving(true);
    await saveLanguage(selected);
    await i18n.changeLanguage(selected);
    capture('welcome_completed', { language: selected, theme: mode });
    onLanguageSelected(selected);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <GridBackground />

      <View style={styles.container}>

        {/* Freight Terminal header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>TRUCKERNET // WELCOME</Text>
        </View>

        {/* Welcome hero — Freight Terminal mono style */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/truck-logo-transparent.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.heading}>{t('welcome.title')}</Text>
          <AccentRule width={84} height={6} style={{ marginTop: 8, marginBottom: 18 }} />
          <Text style={styles.slogan}>{t('welcome.slogan')}</Text>
        </View>

        {/* Language dropdown */}
        <View style={styles.dropdownBlock}>
          <Text style={styles.dropdownLabel}>{t('welcome.languageLabel')}</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownFlag}>{current.flag}</Text>
            <View style={styles.dropdownText}>
              <Text style={styles.dropdownNative}>{current.nativeName}</Text>
              <Text style={styles.dropdownEnglish}>{current.englishName}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Theme dropdown */}
        <View style={styles.themeBlock}>
          <Text style={styles.dropdownLabel}>{t('welcome.themeLabel')}</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setThemeOpen(true)}
            activeOpacity={0.8}
          >
            <View style={styles.themeIconWrap}>
              <Ionicons name={currentTheme.icon} size={18} color={Colors.primary} />
            </View>
            <View style={styles.dropdownText}>
              <Text style={styles.dropdownNative}>{t(`settings.appearance_${currentTheme.value}`)}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        {/* CTA — teal with glow */}
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonLoading]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.onPrimary} />
            : <>
                <Text style={styles.buttonText}>{t('common.next')}</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
              </>
          }
        </TouchableOpacity>

        <Text style={styles.changeHint}>{t('welcome.changeHint')}</Text>
      </View>

      {/* Language picker sheet */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('welcome.languageLabel')}</Text>
            {LANGUAGES.map((lang) => {
              const isSelected = selected === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => pick(lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <View style={styles.optionText}>
                    <Text style={[styles.nativeName, isSelected && styles.nativeNameSelected]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={styles.englishName}>{lang.englishName}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Theme picker sheet */}
      <Modal
        visible={themeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setThemeOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('welcome.themeLabel')}</Text>
            {THEME_OPTIONS.map((opt) => {
              const isSelected = mode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => pickTheme(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.themeIconWrap}>
                    <Ionicons name={opt.icon} size={18} color={isSelected ? Colors.primary : Colors.textSecondary} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.nativeName, isSelected && styles.nativeNameSelected]}>
                      {t(`settings.appearance_${opt.value}`)}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 32, paddingBottom: 24 },

  // Freight Terminal header
  header: { borderBottomWidth: 2, borderBottomColor: Colors.borderStrong, paddingBottom: 18, marginBottom: 48 },
  headerLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: Colors.labelColor, letterSpacing: 1.8 },

  hero:    { marginBottom: 48 },
  heroLogo: { width: 168, height: 83, marginBottom: 20, alignSelf: 'flex-start' },
  heading: { fontFamily: FontFamily.monoBold, fontSize: 48, color: Colors.textPrimary, lineHeight: 52, marginBottom: 0, letterSpacing: -0.6 },
  slogan:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 24 },

  dropdownBlock: { },
  dropdownLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.4, marginBottom: 12, textTransform: 'uppercase' },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: 16, paddingHorizontal: 18,
  },
  dropdownFlag:    { fontSize: 26 },
  themeBlock:      { marginTop: 20 },
  themeIconWrap: {
    width: 30, height: 30, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownText:    { flex: 1 },
  dropdownNative:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  dropdownEnglish: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },

  spacer: { flex: 1 },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 17, marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 12,
  },
  buttonLoading: { opacity: 0.7 },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary, fontWeight: '600' },
  changeHint:    { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },

  // Picker sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderTopWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 24, paddingBottom: 40, gap: 10,
  },
  sheetTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.4, marginBottom: 12, textTransform: 'uppercase' },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: 18, paddingHorizontal: 20,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim, borderWidth: 2 },

  flag:       { fontSize: 28 },
  optionText: { flex: 1 },
  nativeName: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.body,
    color: Colors.textPrimary, marginBottom: 2,
  },
  nativeNameSelected: { color: Colors.primary },
  englishName: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },
});
