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
import { getSavedLanguage } from '../lib/i18n';
import { getSetting, setSetting } from '../db/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();
const GUEST_KEY = '@truckernet_guest_mode';

// All possible app states — only moves forward, never backward (except sign-out)
type Step =
  | 'loading'
  | 'language'
  | 'signin'
  | 'signup'
  | 'onboarding_fuel'
  | 'onboarding_expenses'
  | 'onboarding_miles'
  | 'onboarding_result'
  | 'app';

export default function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  const initialized     = useRef(false);

  // ── Determine starting point ONCE when auth finishes loading ──
  useEffect(() => {
    if (authLoading)           return;
    if (initialized.current)   return;
    initialized.current = true;

    async function init() {
      // 1. Has the user selected a language?
      const lang = await getSavedLanguage();
      if (!lang) { setStep('language'); return; }

      // 2. Guest mode or signed in?
      const guest   = await AsyncStorage.getItem(GUEST_KEY);
      const isAuthed = !!session || guest === 'true';
      if (!isAuthed) { setStep('signin'); return; }

      // 3. Has the user completed onboarding?
      const onboarded = getSetting('onboarding_completed');
      if (!onboarded) { setStep('onboarding_fuel'); return; }

      setStep('app');
    }

    init();
  }, [authLoading]); // eslint-disable-line

  // ── Advance to app when user signs in ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'signin' && step !== 'signup') return;
    if (!session) return;

    const onboarded = getSetting('onboarding_completed');
    setStep(onboarded ? 'app' : 'onboarding_fuel');
  }, [session]); // eslint-disable-line

  // ── Return to sign-in when session ends ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'app') return;
    if (session || authLoading) return;

    AsyncStorage.getItem(GUEST_KEY).then((guest) => {
      if (guest !== 'true') setStep('signin');
    });
  }, [session, authLoading]); // eslint-disable-line

  // ── Guest mode: skip auth entirely ──
  async function enterGuestMode() {
    try {
      await AsyncStorage.setItem(GUEST_KEY, 'true');
      const onboarded = getSetting('onboarding_completed');
      setStep(onboarded ? 'app' : 'onboarding_fuel');
    } catch (e) {
      console.error('Guest mode error:', e);
    }
  }

  // ── Render based on step ──

  if (step === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (step === 'language') {
    return <LanguagePickerScreen onLanguageSelected={() => setStep('signin')} />;
  }

  if (step === 'signin') {
    return (
      <SignInScreen
        onGoToSignUp={() => setStep('signup')}
        onGuestMode={enterGuestMode}
      />
    );
  }

  if (step === 'signup') {
    return (
      <SignUpScreen
        onGoToSignIn={() => setStep('signin')}
        onGuestMode={enterGuestMode}
      />
    );
  }

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

  // step === 'app'
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
}
