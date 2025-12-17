import i18n from 'i18next';
import { logger } from '../services/logger';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import { MMKV } from 'react-native-mmkv';

import en from './locales/en.json';
import es from './locales/es.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';

const storage = new MMKV();
const LANGUAGE_KEY = 'app_language';

// Get saved language or detect device language
const getInitialLanguage = (): string => {
  const savedLanguage = storage.getString(LANGUAGE_KEY);
  if (savedLanguage) {
    return savedLanguage;
  }

  // Detect device language
  const deviceLanguages = RNLocalize.getLocales();
  const deviceLanguage = deviceLanguages[0]?.languageCode || 'en';

  // Map device language to supported languages
  const supportedLanguages = ['en', 'es', 'hi', 'bn'];
  if (supportedLanguages.includes(deviceLanguage)) {
    return deviceLanguage;
  }

  // Default to English
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      es: { translation: es },
      hi: { translation: hi },
      bn: { translation: bn },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
    returnEmptyString: false,
    returnNull: false,
    returnObjects: false,
    // Return the key if translation is missing (for debugging)
    // But we'll handle fallbacks in components
    missingKeyHandler: (lng, ns, key) => {
      logger.warn(`Translation missing for key: ${key} in language: ${lng}`);
    },
  });

// Save language preference when changed
i18n.on('languageChanged', (lng) => {
  storage.set(LANGUAGE_KEY, lng);
});

export const changeLanguage = (languageCode: string): void => {
  i18n.changeLanguage(languageCode);
};

export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export default i18n;

