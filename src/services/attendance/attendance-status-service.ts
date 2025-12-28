/**
 * ATTENDANCE STATUS SERVICE
 * 
 * Provides utility functions for calculating attendance status, worked hours,
 * and determining UI button states (stale check-ins, missed checkouts, etc.)
 */

import moment from 'moment';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { logger } from '../logger';
import { getShiftEndTimestamp } from '../../utils/shift-utils';

/**
 * Calculate worked hours from first CHECK_IN to last CHECK_OUT
 * Formula: lastCheckOutTime - firstCheckInTime
 * Supports multiple check-ins/checkouts per shift
 * 
 * @param records - Array of attendance records for a specific date (sorted chronologically)
 * @returns Worked hours as decimal number (e.g., 8.5 = 8 hours 30 minutes)
 */
export function calculateWorkedHours(records: AttendanceRecord[]): number {
  const logContext = { 
    _context: { 
      service: 'attendance', 
      fileName: 'attendance-status-service.ts', 
      methodName: 'calculateWorkedHours' 
    } 
  };

  if (!records || records.length === 0) {
    logger.debug('calculateWorkedHours: No records provided', logContext);
    return 0;
  }

  // Find first CHECK_IN
  let firstCheckIn: number | null = null;
  for (const record of records) {
    if (record.PunchDirection === 'IN') {
      firstCheckIn = typeof record.Timestamp === 'string' 
        ? parseInt(record.Timestamp, 10) 
        : record.Timestamp;
      break;
    }
  }

  if (!firstCheckIn) {
    logger.debug('calculateWorkedHours: No CHECK_IN found', { ...logContext, recordCount: records.length });
    return 0;
  }

  // Find last CHECK_OUT
  let lastCheckOut: number | null = null;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].PunchDirection === 'OUT') {
      lastCheckOut = typeof records[i].Timestamp === 'string' 
        ? parseInt(records[i].Timestamp as string, 10) 
        : records[i].Timestamp;
      break;
    }
  }

  if (!lastCheckOut) {
    // Still checked in - calculate from first check-in to now
    const now = moment.utc().valueOf();
    const durationMs = now - firstCheckIn;
    const hours = durationMs / (1000 * 60 * 60);
    
    logger.debug('calculateWorkedHours: Still checked in', {
      ...logContext,
      firstCheckIn,
      now,
      hours: hours.toFixed(2),
    });
    
    return Math.max(0, hours);
  }

  // Calculate hours from first check-in to last checkout
  const durationMs = lastCheckOut - firstCheckIn;
  const hours = durationMs / (1000 * 60 * 60);

  logger.debug('calculateWorkedHours: Calculated', {
    ...logContext,
    firstCheckIn,
    lastCheckOut,
    durationMs,
    hours: hours.toFixed(2),
  });

  return Math.max(0, hours);
}

/**
 * Get attendance status color based on records and business rules
 * 
 * Rules:
 * - YELLOW: Approval required (manual correction like forgot checkout)
 * - RED: Worked hours < minimum (only evaluated at end of day/shift)
 * - GREEN: Valid attendance (hours >= minimum, no approval needed)
 * 
 * @param records - Array of attendance records for a specific date
 * @param minimumHours - Minimum hours required for valid attendance
 * @param isEndOfDay - Whether this is end-of-day evaluation (for RED status)
 * @returns Status color: 'GREEN' | 'RED' | 'YELLOW'
 */
export function getAttendanceStatusColor(
  records: AttendanceRecord[],
  minimumHours: number,
  isEndOfDay: boolean = false
): 'GREEN' | 'RED' | 'YELLOW' {
  const logContext = { 
    _context: { 
      service: 'attendance', 
      fileName: 'attendance-status-service.ts', 
      methodName: 'getAttendanceStatusColor' 
    } 
  };

  if (!records || records.length === 0) {
    logger.debug('getAttendanceStatusColor: No records', logContext);
    return 'RED';
  }

  // Check if any record requires approval (YELLOW takes precedence)
  const requiresApproval = records.some(r => r.ApprovalRequired === 'Y');
  if (requiresApproval) {
    logger.debug('getAttendanceStatusColor: Requires approval (YELLOW)', {
      ...logContext,
      recordCount: records.length,
    });
    return 'YELLOW';
  }

  // RED status only evaluated at end of day (not during active shift)
  if (isEndOfDay) {
    const workedHours = calculateWorkedHours(records);
    
    if (workedHours < minimumHours) {
      logger.debug('getAttendanceStatusColor: Hours deficit (RED)', {
        ...logContext,
        workedHours: workedHours.toFixed(2),
        minimumHours,
      });
      return 'RED';
    }
  }

  logger.debug('getAttendanceStatusColor: Valid (GREEN)', {
    ...logContext,
    recordCount: records.length,
    isEndOfDay,
  });
  return 'GREEN';
}

/**
 * Check if check-in is stale (> 3 days old)
 * Stale check-ins should force CHECK_IN button only
 * 
 * @param lastCheckInTime - Timestamp of last check-in (milliseconds)
 * @returns true if check-in is stale (> 3 days), false otherwise
 */
export function isStaleCheckIn(lastCheckInTime: number): boolean {
  if (!lastCheckInTime) {
    return false;
  }

  const now = moment.utc();
  const checkInMoment = moment.utc(lastCheckInTime);
  const daysDiff = now.diff(checkInMoment, 'days', true);

  const isStale = daysDiff > 3;

  // Only log if stale (reduce verbosity)
  if (isStale) {
    logger.debug('isStaleCheckIn: Check-in is stale', {
      _context: { 
        service: 'attendance', 
        fileName: 'attendance-status-service.ts', 
        methodName: 'isStaleCheckIn' 
      },
      lastCheckInTime,
      daysDiff: daysDiff.toFixed(2),
    });
  }

  return isStale;
}

/**
 * Check if user missed checkout (forgot to check out)
 * Conditions:
 * 1. Last action = CHECK_IN
 * 2. now <= lastCheckInTime + 3 days (not stale)
 * 3. now > shiftEndTime + buffer (e.g., 2 hours)
 * 
 * @param lastCheckInTime - Timestamp of last check-in (milliseconds)
 * @param checkInDate - Date of check-in (YYYY-MM-DD format)
 * @param shiftEndTime - Shift end time in HH:mm format (e.g., "17:00")
 * @param bufferHours - Hours to add after shift end before considering missed (default: 2)
 * @returns true if checkout was missed, false otherwise
 */
export function isMissedCheckout(
  lastCheckInTime: number,
  checkInDate: string,
  shiftEndTime: string,
  bufferHours: number = 2
): boolean {
  if (!lastCheckInTime || !checkInDate || !shiftEndTime) {
    return false;
  }


  // Get shift end timestamp for check-in date
  const shiftEndTimestamp = getShiftEndTimestamp(checkInDate, shiftEndTime);
  if (!shiftEndTimestamp) {
    logger.warn('isMissedCheckout: Invalid shift end time', {
      _context: { 
        service: 'attendance', 
        fileName: 'attendance-status-service.ts', 
        methodName: 'isMissedCheckout' 
      },
      checkInDate,
      shiftEndTime,
    });
    return false;
  }

  // Calculate auto-checkout time: shift end + buffer hours
  const shiftEndMoment = moment.utc(shiftEndTimestamp);
  const autoCheckoutTime = shiftEndMoment.clone().add(bufferHours, 'hours');
  const now = moment.utc();

  // Missed checkout if current time > auto-checkout time
  const isMissed = now.isAfter(autoCheckoutTime);

  // Only log if missed (reduce verbosity)
  if (isMissed) {
    logger.debug('isMissedCheckout: Detected missed checkout', {
      _context: { 
        service: 'attendance', 
        fileName: 'attendance-status-service.ts', 
        methodName: 'isMissedCheckout' 
      },
      lastCheckInTime,
      checkInDate,
      shiftEndTime,
      autoCheckoutTime: autoCheckoutTime.format('YYYY-MM-DD HH:mm'),
      now: now.format('YYYY-MM-DD HH:mm'),
    });
  }

  return isMissed;
}

/**
 * Get the status color for a specific attendance record
 * This is a convenience function for single-record status
 * 
 * @param record - Single attendance record
 * @param minimumHours - Minimum hours required
 * @param isEndOfDay - Whether this is end-of-day evaluation
 * @returns Status color: 'GREEN' | 'RED' | 'YELLOW'
 */
export function getRecordStatusColor(
  record: AttendanceRecord,
  minimumHours: number,
  isEndOfDay: boolean = false
): 'GREEN' | 'RED' | 'YELLOW' {
  return getAttendanceStatusColor([record], minimumHours, isEndOfDay);
}

/**
 * Attendance status type definition
 * 
 * - PRESENT: Complete check-in/out AND hours >= minimum
 * - ABSENT: No check-in
 * - HOURS_DEFICIT: Complete check-in/out AND hours < minimum (NEVER requires approval)
 * - PENDING_APPROVAL: Forgot checkout OR manual time correction
 */
export type AttendanceStatus = 
  | 'PRESENT'           // Complete + hours >= minimum
  | 'ABSENT'            // No check-in
  | 'HOURS_DEFICIT'     // Complete + hours < minimum (NEVER approval)
  | 'PENDING_APPROVAL'  // Forgot checkout OR manual time
  | 'PARTIAL';          // Temporary status for backward compatibility

/**
 * Calculate attendance status based on records and business rules
 * 
 * Rules (Authoritative):
 * 1. No check-in -> ABSENT
 * 2. Correction type (forgot/manual) -> PENDING_APPROVAL
 * 3. Check-in + check-out AND hours >= minimum -> PRESENT
 * 4. Check-in + check-out AND hours < minimum -> HOURS_DEFICIT (NEVER approval)
 * 5. Check-in without check-out -> PENDING_APPROVAL
 * 
 * @param records - Array of attendance records for a specific date
 * @param minimumHours - Minimum hours required for valid attendance
 * @returns Attendance status
 */
export function calculateAttendanceStatus(
  records: AttendanceRecord[],
  minimumHours: number
): AttendanceStatus {
  const logContext = { 
    _context: { 
      service: 'attendance', 
      fileName: 'attendance-status-service.ts', 
      methodName: 'calculateAttendanceStatus' 
    } 
  };

  // Rule 1: No check-in -> ABSENT
  if (!records || records.length === 0) {
    logger.debug('calculateAttendanceStatus: ABSENT (no records)', logContext);
    return 'ABSENT';
  }

  const hasCheckIn = records.some(r => r.PunchDirection === 'IN');
  if (!hasCheckIn) {
    logger.debug('calculateAttendanceStatus: ABSENT (no check-in)', {
      ...logContext,
      recordCount: records.length,
    });
    return 'ABSENT';
  }

  // Rule 2: Check if pending approval due to correction
  const hasCorrectionType = records.some(r => 
    r.CorrectionType === 'FORGOT_CHECKOUT' || 
    r.CorrectionType === 'MANUAL_TIME'
  );
  
  if (hasCorrectionType) {
    logger.debug('calculateAttendanceStatus: PENDING_APPROVAL (correction type)', {
      ...logContext,
      recordCount: records.length,
    });
    return 'PENDING_APPROVAL';
  }

  // Rule 3 & 4: Check if complete checkout
  const hasCheckOut = records.some(r => r.PunchDirection === 'OUT');
  
  if (hasCheckOut) {
    const hours = calculateWorkedHours(records);
    
    if (hours >= minimumHours) {
      logger.debug('calculateAttendanceStatus: PRESENT', {
        ...logContext,
        hours: hours.toFixed(2),
        minimumHours,
      });
      return 'PRESENT';
    } else {
      // Rule 4: Hours deficit NEVER requires approval
      logger.debug('calculateAttendanceStatus: HOURS_DEFICIT', {
        ...logContext,
        hours: hours.toFixed(2),
        minimumHours,
      });
      return 'HOURS_DEFICIT';
    }
  }

  // Rule 5: Incomplete (still checked in)
  logger.debug('calculateAttendanceStatus: PENDING_APPROVAL (incomplete)', {
    ...logContext,
    recordCount: records.length,
  });
  return 'PENDING_APPROVAL';
}

/**
 * Map attendance status to color for UI display
 * 
 * @param status - Attendance status
 * @returns Color: 'GREEN' | 'RED' | 'YELLOW'
 */
export function getStatusColorFromStatus(
  status: AttendanceStatus
): 'GREEN' | 'RED' | 'YELLOW' {
  switch (status) {
    case 'PRESENT':
      return 'GREEN';
    case 'ABSENT':
    case 'HOURS_DEFICIT':
    case 'PARTIAL':  // Backward compatibility
      return 'RED';
    case 'PENDING_APPROVAL':
      return 'YELLOW';
    default:
      return 'RED';
  }
}

