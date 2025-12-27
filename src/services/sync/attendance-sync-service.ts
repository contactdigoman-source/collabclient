import { 
  getUnsyncedAttendanceRecords, 
  markAttendanceRecordAsSynced, 
  insertAttendancePunchRecord, 
  getAttendanceData, 
  getAllAttendanceRecords 
} from '../attendance/attendance-db-service';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { store } from '../../redux';
import { networkService } from '../network/network-service';
import { logger } from '../logger';
import { Configs } from '../../constants/configs';
import apiClient from '../api/api-client';
import moment from 'moment';
import { apiTimestampToTicks } from '../../utils/timestamp-utils';

const API_BASE_URL = Configs.apiBaseUrl;

/**
 * ATTENDANCE SYNC SERVICE - ALL API calls and sync operations
 * 
 * ⚠️ THIS IS THE ONLY FILE WITH API CALLS (axios.get, axios.post) ⚠️
 * 
 * 📋 CALLED BY:
 * 
 * 1. UI COMPONENTS (HomeScreen, DaysBottomTabScreen):
 *    → Via attendance-service.ts getDaysAttendance()
 *    → Which calls: syncAttendanceFromServer()
 *    → Reason: UI gets clean high-level API, this file handles complexity
 * 
 * 2. SYNC COORDINATOR (background sync):
 *    → Direct call: syncAttendanceFromServer(userID, month?)
 *    → Direct call: syncAllUnsyncedAttendance(userID)
 *    → Reason: Coordinator needs direct control over sync operations
 * 
 * 3. CHECK-IN/CHECKOUT FLOWS:
 *    → Direct call: syncAttendanceRecordToServer(record)
 *    → Reason: Immediate push of new attendance record to server
 * 
 * 🔌 API ENDPOINTS (ALL HERE):
 * 
 * PULL (Server → Local):
 * - GET /api/attendance/days → syncAttendanceFromServer()
 *   → Fetches attendance records from server
 *   → Merges with local DB (preserves local data)
 *   → Updates Redux state
 * 
 * PUSH (Local → Server):
 * - POST /api/attendance/punch-in → syncAttendanceRecordToServer() (when PunchDirection='IN')
 * - POST /api/attendance/punch-out → syncAttendanceRecordToServer() (when PunchDirection='OUT')
 *   → Sends single attendance record to server
 *   → Marks as synced after successful upload
 * 
 * 📊 OPERATIONS:
 * 
 * - syncAttendanceFromServer(): Pull from server, merge with local DB
 * - syncAttendanceRecordToServer(): Push single record to server
 * - syncAllUnsyncedAttendance(): Push all unsynced records (batch)
 * - mergeAttendanceData(): Merge server data with local (preserves local records)
 * - getUnsyncedAttendanceRecords(): Query unsynced records from local DB
 * 
 * 🏗️ ARCHITECTURE:
 * - ✅ ALL API CALLS: ONLY in this file (axios.get, axios.post)
 * - Uses attendance-db-service.ts for database operations
 * - attendance-service.ts delegates here (no API calls in attendance-service.ts)
 */
class AttendanceSyncService {
  /**
   * Get all unsynced attendance records for a user
   * Used to identify which local records need to be pushed to server
   */
  async getUnsyncedAttendanceRecords(userID: string): Promise<AttendanceRecord[]> {
    try {
      const records = await getUnsyncedAttendanceRecords(userID);
      return records.map((record) => ({
        Timestamp: typeof record.Timestamp === 'string' ? parseInt(record.Timestamp, 10) : record.Timestamp,
        OrgID: record.OrgID,
        UserID: record.UserID,
        PunchType: record.PunchType,
        PunchDirection: record.PunchDirection as 'IN' | 'OUT',
        LatLon: record.LatLon,
        Address: record.Address,
        CreatedOn: typeof record.CreatedOn === 'string' ? parseInt(record.CreatedOn, 10) : record.CreatedOn,
        IsSynced: record.IsSynced as 'Y' | 'N',
        DateOfPunch: record.DateOfPunch,
        AttendanceStatus: record.AttendanceStatus,
        ModuleID: record.ModuleID,
        TripType: record.TripType,
        PassengerID: record.PassengerID,
        AllowanceData: record.AllowanceData,
        IsCheckoutQrScan: record.IsCheckoutQrScan,
        TravelerName: record.TravelerName,
        PhoneNumber: record.PhoneNumber,
      }));
    } catch (error) {
      logger.error('Error getting unsynced attendance records', error);
      return [];
    }
  }

  /**
   * Push a single attendance record to server (Local → Server)
   * Marks the record as synced after successful upload
   */
  async syncAttendanceRecordToServer(record: AttendanceRecord): Promise<boolean> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        logger.debug('[AttendanceSync] Offline - cannot sync attendance record');
        return false;
      }

      // Get user email from Redux store or record
      const userEmail = record.UserID || store.getState().userState?.userData?.email;
      if (!userEmail) {
        logger.debug('[AttendanceSync] No user email - cannot sync attendance record');
        return false;
      }

      // Determine API endpoint based on punch direction
      const endpoint = record.PunchDirection === 'IN'
        ? `/api/attendance/punch-in`
        : `/api/attendance/punch-out`;

      // Convert timestamp to UTC ticks (milliseconds since epoch) - backend always expects UTC
      // Ensure we're sending UTC timestamp even if local timestamp was stored
      const utcTimestamp = moment.utc(record.Timestamp).valueOf();
      
      const response = await apiClient.post(
        endpoint,
        {
          timestamp: utcTimestamp, // UTC ticks (milliseconds since epoch)
          latLon: record.LatLon,
          address: record.Address,
          punchType: record.PunchType,
          moduleID: record.ModuleID,
          tripType: record.TripType,
          passengerID: record.PassengerID,
          allowanceData: record.AllowanceData,
          isCheckoutQrScan: record.IsCheckoutQrScan,
          travelerName: record.TravelerName,
          phoneNumber: record.PhoneNumber,
        },
        {
          timeout: 30000,
        }
      );

      // Mark as synced - server always returns UTC (datetime string or ticks)
      // Handle both formats: datetime string (e.g., "2026-01-15T09:00:00Z") or ticks
      const serverTimestampRaw = response.data?.timestamp || response.data?.Timestamp || 
                                 response.data?.punchInTime || response.data?.punchOutTime || 
                                 utcTimestamp;
      // Convert to UTC ticks if it's a datetime string, or use as-is if already ticks
      const serverTimestampUTC = apiTimestampToTicks(serverTimestampRaw);
      await markAttendanceRecordAsSynced(record.Timestamp, serverTimestampUTC);
      return true;
    } catch (error: any) {
      logger.error('syncAttendanceRecordToServer error', error);
      return false;
    }
  }

  /**
   * Push all unsynced attendance records to server (Local → Server)
   * Processes records one by one and marks each as synced after successful upload
   */
  async syncAllUnsyncedAttendance(userID: string): Promise<{ success: number; failed: number }> {
    const unsynced = await this.getUnsyncedAttendanceRecords(userID);
    let success = 0;
    let failed = 0;

    for (const record of unsynced) {
      const result = await this.syncAttendanceRecordToServer(record);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    logger.debug('[AttendanceSync] Synced attendance records', { success, failed });
    return { success, failed };
  }

  /**
   * Pull attendance data from server and merge with local database
   * 
   * COMPLETE FLOW:
   * 1. ✅ Check network connectivity (returns early if offline)
   * 2. ✅ Get JWT token (returns early if no token)
   * 3. ✅ Build API URL (with optional month filter: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD)
   * 4. ✅ Fetch data from server API: GET /api/attendance/days
   * 5. ✅ Call mergeAttendanceData() which:
   *    - Gets all local records from DB
   *    - Compares each server record with local (by timestamp - primary key)
   *    - Updates DB:
   *      • If local record exists with same timestamp: Mark as synced (IsSynced='Y') but KEEP local data
   *      • If server record doesn't exist locally: Insert it as new record (IsSynced='Y')
   *      • If local record doesn't exist on server: Preserve it (never deleted)
   *    - Calls getAttendanceData() to refresh Redux state
   * 6. ✅ UI automatically updates (via Redux selectors)
   * 
 * CALLED BY:
 * - UI Components: Via attendance-service.ts getDaysAttendance() (recommended)
 * - Sync Coordinator: Direct call (for background sync operations)
   * 
   * @param userID - User ID (email) to sync data for
   * @param month - Optional month parameter to fetch specific month data
   */
  async syncAttendanceFromServer(userID: string, month?: moment.Moment): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        logger.debug('[AttendanceSync] Offline - cannot pull attendance');
        return;
      }

      // Build API URL with optional month parameter
      let url = `/api/attendance/days`;
      if (month) {
        const monthStart = month.clone().startOf('month').format('YYYY-MM-DD');
        const monthEnd = month.clone().endOf('month').format('YYYY-MM-DD');
        url += `?startDate=${monthStart}&endDate=${monthEnd}`;
      }

      // Pull attendance data from server
      const response = await apiClient.get(
        url,
        {
          timeout: 30000,
        }
      );

      // Handle different response formats: could be array directly, or wrapped in data property
      const serverData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || response.data || []);
      
      logger.debug(`[AttendanceSync] Received ${serverData.length} days from server`, {
        userID,
        month: month?.format('YYYY-MM'),
        totalDays: serverData.length,
        responseDataType: Array.isArray(response.data) ? 'array' : typeof response.data,
      });
      
      // Merge server records with local records
      // Strategy: Keep both local and server records
      // If server has a record with same timestamp, mark local as synced
      // If server has different records, keep both
      // Never overwrite local records that don't exist on server
      await this.mergeAttendanceData(userID, serverData);
    } catch (error: any) {
      logger.error('syncAttendanceFromServer error', error);
    }
  }

  /**
   * Merge server attendance data with local data
   * 
   * CRITICAL: This function NEVER overwrites local records. It preserves ALL local records.
   * 
   * Strategy:
   * 1. Check records individually by timestamp (primary key in DB - each timestamp is unique)
   * 2. If local record exists with same timestamp as server:
   *    - Mark local record as synced (IsSynced='Y') but KEEP the local data
   *    - Local location data and other fields are preserved, not overwritten
   * 3. If server record doesn't exist locally:
   *    - Insert the server record as a new record
   * 4. Local records with timestamps NOT present on server:
   *    - Are automatically preserved (never deleted or modified)
   * 
   * Examples:
   * - Server has 10 records for current month, Local has 1 record (today) not on server
   *   -> Result: 11 records in SQLite (10 from server + 1 from local)
   * 
   * - Server has 2 check-in + 1 checkout for today, Local has 2 check-in + 2 checkout
   *   -> Result: All 4 local records preserved + server's 3 records inserted (if timestamps differ)
   *   -> If timestamps match: Local records marked as synced, no duplicates created
   * 
   * - If today's checkout exists locally but not on server, it is NEVER overwritten
   */
  private async mergeAttendanceData(userID: string, serverData: any[]): Promise<void> {
    try {
      // Get ALL local records (both synced and unsynced) to check for existence
      // This ensures we never overwrite any local record
      const allLocalRecords = await getAllAttendanceRecords(userID);
      
      // Create a map of local records by timestamp (primary key) for O(1) lookup
      // Since timestamp is the primary key, each timestamp can only have one record
      // This map ensures we can quickly check if a local record exists for any server timestamp
      const localRecordsMap = new Map<number, any>();
      for (const record of allLocalRecords) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        localRecordsMap.set(timestamp, record);
      }

      // Track server record timestamps to calculate preserved records
      const serverRecordKeys = new Set<number>();
      let insertedCount = 0;
      let syncedCount = 0;
      let totalServerRecords = 0;

      // Process each day's records from server
      for (const day of serverData) {
        if (day.records && Array.isArray(day.records)) {
          totalServerRecords += day.records.length;
          for (const serverRecord of day.records) {
            // Convert API timestamp (datetime string or ticks) to UTC ticks for storage
            const serverTimestampRaw = serverRecord.Timestamp || serverRecord.timestamp;
            const serverTimestamp = apiTimestampToTicks(serverTimestampRaw);
            serverRecordKeys.add(serverTimestamp);
            
            // Convert CreatedOn if present
            const serverCreatedOn = serverRecord.CreatedOn || serverRecord.createdOn;
            const createdOnTicks = serverCreatedOn ? apiTimestampToTicks(serverCreatedOn) : serverTimestamp;

            // Check if local has a record with this EXACT timestamp
            // This is the critical check - we compare by timestamp (primary key)
            const localRecord = localRecordsMap.get(serverTimestamp);
            
            if (localRecord) {
              // Local record exists with same timestamp - mark it as synced but KEEP local data
              // This preserves local location data, address, and other fields that might differ from server
              // We NEVER overwrite the local record, only update the IsSynced flag
              if (localRecord.IsSynced !== 'Y') {
                await markAttendanceRecordAsSynced(serverTimestamp, serverTimestamp);
                syncedCount++;
                logger.debug(`[AttendanceSync] Marked local record as synced (preserved): ${serverTimestamp}, direction: ${localRecord.PunchDirection}`);
              }
            } else {
              // Server has a record that doesn't exist locally - insert it as a new record
              // This adds server records to local DB without affecting existing local records
              try {
                logger.debug(`[AttendanceSync] Attempting to insert server record: ${serverTimestamp}, direction: ${serverRecord.PunchDirection || serverRecord.punchDirection}`);
                await insertAttendancePunchRecord({
                  timestamp: serverTimestamp,
                  orgID: serverRecord.OrgID || serverRecord.orgID || '',
                  userID: userID,
                  punchType: serverRecord.PunchType || serverRecord.punchType || '',
                  punchDirection: serverRecord.PunchDirection || serverRecord.punchDirection || 'IN',
                  latLon: serverRecord.LatLon || serverRecord.latLon || '',
                  address: serverRecord.Address || serverRecord.address || '',
                  createdOn: createdOnTicks,
                  isSynced: 'Y', // Server record is already synced
                  dateOfPunch: serverRecord.DateOfPunch || serverRecord.dateOfPunch || day.dateOfPunch,
                  attendanceStatus: serverRecord.AttendanceStatus || serverRecord.attendanceStatus,
                  moduleID: serverRecord.ModuleID || serverRecord.moduleID,
                  tripType: serverRecord.TripType || serverRecord.tripType,
                  passengerID: serverRecord.PassengerID || serverRecord.passengerID,
                  allowanceData: serverRecord.AllowanceData || serverRecord.allowanceData,
                  isCheckoutQrScan: serverRecord.IsCheckoutQrScan || serverRecord.isCheckoutQrScan || 0,
                  travelerName: serverRecord.TravelerName || serverRecord.travelerName,
                  phoneNumber: serverRecord.PhoneNumber || serverRecord.phoneNumber,
                });
                insertedCount++;
                logger.debug(`[AttendanceSync] Successfully inserted server record: ${serverTimestamp}, direction: ${serverRecord.PunchDirection || serverRecord.punchDirection}, total inserted: ${insertedCount}`);
              } catch (insertError: any) {
                // If insert fails due to duplicate (PRIMARY KEY constraint), that's okay
                // This can happen in race conditions where a record was inserted between our check and insert
                if (insertError?.code === 19 || insertError?.message?.includes('UNIQUE constraint') || insertError?.message?.includes('already exists') || insertError?.message?.includes('PRIMARY KEY')) {
                  logger.debug(`[AttendanceSync] Server record already exists locally (race condition): ${serverTimestamp}`);
                  // Try to mark as synced if it exists
                  const existingRecord = localRecordsMap.get(serverTimestamp);
                  if (existingRecord && existingRecord.IsSynced !== 'Y') {
                    await markAttendanceRecordAsSynced(serverTimestamp, serverTimestamp);
                    syncedCount++;
                  }
                } else {
                  // Log full error details to help debug why data isn't saving
                  logger.error('[AttendanceSync] Error inserting server record', insertError, undefined, {
                    serverTimestamp,
                    userID,
                    punchDirection: serverRecord.PunchDirection || serverRecord.punchDirection,
                    errorCode: insertError?.code,
                    errorMessage: insertError?.message,
                    errorStack: insertError?.stack,
                  });
                }
              }
            }
          }
        }
      }

      // Calculate preserved records (local records not present in server data)
      // These are records that exist locally but not on server - they are NEVER deleted or modified
      const preservedCount = allLocalRecords.length - Array.from(serverRecordKeys).filter(key => localRecordsMap.has(key)).length;

      // Local records not present on server are automatically preserved (never deleted or overwritten)
      // This ensures local data (like additional checkouts, location data) that's not on server is kept
      logger.debug(`[AttendanceSync] Merge complete: Processed=${totalServerRecords} server records, Inserted=${insertedCount} new records, Synced=${syncedCount} local records, Preserved=${preservedCount} local-only records, Total local before=${allLocalRecords.length}`);
      
      // Refresh attendance data to update Redux after sync
      // This ensures UI shows the merged data (server + local records)
      await getAttendanceData(userID);
      
      // Verify final count after sync
      const finalRecords = await getAllAttendanceRecords(userID);
      logger.debug(`[AttendanceSync] Final record count after sync: ${finalRecords.length} (expected: ${allLocalRecords.length + insertedCount - syncedCount})`);
    } catch (error: any) {
      logger.error('mergeAttendanceData error', error);
    }
  }

  /**
   * Get attendance sync status (alias for getUnsyncedAttendanceRecords)
   * Returns list of all unsynced records that need to be pushed to server
   */
  async getAttendanceSyncStatus(userID: string): Promise<AttendanceRecord[]> {
    return await this.getUnsyncedAttendanceRecords(userID);
  }
}

export const attendanceSyncService = new AttendanceSyncService();

