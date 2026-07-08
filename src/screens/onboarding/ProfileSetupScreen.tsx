import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { setSetting } from '../../db/database';
import { capture } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import { AddressSuggestion, extractCity, suggestionState } from '../../lib/mapbox';

interface Props {
  onContinue: () => void;
  onBack:     () => void;
  /** Signed-in review mode (Replay Setup): the CTA saves and returns to the
   *  app instead of reading "Create My Account". */
  replay?:    boolean;
}

const EQUIPMENT_TYPES = [
  'dryVan',
  'flatbed',
  'reefer',
  'boxTruck',
  'stepDeck',
  'tanker',
  'intermodal',
  'carHauler',
  'other',
] as const;
type EquipmentType = typeof EQUIPMENT_TYPES[number];

export default function ProfileSetupScreen({ onContinue, onBack, replay = false }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  const [name,      setName]      = useState('');
  const [equipment, setEquipment] = useState<EquipmentType | null>(null);
  const [truckNum,  setTruckNum]  = useState('');
  const [homeBaseInput, setHomeBaseInput] = useState('');
  const [homeBaseSel,   setHomeBaseSel]   = useState<AddressSuggestion | null>(null);
  const nameRef   = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  function handleContinue() {
    // Name is the one field that personalizes everything downstream. Rather than
    // dead-disabling the CTA (reads as broken), keep it live and nudge focus back
    // to the name field if it's empty.
    if (!name.trim()) { nameRef.current?.focus(); return; }
    setSetting('profile_name', name.trim());
    if (equipment)   setSetting('profile_equipment_type', equipment);
    if (truckNum.trim()) setSetting('profile_truck_number', truckNum.trim());

    // Prefer the geocoded city/state; fall back to whatever the driver typed.
    let homeBase = '';
    if (homeBaseSel) {
      homeBase = [extractCity(homeBaseSel.label), suggestionState(homeBaseSel)].filter(Boolean).join(', ');
    }
    if (!homeBase) homeBase = homeBaseInput.trim();
    if (homeBase) setSetting('profile_home_base', homeBase);

    capture('onboarding_profile_completed', {
      has_name: !!name.trim(),
      equipment_type: equipment ?? 'skipped',
      has_home_base: !!homeBase,
    });
    onContinue();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Icon + heading */}
          <View style={styles.iconCircle}>
            <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>{t('profile.heading')}</Text>
          <AccentRule style={{ marginTop: 10, marginBottom: 16 }} />
          <Text style={styles.subheading}>{t('profile.subheading')}</Text>

          {/* Name */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('profile.nameLabel')}</Text>
            <TextInput
              ref={nameRef}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Equipment type */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('profile.equipmentLabel')}</Text>
            <View style={styles.chipGrid}>
              {EQUIPMENT_TYPES.map((eq) => {
                const selected = equipment === eq;
                return (
                  <TouchableOpacity
                    key={eq}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setEquipment(selected ? null : eq)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {t(`profile.eq_${eq}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Truck number */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              {t('profile.truckNumLabel')}{' '}
              <Text style={styles.optional}>({t('common.optional')})</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={truckNum}
              onChangeText={setTruckNum}
              placeholder={t('profile.truckNumPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Home base */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              {t('profile.homeBaseLabel')}{' '}
              <Text style={styles.optional}>({t('common.optional')})</Text>
            </Text>
            <AddressAutocomplete
              value={homeBaseInput}
              onChangeText={(v) => { setHomeBaseInput(v); if (homeBaseSel) setHomeBaseSel(null); }}
              onSelect={(s) => {
                setHomeBaseSel(s);
                const parsed = [extractCity(s.label), suggestionState(s)].filter(Boolean).join(', ');
                setHomeBaseInput(parsed || s.label);
              }}
              placeholder={t('profile.cityPlaceholder')}
              icon="location-outline"
              // Home base is the last field on screen — when its dropdown opens
              // it would render below the fold, hidden under the Continue button.
              // Scroll it into view the moment it appears.
              onSuggestionsOpen={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
          </View>
        </ScrollView>

        {/* Continue button */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {replay ? t('common.save') : t('profile.continue')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} />
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
  // Generous bottom padding: the home-base dropdown (last field) needs room to
  // scroll fully above the footer Continue button.
  scrollContent: { paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 160 },

  backBtn: { marginBottom: 24, alignSelf: 'flex-start', padding: 4 },

  iconCircle: {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },

  heading:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 0, letterSpacing: -0.6 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },

  fieldBlock: { marginBottom: 28 },
  fieldLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 12 },
  optional:   { fontFamily: FontFamily.regular, fontSize: FontSize.micro, color: Colors.textTertiary, letterSpacing: 0.5, textTransform: 'none' },

  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 16,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },

  chipGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:             { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipSelected:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  chipText:         { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  chipTextSelected: { color: Colors.primary, fontFamily: FontFamily.semiBold },

  homeBaseRow: { flexDirection: 'row', gap: 10 },
  cityInput:   { flex: 1 },
  stateInput:  { width: 62 },

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
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
});
