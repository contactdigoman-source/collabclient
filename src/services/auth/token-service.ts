import * as Keychain from 'react-native-keychain';
import { logger } from '../logger';

/**
 * Securely store JWT token in Keychain
 */
export const storeJWTToken = async (token: string, email: string, refreshToken?: string): Promise<void> => {
  try {
    await Keychain.setGenericPassword('jwt_token', token, {
      service: `jwt_${email}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
    logger.info('JWT token stored securely');
    
    // Store refresh token if provided
    if (refreshToken) {
      await Keychain.setGenericPassword('refresh_token', refreshToken, {
        service: `refresh_token_${email}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      logger.info('Refresh token stored securely');
    }
  } catch (error) {
    logger.error('Failed to store JWT token', error as Error, undefined, {
      email,
    });
    throw new Error('Failed to store authentication token');
  }
};

/**
 * Get stored JWT token from Keychain
 */
export const getJWTToken = async (email: string): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: `jwt_${email}`,
    });
    return credentials ? credentials.password : null;
  } catch (error) {
    logger.error('Failed to get JWT token', error as Error, undefined, {
      email,
    });
    return null;
  }
};

/**
 * Get stored refresh token from Keychain
 */
export const getRefreshToken = async (email: string): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: `refresh_token_${email}`,
    });
    return credentials ? credentials.password : null;
  } catch (error) {
    logger.error('Failed to get refresh token', error as Error, undefined, {
      email,
    });
    return null;
  }
};

/**
 * Clear JWT token from Keychain
 */
export const clearJWTToken = async (email: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({
      service: `jwt_${email}`,
    });
    // Also clear refresh token
    await Keychain.resetGenericPassword({
      service: `refresh_token_${email}`,
    });
  } catch (error) {
    logger.error('Error clearing JWT token', error);
  }
};

