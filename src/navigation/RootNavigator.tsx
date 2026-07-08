import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import OnboardingGoalsScreen from '../screens/onboarding/OnboardingGoalsScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import { getSavedLanguage } from '../lib/i18n';
import { getSetting, setSetting, clearAllUserData, claimDataOwnership } from '../db/database';
import { capture } from '../lib/analytics';
import { AppFlowContext } from '../contexts/AppFlowContext';
import { syncAll, pushAll } from '../lib/sync';
import { setupNotifications } from '../lib/notifications';

const Stack = createNativeStackNavigator();
const WALKTHROUGH_SETTING = 'walkthrough_seen';

// Onboarding completion is tracked per account so one account's progress never
// leaks to another (and guests, who have no id, never persist it).
const onboardingKey = (userId: string) => `onboarding_completed:${userId}`;

// Does this device hold the account's core setup (the two numbers break-even
// cannot exist without)? This — not a local flag — is the source of truth for
// whether an account is onboarded: the flag can go stale or leak across
// accounts on a shared device, but real data can't be faked. Mirrors how the
// big consumer apps route post-login (the server's account state decides
// whether you see setup, not anything device-local).
function hasCoreSetup(): boolean {
  const fuel  = parseFloat(getSetting('weekly_fuel_cost') ?? '0') || 0;
  const miles = parseFloat(getSetting('weekly_miles')     ?? '0') || 0;
  return fuel > 0 && miles > 0;
}

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
  | 'onboarding_goals'
  | 'profile_setup'
  | 'app';

// Keep native splash visible until our animated JS splash finishes.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [step, setStep]           = useState<Step>('loading');
  const [splashDone, setSplashDone] = useState(false);
  // Non-null while the walkthrough is being VIEWED (not first-launch-routed):
  // holds the step to return to when it finishes — 'app' for the Settings
  // replay, 'signin' / 'onboarding_fuel' for the "see how it works" links.
  const [walkthroughReturn, setWalkthroughReturn] = useState<Step | null>(null);
  const [onboardingReplay, setOnboardingReplay] = useState(false);
  // A signed-in account with no setup data (brand-new account created from the
  // sign-in screen, or a restore that found nothing in the cloud) runs the
  // SAME onboarding screens, but post-auth: finishing routes to the app (with
  // a push), never to the signup screen.
  const [postAuthOnboarding, setPostAuthOnboarding] = useState(false);
  const initialized               = useRef(false);

  // ── Route a signed-in user: account state decides, not a device flag ──
  // If the core setup exists locally → straight to the app (background sync).
  // If not, this may be an existing account on a fresh device — pull the cloud
  // copy first (bounded wait), THEN decide: restored data → app; genuinely
  // empty account → onboarding. This is what kills the "new account lands on
  // an empty dashboard with no break-even" bug: onboarding is per-ACCOUNT.
  const routeSignedIn = useCallback(async (userId: string) => {
    setSetting('has_real_account', 'true');
    claimDataOwnership(userId);

    if (hasCoreSetup()) {
      setSetting(onboardingKey(userId), 'true');
      syncAll(userId); // fire-and-forget reconcile
      setStep('app');
      return;
    }

    setStep('loading');
    await Promise.race([
      syncAll(userId),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)), // never strand on a hung pull
    ]);

    if (hasCoreSetup()) {
      setSetting(onboardingKey(userId), 'true');
      setStep('app');
    } else {
      setPostAuthOnboarding(true);
      setStep('onboarding_fuel');
    }
  }, []);

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

      // 3. Real session: same account-state routing as the sign-in transition.
      //    (Previously this trusted a per-user local flag — which the old
      //    sign-in path stamped 'true' for EVERY account unconditionally, so a
      //    brand-new account created from the sign-in screen skipped onboarding
      //    entirely and landed on an empty dashboard with no break-even.)
      await routeSignedIn(session.user.id);
    }

    init();
  }, [authLoading]); // eslint-disable-line

  // ── Advance when user signs in (or signs up) ──
  useEffect(() => {
    if (!initialized.current) return;
    if (step !== 'signin' && step !== 'signup') return;
    if (!session) return;

    // Account state decides where they land:
    //   - Pre-auth onboarding just completed (signup path) → core setup exists
    //     locally → app, with the captured data pushed up.
    //   - Existing account on a fresh device → pull restores the setup → app.
    //   - Genuinely new account with nothing in the cloud → onboarding.
    void routeSignedIn(session.user.id);
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

  // ── Replay onboarding from inside the app (review/edit mode) ──
  // The onboarded flag stays SET: a force-quit mid-replay must land back in the
  // app on next launch, never strand a signed-in user in the pre-auth flow.
  // (The old approach cleared the flag and could dead-end on the signup screen.)
  const replayOnboarding = useCallback(() => {
    setOnboardingReplay(true);
    setStep('onboarding_fuel');
  }, []);

  // ── Replay the walkthrough from inside the app (review mode) ──
  // Returns to the app when finished instead of routing to auth.
  const replayWalkthrough = useCallback(() => {
    setWalkthroughReturn('app');
    setStep('walkthrough');
  }, []);

  // ── Preview the walkthrough from sign-in / onboarding, then come back ──
  const previewWalkthrough = useCallback((from: Step) => {
    setWalkthroughReturn(from);
    setStep('walkthrough');
  }, []);

  // ── Render ──
  // The current step screen renders underneath; the launch splash overlays it and
  // crossfades out on completion (AppSplashScreen fades its own opacity to 0, then
  // calls onDone → splashDone unmounts the overlay), so the first real screen fades
  // in beneath it. A returning user with a live session lands on the dashboard, so
  // the splash literally crossfades into the dashboard per spec.
  const renderStep = () => {
    if (step === 'loading') {
      // Branded backdrop beneath the splash until auth resolves — and, on
      // sign-in, while the account's cloud data is pulled before routing
      // (a visible spinner so the bounded wait never reads as a freeze).
      return (
        <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
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
      // View/review mode (Settings replay, or a "see how it works" link):
      // just return to wherever the viewer came from.
      if (walkthroughReturn) {
        return (
          <WalkthroughScreen
            onDone={() => { setWalkthroughReturn(null); setStep(walkthroughReturn); }}
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
          onShowWalkthrough={() => previewWalkthrough('signin')}
        />
      );
    }

    if (step === 'signup') {
      return <SignUpScreen onGoToSignIn={() => setStep('signin')} />;
    }

    if (step === 'onboarding_fuel') {
      capture(onboardingReplay ? 'onboarding_replayed' : 'onboarding_started');
      return (
        <OnboardingFuelScreen
          replay={onboardingReplay}
          onNext={() => setStep('onboarding_expenses')}
          // First-time onboarding offers a peek at the walkthrough ("why am I
          // answering fuel questions?"); replay from Settings doesn't need it.
          onShowWalkthrough={onboardingReplay ? undefined : () => previewWalkthrough('onboarding_fuel')}
        />
      );
    }

    if (step === 'onboarding_expenses') {
      return (
        <OnboardingExpensesScreen
          replay={onboardingReplay}
          onNext={() => setStep('onboarding_miles')}
          onBack={() => setStep('onboarding_fuel')}
        />
      );
    }

    if (step === 'onboarding_miles') {
      return (
        <OnboardingMilesScreen
          replay={onboardingReplay}
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
            setStep('onboarding_goals');
          }}
        />
      );
    }

    if (step === 'onboarding_goals') {
      return (
        <OnboardingGoalsScreen
          onNext={() => setStep('profile_setup')}
          onBack={() => setStep('onboarding_result')}
        />
      );
    }

    if (step === 'profile_setup') {
      return (
        <ProfileSetupScreen
          // Both replay AND post-auth onboarding end with a signed-in user —
          // the CTA reads "Save", never "Create My Account".
          replay={onboardingReplay || postAuthOnboarding}
          onBack={() => setStep('onboarding_goals')}
          onContinue={() => {
            // Any signed-in flavor (replay review, or a new account's post-auth
            // onboarding): return to the app — never route an authenticated
            // user to the signup screen.
            if (onboardingReplay || postAuthOnboarding) {
              setOnboardingReplay(false);
              setPostAuthOnboarding(false);
              if (session) {
                setSetting(onboardingKey(session.user.id), 'true');
                // PUSH-ONLY: the user just entered/edited their setup locally.
                // A pull here would restore weekly_miles / weekly_fuel_cost /
                // profile from a stale cloud row and revert the edits.
                pushAll(session.user.id);
              }
              setStep('app');
            } else {
              setStep('signup');
            }
          }}
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
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {renderStep()}
      {!splashDone && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <AppSplashScreen
            onDone={() => {
              SplashScreen.hideAsync().catch(() => {});
              setSplashDone(true);
            }}
          />
        </View>
      )}
    </View>
  );
}
