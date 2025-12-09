import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'login-attempts' });

const LOGIN_ATTEMPTS_KEY = 'login_attempts_count';
const ACCOUNT_LOCKED_KEY = 'account_locked';
const SUCCESSFUL_LOGIN_COUNT_KEY = 'successful_login_count';

/**
 * Get current login attempts count
 */
export const getLoginAttempts = (): number => {
  return storage.getNumber(LOGIN_ATTEMPTS_KEY) || 0;
};

/**
 * Increment login attempts count
 * For demo: locks account on every 3rd attempt
 */
export const incrementLoginAttempts = (): number => {
  const currentAttempts = getLoginAttempts();
  const newAttempts = currentAttempts + 1;
  storage.set(LOGIN_ATTEMPTS_KEY, newAttempts);

  // For demo: lock account on every 3rd attempt
  if (newAttempts % 3 === 0) {
    setAccountLocked(true);
  }

  return newAttempts;
};

/**
 * Reset login attempts (call after successful login)
 */
export const resetLoginAttempts = (): void => {
  storage.delete(LOGIN_ATTEMPTS_KEY);
  setAccountLocked(false);
};

/**
 * Increment successful login count
 * Returns the new count
 */
export const incrementSuccessfulLoginCount = (): number => {
  const currentCount = storage.getNumber(SUCCESSFUL_LOGIN_COUNT_KEY) || 0;
  const newCount = currentCount + 1;
  storage.set(SUCCESSFUL_LOGIN_COUNT_KEY, newCount);
  return newCount;
};

/**
 * Get successful login count
 */
export const getSuccessfulLoginCount = (): number => {
  return storage.getNumber(SUCCESSFUL_LOGIN_COUNT_KEY) || 0;
};

/**
 * Reset successful login count
 */
export const resetSuccessfulLoginCount = (): void => {
  storage.delete(SUCCESSFUL_LOGIN_COUNT_KEY);
};

/**
 * Check if account is locked
 */
export const isAccountLocked = (): boolean => {
  return storage.getBoolean(ACCOUNT_LOCKED_KEY) || false;
};

/**
 * Set account locked status
 */
export const setAccountLocked = (locked: boolean): void => {
  storage.set(ACCOUNT_LOCKED_KEY, locked);
};

/**
 * Unlock account (for admin use)
 */
export const unlockAccount = (): void => {
  storage.set(ACCOUNT_LOCKED_KEY, false);
  storage.delete(LOGIN_ATTEMPTS_KEY);
};

