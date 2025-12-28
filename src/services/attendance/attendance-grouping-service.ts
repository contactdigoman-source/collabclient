import moment from 'moment';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { AttendanceDay, AttendanceDayRecord } from './attendance-service';
import { logger } from '../logger';
import { calculateWorkedHours } from './attendance-status-service';

/**
 * ATTENDANCE GROUPING SERVICE - Core business logic for attendance calculations
 *
 * This service contains the heart of the attendance system:
 * - Grouping records by date
 * - Handling overnight shifts
 * - Calculating attendance status (PRESENT/ABSENT/PARTIAL/HOURS_DEFICIT)
 * - Determining shift windows
 * - Calculating durations
 *
 * This is the core business logic that involves shift start/end times,
 * minimum hours requirements, and complex attendance rules.
 */

/**
 * Helper function to convert timestamp to numeric value
 */
function toNumericTimestamp(ts: string | number | undefined): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  // Try parsing as number first (most common case)
  const parsed = parseInt(ts, 10);
  if (!isNaN(parsed) && parsed > 1000000000000) {
    // Valid timestamp in milliseconds
    return parsed;
  }
  // Try parsing as date string (UTC)
  return moment.utc(ts).valueOf();
}

/**
 * Link overnight checkouts: Move early morning checkouts to previous day if it has unmatched check-in
 *
 * This handles cases where:
 * - Check-in on Day 1 (e.g., Dec 28, 3:30 PM)
 * - Check-out on Day 2 (e.g., Dec 29, 3:00 AM)
 *
 * The checkout should be linked back to Day 1 for correct attendance calculation.
 *
 * Heuristic: If checkout is before 6:00 AM and previous day has check-in without checkout, link them.
 */
function linkOvernightCheckouts(
  groupedByDate: Map<string, AttendanceRecord[]>
): Map<string, AttendanceRecord[]> {
  const dates = Array.from(groupedByDate.keys()).sort();
  const linkedMap = new Map(groupedByDate); // Create a copy to modify

  // Scan consecutive date pairs
  for (let i = 0; i < dates.length - 1; i++) {
    const today = dates[i];
    const tomorrow = dates[i + 1];

    const todayRecords = linkedMap.get(today) || [];
    const tomorrowRecords = linkedMap.get(tomorrow) || [];

    // Check if today has check-in without checkout
    const todayInCount = todayRecords.filter(r => r.PunchDirection === 'IN').length;
    const todayOutCount = todayRecords.filter(r => r.PunchDirection === 'OUT').length;
    const hasUnmatchedCheckIn = todayInCount > todayOutCount;

    // Check if tomorrow has early morning checkout (before 6 AM UTC)
    const earlyCheckouts = tomorrowRecords.filter(r => {
      if (r.PunchDirection !== 'OUT') return false;

      const timestamp = toNumericTimestamp(r.Timestamp);
      const hour = moment.utc(timestamp).hour();

      // Early morning checkout: before 6 AM UTC (which is ~11:30 AM IST)
      // This catches overnight shifts that end in early morning
      return hour < 6;
    });

    // If today has unmatched check-in and tomorrow has early checkout, link them
    if (hasUnmatchedCheckIn && earlyCheckouts.length > 0) {
      // Move the earliest checkout from tomorrow to today
      const checkoutToMove = earlyCheckouts.sort((a, b) => {
        const aTime = toNumericTimestamp(a.Timestamp);
        const bTime = toNumericTimestamp(b.Timestamp);
        return aTime - bTime; // Earliest first
      })[0];

      // Add checkout to today's records
      todayRecords.push(checkoutToMove);

      // Remove checkout from tomorrow's records
      const tomorrowFiltered = tomorrowRecords.filter(r => r !== checkoutToMove);

      // Update the map
      linkedMap.set(today, todayRecords);
      linkedMap.set(tomorrow, tomorrowFiltered);

      logger.debug('[linkOvernightCheckouts] Linked overnight checkout', {
        checkInDate: today,
        checkOutDate: tomorrow,
        checkOutTime: moment.utc(toNumericTimestamp(checkoutToMove.Timestamp)).format('HH:mm'),
        checkOutTimestamp: checkoutToMove.Timestamp,
      });
    }
  }

  return linkedMap;
}

/**
 * Check if today is within the shift window
 * Returns true if:
 * - The date is today (UTC)
 * - Current time is before shift end time (for overnight shifts, checks if before shift end or after shift start)
 */
function isTodayWithinShiftWindow(dateOfPunch: string, records: AttendanceRecord[]): boolean {
  try {
    // Check if date is today (check both UTC and IST to handle timezone edge cases)
    const todayUTC = moment.utc().format('YYYY-MM-DD');
    const todayIST = moment.utc().utcOffset(330).format('YYYY-MM-DD'); // IST is UTC+5:30
    const isToday = dateOfPunch === todayUTC || dateOfPunch === todayIST;

    if (!isToday) {
      logger.debug('[isTodayWithinShiftWindow] Not today', {
        dateOfPunch,
        todayUTC,
        todayIST,
      });
      return false; // Not today
    }

    // Get shift times from first check-in record
    const firstCheckIn = records.find(r => r.PunchDirection === 'IN');
    if (!firstCheckIn) {
      return false; // No check-in record to get shift times
    }

    const shiftStartTime = (firstCheckIn as any)?.ShiftStartTime;
    const shiftEndTime = (firstCheckIn as any)?.ShiftEndTime;

    if (!shiftStartTime || !shiftEndTime) {
      // If shift times aren't available but it's today and there's a check-in,
      // return true as a safe default (show green for today's check-in)
      logger.debug('[isTodayWithinShiftWindow] No shift times available, but today with check-in - showing green', {
        dateOfPunch,
        hasCheckIn: !!firstCheckIn,
      });
      return true; // Show green for today's check-in even if shift times aren't available
    }

    // Parse shift times (HH:mm format)
    const [startHour, startMin] = shiftStartTime.split(':').map(Number);
    const [endHour, endMin] = shiftEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Get current time in IST (UTC+5:30)
    const nowUTC = moment.utc();
    const nowIST = nowUTC.clone().utcOffset(330); // IST is UTC+5:30 = 330 minutes
    const currentHour = nowIST.hour();
    const currentMin = nowIST.minute();
    const currentMinutes = currentHour * 60 + currentMin;

    // Check if shift is overnight (end < start)
    const isOvernight = endMinutes < startMinutes;

    if (isOvernight) {
      // Overnight shift: Check if current time is:
      // - After shift start (evening) OR
      // - Before shift end (next morning)
      const isAfterStart = currentMinutes >= startMinutes;
      const isBeforeEnd = currentMinutes <= endMinutes;
      const isWithinWindow = isAfterStart || isBeforeEnd;

      logger.debug('[isTodayWithinShiftWindow] Overnight shift check', {
        dateOfPunch,
        shiftStartTime,
        shiftEndTime,
        currentTime: nowIST.format('HH:mm'),
        currentMinutes,
        startMinutes,
        endMinutes,
        isAfterStart,
        isBeforeEnd,
        isWithinWindow,
      });

      return isWithinWindow;
    } else {
      // Same-day shift: Check if current time is between start and end
      const isWithinWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

      logger.debug('[isTodayWithinShiftWindow] Same-day shift check', {
        dateOfPunch,
        shiftStartTime,
        shiftEndTime,
        currentTime: nowIST.format('HH:mm'),
        currentMinutes,
        startMinutes,
        endMinutes,
        isWithinWindow,
      });

      return isWithinWindow;
    }
  } catch (error) {
    logger.error('[isTodayWithinShiftWindow] Error checking shift window', error);
    return false; // On error, default to false (show normal status)
  }
}

/**
 * Calculate attendance status based on records
 *
 * Special handling for today:
 * - If today is within shift window and has check-in → Show PRESENT (green) instead of PARTIAL
 * - If today is within shift window and no check-in → Don't show ABSENT yet
 */
function calculateAttendanceStatus(
  records: AttendanceRecord[],
  dateOfPunch?: string
): 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'HOURS_DEFICIT' {
  if (!records || records.length === 0) {
    // Check if today is within shift window - if yes, don't show ABSENT yet
    if (dateOfPunch && isTodayWithinShiftWindow(dateOfPunch, records)) {
      // Today is within shift window, no records yet - return PARTIAL (will be handled as "in progress")
      return 'PARTIAL';
    }
    return 'ABSENT';
  }

  // Check if there's at least one IN punch
  const hasInPunch = records.some(r => r.PunchDirection === 'IN');

  if (!hasInPunch) {
    // Check if today is within shift window - if yes, don't show ABSENT yet
    if (dateOfPunch && isTodayWithinShiftWindow(dateOfPunch, records)) {
      return 'PARTIAL'; // Will be shown as "in progress" not ABSENT
    }
    return 'ABSENT';
  }

  // Check for complete pairs (IN-OUT pairs)
  let inCount = 0;
  let outCount = 0;

  records.forEach(record => {
    if (record.PunchDirection === 'IN') {
      inCount++;
    } else if (record.PunchDirection === 'OUT') {
      outCount++;
    }
  });

  // If last record is OUT, it's complete (PRESENT or PARTIAL based on duration)
  const lastRecord = records[records.length - 1];
  const isComplete = lastRecord.PunchDirection === 'OUT';

  if (isComplete && inCount === outCount) {
    // Calculate total duration
    const { totalDuration } = calculateDurations(records);

    // Parse duration string - handle both "HH:mm" and "H:mm" formats
    const durationParts = totalDuration.split(':');
    const hours = parseInt(durationParts[0] || '0', 10);
    const minutes = parseInt(durationParts[1] || '0', 10);
    const totalMinutes = hours * 60 + minutes;

    // Get minimum hours required from the first check-in record (stored at check-in)
    const firstCheckIn = records.find(r => r.PunchDirection === 'IN');
    const minimumHours = firstCheckIn?.MinimumHoursRequired || 8; // Default to 8 hours if not set
    const minimumMinutes = minimumHours * 60;

    logger.debug('[calculateAttendanceStatus] Checking hours', {
      totalDuration,
      parsedHours: hours,
      parsedMinutes: minutes,
      totalMinutes,
      minimumHours,
      minimumMinutes,
      hasMinimumHoursRequired: !!firstCheckIn?.MinimumHoursRequired,
      firstCheckInTimestamp: firstCheckIn?.Timestamp,
      dateOfPunch: firstCheckIn?.DateOfPunch,
    });

    // If worked less than minimum hours, return HOURS_DEFICIT (complete checkout but insufficient hours)
    if (totalMinutes < minimumMinutes) {
      logger.debug('[calculateAttendanceStatus] Hours deficit detected', {
        totalMinutes,
        minimumMinutes,
        deficit: minimumMinutes - totalMinutes,
        deficitHours: (minimumMinutes - totalMinutes) / 60,
      });
      return 'HOURS_DEFICIT'; // Changed from 'PARTIAL' to 'HOURS_DEFICIT'
    }
    logger.debug('[calculateAttendanceStatus] Present - met minimum hours', {
      totalMinutes,
      minimumMinutes,
      surplus: totalMinutes - minimumMinutes,
      surplusHours: (totalMinutes - minimumMinutes) / 60,
    });
    return 'PRESENT';
  }

  // If last record is IN (not checked out)
  // Special case: If today is within shift window and has check-in → Show PRESENT (green) instead of PARTIAL
  if (dateOfPunch && isTodayWithinShiftWindow(dateOfPunch, records)) {
    logger.debug('[calculateAttendanceStatus] Today within shift window with check-in - showing PRESENT', {
      dateOfPunch,
      lastRecordDirection: lastRecord.PunchDirection,
      inCount,
      outCount,
    });
    return 'PRESENT'; // Show green if check-in is present, even if incomplete
  }

  logger.debug('[calculateAttendanceStatus] Incomplete (no checkout)', {
    lastRecordDirection: lastRecord.PunchDirection,
    inCount,
    outCount,
  });
  return 'PARTIAL';
}

/**
 * Calculate total duration and break duration from records
 * RULE: Total Duration = Last Checkout - First Checkin
 */
function calculateDurations(records: AttendanceRecord[]): {
  totalDuration: string;
  breakDuration: string;
} {
  if (!records || records.length === 0) {
    return { totalDuration: '00:00', breakDuration: '00:00' };
  }

  // Find first CHECK-IN
  const firstCheckIn = records.find(r => r.PunchDirection === 'IN');

  // Find last CHECK-OUT
  let lastCheckOut: AttendanceRecord | null = null;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].PunchDirection === 'OUT') {
      lastCheckOut = records[i];
      break;
    }
  }

  let totalMinutes = 0;
  let breakMinutes = 0;

  // Calculate total duration: Last Checkout - First Checkin
  if (firstCheckIn && lastCheckOut) {
    const firstInTime = toNumericTimestamp(firstCheckIn.Timestamp);
    const lastOutTime = toNumericTimestamp(lastCheckOut.Timestamp);

    // Simple calculation in milliseconds, then convert to minutes
    const durationMs = lastOutTime - firstInTime;
    totalMinutes = Math.max(0, Math.floor(durationMs / (1000 * 60)));
  }

  // Calculate break duration (time between OUT and next IN for break records)
  for (let i = 0; i < records.length - 1; i++) {
    const currentRecord = records[i];
    const nextRecord = records[i + 1];

    // If current is OUT with a break status and next is IN, calculate break duration
    if (currentRecord.PunchDirection === 'OUT' &&
        nextRecord.PunchDirection === 'IN' &&
        currentRecord.AttendanceStatus &&
        currentRecord.AttendanceStatus.trim() !== '') {
      const outTime = toNumericTimestamp(currentRecord.Timestamp);
      const inTime = toNumericTimestamp(nextRecord.Timestamp);
      const breakDuration = Math.max(0, Math.floor((inTime - outTime) / (1000 * 60)));
      breakMinutes += breakDuration;
    }
  }

  // Format durations as HH:mm
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(Math.max(0, minutes) / 60);
    const mins = Math.max(0, minutes) % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return {
    totalDuration: formatDuration(totalMinutes),
    breakDuration: formatDuration(breakMinutes),
  };
}

/**
 * Group attendance records by date and calculate durations
 * This transforms database records into the grouped format used by UI
 */
export function groupAttendanceByDate(
  records: AttendanceRecord[]
): AttendanceDay[] {
  if (!records || records.length === 0) {
    logger.debug('[groupAttendanceByDate] No records provided');
    return [];
  }

  logger.debug(`[groupAttendanceByDate] Processing ${records.length} records`, {
    sampleRecords: records.slice(0, 3).map(r => ({
      Timestamp: r.Timestamp,
      PunchDirection: r.PunchDirection,
      IsSynced: r.IsSynced,
      DateOfPunch: r.DateOfPunch,
    })),
  });

  // Group records by date
  const groupedByDate = new Map<string, AttendanceRecord[]>();

  records.forEach((record) => {
    // Use LinkedEntryDate if present (for overnight shift checkouts), otherwise use DateOfPunch
    let dateKey: string;
    if ((record as any).LinkedEntryDate && record.PunchDirection === 'OUT') {
      // For overnight shift checkouts, use the linked entry date (check-in date)
      dateKey = (record as any).LinkedEntryDate;
      logger.debug('[groupAttendanceByDate] Using LinkedEntryDate for overnight checkout', {
        recordDate: record.DateOfPunch,
        linkedDate: dateKey,
        timestamp: record.Timestamp,
      });
    } else if (record.DateOfPunch) {
      dateKey = record.DateOfPunch;
    } else if (record.Timestamp) {
      let timestamp: number;
      if (typeof record.Timestamp === 'string') {
        // Try parsing as number first (most common case)
        const parsed = parseInt(record.Timestamp, 10);
        if (!isNaN(parsed) && parsed > 1000000000000) {
          // Valid timestamp in milliseconds
          timestamp = parsed;
        } else {
          // Try parsing as date string (UTC)
          timestamp = moment.utc(record.Timestamp).valueOf();
        }
      } else {
        timestamp = record.Timestamp;
      }
      dateKey = moment.utc(timestamp).format('YYYY-MM-DD');
    } else {
      logger.warn('[groupAttendanceByDate] Skipping record without date', {
        Timestamp: record.Timestamp,
        DateOfPunch: record.DateOfPunch,
        PunchDirection: record.PunchDirection,
      });
      return; // Skip records without date
    }

    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, []);
    }
    groupedByDate.get(dateKey)!.push(record);
  });

  logger.debug(`[groupAttendanceByDate] Grouped into ${groupedByDate.size} dates`);

  // Link overnight checkouts: Move early morning checkouts to previous day if it has unmatched check-in
  const linkedGroupedByDate = linkOvernightCheckouts(groupedByDate);

  // Transform each date group into AttendanceDay format
  const attendanceDays: AttendanceDay[] = [];

  linkedGroupedByDate.forEach((dayRecords, dateOfPunch) => {
    logger.debug(`[groupAttendanceByDate] Processing date ${dateOfPunch}`, { recordCount: dayRecords.length });
    // Sort records by timestamp (ascending - earliest first)
    const sortedRecords = dayRecords.sort((a, b) => {
      const aTime = toNumericTimestamp(a.Timestamp);
      const bTime = toNumericTimestamp(b.Timestamp);
      return aTime - bTime;
    });

    // Transform to AttendanceDayRecord format (preserve IsSynced and CreatedOn for display)
    const transformedRecords: AttendanceDayRecord[] = sortedRecords.map((record) => ({
      Timestamp: toNumericTimestamp(record.Timestamp),
      PunchDirection: record.PunchDirection || 'IN',
      AttendanceStatus: record.AttendanceStatus || null,
      LatLon: record.LatLon,
      Address: record.Address,
      DateOfPunch: dateOfPunch,
      IsSynced: record.IsSynced || 'Y', // Default to 'Y' if not specified
      CreatedOn: toNumericTimestamp(record.CreatedOn || record.Timestamp),
    }));

    // Calculate attendance status (pass dateOfPunch to check if today is within shift window)
    const attendanceStatus = calculateAttendanceStatus(sortedRecords, dateOfPunch);

    // Calculate durations
    const { totalDuration, breakDuration } = calculateDurations(sortedRecords);

    // Calculate worked hours (decimal format)
    const workedHours = calculateWorkedHours(sortedRecords);

    // Check if any record requires approval
    const requiresApproval = sortedRecords.some(r => r.ApprovalRequired === 'Y');

    attendanceDays.push({
      dateOfPunch,
      attendanceStatus,
      totalDuration,
      breakDuration,
      records: transformedRecords,
      workedHours,
      requiresApproval,
    });
  });

  // Sort by date (most recent first) - using UTC
  return attendanceDays.sort((a, b) =>
    moment.utc(b.dateOfPunch).diff(moment.utc(a.dateOfPunch))
  );
}
