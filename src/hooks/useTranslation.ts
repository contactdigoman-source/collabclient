import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Provides a cleaner API for accessing translations
 */
export const useTranslation = () => {
  const { t: originalT, i18n } = useI18nTranslation();

  // Wrapper function that ensures we get a proper translation or fallback
  // Supports both string fallback and interpolation object
  const t = (key: string, fallbackOrOptions?: string | Record<string, any>): string => {
    try {
      // Check if second parameter is an object (interpolation) or string (fallback)
      if (typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null) {
        // Interpolation object provided - pass it directly to originalT
        // originalT supports { defaultValue?: string, ...interpolation }
        const translation = originalT(key, fallbackOrOptions);
        // If translation returns the key itself (meaning not found), check for defaultValue
        if (translation === key && 'defaultValue' in fallbackOrOptions && fallbackOrOptions.defaultValue) {
          return fallbackOrOptions.defaultValue;
        }
        return translation;
      } else {
        // String fallback provided (or undefined)
        const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
        const translation = originalT(key, { defaultValue: fallback });
        // If translation returns the key itself (meaning not found), use fallback
        if (translation === key && fallback !== key) {
          return fallback;
        }
        // If translation is empty or just the key, use fallback
        if (!translation || (typeof translation === 'string' && translation.trim() === '') || translation === key) {
          return fallback;
        }
        return translation;
      }
    } catch (error) {
      console.warn(`Translation error for key: ${key}`, error);
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
      return fallback;
    }
  };

  return {
    t,
    changeLanguage: (languageCode: string) => i18n.changeLanguage(languageCode),
    currentLanguage: i18n.language,
  };
};

