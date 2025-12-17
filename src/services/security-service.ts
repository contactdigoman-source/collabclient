import { NativeModules, Platform } from 'react-native';
import { logger } from './logger';

const { SecurityUtils } = NativeModules as {
  SecurityUtils?: {
    isUsbDebuggingEnabled: (
      callback: (error: Error | null, isEnabled: boolean) => void,
    ) => void;
    isDeveloperModeEnabled: (
      callback: (error: Error | null, isEnabled: boolean) => void,
    ) => void;
  };
};

/**
 * Check if USB debugging is enabled on the device
 * @returns Promise<boolean> true if USB debugging is enabled, false otherwise
 */
export const checkUsbDebuggingStatus = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'android') {
      // iOS doesn't have USB debugging in the same way, so always return false
      resolve(false);
      return;
    }

    if (!SecurityUtils) {
      logger.warn('SecurityUtils native module not found');
      // If module is not available, allow access (fail open for development)
      resolve(false);
      return;
    }

    SecurityUtils.isUsbDebuggingEnabled((error, isEnabled) => {
      if (error) {
        logger.error('Error checking USB debugging status', error);
        // On error, allow access (fail open)
        resolve(false);
        return;
      }
      resolve(isEnabled);
    });
  });
};

/**
 * Check if Developer Mode is enabled
 * @returns Promise<boolean> true if developer mode is enabled, false otherwise
 */
export const checkDeveloperModeStatus = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'android') {
      resolve(false);
      return;
    }

    if (!SecurityUtils) {
      resolve(false);
      return;
    }

    SecurityUtils.isDeveloperModeEnabled((error, isEnabled) => {
      if (error) {
        logger.error('Error checking developer mode status', error);
        resolve(false);
        return;
      }
      resolve(isEnabled);
    });
  });
};

