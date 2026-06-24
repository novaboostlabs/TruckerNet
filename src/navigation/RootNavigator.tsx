import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getSetting, setSetting, clearAllUserData } from '../db/database';
import { AppFlowContext } from '../contexts/AppFlowContext';
import { syncExpensesOnSignIn, pushExpenses } from '../lib/sync/expensesSync';
import { syncFuelOnSignIn } from '../lib/sync/fuelSync';
import { syncLoadsOnSignIn } from '../lib/sync/loadsSync';
import { setupNotifications } from '../lib/notifications';

const Stack = createNativeStackNavigator();
const GUEST_SETTING = 'guest_mode';

// Onboarding completion is tracked per account so one account's progress never
// leaks to another (and guests, who have no id, never persist it).
const onboardingKey = (userId: string) => `onboarding_completed:${userId}`;

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
      // 1. Language must be chosen first.
      const lang = await getSavedLanguage();
      if (!lang) { setStep('language'); return; }

      // 2. No active session — decide whether to wipe data.
      if (!session) {
        // If a real account has previously signed in on this device the session
        // may be temporarily unavailable (offline / token expired). Keep local
        // data and send the user to sign-in to re-authenticate.
        // Otherwise (guest or fresh install) wipe everything for a clean slate
        // on every cold start — no data survives without an account.
        const hadRealAccount = getSetting('has_real_account') === 'true';
        if (!hadRealAccount) clearAllUserData();
        setStep('signin');
        return;
      }

      // 3. Real session: mark the device and check onboarding.
      setSetting('has_real_account', 'true');
      const onboarded = getSetting(onboardingKey(session.user.id)) === 'true';
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

    // Real account signed in — mark the device and check onboarding.
    setSetting('has_real_account', 'true');
    const onboarded = getSetting(onboardingKey(session.user.id)) === 'true';

    // Reconcile with the cloud (pull the account's data, or push local up if the
    // cloud is empty — e.g. a guest who just created an account). Fire-and-forget:
    // never blocks navigation, no-op for unconfigured Supabase.
    syncExpensesOnSignIn(session.user.id);
    syncFuelOnSignIn(session.user.id);
    syncLoadsOnSignIn(session.user.id);

    setStep(onboarded ? 'app' : 'onboarding_fuel');
  }, [session]); // eslint-disable-line

  // ── Return to sign-in when session ends ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'app') return;
    if (session || authLoading) return;

    // Session ended — always return to sign-in. guest_mode is cleared by
    // clearAllUserData() which runs on explicit sign-out.
    setStep('signin');
  }, [session, authLoading]); // eslint-disable-line

  // ── Set up push notifications once per app entry ──
  useEffect(() => {
    if (step !== 'app') return;
    setupNotifications().catch(() => {});
  }, [step]);

  // ── Replay onboarding from inside the app ──
  const replayOnboarding = useCallback(() => {
    // Clear this account's flag so the flow is consistent if the app restarts
    // mid-replay; OnboardingResult re-sets it on completion. (Guests have none.)
    if (session) setSetting(onboardingKey(session.user.id), '');
    setStep('onboarding_fuel');
  }, [session]);

  // ── Guest mode: skip auth entirely ──
  function enterGuestMode() {
    try {
      // Always start from a clean slate in explore/guest mode.
      // No data from previous sessions or accounts should bleed through.
      clearAllUserData();
      setSetting(GUEST_SETTING, 'true');
      setStep('onboarding_fuel');
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
    return (
      <OnboardingExpensesScreen
        onNext={() => setStep('onboarding_miles')}
        onBack={() => setStep('onboarding_fuel')}
      />
    );
  }

  if (step === 'onboarding_miles') {
    return (
      <OnboardingMilesScreen
        onNext={() => setStep('onboarding_result')}
        onBack={() => setStep('onboarding_expenses')}
      />
    );
  }

  if (step === 'onboarding_result') {
    return (
      <OnboardingResultScreen
        onBack={() => setStep('onboarding_miles')}
        onComplete={() => {
          // Persist completion for this account only. Guests aren't saved, so
          // onboarding reappears on the next launch until they sign up.
          if (session) {
            setSetting(onboardingKey(session.user.id), 'true');
            // Back up the expenses + miles captured during onboarding.
            pushExpenses(session.user.id);
          }
          setStep('app');
        }}
      />
    );
  }

  // step === 'app'
  return (
    <AppFlowContext.Provider value={{ replayOnboarding }}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </AppFlowContext.Provider>
  );
}
