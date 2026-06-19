import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANGUAGES, SupportedLanguage, saveLanguage } from '../lib/i18n';
import i18n from '../lib/i18n';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '../theme/theme';

interface Props {
  onLanguageSelected: (lang: SupportedLanguage) => void;
}

export default function LanguagePickerScreen({ onLanguageSelected }: Props) {
  const [selected, setSelected] = useState<SupportedLanguage>('en');
  const [saving,   setSaving]   = useState(false);

  async function handleContinue() {
    setSaving(true);
    await saveLanguage(selected);
    await i18n.changeLanguage(selected);
    onLanguageSelected(selected);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Brand mark */}
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoChar}>T</Text>
          </View>
          <Text style={styles.brandName}>TruckerNet</Text>
        </View>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Select your language</Text>
          <Text style={styles.subheading}>Selecciona tu idioma · ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ · 选择语言</Text>
        </View>

        {/* Language options */}
        <View style={styles.optionList}>
          {LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.8}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <View style={styles.optionText}>
                  <Text style={[styles.nativeName, isSelected && styles.nativeNameSelected]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.englishName}>{lang.englishName}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonLoading]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.background} />
            : <Text style={styles.buttonText}>Continue</Text>
          }
        </TouchableOpacity>

        <Text style={styles.changeHint}>You can change this anytime in Settings</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 40, justifyContent: 'center' },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 48 },
  logoMark: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  logoChar:  { fontFamily: FontFamily.bold, fontSize: 22, color: Colors.background },
  brandName: { fontFamily: FontFamily.semiBold, fontSize: 18, color: Colors.textPrimary },

  headingBlock: { marginBottom: 32 },
  heading:      { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, marginBottom: 8 },
  subheading:   { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, lineHeight: 20 },

  optionList: { gap: 10, marginBottom: 32 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 18, paddingHorizontal: 20,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },

  flag:       { fontSize: 28 },
  optionText: { flex: 1 },
  nativeName: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.body,
    color: Colors.textPrimary, marginBottom: 2,
  },
  nativeNameSelected: { color: Colors.primary },
  englishName: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  button: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 17, alignItems: 'center', marginBottom: 16,
  },
  buttonLoading: { opacity: 0.7 },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
  changeHint:    { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },
});
