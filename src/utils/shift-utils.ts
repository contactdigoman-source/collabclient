import moment from 'moment';
import { logger } from '../services/logger';
import { createTimestampFromDateTime, getCurrentUTCDate, getDateFromUTCTimestamp } from './time-utils';

// Default shift times (in UTC format from API)
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
 * Shift times from API are in UTC format
 * @param shiftStartTime - Shift start time in HH:mm format (e.g., "09:00") in UTC, defaults to 09:00
 * @returns timestamp in milliseconds (UTC), or null if invalid
 */
export function getShiftStartTimestamp(shiftStartTime?: string): number | null {
  const startTime = getShiftStartTime(shiftStartTime);

  try {
    // Get today's date in UTC (since shift times are in UTC)
    const todayUTC = getCurrentUTCDate();
    // Create UTC timestamp from UTC date/time
    return createTimestampFromDateTime(todayUTC, startTime);
  } catch (error) {
    logger.error('Error getting shift start timestamp', error);
    return null;
  }
}

/**
 * Get shift end time with default fallback
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @returns shift end time or default (17:00, which is 8 hours after default start 09:00)
 */
function getShiftEndTime(shiftEndTime?: string): string {
  return shiftEndTime || '17:00'; // Default: 8 hours after 09:00 (9am to 5pm UTC)
}

/**
 * Get the shift end time timestamp for a given date
 * Shift times from API are in UTC format
 * @param date - Date in YYYY-MM-DD format in UTC (defaults to today in UTC)
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00") in UTC, defaults to 17:00
 * @returns timestamp in milliseconds (UTC), or null if invalid
 */
export function getShiftEndTimestamp(
  date?: string,
  shiftEndTime?: string
): number | null {
  const endTime = getShiftEndTime(shiftEndTime);
  // If date not provided, use today's date in UTC (since shift times are in UTC)
  const targetDate = date || getCurrentUTCDate();

  try {
    // Create UTC timestamp from UTC date/time
    return createTimestampFromDateTime(targetDate, endTime);
  } catch (error) {
    logger.error('Error getting shift end timestamp', error);
    return null;
  }
}

/**
 * Check if user needs auto-checkout based on shift end time
 * @param checkInTimestamp - Check-in timestamp in milliseconds
 * @param checkInDate - Date of check-in in YYYY-MM-DD format (optional, will be derived from timestamp if not provided)
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @param bufferHours - Hours to add after shift end time before auto-checkout (default: 2 hours)
 * @returns true if current time is past shift end time + buffer, false otherwise
 */
export function needsAutoCheckoutByShiftEnd(
  checkInTimestamp: number | null | undefined,
  checkInDate?: string,
  shiftEndTime?: string,
  bufferHours: number = 2
): boolean {
  if (!checkInTimestamp) {
    return false;
  }

  try {
    // Get current time in UTC
    const now = moment.utc();
    
    // Get check-in date if not provided (timestamp is UTC)
    // Shift times are in UTC, so use UTC date
    const checkInUTC = moment.utc(checkInTimestamp);
    const date = checkInDate || checkInUTC.format('YYYY-MM-DD');
    
    // Get shift end timestamp for the check-in date
    // Shift times are in UTC
    const shiftEndTimestamp = getShiftEndTimestamp(date, shiftEndTime);
    if (!shiftEndTimestamp) {
      // Fallback to old 3-hour logic if shift end time is invalid
      logger.warn('Invalid shift end time, falling back to 3-hour check');
      const autoCheckoutTime = checkInUTC.clone().add(3, 'hours');
      return now.isAfter(autoCheckoutTime);
    }
    
    // Calculate auto-checkout time: shift end + buffer hours (all in UTC)
    const shiftEndUTC = moment.utc(shiftEndTimestamp);
    const autoCheckoutTime = shiftEndUTC.clone().add(bufferHours, 'hours');
    
    // Return true if current UTC time is after auto-checkout time
    return now.isAfter(autoCheckoutTime);
  } catch (error) {
    logger.error('Error checking auto-checkout condition by shift end', error);
    return false;
  }
}

/**
 * Check if user needs auto-checkout (3 hours after check-in without checkout)
 * @deprecated Use needsAutoCheckoutByShiftEnd instead for shift-based auto-checkout
 * @param checkInTimestamp - Check-in timestamp in milliseconds
 * @returns true if 3 hours have passed since check-in, false otherwise
 */
export function needsAutoCheckout(checkInTimestamp: number | null | undefined): boolean {
  if (!checkInTimestamp) {
    return false;
  }

  try {
    // Get current time in UTC
    const now = moment.utc();
    // Interpret check-in timestamp as UTC
    const checkInTime = moment.utc(checkInTimestamp);
    
    // Calculate 3 hours after check-in
    const autoCheckoutTime = checkInTime.clone().add(3, 'hours');
    
    // Return true if current UTC time is after auto-checkout time
    return now.isAfter(autoCheckoutTime);
  } catch (error) {
      logger.error('Error checking auto-checkout condition', error);
    return false;
  }
}

