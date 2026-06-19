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
  NotoSansGurmukhi_400Regular,
  NotoSansGurmukhi_700Bold,
} from '@expo-google-fonts/noto-sans-gurmukhi';
import {
  NotoSansSC_400Regular,
  NotoSansSC_700Bold,
} from '@expo-google-fonts/noto-sans-sc';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from './src/db/database';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/theme/theme';
import { initI18n, getSavedLanguage, SupportedLanguage } from './src/lib/i18n';

export default function App() {
  const [dbReady,    setDbReady]    = useState(false);
  const [i18nReady,  setI18nReady]  = useState(false);

  const [fontsLoaded] = useFonts({
    // Inter — Latin (English, Spanish)
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
    } catch (e) {
      console.error('DB init failed:', e);
    } finally {
      setDbReady(true);
    }
  }, []);

  // Init i18n with saved language
  useEffect(() => {
    async function init() {
      const lang = await getSavedLanguage();
      await initI18n((lang as SupportedLanguage) ?? 'en');
      setI18nReady(true);
    }
    init();
  }, []);

  if (!fontsLoaded || !dbReady || !i18nReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
