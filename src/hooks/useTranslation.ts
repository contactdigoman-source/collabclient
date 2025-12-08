import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Provides a cleaner API for accessing translations
 */
export const useTranslation = () => {
  const { t: originalT, i18n } = useI18nTranslation();

  // Wrapper function that ensures we get a proper translation or fallback
  const t = (key: string, fallback?: string): string => {
    try {
      const translation = originalT(key, { defaultValue: fallback || key });
      // If translation returns the key itself (meaning not found), use fallback
      if (translation === key && fallback) {
        return fallback;
      }
      // If translation is empty or just the key, use fallback
      if (!translation || (typeof translation === 'string' && translation.trim() === '') || translation === key) {
        return fallback || key;
      }
      return translation;
    } catch (error) {
      console.warn(`Translation error for key: ${key}`, error);
      return fallback || key;
    }
  };

  return {
    t,
    changeLanguage: (languageCode: string) => i18n.changeLanguage(languageCode),
    currentLanguage: i18n.language,
  };
};

