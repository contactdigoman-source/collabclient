import moment from 'moment';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { AttendanceDay, AttendanceDayRecord } from './attendance-service';
import { logger } from '../logger';

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
    // Use DateOfPunch if available, otherwise derive from Timestamp
    let dateKey: string;
    if (record.DateOfPunch) {
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
  
  // Transform each date group into AttendanceDay format
  const attendanceDays: AttendanceDay[] = [];

  groupedByDate.forEach((dayRecords, dateOfPunch) => {
    logger.debug(`[groupAttendanceByDate] Processing date ${dateOfPunch}`, { recordCount: dayRecords.length });
    // Sort records by timestamp (ascending - earliest first)
    const sortedRecords = dayRecords.sort((a, b) => {
      const aTime = toNumericTimestamp(a.Timestamp);
      const bTime = toNumericTimestamp(b.Timestamp);
      return aTime - bTime;
    });

    // Transform to AttendanceDayRecord format
    const transformedRecords: AttendanceDayRecord[] = sortedRecords.map((record) => ({
      Timestamp: toNumericTimestamp(record.Timestamp),
      PunchDirection: record.PunchDirection || 'IN',
      AttendanceStatus: record.AttendanceStatus || null,
      LatLon: record.LatLon,
      Address: record.Address,
      DateOfPunch: dateOfPunch,
    }));

    // Calculate attendance status
    const attendanceStatus = calculateAttendanceStatus(sortedRecords);

    // Calculate durations
    const { totalDuration, breakDuration } = calculateDurations(sortedRecords);

    attendanceDays.push({
      dateOfPunch,
      attendanceStatus,
      totalDuration,
      breakDuration,
      records: transformedRecords,
    });
  });

  // Sort by date (most recent first) - using UTC
  return attendanceDays.sort((a, b) => 
    moment.utc(b.dateOfPunch).diff(moment.utc(a.dateOfPunch))
  );
}

/**
 * Calculate attendance status based on records
 */
function calculateAttendanceStatus(records: AttendanceRecord[]): 'PRESENT' | 'ABSENT' | 'PARTIAL' {
  if (!records || records.length === 0) {
    return 'ABSENT';
  }

  // Check if there's at least one IN punch
  const hasInPunch = records.some(r => r.PunchDirection === 'IN');
  
  if (!hasInPunch) {
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
    const [hours, minutes] = totalDuration.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // If worked less than 4 hours, consider it PARTIAL
    if (totalMinutes < 240) {
      return 'PARTIAL';
    }
    return 'PRESENT';
  }

  // If last record is IN (not checked out), it's PARTIAL
  return 'PARTIAL';
}

/**
 * Calculate total duration and break duration from records
 */
function calculateDurations(records: AttendanceRecord[]): {
  totalDuration: string;
  breakDuration: string;
} {
  if (!records || records.length === 0) {
    return { totalDuration: '00:00', breakDuration: '00:00' };
  }

  let totalMinutes = 0;
  let breakMinutes = 0;

  // Process records chronologically, pairing IN-OUT
  let i = 0;
  while (i < records.length) {
    const record = records[i];
    
      if (record.PunchDirection === 'IN') {
      const inTime = toNumericTimestamp(record.Timestamp);
      let outTime: number | null = null;
      let outRecord: AttendanceRecord | null = null;
      
      // Find the next OUT record
      for (let j = i + 1; j < records.length; j++) {
        if (records[j].PunchDirection === 'OUT') {
          outRecord = records[j];
          outTime = toNumericTimestamp(records[j].Timestamp);
          break;
        }
      }
      
      if (outTime !== null && outRecord) {
        // Complete IN-OUT pair (timestamps are in UTC)
        const duration = Math.max(0, moment.utc(outTime).diff(moment.utc(inTime), 'minutes'));
        totalMinutes += duration;

        // Check if this OUT is a break (has attendance status)
        if (outRecord.AttendanceStatus && 
            outRecord.AttendanceStatus.trim() !== '' && 
            outRecord.AttendanceStatus !== null) {
          // Find the next IN after this OUT (end of break)
          const nextInRecord = records.find((r, idx) => 
            idx > records.indexOf(outRecord!) && r.PunchDirection === 'IN'
          );
          
          if (nextInRecord) {
            const breakEndTime = toNumericTimestamp(nextInRecord.Timestamp);
            const breakDuration = Math.max(0, moment.utc(breakEndTime).diff(moment.utc(outTime), 'minutes'));
            breakMinutes += breakDuration;
          }
        }
        
        // Move past the OUT record
        i = records.indexOf(outRecord) + 1;
      } else {
        // No OUT found - still checked in, calculate from IN to now (UTC)
        const now = Date.now();
        const duration = Math.max(0, moment.utc(now).diff(moment.utc(inTime), 'minutes'));
        totalMinutes += duration;
        i++;
      }
    } else {
      // OUT without preceding IN (shouldn't happen, but handle gracefully)
      i++;
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

