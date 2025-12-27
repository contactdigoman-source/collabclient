import { useMemo } from 'react';
import { useAppSelector } from '../redux';
import { PUNCH_DIRECTIONS } from '../constants/location';
import { getCurrentUTCDate } from '../utils/time-utils';
import { getShiftEndTimestamp } from '../utils/shift-utils';
import moment from 'moment';
import { logger } from '../services/logger';

/**
 * Custom hook to determine if user is currently checked in
 * This logic handles:
 * - Today's check-in/checkout
 * - Shift spanning two days (e.g., 5pm start, 6am end)
 * - Whether still within shift period for multi-day shifts
 * 
 * @returns {boolean} true if user should see checkout button, false for check-in button
 */
export function useCheckInStatus(): boolean {
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  /**
   * Check if shift spans 2 days (e.g., 5pm start, 6am end)
   */
  const doesShiftSpanTwoDays = useMemo(() => {
    const shiftStartTime = userData?.shiftStartTime || '09:00';
    const shiftEndTime = userData?.shiftEndTime || '17:00';
    
    // Parse times
    const [startHour, startMin] = shiftStartTime.split(':').map(Number);
    const [endHour, endMin] = shiftEndTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // If end time is earlier than start time, shift spans 2 days
    return endMinutes < startMinutes;
  }, [userData?.shiftStartTime, userData?.shiftEndTime]);

  /**
   * Check if we're still within the shift period (for 2-day shifts)
   */
  const isWithinShiftPeriod = useMemo(() => {
    if (!userLastAttendance || userLastAttendance.PunchDirection !== PUNCH_DIRECTIONS.in) {
      return false;
    }

    if (!doesShiftSpanTwoDays) {
      return false;
    }

    try {
      const checkInTimestamp = typeof userLastAttendance.Timestamp === 'string'
        ? parseInt(userLastAttendance.Timestamp, 10)
        : userLastAttendance.Timestamp;

      if (!checkInTimestamp) {
        return false;
      }

      // Get current time in UTC
      const now = moment.utc();

      // Get check-in date in UTC (since shift times are in UTC)
      const checkInUTC = moment.utc(checkInTimestamp);
      const checkInDate = userLastAttendance.DateOfPunch || checkInUTC.format('YYYY-MM-DD');

      // Get shift end timestamp for check-in date
      const shiftEndTime = userData?.shiftEndTime || '17:00';
      const shiftEndTimestamp = getShiftEndTimestamp(checkInDate, shiftEndTime);

      if (!shiftEndTimestamp) {
        return false;
      }

      // Check if current time is before shift end (shift end is next day)
      const shiftEndUTC = moment.utc(shiftEndTimestamp);

      // Check if current time is before shift end (shift end is next day)
      return now.isBefore(shiftEndUTC);
    } catch (error) {
      logger.error('Error checking if within shift period', error);
      return false;
    }
  }, [userLastAttendance, doesShiftSpanTwoDays, userData?.shiftEndTime]);

  /**
   * Check if last check-in was today (in UTC)
   */
  const isLastCheckInToday = useMemo(() => {
    if (!userLastAttendance || userLastAttendance.PunchDirection !== PUNCH_DIRECTIONS.in) {
      return false;
    }

    try {
      const checkInTimestamp = typeof userLastAttendance.Timestamp === 'string'
        ? parseInt(userLastAttendance.Timestamp, 10)
        : userLastAttendance.Timestamp;

      if (!checkInTimestamp) {
        return false;
      }

      // Get check-in date in UTC
      const checkInUTC = moment.utc(checkInTimestamp);
      const checkInDate = checkInUTC.format('YYYY-MM-DD');

      // Get today's date in UTC
      const todayUTC = getCurrentUTCDate();

      return checkInDate === todayUTC;
    } catch (error) {
      logger.error('Error checking if last check-in is today', error);
      return false;
    }
  }, [userLastAttendance]);

  // Determine if user should see checkout button or check-in button
  const isUserCheckedIn = useMemo(() => {
    // If no last attendance, show check-in
    if (!userLastAttendance) {
      return false;
    }

    // If last attendance is OUT, show check-in
    if (userLastAttendance.PunchDirection === PUNCH_DIRECTIONS.out) {
      return false;
    }

    // If last attendance is IN:
    // - If it's today -> show checkout
    // - If it's not today but shift spans 2 days and we're still within shift period -> show checkout
    // - Otherwise -> show check-in
    if (isLastCheckInToday) {
      return true; // Show checkout
    }

    // Not today, but check if shift spans 2 days and we're still within shift period
    if (doesShiftSpanTwoDays && isWithinShiftPeriod) {
      return true; // Show checkout
    }

    // Not today and not within shift period -> show check-in
    return false;
  }, [userLastAttendance, isLastCheckInToday, doesShiftSpanTwoDays, isWithinShiftPeriod]);

  return isUserCheckedIn;
}

