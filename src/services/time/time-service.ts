import { NativeModules, Platform } from 'react-native';
import apiClient from '../api/api-client';
import { logger } from '../logger';
import moment from 'moment';

const { SecurityUtils } = NativeModules as {
  SecurityUtils?: {
    isAutomaticTimeEnabled?: (
      callback: (error: Error | null, isEnabled: boolean) => void,
    ) => void;
  };
};

export interface CurrentTimeResponse {
  currentTime: string; // ISO 8601 format
  timezone: string; // Timezone name (e.g., "Asia/Kolkata", "America/New_York")
  timezoneOffset: number; // Offset in minutes from UTC
  timestamp: number; // Unix timestamp in milliseconds
}

export interface ClockAccuracyCheck {
  isAccurate: boolean;
  deviceTime: number; // Device time in milliseconds
  serverTime: number; // Server time in milliseconds
  differenceMinutes: number; // Absolute difference in minutes
  differenceSeconds: number; // Absolute difference in seconds
}

/**
 * Get current time and timezone from server
 */
export const getCurrentTimeAndZone = async (): Promise<CurrentTimeResponse> => {
  try {
    logger.debug('Fetching current time and timezone');

    const response = await apiClient.get<CurrentTimeResponse>(
      '/api/time/current',
    );

    logger.info('Current time and timezone fetched', { 
      timezone: response.data.timezone,
      currentTime: response.data.currentTime,
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to fetch current time and timezone', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to fetch current time and timezone'
    );
  }
};

/**
 * Check if automatic time setting is enabled on the device (no server call needed)
 * @returns Promise<boolean> true if automatic time is enabled, false otherwise
 */
export const isAutomaticTimeEnabled = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'android') {
      if (!SecurityUtils?.isAutomaticTimeEnabled) {
        logger.warn('isAutomaticTimeEnabled native method not available');
        // If method is not available, assume enabled (fail open)
        resolve(true);
        return;
      }

      SecurityUtils.isAutomaticTimeEnabled((error, isEnabled) => {
        if (error) {
          logger.error('Error checking automatic time status', error);
          // On error, assume enabled (fail open)
          resolve(true);
          return;
        }
        resolve(isEnabled);
      });
    } else if (Platform.OS === 'ios') {
      // iOS: Check Settings -> General -> Date & Time -> Set Automatically
      // Note: iOS doesn't expose this via public API, so we'll use a workaround
      // For iOS, we can't directly check, so we'll assume it's enabled if we can't check
      // or fall back to server time check
      logger.debug('iOS: Automatic time check not directly available, will use server time if needed');
      resolve(true); // Assume enabled for iOS (fail open)
    } else {
      resolve(true); // Unknown platform, assume enabled
    }
  });
};

/**
 * Check if device clock is accurate by comparing with server time
 * @param allowedDifferenceMinutes Maximum allowed difference in minutes (default: 5 minutes)
 * @param useServerTime If true, uses server time API. If false, only checks if auto-time is enabled.
 * @returns Promise<ClockAccuracyCheck> Object containing accuracy status and time difference
 */
export const checkClockAccuracy = async (
  allowedDifferenceMinutes: number = 5,
  useServerTime: boolean = false
): Promise<ClockAccuracyCheck> => {
  try {
    // First, check if automatic time is enabled (no server call needed)
    const autoTimeEnabled = await isAutomaticTimeEnabled();
    
    if (!useServerTime && autoTimeEnabled) {
      // If auto-time is enabled, assume clock is accurate (no need for server call)
      logger.debug('Clock accuracy check: Automatic time enabled, assuming accurate');
      const deviceTime = Date.now();
      return {
        isAccurate: true,
        deviceTime,
        serverTime: deviceTime, // Same as device time since we're not checking server
        differenceMinutes: 0,
        differenceSeconds: 0,
      };
    }

    // If auto-time is disabled OR useServerTime is true, check against server
    if (!autoTimeEnabled) {
      logger.warn('Clock accuracy check: Automatic time is disabled');
    }

    // Get server time for comparison
    const serverTimeData = await getCurrentTimeAndZone();
    const serverTime = serverTimeData.timestamp;

    // Get device time (UTC milliseconds)
    const deviceTime = Date.now();

    // Calculate difference in milliseconds
    const differenceMs = Math.abs(deviceTime - serverTime);
    const differenceSeconds = Math.floor(differenceMs / 1000);
    const differenceMinutes = Math.floor(differenceSeconds / 60);

    const isAccurate = differenceMinutes <= allowedDifferenceMinutes;

    logger.debug('Clock accuracy check', {
      autoTimeEnabled,
      deviceTime: new Date(deviceTime).toISOString(),
      serverTime: new Date(serverTime).toISOString(),
      differenceMinutes,
      differenceSeconds,
      isAccurate,
      allowedDifferenceMinutes,
    });

    return {
      isAccurate,
      deviceTime,
      serverTime,
      differenceMinutes,
      differenceSeconds,
    };
  } catch (error: any) {
    logger.error('Failed to check clock accuracy', error);
    // On error, assume clock is accurate to avoid blocking user
    // This is a "fail open" approach - if we can't check, allow access
    return {
      isAccurate: true,
      deviceTime: Date.now(),
      serverTime: Date.now(),
      differenceMinutes: 0,
      differenceSeconds: 0,
    };
  }
};

