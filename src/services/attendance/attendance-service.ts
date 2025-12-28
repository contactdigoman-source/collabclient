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
  IsSynced?: string; // 'Y' or 'N' - for sync status display
  CreatedOn?: number; // For animation key
}

export interface AttendanceDay {
  dateOfPunch: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'HOURS_DEFICIT';
  totalDuration: string; // Format: "HH:mm"
  breakDuration: string; // Format: "HH:mm"
  records: AttendanceDayRecord[];
  // Fields for status tracking
  workedHours?: number; // Decimal hours (e.g., 8.5)
  requiresApproval?: boolean;
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
 * Get attendance data from database first, then sync with server in background
 * 
 * This is the MAIN function UI components should use to fetch attendance data.
 * 
 * FLOW (OFFLINE-FIRST):
 * 1. ✅ Load from DB first (FAST - shows data immediately)
 *    - Calls getAttendanceData() which updates Redux state
 *    - UI updates immediately with DB data
 * 2. ✅ Sync from server in background (SLOWER - network)
 *    - Pulls data from server (with optional month filter)
 *    - Compares server records with local DB (by timestamp)
 *    - Updates database:
 *      • Marks local records as synced if they match server (preserves local data)
 *      • Inserts server records that don't exist locally
 *      • Preserves local records that don't exist on server (never overwritten)
 *    - Calls getAttendanceData() again to refresh Redux state
 * 3. ✅ If server sync fails, DB data is still shown (offline-first)
 * 
 * KEY PRINCIPLES:
 * - DB is the source of truth
 * - Always load from DB first (fast, reliable)
 * - Server sync updates DB, then UI updates from DB
 * - Server failures don't affect UI (DB data is always available)
 * 
 * @param userID - User ID (email) to sync data for
 * @param month - Optional month parameter to fetch specific month data
 * @returns Promise that resolves immediately after DB load (server sync happens in background)
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
    // STEP 1: Load from DB first (FAST - shows data immediately)
    // This ensures UI shows data right away, even if server sync is slow or fails
    const { getAttendanceData } = await import('../attendance/attendance-db-service');
    await getAttendanceData(userID);
    
    logger.debug('[AttendanceService] Loaded attendance from DB', {
      userID,
      month: month?.format('YYYY-MM'),
    });
    
    // STEP 2: Sync from server in background (SLOWER - network)
    // This updates DB with server data, then refreshes Redux state
    // If this fails, DB data is still shown (offline-first)
    attendanceSyncService.syncAttendanceFromServer(userID, month).catch((error: any) => {
      logger.error('[AttendanceService] Server sync failed, using DB data', error, undefined, {
        userID,
        month: month?.format('YYYY-MM'),
      });
      // Error is logged but not thrown - DB data is still available
    });
    
    // Return immediately - don't wait for server sync
    // UI already has DB data, server sync will update it in background
  } catch (error: any) {
    logger.error('[AttendanceService] getDaysAttendance error', error, undefined, {
      userID,
      month: month?.format('YYYY-MM'),
    });
    // Error is logged but not thrown - allows UI to continue functioning
    // UI components can check Redux state to see if data is available
  }
};

