import React, { useState, useEffect } from 'react';
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
import { getSetting } from '../db/database';

type AppState =
  | 'loading'
  | 'language'
  | 'auth'
  | 'onboarding_fuel'
  | 'onboarding_expenses'
  | 'onboarding_miles'
  | 'onboarding_result'
  | 'app';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    async function determineState() {
      // 1. Check language
      const lang = await getSavedLanguage();
      if (!lang) {
        setAppState('language');
        return;
      }
      // 2. Check auth
      if (!session) {
        setAppState('auth');
        return;
      }
      // 3. Check onboarding
      const onboarded = getSetting('onboarding_completed');
      if (!onboarded) {
        setAppState('onboarding_fuel');
        return;
      }
      // 4. All done — go to app
      setAppState('app');
    }

    if (!authLoading) {
      determineState();
    }
  }, [session, authLoading]);

  if (appState === 'loading' || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  // Language picker — shown once on first launch
  if (appState === 'language') {
    return (
      <LanguagePickerScreen
        onLanguageSelected={() => setAppState('auth')}
      />
    );
  }

  // Onboarding flow — after sign up
  if (appState === 'onboarding_fuel') {
    return <OnboardingFuelScreen onNext={() => setAppState('onboarding_expenses')} />;
  }
  if (appState === 'onboarding_expenses') {
    return <OnboardingExpensesScreen onNext={() => setAppState('onboarding_miles')} />;
  }
  if (appState === 'onboarding_miles') {
    return <OnboardingMilesScreen onNext={() => setAppState('onboarding_result')} />;
  }
  if (appState === 'onboarding_result') {
    return <OnboardingResultScreen onComplete={() => setAppState('app')} />;
  }

  // Main app
  if (appState === 'app') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    );
  }

  // Auth screens
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="SignIn"  component={SignInScreen} />
      <Stack.Screen name="SignUp"  component={SignUpScreen} />
    </Stack.Navigator>
  );
}
