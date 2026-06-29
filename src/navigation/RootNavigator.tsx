import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AppSplashScreen from '../screens/AppSplashScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../theme/theme';
import TabNavigator from './TabNavigator';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LanguagePickerScreen from '../screens/LanguagePickerScreen';
import WalkthroughScreen from '../screens/walkthrough/WalkthroughScreen';
import OnboardingFuelScreen from '../screens/onboarding/OnboardingFuelScreen';
import OnboardingExpensesScreen from '../screens/onboarding/OnboardingExpensesScreen';
import OnboardingMilesScreen from '../screens/onboarding/OnboardingMilesScreen';
import OnboardingResultScreen from '../screens/onboarding/OnboardingResultScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import { getSavedLanguage } from '../lib/i18n';
import { getSetting, setSetting, clearAllUserData, claimDataOwnership } from '../db/database';
import { capture } from '../lib/analytics';
import { AppFlowContext } from '../contexts/AppFlowContext';
import { syncExpensesOnSignIn } from '../lib/sync/expensesSync';
import { syncFuelOnSignIn } from '../lib/sync/fuelSync';
import { syncLoadsOnSignIn } from '../lib/sync/loadsSync';
import { syncProfileOnSignIn } from '../lib/sync/profileSync';
import { syncGeneralExpensesOnSignIn } from '../lib/sync/generalExpensesSync';
import { setupNotifications } from '../lib/notifications';

const Stack = createNativeStackNavigator();
const WALKTHROUGH_SETTING = 'walkthrough_seen';

// Onboarding completion is tracked per account so one account's progress never
// leaks to another (and guests, who have no id, never persist it).
const onboardingKey = (userId: string) => `onboarding_completed:${userId}`;

// All possible app states — only moves forward, never backward (except sign-out)
type Step =
  | 'loading'
  | 'language'
  | 'walkthrough'
  | 'signin'
  | 'signup'
  | 'onboarding_fuel'
  | 'onboarding_expenses'
  | 'onboarding_miles'
  | 'onboarding_result'
  | 'profile_setup'
  | 'app';

// Keep native splash visible until our animated JS splash finishes.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [step, setStep]           = useState<Step>('loading');
  const [splashDone, setSplashDone] = useState(false);
  const [walkthroughReplay, setWalkthroughReplay] = useState(false);
  const initialized               = useRef(false);

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

        // First-ever launch (no account, walkthrough never seen) gets the
        // pre-onboarding walkthrough before sign-in. Survives sign-out (it's
        // not in clearAllUserData's allow-list); only a reinstall resets it.
        const seenWalkthrough = getSetting(WALKTHROUGH_SETTING) === 'true';
        setStep(!hadRealAccount && !seenWalkthrough ? 'walkthrough' : 'signin');
        return;
      }

      // 3. Real session: mark the device, claim local data for this account
      //    (wipes it if it belonged to a different account), then check onboarding.
      setSetting('has_real_account', 'true');
      claimDataOwnership(session.user.id);
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

    // Real account signed in — mark the device.
    setSetting('has_real_account', 'true');

    // Guard against cross-account contamination: if the local data belongs to a
    // DIFFERENT account (e.g. a prior session expired without an explicit sign-out),
    // wipe it before reconciling so it can never be pushed up into this account.
    // A guest's unclaimed data (owner '') is preserved here so it can consolidate
    // onto this account via the cloud-empty push in syncXOnSignIn.
    claimDataOwnership(session.user.id);

    // In the new flow onboarding runs before auth, so the per-user flag won't be
    // set yet. Mark it now so future launches know this account is onboarded.
    // For accounts that went through the old flow the flag is already set — this
    // is a no-op write of the same value, which is harmless.
    setSetting(onboardingKey(session.user.id), 'true');

    // Reconcile with the cloud. Push expenses captured during pre-auth onboarding
    // now that we have a user ID. Fire-and-forget, never blocks navigation.
    syncExpensesOnSignIn(session.user.id);
    syncFuelOnSignIn(session.user.id);
    syncLoadsOnSignIn(session.user.id);
    syncProfileOnSignIn(session.user.id);
    syncGeneralExpensesOnSignIn(session.user.id);

    setStep('app');
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

  // ── Replay the walkthrough from inside the app (review mode) ──
  // Returns to the app when finished instead of routing to auth.
  const replayWalkthrough = useCallback(() => {
    setWalkthroughReplay(true);
    setStep('walkthrough');
  }, []);

  // ── Render based on step ──

  if (step === 'loading' || !splashDone) {
    return (
      <AppSplashScreen
        onDone={() => {
          SplashScreen.hideAsync().catch(() => {});
          setSplashDone(true);
        }}
      />
    );
  }

  if (step === 'language') {
    return (
      <LanguagePickerScreen
        onLanguageSelected={() =>
          setStep(getSetting(WALKTHROUGH_SETTING) === 'true' ? 'signin' : 'walkthrough')
        }
      />
    );
  }

  if (step === 'walkthrough') {
    // Replay/review mode (launched from Settings): just return to the app.
    if (walkthroughReplay) {
      return (
        <WalkthroughScreen
          onDone={() => { setWalkthroughReplay(false); setStep('app'); }}
        />
      );
    }
    // First-launch mode: mark seen, then route appropriately.
    // "Get Started" (sign up path) goes to onboarding first — auth comes after.
    // "Already have an account" goes straight to sign-in (returning users skip onboarding).
    const finishWalkthrough = () => setSetting(WALKTHROUGH_SETTING, 'true');
    return (
      <WalkthroughScreen
        onSignUp={() => { finishWalkthrough(); setStep('onboarding_fuel'); }}
        onSignIn={() => { finishWalkthrough(); setStep('signin'); }}
      />
    );
  }

  if (step === 'signin') {
    return (
      <SignInScreen
        onGoToSignUp={() => setStep('signup')}
      />
    );
  }

  if (step === 'signup') {
    return (
      <SignUpScreen
        onGoToSignIn={() => setStep('signin')}
      />
    );
  }

  if (step === 'onboarding_fuel') {
    capture('onboarding_started');
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
          capture('onboarding_completed');
          // Onboarding now runs before auth. Per-user flag and expense sync
          // are handled in the session effect when the user signs up.
          setStep('profile_setup');
        }}
      />
    );
  }

  if (step === 'profile_setup') {
    return (
      <ProfileSetupScreen
        onBack={() => setStep('onboarding_result')}
        onContinue={() => setStep('signup')}
      />
    );
  }

  // step === 'app'
  return (
    <AppFlowContext.Provider value={{ replayOnboarding, replayWalkthrough }}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </AppFlowContext.Provider>
  );
}
