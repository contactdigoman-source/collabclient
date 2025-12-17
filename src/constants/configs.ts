import Config from 'react-native-config';

// Log URLs for debugging (remove in production if needed)
const privacyUrl = Config.PRIVACY_POLICY_URL || 'https://colab.nexaei.com/privacy-andriod';
const termsUrl = Config.TERM_AND_CONDITIONS_URL || 'https://colab.nexaei.com/terms-andriod';

// API Base URL for all API calls
const apiBaseUrl = Config.API_BASE_URL || 'http://localhost:8080';

// Note: Removed logger calls to avoid circular dependency
// (logger-service.ts imports Configs from this file)

export const Configs = {
  apiBaseUrl: apiBaseUrl,
  privacyPolicyUrl: privacyUrl,
  termsAndConditionsUrl: termsUrl,
  //   attendanceBaseUrl: Config.ATTENDANCE_BASE_URL,
  //   supportBaseUrl: Config.SUPPORT_BASE_URL,
  //   fileViewerBaseUrl: Config.FILE_VIEWER_BASE_URL,
  //   imageBaseUrl: Config.IMAGE_BASE_URL,
  googleMapsApiKey: Config.GOOGLE_MAPS_API_KEY || 'AIzaSyDNd3TT1CZZc5AkcRgSoJRleo-m_PLcQE0',
} as const;

