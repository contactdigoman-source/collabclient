/**
 * SHIFT DETECTION SERVICE
 * 
 * Provides utility functions for detecting overlapping shifts and determining
 * when to create new attendance entries vs. continuing existing ones
 */

import moment from 'moment';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { logger } from '../logger';
import { getShiftEndTimestamp } from '../../utils/shift-utils';
import { getCurrentUTCDate } from '../../utils/time-utils';

/**
 * Determine if a new attendance entry should be created
 * 
 * Rules:
 * 1. Create new entry if check-in occurs after shift end time
 * 2. Create new entry if check-in occurs after previous checkout + buffer (1 hour)
 * 3. Otherwise, continue existing shift
 * 
 * @param lastCheckout - Last checkout record (null if no previous checkout)
 * @param checkInTime - Timestamp of new check-in (milliseconds)
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @param bufferHours - Hours to add after checkout before new entry (default: 1)
 * @returns true if new entry should be created, false to continue existing
 */
export function shouldCreateNewEntry(
  lastCheckout: AttendanceRecord | null,
  checkInTime: number,
  shiftEndTime: string,
  bufferHours: number = 1
): boolean {
  const logContext = { 
    _context: { 
      service: 'attendance', 
      fileName: 'shift-detection-service.ts', 
      methodName: 'shouldCreateNewEntry' 
    } 
  };

  // If no previous checkout, continue existing entry or start new day
  if (!lastCheckout) {
    logger.debug('shouldCreateNewEntry: No previous checkout, check date to determine', {
      ...logContext,
      checkInTime,
      checkInDate: moment.utc(checkInTime).format('YYYY-MM-DD'),
    });
    // Caller should handle date-based logic
    return false;
  }

  const checkInMoment = moment.utc(checkInTime);
  const lastCheckoutTime = typeof lastCheckout.Timestamp === 'string'
    ? parseInt(lastCheckout.Timestamp, 10)
    : lastCheckout.Timestamp;
  const lastCheckoutMoment = moment.utc(lastCheckoutTime);
  const lastCheckoutDate = lastCheckout.DateOfPunch || lastCheckoutMoment.format('YYYY-MM-DD');

  // Rule 1: Check if check-in occurs after shift end time
  const shiftEndTimestamp = getShiftEndTimestamp(lastCheckoutDate, shiftEndTime);
  if (shiftEndTimestamp) {
    const shiftEndMoment = moment.utc(shiftEndTimestamp);
    
    if (checkInMoment.isAfter(shiftEndMoment)) {
      logger.debug('shouldCreateNewEntry: Check-in after shift end time, create new entry', {
        ...logContext,
        checkInTime: checkInMoment.format('YYYY-MM-DD HH:mm'),
        shiftEndTime: shiftEndMoment.format('YYYY-MM-DD HH:mm'),
        lastCheckoutDate,
      });
      return true;
    }
  }

  // Rule 2: Check if check-in occurs after previous checkout + buffer
  const bufferEndTime = lastCheckoutMoment.clone().add(bufferHours, 'hours');
  
  if (checkInMoment.isAfter(bufferEndTime)) {
    logger.debug('shouldCreateNewEntry: Check-in after checkout + buffer, create new entry', {
      ...logContext,
      checkInTime: checkInMoment.format('YYYY-MM-DD HH:mm'),
      lastCheckoutTime: lastCheckoutMoment.format('YYYY-MM-DD HH:mm'),
      bufferEndTime: bufferEndTime.format('YYYY-MM-DD HH:mm'),
      bufferHours,
    });
    return true;
  }

  // Continue existing shift
  logger.debug('shouldCreateNewEntry: Continue existing shift', {
    ...logContext,
    checkInTime: checkInMoment.format('YYYY-MM-DD HH:mm'),
    lastCheckoutTime: lastCheckoutMoment.format('YYYY-MM-DD HH:mm'),
  });
  return false;
}

/**
 * Calculate the correct date for a new check-in based on shift and checkout logic
 * 
 * Rules:
 * 1. If no previous attendance or last was OUT, use current date or calculated date
 * 2. For overlapping shifts (spans midnight), keep entry under check-in date
 * 3. If check-in after shift end OR after checkout + buffer, use next appropriate date
 * 
 * @param lastCheckout - Last checkout record (null if no previous checkout)
 * @param checkInTime - Timestamp of new check-in (milliseconds)
 * @param shiftStartTime - Shift start time in HH:mm format (e.g., "09:00")
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @returns Date string in YYYY-MM-DD format for the new check-in
 */
export function getCheckInEntryDate(
  lastCheckout: AttendanceRecord | null,
  checkInTime: number,
  shiftStartTime: string,
  shiftEndTime: string
): string {
  const logContext = { 
    _context: { 
      service: 'attendance', 
      fileName: 'shift-detection-service.ts', 
      methodName: 'getCheckInEntryDate' 
    } 
  };

  const checkInMoment = moment.utc(checkInTime);
  const today = getCurrentUTCDate();

  // If no last checkout, use today
  if (!lastCheckout) {
    logger.debug('getCheckInEntryDate: No previous checkout, using today', {
      ...logContext,
      date: today,
    });
    return today;
  }

  const lastCheckoutTime = typeof lastCheckout.Timestamp === 'string'
    ? parseInt(lastCheckout.Timestamp, 10)
    : lastCheckout.Timestamp;
  const lastCheckoutMoment = moment.utc(lastCheckoutTime);
  const lastCheckoutDate = lastCheckout.DateOfPunch || lastCheckoutMoment.format('YYYY-MM-DD');

  // Check if shift spans 2 days
  const [startHour, startMin] = shiftStartTime.split(':').map(Number);
  const [endHour, endMin] = shiftEndTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const doesShiftSpanTwoDays = endMinutes < startMinutes;

  // If normal shift (doesn't span midnight)
  if (!doesShiftSpanTwoDays) {
    // Check if current check-in is on a different calendar date
    const checkInDate = checkInMoment.format('YYYY-MM-DD');
    
    if (checkInDate !== lastCheckoutDate) {
      logger.debug('getCheckInEntryDate: Different day from checkout, using check-in date', {
        ...logContext,
        checkInDate,
        lastCheckoutDate,
      });
      return checkInDate;
    }
    
    // Same day - check if new entry should be created
    if (shouldCreateNewEntry(lastCheckout, checkInTime, shiftEndTime)) {
      // New entry on same calendar day (e.g., evening shift after morning shift)
      logger.debug('getCheckInEntryDate: New entry on same day', {
        ...logContext,
        date: checkInDate,
      });
      return checkInDate;
    }
    
    // Continue same shift
    logger.debug('getCheckInEntryDate: Continue same shift, using checkout date', {
      ...logContext,
      date: lastCheckoutDate,
    });
    return lastCheckoutDate;
  }

  // 2-day shift logic
  const shiftEndTimestamp = getShiftEndTimestamp(lastCheckoutDate, shiftEndTime);
  if (!shiftEndTimestamp) {
    logger.warn('getCheckInEntryDate: Invalid shift end time, using today', {
      ...logContext,
      date: today,
    });
    return today;
  }

  const shiftEndMoment = moment.utc(shiftEndTimestamp);

  // Check if checkout was on/after shift end time
  if (lastCheckoutMoment.isSameOrAfter(shiftEndMoment)) {
    // Checkout was on/after shift end, next check-in should be next day
    const nextDay = moment.utc(today).add(1, 'day').format('YYYY-MM-DD');
    logger.debug('getCheckInEntryDate: 2-day shift, checkout after shift end, using next day', {
      ...logContext,
      nextDay,
      lastCheckoutTime: lastCheckoutMoment.format('YYYY-MM-DD HH:mm'),
      shiftEndTime: shiftEndMoment.format('YYYY-MM-DD HH:mm'),
    });
    return nextDay;
  }

  // Check if current check-in is on/after shift start time
  const [currentHour, currentMin] = [checkInMoment.hour(), checkInMoment.minute()];
  const currentMinutes = currentHour * 60 + currentMin;

  if (currentMinutes >= startMinutes) {
    // Check-in at/after shift start, it's next day's check-in
    const nextDay = moment.utc(today).add(1, 'day').format('YYYY-MM-DD');
    logger.debug('getCheckInEntryDate: 2-day shift, check-in at/after shift start, using next day', {
      ...logContext,
      nextDay,
      currentMinutes,
      startMinutes,
    });
    return nextDay;
  }

  // Check-in before shift start, use today
  logger.debug('getCheckInEntryDate: 2-day shift, check-in before shift start, using today', {
    ...logContext,
    date: today,
  });
  return today;
}

/**
 * Check if an attendance entry is complete (has matching IN and OUT)
 * 
 * @param records - Array of attendance records for a specific date
 * @returns true if entry is complete (last record is OUT), false otherwise
 */
export function isAttendanceEntryComplete(records: AttendanceRecord[]): boolean {
  if (!records || records.length === 0) {
    return false;
  }

  const lastRecord = records[records.length - 1];
  return lastRecord.PunchDirection === 'OUT';
}

/**
 * Check if shift has ended based on current time
 * 
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @param date - Date to check (YYYY-MM-DD format), defaults to today
 * @returns true if shift has ended, false otherwise
 */
export function hasShiftEnded(shiftEndTime: string, date?: string): boolean {
  const targetDate = date || getCurrentUTCDate();
  const shiftEndTimestamp = getShiftEndTimestamp(targetDate, shiftEndTime);
  
  if (!shiftEndTimestamp) {
    return false;
  }

  const now = moment.utc();
  const shiftEndMoment = moment.utc(shiftEndTimestamp);
  
  return now.isAfter(shiftEndMoment);
}

