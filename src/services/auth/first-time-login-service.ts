import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const FIRST_TIME_LOGIN_KEY = 'has_completed_first_time_login';

/**
 * Check if user has completed first-time login
 * @returns true if user has completed first-time login, false otherwise
 */
export const hasCompletedFirstTimeLogin = (): boolean => {
  try {
    return storage.getBoolean(FIRST_TIME_LOGIN_KEY) || false;
  } catch (error) {
    console.log('Error checking first-time login status:', error);
    return false;
  }
};

/**
 * Mark first-time login as completed
 */
export const markFirstTimeLoginCompleted = (): void => {
  try {
    storage.set(FIRST_TIME_LOGIN_KEY, true);
  } catch (error) {
    console.log('Error marking first-time login as completed:', error);
  }
};

/**
 * Reset first-time login status (useful for testing or logout)
 */
export const resetFirstTimeLogin = (): void => {
  try {
    storage.delete(FIRST_TIME_LOGIN_KEY);
  } catch (error) {
    console.log('Error resetting first-time login status:', error);
  }
};

