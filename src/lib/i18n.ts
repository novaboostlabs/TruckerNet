import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

import en from '../translations/en.json';
import es from '../translations/es.json';
import pa from '../translations/pa.json';
import zh from '../translations/zh.json';

export type SupportedLanguage = 'en' | 'es' | 'pa' | 'zh';

export const LANGUAGES: {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
  flag: string;
}[] = [
  { code: 'en', nativeName: 'English',  englishName: 'English', flag: '🇺🇸' },
  { code: 'es', nativeName: 'Español',  englishName: 'Spanish', flag: '🇲🇽' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ',   englishName: 'Punjabi', flag: '🇮🇳' },
  { code: 'zh', nativeName: '中文',      englishName: 'Chinese', flag: '🇨🇳' },
];

export const LANGUAGE_STORAGE_KEY = '@truckernet_language';

export async function getSavedLanguage(): Promise<SupportedLanguage | null> {
  try {
    const lang = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    return (lang as SupportedLanguage) || null;
  } catch {
    return null;
  }
}

export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
  } catch {}
}

export async function initI18n(language: SupportedLanguage = 'en'): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      pa: { translation: pa },
      zh: { translation: zh },
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export default i18n;
