import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Provides a cleaner API for accessing translations
 */
export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  return {
    t,
    changeLanguage: (languageCode: string) => i18n.changeLanguage(languageCode),
    currentLanguage: i18n.language,
  };
};

