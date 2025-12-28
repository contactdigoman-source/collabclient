import moment from 'moment';
import {logger} from '../logger';

/**
 * Overnight Shift Service
 * 
 * Handles logic for shifts that cross midnight (e.g., 18:00 - 03:00)
 * Ensures check-in is logged on Day 1 and check-out on Day 2
 */

/**
 * Detect if a shift crosses midnight
 * 
 * @param shiftStart - Shift start time in "HH:mm" format (e.g., "18:00")
 * @param shiftEnd - Shift end time in "HH:mm" format (e.g., "03:00")
 * @returns true if shift crosses midnight, false otherwise
 * 
 * @example
 * isOvernightShift("18:00", "03:00") // true - overnight shift
 * isOvernightShift("09:00", "18:00") // false - same day shift
 * isOvernightShift("23:00", "01:00") // true - crosses midnight
 */
export function isOvernightShift(
  shiftStart: string,
  shiftEnd: string
): boolean {
  try {
    const [startHour, startMinute] = shiftStart.split(':').map(Number);
    const [endHour, endMinute] = shiftEnd.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    // If end time is less than start time, shift crosses midnight
    const isOvernight = endMinutes < startMinutes;
    
    logger.debug('isOvernightShift', {
      shiftStart,
      shiftEnd,
      startMinutes,
      endMinutes,
      isOvernight,
    });
    
    return isOvernight;
  } catch (error) {
    logger.error('Error detecting overnight shift', error);
    return false;
  }
}

/**
 * Calculate which calendar day a checkout belongs to
 * For overnight shifts, checkout may be on Day 2
 * 
 * @param checkInDate - Check-in date in "YYYY-MM-DD" format
 * @param checkoutTimestamp - Checkout timestamp (milliseconds)
 * @param shiftStart - Shift start time in "HH:mm" format
 * @param shiftEnd - Shift end time in "HH:mm" format
 * @returns Checkout date in "YYYY-MM-DD" format
 * 
 * @example
 * // Check-in: Dec 19 18:00, Check-out: Dec 20 03:00
 * getCheckoutDate("2025-12-19", 1734668400000, "18:00", "03:00")
 * // Returns: "2025-12-20"
 */
export function getCheckoutDate(
  checkInDate: string,
  checkoutTimestamp: number,
  shiftStart: string,
  shiftEnd: string
): string {
  try {
    const checkoutMoment = moment(checkoutTimestamp);
    const checkoutDate = checkoutMoment.format('YYYY-MM-DD');
    
    // If not an overnight shift, checkout is same day as derived from timestamp
    if (!isOvernightShift(shiftStart, shiftEnd)) {
      logger.debug('getCheckoutDate: Same-day shift', {
        checkInDate,
        checkoutDate,
      });
      return checkoutDate;
    }
    
    // For overnight shifts, checkout date is naturally the next calendar day
    // The timestamp already reflects the correct date
    logger.debug('getCheckoutDate: Overnight shift', {
      checkInDate,
      checkoutDate,
      shiftStart,
      shiftEnd,
    });
    
    return checkoutDate;
  } catch (error) {
    logger.error('Error calculating checkout date', error);
    return moment(checkoutTimestamp).format('YYYY-MM-DD');
  }
}

/**
 * Link Day 2 checkout back to Day 1 entry for overnight shifts
 * 
 * @param checkInDate - Check-in date in "YYYY-MM-DD" format (Day 1)
 * @param checkoutDate - Check-out date in "YYYY-MM-DD" format (Day 2)
 * @returns Object with primaryDate (check-in) and linkedDate (checkout)
 * 
 * @example
 * linkOvernightEntry("2025-12-19", "2025-12-20")
 * // Returns: { primaryDate: "2025-12-19", linkedDate: "2025-12-20" }
 */
export function linkOvernightEntry(
  checkInDate: string,
  checkoutDate: string
): { primaryDate: string; linkedDate: string } {
  logger.debug('linkOvernightEntry', {
    checkInDate,
    checkoutDate,
  });
  
  return {
    primaryDate: checkInDate,
    linkedDate: checkoutDate,
  };
}

/**
 * Determine if a timestamp falls within the overnight portion of a shift
 * Used to determine if a checkout on Day 2 belongs to Day 1's shift
 * 
 * @param timestamp - The timestamp to check
 * @param shiftStart - Shift start time in "HH:mm" format
 * @param shiftEnd - Shift end time in "HH:mm" format
 * @returns true if timestamp is in the overnight portion (after midnight before shift end)
 * 
 * @example
 * // For shift 18:00-03:00, a checkout at 02:00 is in overnight portion
 * isInOvernightPortion(timestamp_at_02_00, "18:00", "03:00") // true
 * // A checkout at 20:00 is in the same day portion
 * isInOvernightPortion(timestamp_at_20_00, "18:00", "03:00") // false
 */
export function isInOvernightPortion(
  timestamp: number,
  shiftStart: string,
  shiftEnd: string
): boolean {
  try {
    if (!isOvernightShift(shiftStart, shiftEnd)) {
      return false;
    }
    
    const timeMoment = moment(timestamp);
    const timeHour = timeMoment.hours();
    const timeMinute = timeMoment.minutes();
    const timeInMinutes = timeHour * 60 + timeMinute;
    
    const [endHour, endMinute] = shiftEnd.split(':').map(Number);
    const endInMinutes = endHour * 60 + endMinute;
    
    // If time is before shift end time (which is early morning), it's overnight portion
    const isOvernight = timeInMinutes <= endInMinutes;
    
    logger.debug('isInOvernightPortion', {
      timestamp: timeMoment.format('YYYY-MM-DD HH:mm'),
      timeInMinutes,
      endInMinutes,
      isOvernight,
    });
    
    return isOvernight;
  } catch (error) {
    logger.error('Error checking overnight portion', error);
    return false;
  }
}

