import moment from 'moment';
import { logger } from '../services/logger';

// Default shift times (UTC)
const DEFAULT_SHIFT_START_TIME = '09:00';

/**
 * Get shift start time with default fallback
 * @param shiftStartTime - Shift start time in HH:mm format (e.g., "09:00")
 * @returns shift start time or default (09:00)
 */
function getShiftStartTime(shiftStartTime?: string): string {
  return shiftStartTime || DEFAULT_SHIFT_START_TIME;
}

/**
 * Get the shift start time timestamp for today
 * @param shiftStartTime - Shift start time in HH:mm format (e.g., "09:00"), defaults to 09:00
 * @returns timestamp in milliseconds, or null if invalid
 */
export function getShiftStartTimestamp(shiftStartTime?: string): number | null {
  const startTime = getShiftStartTime(shiftStartTime);

  try {
    const today = moment.utc().format('YYYY-MM-DD');
    const shiftStartDateTime = moment.utc(`${today} ${startTime}`, 'YYYY-MM-DD HH:mm');
    
    if (!shiftStartDateTime.isValid()) {
      logger.warn('Invalid shift start time format', undefined, { startTime });
      return null;
    }

    return shiftStartDateTime.valueOf(); // Returns milliseconds
  } catch (error) {
    logger.error('Error getting shift start timestamp', error);
    return null;
  }
}

/**
 * Check if user needs auto-checkout (3 hours after check-in without checkout)
 * @param checkInTimestamp - Check-in timestamp in milliseconds
 * @returns true if 3 hours have passed since check-in, false otherwise
 */
export function needsAutoCheckout(checkInTimestamp: number | null | undefined): boolean {
  if (!checkInTimestamp) {
    return false;
  }

  try {
    const now = moment.utc();
    const checkInTime = moment.utc(checkInTimestamp);
    
    // Calculate 3 hours after check-in
    const autoCheckoutTime = checkInTime.clone().add(3, 'hours');
    
    // Return true if current time is after auto-checkout time
    return now.isAfter(autoCheckoutTime);
  } catch (error) {
      logger.error('Error checking auto-checkout condition', error);
    return false;
  }
}

