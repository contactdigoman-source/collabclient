/**
 * Session management utilities
 */

import { logger } from '../logger';

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

