import moment from 'moment';
import { AttendanceDay } from './attendance-service';

/**
 * Fill missing dates in a month with ABSENT entries
 * 
 * This ensures every day in the month has an attendance entry,
 * even if the user didn't check in. Missing days are marked as ABSENT (RED).
 * 
 * @param attendanceDays - Existing attendance data (already sorted by date desc)
 * @param month - Optional moment object for the month to fill (defaults to current month)
 * @returns AttendanceDay[] with all dates in the month filled
 */
export function fillMissingDatesInMonth(
  attendanceDays: AttendanceDay[],
  month?: moment.Moment
): AttendanceDay[] {
  if (!attendanceDays || attendanceDays.length === 0) {
    // If no records at all, return empty (or could fill entire month with ABSENT)
    return attendanceDays;
  }

  // Use provided month or determine from the attendance data
  const targetMonth = month ? month.clone() : moment.utc(attendanceDays[0].dateOfPunch, 'YYYY-MM-DD');
  
  // Get start and end of the month
  const monthStart = targetMonth.clone().startOf('month');
  const monthEnd = targetMonth.clone().endOf('month');
  const today = moment.utc().startOf('day');
  
  // Don't go beyond today for the current month
  const lastDateToFill = monthEnd.isAfter(today) ? today : monthEnd;
  
  // Create a map of existing dates for quick lookup
  const existingDatesMap = new Map<string, AttendanceDay>();
  attendanceDays.forEach(day => {
    existingDatesMap.set(day.dateOfPunch, day);
  });
  
  // Fill in missing dates
  const result: AttendanceDay[] = [];
  const currentDate = monthStart.clone();
  
  while (currentDate.isSameOrBefore(lastDateToFill)) {
    const dateKey = currentDate.format('YYYY-MM-DD');
    
    if (existingDatesMap.has(dateKey)) {
      // Date exists, use existing data
      result.push(existingDatesMap.get(dateKey)!);
    } else {
      // Date missing, create ABSENT entry
      result.push({
        dateOfPunch: dateKey,
        attendanceStatus: 'ABSENT',
        totalDuration: '0:00',
        breakDuration: '0:00',
        workedHours: 0,
        requiresApproval: false,
        records: [],
      });
    }
    
    currentDate.add(1, 'day');
  }
  
  // Sort by date (most recent first)
  return result.sort((a, b) => 
    moment.utc(b.dateOfPunch).diff(moment.utc(a.dateOfPunch))
  );
}

