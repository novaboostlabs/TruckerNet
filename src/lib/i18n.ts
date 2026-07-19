import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { secureGet, secureSet } from './secureStorage';
import { getSetting, setSetting } from '../db/database';

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

// No leading "@" — SecureStore keys may only contain alphanumerics, ".", "-",
// and "_" (unlike AsyncStorage, where "@app:key" is a common convention).
// The old "@truckernet_language" key was invalid syntax and every write threw
// immediately — the language preference has never once been successfully
// saved. Renaming (not just stripping "@" in place) makes that explicit: any
// stale, unreadable value under the old key is simply orphaned, never read.
export const LANGUAGE_STORAGE_KEY = 'truckernet_language';

const VALID: SupportedLanguage[] = ['en', 'es', 'pa', 'zh'];
const isValid = (v: unknown): v is SupportedLanguage =>
  typeof v === 'string' && (VALID as string[]).includes(v);

/**
 * Resolve the saved language from BOTH stores. SecureStore is primary (it
 * survives sign-out and is written by the welcome picker); SQLite settings is
 * the fallback. Reading both matters because (a) the in-app Settings switcher
 * historically wrote only SQLite, and (b) the FIRST keychain read after a cold
 * boot can transiently return null (AFTER_FIRST_UNLOCK timing) — the SQLite
 * fallback then still returns the right language instead of defaulting to en.
 */
export async function getSavedLanguage(): Promise<SupportedLanguage | null> {
  const secure = await secureGet(LANGUAGE_STORAGE_KEY);
  if (isValid(secure)) return secure;
  try {
    const sql = getSetting('language');
    if (isValid(sql)) return sql;
  } catch { /* DB not ready yet — ignore */ }
  return null;
}

/** Persist to BOTH stores so the two sources can never disagree again. */
export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  await secureSet(LANGUAGE_STORAGE_KEY, lang);
  try { setSetting('language', lang); } catch { /* DB not ready — ignore */ }
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

// Maps the active UI language to a BCP-47 locale for date formatting, so
// month/weekday names render in the user's language (not always English).
// Note: number/money formatting deliberately stays 'en-US' app-wide (USD).
const DATE_LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-MX',
  pa: 'pa-IN',
  zh: 'zh-CN',
};

export function getDateLocale(): string {
  const lang = i18n.language?.split('-')[0] as SupportedLanguage;
  return DATE_LOCALES[lang] ?? 'en-US';
}

export default i18n;
