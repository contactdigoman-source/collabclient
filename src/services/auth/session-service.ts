/**
 * Session management utilities
 */

import { logger } from '../logger';
import { refreshAccessToken } from './refresh-token-service';

/**
 * Check if the session has expired based on expiresAt timestamp
 * Uses device's local time to compare with expiration timestamp.
 * This is a lightweight check that only compares timestamps - it won't drain battery.
 * 
 * @param expiresAt - ISO 8601 timestamp string from server
 * @returns true if session is expired, false otherwise
 */
export const isSessionExpired = (expiresAt: string | null): boolean => {
  // If no expiration date is provided, we can't determine if it's expired
  // Return false to allow access (might be old session format or API didn't return it)
  if (!expiresAt) {
    logger.debug('[Session] No expiration date provided, allowing access');
    return false; // No expiration date means we can't determine, so allow access
  }

  try {
    const expirationDate = new Date(expiresAt);
    
    // Check if date parsing was successful
    if (isNaN(expirationDate.getTime())) {
      logger.error('[Session] Invalid expiration date format', undefined, undefined, { expiresAt });
      return true; // Invalid date means expired
    }
    
    // Use UTC time for comparison to avoid timezone issues
    const now = new Date();
    const expirationTime = expirationDate.getTime();
    const currentTime = now.getTime();
    const isExpired = currentTime >= expirationTime;
    
    // Debug logging with more details
    logger.debug('[Session] Checking expiration', {
      expiresAt,
      expirationDateUTC: expirationDate.toISOString(),
      expirationDateLocal: expirationDate.toString(),
      nowUTC: now.toISOString(),
      nowLocal: now.toString(),
      expirationTime,
      currentTime,
      isExpired,
      timeUntilExpirationMs: expirationTime - currentTime,
      timeUntilExpirationDays: (expirationTime - currentTime) / (1000 * 60 * 60 * 24),
      deviceYear: now.getFullYear(),
      expirationYear: expirationDate.getFullYear(),
    });
    
    // Additional validation: if expiration year is in the future compared to device year,
    // but device thinks it's expired, there might be a clock issue
    if (expirationDate.getFullYear() > now.getFullYear() && isExpired) {
      logger.warn('[Session] WARNING: Expiration year is in future but marked as expired. Possible device clock issue.');
    }
    
    return isExpired;
  } catch (error) {
    logger.error('[Session] Error parsing expiration date', error, undefined, { expiresAt });
    return true; // If we can't parse, consider it expired
  }
};

/**
 * Check if the session is about to expire within the specified minutes
 * @param expiresAt - ISO 8601 timestamp string from server
 * @param minutesBeforeExpiry - Number of minutes before expiry to consider "about to expire" (default: 30)
 * @returns true if session will expire within the specified minutes, false otherwise
 */
export const isSessionAboutToExpire = (
  expiresAt: string | null,
  minutesBeforeExpiry: number = 30
): boolean => {
  if (!expiresAt) {
    return false; // No expiration date means we can't determine
  }

  try {
    const expirationDate = new Date(expiresAt);
    
    if (isNaN(expirationDate.getTime())) {
      return false; // Invalid date
    }
    
    const now = new Date();
    const expirationTime = expirationDate.getTime();
    const currentTime = now.getTime();
    const timeUntilExpirationMs = expirationTime - currentTime;
    const minutesUntilExpiration = timeUntilExpirationMs / (1000 * 60);
    
    // Check if session will expire within the specified minutes
    const isAboutToExpire = minutesUntilExpiration > 0 && minutesUntilExpiration <= minutesBeforeExpiry;
    
    logger.debug('[Session] Checking if about to expire', {
      expiresAt,
      minutesUntilExpiration,
      minutesBeforeExpiry,
      isAboutToExpire,
    });
    
    return isAboutToExpire;
  } catch (error) {
    logger.error('[Session] Error checking if about to expire', error, undefined, { expiresAt });
    return false;
  }
};

/**
 * Check session and refresh token if about to expire
 * This function checks if the session is expired or about to expire,
 * and automatically refreshes the token if needed.
 * @param expiresAt - ISO 8601 timestamp string from server (from Redux state)
 * @param minutesBeforeExpiry - Number of minutes before expiry to refresh token (default: 30)
 * @returns Promise<boolean> - true if session is valid (or was refreshed), false if expired
 */
export const checkAndRefreshSession = async (
  expiresAt: string | null,
  minutesBeforeExpiry: number = 30
): Promise<boolean> => {
  // If no expiration date, we can't check - assume valid
  if (!expiresAt) {
    logger.debug('[Session] No expiration date, assuming session is valid');
    return true;
  }

  // Check if session is already expired
  if (isSessionExpired(expiresAt)) {
    logger.warn('[Session] Session has expired');
    return false;
  }

  // Check if session is about to expire and refresh if needed
  if (isSessionAboutToExpire(expiresAt, minutesBeforeExpiry)) {
    try {
      logger.info('[Session] Session about to expire, refreshing token', {
        expiresAt,
        minutesBeforeExpiry,
      });
      
      // Refresh the token - this will update JWT, refreshToken, and expiresAt in Redux
      const refreshResult = await refreshAccessToken();
      
      logger.info('[Session] Token refreshed successfully', {
        newExpiresAt: refreshResult.expiresAt,
      });
      
      // After refresh, verify the new token is valid
      if (refreshResult.expiresAt && isSessionExpired(refreshResult.expiresAt)) {
        logger.error('[Session] New token is already expired - this should not happen');
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('[Session] Failed to refresh token', error);
      // If refresh fails, check if the original session is still valid
      // If it's expired now, return false
      if (isSessionExpired(expiresAt)) {
        return false;
      }
      // If refresh failed but session is still valid, return true
      // The user can continue, but token might expire soon
      return true;
    }
  }

  // Session is valid and not about to expire
  return true;
};

