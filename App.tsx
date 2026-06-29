import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  NotoSansGurmukhi_400Regular,
  NotoSansGurmukhi_700Bold,
} from '@expo-google-fonts/noto-sans-gurmukhi';
import {
  NotoSansSC_400Regular,
  NotoSansSC_700Bold,
} from '@expo-google-fonts/noto-sans-sc';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PostHogProvider } from 'posthog-react-native';
import { initDatabase } from './src/db/database';
import { loadCachedMarketConfig, refreshMarketConfig } from './src/lib/marketConfig';
import { AuthProvider } from './src/contexts/AuthContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { PaywallProvider } from './src/contexts/PaywallContext';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/theme/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { initI18n, getSavedLanguage, SupportedLanguage } from './src/lib/i18n';
import { posthog } from './src/lib/analytics';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://c923a87f3ef94559c465375afb5e69bf@o4511626557587456.ingest.us.sentry.io/4511626562568192',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function App() {
  const [dbReady,    setDbReady]    = useState(false);
  const [i18nReady,  setI18nReady]  = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    // Inter — Latin (English, Spanish)
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // JetBrains Mono — Freight Terminal aesthetic headings
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    // Noto Sans Gurmukhi — Punjabi
    NotoSansGurmukhi_400Regular,
    NotoSansGurmukhi_700Bold,
    // Noto Sans SC — Chinese Simplified
    NotoSansSC_400Regular,
    NotoSansSC_700Bold,
  });

  // Init database
  useEffect(() => {
    try {
      initDatabase();
      // Apply the last-known fair-market baseline immediately, then refresh from
      // Supabase in the background (refinement #3a). Both no-op gracefully.
      loadCachedMarketConfig();
      refreshMarketConfig().catch(() => {});
    } catch (e) {
      console.error('DB init failed:', e);
    } finally {
      setDbReady(true);
    }
  }, []);

  // Init i18n with saved language
  useEffect(() => {
    async function init() {
      try {
        const lang = await getSavedLanguage();
        await initI18n((lang as SupportedLanguage) ?? 'en');
      } catch (e) {
        // i18next init failed — proceed anyway with whatever state i18n has so
        // the app never gets stuck on the splash. Strings may fall back to keys.
        console.error('i18n init failed:', e);
      } finally {
        setI18nReady(true);
      }
    }
    init();
  }, []);

  // Global failsafe: never let the loading gate block forever. If any init path
  // hangs (font fetch stall, native module wedge, etc.), force-open after 8s.
  const [failsafe, setFailsafe] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFailsafe(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!failsafe && ((!fontsLoaded && !fontError) || !dbReady || !i18nReady)) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <Sentry.ErrorBoundary>
    <SafeAreaProvider>
      <ThemeProvider>
        <PostHogProvider
          client={posthog}
          autocapture={{
            captureScreens: false,
            captureTouches: false,
          }}
        >
          <AuthProvider>
            <SubscriptionProvider>
              <PaywallProvider>
                <NavigationContainer>
                  <ThemedStatusBar />
                  <RootNavigator />
                </NavigationContainer>
              </PaywallProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </PostHogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </Sentry.ErrorBoundary>
  );
}

// Status bar follows the active theme (light icons on dark, dark icons on light).
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default Sentry.wrap(App);
