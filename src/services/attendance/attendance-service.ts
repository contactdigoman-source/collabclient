/**
 * ATTENDANCE SERVICE - High-level API for UI components
 * 
 * ✅ ARCHITECTURE - API Calls ONLY in attendance-sync-service.ts:
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │ UI COMPONENTS (HomeScreen, DaysBottomTabScreen, etc.)      │
 * │ ✅ USE THIS FILE: getDaysAttendance()                      │
 * │    → High-level, UI-friendly function                      │
 * │    → NO API calls, just delegates to sync service          │
 * └──────────────────────┬──────────────────────────────────────┘
 *                        │
 * ┌──────────────────────▼──────────────────────────────────────┐
 * │ attendance-service.ts (THIS FILE)                          │
 * │ ✅ NO API CALLS - Just delegates                           │
 * │ - Type definitions (AttendanceDay, AttendanceDayRecord)    │
 * │ - High-level function: getDaysAttendance()                 │
 * │ - Error handling for UI                                    │
 * └──────────────────────┬──────────────────────────────────────┘
 *                        │ delegates to
 * ┌──────────────────────▼──────────────────────────────────────┐
 * │ attendance-sync-service.ts                                  │
 * │ ✅ ALL API CALLS HERE (axios.get, axios.post)              │
 * │ - syncAttendanceFromServer() → GET /api/attendance/days    │
 * │ - syncAttendanceRecordToServer() → POST /api/attendance/*  │
 * │ - Used by: UI (via this file) AND Sync Coordinator (direct)│
 * └──────────────────────┬──────────────────────────────────────┘
 *                        │ uses
 * ┌──────────────────────▼──────────────────────────────────────┐
 * │ attendance-db-service.ts                                    │
 * │ - Database operations (insert, update, query)               │
 * │ - Redux state updates (getAttendanceData)                   │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * 📋 USAGE GUIDELINES:
 * 
 * ✅ UI COMPONENTS (HomeScreen, DaysBottomTabScreen, etc.):
 *    → import { getDaysAttendance } from 'attendance-service'
 *    → await getDaysAttendance(userID, month?)
 *    → This handles: network check, API call, DB merge, Redux update
 * 
 * ✅ SYNC COORDINATOR (background sync):
 *    → import { attendanceSyncService } from 'attendance-sync-service'
 *    → await attendanceSyncService.syncAttendanceFromServer(userID, month?)
 *    → await attendanceSyncService.syncAllUnsyncedAttendance(userID)
 * 
 * ✅ CHECK-IN/CHECKOUT FLOWS:
 *    → import { attendanceSyncService } from 'attendance-sync-service'
 *    → await attendanceSyncService.syncAttendanceRecordToServer(record)
 * 
 * ⚠️ IMPORTANT: API calls (axios) are ONLY in attendance-sync-service.ts
 */

// ============================================================================
// TYPE DEFINITIONS (for API responses)
// ============================================================================

export interface AttendanceDayRecord {
  Timestamp: number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string | null;
  LatLon?: string;
  Address?: string;
  DateOfPunch?: string;
}

export interface AttendanceDay {
  dateOfPunch: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PARTIAL';
  totalDuration: string; // Format: "HH:mm"
  breakDuration: string; // Format: "HH:mm"
  records: AttendanceDayRecord[];
}

export interface GetDaysAttendanceResponse {
  data: AttendanceDay[];
}

// ============================================================================
// HIGH-LEVEL API FUNCTIONS (for UI components)
// ============================================================================

import moment from 'moment';
import { logger } from '../logger';
import { attendanceSyncService } from '../sync/attendance-sync-service';

/**
 * Get attendance data from server and sync with local database
 * 
 * This is the MAIN function UI components should use to fetch attendance data.
 * 
 * FLOW:
 * 1. ✅ Pulls data from server (with optional month filter)
 * 2. ✅ Compares server records with local DB (by timestamp)
 * 3. ✅ Updates database:
 *    - Marks local records as synced if they match server (preserves local data)
 *    - Inserts server records that don't exist locally
 *    - Preserves local records that don't exist on server (never overwritten)
 * 4. ✅ Refreshes Redux state from database (UI updates automatically)
 * 
 * @param userID - User ID (email) to sync data for
 * @param month - Optional month parameter to fetch specific month data
 * @returns Promise that resolves when sync is complete
 * 
 * @example
 * // Fetch current month data (HomeScreen, DaysBottomTabScreen)
 * await getDaysAttendance(userEmail);
 * 
 * // Fetch specific month
 * const targetMonth = moment('2024-01', 'YYYY-MM');
 * await getDaysAttendance(userEmail, targetMonth);
 */
export const getDaysAttendance = async (userID: string, month?: moment.Moment): Promise<void> => {
  try {
    // Delegate to sync service - it handles all the complexity (API calls, network, merge, DB update)
    await attendanceSyncService.syncAttendanceFromServer(userID, month);
    // After this completes, Redux state is updated and UI will re-render automatically
  } catch (error: any) {
    logger.error('[AttendanceService] getDaysAttendance error', error, undefined, {
      userID,
      month: month?.format('YYYY-MM'),
    });
    // Error is logged but not thrown - allows UI to continue functioning
    // UI components can check Redux state to see if data is available
  }
};

