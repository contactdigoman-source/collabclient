import { useMemo } from 'react';
import { useAppSelector } from '../redux';
import { PUNCH_DIRECTIONS } from '../constants/location';
import { 
  isStaleCheckIn, 
  isMissedCheckout 
} from '../services/attendance/attendance-status-service';

export interface CheckInStatusResult {
  buttonType: 'CHECK_IN' | 'CHECK_OUT';
  buttonColor: 'GREEN' | 'RED' | 'DEFAULT';
  isStale: boolean;
  isMissedCheckout: boolean;
  showMissedCheckoutModal: boolean;
  isUserCheckedIn: boolean; // For backward compatibility
}

/**
 * Custom hook to determine check-in/out button state and behavior
 * 
 * Rules:
 * 1. If stale (> 3 days): Force CHECK_IN only
 * 2. If last action = IN: Show CHECK_OUT
 *    - If missed checkout: RED button + modal
 *    - Otherwise: DEFAULT button
 * 3. If last action = OUT or none: Show CHECK_IN (GREEN button)
 * 
 * @returns CheckInStatusResult with button type, color, and modal flags
 */
export function useCheckInStatus(): CheckInStatusResult {
  const userLastAttendance = useAppSelector(state => state.userState.userLastAttendance,);
  const userData = useAppSelector(state => state.userState.userData);

  const result = useMemo<CheckInStatusResult>(() => {
    // Default state: no attendance, show check-in
    if (!userLastAttendance) {
      return {
        buttonType: 'CHECK_IN',
        buttonColor: 'DEFAULT',
        isStale: false,
        isMissedCheckout: false,
        showMissedCheckoutModal: false,
        isUserCheckedIn: false,
      };
    }

    const lastTimestamp = typeof userLastAttendance.Timestamp === 'string'
      ? parseInt(userLastAttendance.Timestamp, 10)
      : userLastAttendance.Timestamp;

    // Check if last action was CHECK_IN
    const isCheckedIn = userLastAttendance.PunchDirection === PUNCH_DIRECTIONS.in;

    if (!isCheckedIn) {
      // Last action was CHECK_OUT, show CHECK_IN
      return {
        buttonType: 'CHECK_IN',
        buttonColor: 'DEFAULT',
        isStale: false,
        isMissedCheckout: false,
        showMissedCheckoutModal: false,
        isUserCheckedIn: false,
      };
    }

    // Last action was CHECK_IN - determine if stale or missed checkout

    // Check stale status (> 3 days)
    const isStale = isStaleCheckIn(lastTimestamp);
    if (isStale) {
      // Stale check-in: Force CHECK_IN only
      return {
        buttonType: 'CHECK_IN',
        buttonColor: 'DEFAULT',
        isStale: true,
        isMissedCheckout: false,
        showMissedCheckoutModal: false,
        isUserCheckedIn: false,
      };
    }

    // Check missed checkout (not stale, but past shift end + buffer)
    const checkInDate = userLastAttendance.DateOfPunch || 
    new Date(lastTimestamp).toISOString().split('T')[0];
    const shiftEndTime = userData?.shiftEndTime || '17:00';
    const bufferHours = 2; // 2 hours after shift end

    const missedCheckout = isMissedCheckout(
      lastTimestamp,
      checkInDate,
      shiftEndTime,
      bufferHours
    );

    if (missedCheckout) {
      // Missed checkout: Show CHECK_OUT in RED + modal
      return {
        buttonType: 'CHECK_OUT',
        buttonColor: 'RED',
        isStale: false,
        isMissedCheckout: true,
        showMissedCheckoutModal: true,
        isUserCheckedIn: true,
      };
    }

    // Normal CHECK_OUT (not stale, not missed)
    return {
      buttonType: 'CHECK_OUT',
      buttonColor: 'DEFAULT',
      isStale: false,
      isMissedCheckout: false,
      showMissedCheckoutModal: false,
      isUserCheckedIn: true,
    };
  }, [userLastAttendance, userData?.shiftEndTime]);

  return result;
}

/**
 * Legacy export for backward compatibility
 * Returns simple boolean: true if checked in, false otherwise
 */
export function useCheckInStatusSimple(): boolean {
  const result = useCheckInStatus();
  return result.isUserCheckedIn;
}

