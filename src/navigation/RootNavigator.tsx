import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../theme/theme';
import TabNavigator from './TabNavigator';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LanguagePickerScreen from '../screens/LanguagePickerScreen';
import OnboardingFuelScreen from '../screens/onboarding/OnboardingFuelScreen';
import OnboardingExpensesScreen from '../screens/onboarding/OnboardingExpensesScreen';
import OnboardingMilesScreen from '../screens/onboarding/OnboardingMilesScreen';
import OnboardingResultScreen from '../screens/onboarding/OnboardingResultScreen';
import { getSavedLanguage, SupportedLanguage } from '../lib/i18n';
import { getSetting, setSetting } from '../db/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();

// ── Guest mode key ──
const GUEST_KEY = '@truckernet_guest_mode';

type Step = 'loading' | 'language' | 'auth' | 'onboarding_fuel' | 'onboarding_expenses' | 'onboarding_miles' | 'onboarding_result' | 'app';

export default function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  // Track whether we've done the initial determination so session changes
  // don't restart the whole flow
  const initialized = useRef(false);

  // ── Run ONCE when auth finishes loading ──
  useEffect(() => {
    if (authLoading) return;
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      // 1. Language selected?
      const lang = await getSavedLanguage();
      if (!lang) { setStep('language'); return; }

      // 2. Guest mode or signed in?
      const guestMode = await AsyncStorage.getItem(GUEST_KEY);
      const isAuthed  = !!session || guestMode === 'true';
      if (!isAuthed) { setStep('auth'); return; }

      // 3. Onboarding done?
      const onboarded = getSetting('onboarding_completed');
      if (!onboarded) { setStep('onboarding_fuel'); return; }

      // All clear
      setStep('app');
    }

    init();
  }, [authLoading]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── When user signs in — advance from auth only ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'auth') return;
    if (!session) return;

    const onboarded = getSetting('onboarding_completed');
    setStep(onboarded ? 'app' : 'onboarding_fuel');
  }, [session]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── When user signs out — go back to auth ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'app') return;
    if (session) return;

    // Check if guest mode is still active
    AsyncStorage.getItem(GUEST_KEY).then((guest) => {
      if (guest !== 'true') setStep('auth');
    });
  }, [session]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guest mode helper ──
  async function enterGuestMode() {
    await AsyncStorage.setItem(GUEST_KEY, 'true');
    const onboarded = getSetting('onboarding_completed');
    setStep(onboarded ? 'app' : 'onboarding_fuel');
  }

  // ── Loading ──
  if (step === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  // ── Language picker ──
  if (step === 'language') {
    return <LanguagePickerScreen onLanguageSelected={() => setStep('auth')} />;
  }

  // ── Onboarding flow ──
  if (step === 'onboarding_fuel') {
    return <OnboardingFuelScreen onNext={() => setStep('onboarding_expenses')} />;
  }
  if (step === 'onboarding_expenses') {
    return <OnboardingExpensesScreen onNext={() => setStep('onboarding_miles')} />;
  }
  if (step === 'onboarding_miles') {
    return <OnboardingMilesScreen onNext={() => setStep('onboarding_result')} />;
  }
  if (step === 'onboarding_result') {
    return (
      <OnboardingResultScreen
        onComplete={() => {
          setSetting('onboarding_completed', 'true');
          setStep('app');
        }}
      />
    );
  }

  // ── Main app ──
  if (step === 'app') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    );
  }

  // ── Auth ──
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="SignIn"  children={(props) => <SignInScreen  {...props} onGuestMode={enterGuestMode} />} />
      <Stack.Screen name="SignUp"  children={(props) => <SignUpScreen  {...props} onGuestMode={enterGuestMode} />} />
    </Stack.Navigator>
  );
}
