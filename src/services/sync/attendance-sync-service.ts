import { getUnsyncedAttendanceRecords, markAttendanceRecordAsSynced, insertAttendancePunchRecord } from '../attendance/attendance-db-service';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { networkService } from '../network/network-service';
import { syncQueueService } from './sync-queue-service';
import { logServiceError } from '../logger';
import axios from 'axios';
import { Configs } from '../../constants/configs';
import { getJWTToken } from '../auth/login-service';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && console.log('[AttendanceSync]', ...args);

const API_BASE_URL = Configs.apiBaseUrl;

/**
 * Attendance Sync Service
 * Handles syncing attendance records, keeping both local and server records
 */
class AttendanceSyncService {
  /**
   * Get all unsynced attendance records for a user
   */
  async getUnsyncedAttendanceRecords(userID: string): Promise<AttendanceRecord[]> {
    try {
      const records = await getUnsyncedAttendanceRecords(userID);
      return records.map((record) => ({
        Timestamp: record.Timestamp,
        OrgID: record.OrgID,
        UserID: record.UserID,
        PunchType: record.PunchType,
        PunchDirection: record.PunchDirection as 'IN' | 'OUT',
        LatLon: record.LatLon,
        Address: record.Address,
        CreatedOn: record.CreatedOn,
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
      console.log('Error getting unsynced attendance records:', error);
      return [];
    }
  }

  /**
   * Sync single attendance record to server
   */
  async syncAttendanceRecordToServer(record: AttendanceRecord): Promise<boolean> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot sync attendance record');
        return false;
      }

      const token = await getJWTToken('');
      if (!token) {
        log('No token - cannot sync attendance record');
        return false;
      }

      // Determine API endpoint based on punch direction
      const endpoint = record.PunchDirection === 'IN'
        ? `${API_BASE_URL}/api/attendance/punch-in`
        : `${API_BASE_URL}/api/attendance/punch-out`;

      const response = await axios.post(
        endpoint,
        {
          timestamp: record.Timestamp,
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
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Mark as synced
      const serverTimestamp = response.data?.timestamp || response.data?.Timestamp || record.Timestamp;
      await markAttendanceRecordAsSynced(record.Timestamp, serverTimestamp);
      return true;
    } catch (error: any) {
      logServiceError(
        'sync',
        'attendance-sync-service.ts',
        'syncAttendanceRecordToServer',
        error,
        { timestamp: record.Timestamp, direction: record.PunchDirection },
      );
      return false;
    }
  }

  /**
   * Sync all unsynced attendance records
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

    log(`Synced ${success} attendance records, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Sync attendance from server (pull)
   * Merges server records with local records, keeping both
   */
  async syncAttendanceFromServer(userID: string): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot pull attendance');
        return;
      }

      const token = await getJWTToken('');
      if (!token) {
        log('No token - cannot pull attendance');
        return;
      }

      // Pull attendance data from server
      const response = await axios.get(
        `${API_BASE_URL}/api/attendance/days`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const serverData = response.data || [];
      
      // Merge server records with local records
      // Strategy: Keep both local and server records
      // If server has a record with same timestamp, mark local as synced
      // If server has different records, keep both
      await this.mergeAttendanceData(userID, serverData);
    } catch (error: any) {
      logServiceError(
        'sync',
        'attendance-sync-service.ts',
        'syncAttendanceFromServer',
        error,
        { userID },
      );
    }
  }

  /**
   * Merge server attendance data with local data
   * Keeps both local and server records (never overwrites)
   */
  private async mergeAttendanceData(userID: string, serverData: any[]): Promise<void> {
    try {
      // Get all local records
      const localUnsynced = await this.getUnsyncedAttendanceRecords(userID);
      const localTimestamps = new Set(localUnsynced.map((r) => r.Timestamp));

      // Process server data
      for (const day of serverData) {
        if (day.records && Array.isArray(day.records)) {
          for (const serverRecord of day.records) {
            const serverTimestamp = serverRecord.Timestamp || serverRecord.timestamp;

            // If local has same timestamp, mark local as synced
            if (localTimestamps.has(serverTimestamp)) {
              await markAttendanceRecordAsSynced(serverTimestamp, serverTimestamp);
              localTimestamps.delete(serverTimestamp);
            } else {
              // Server has different record - keep both by inserting server record
              // Only insert if it doesn't exist locally
              const localRecord = localUnsynced.find((r) => r.Timestamp === serverTimestamp);
              if (!localRecord) {
                // Insert server record as synced
                await insertAttendancePunchRecord({
                  timestamp: serverTimestamp,
                  orgID: serverRecord.OrgID || serverRecord.orgID || '',
                  userID: userID,
                  punchType: serverRecord.PunchType || serverRecord.punchType || '',
                  punchDirection: serverRecord.PunchDirection || serverRecord.punchDirection || 'IN',
                  latLon: serverRecord.LatLon || serverRecord.latLon || '',
                  address: serverRecord.Address || serverRecord.address || '',
                  createdOn: serverRecord.CreatedOn || serverRecord.createdOn || Date.now(),
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
              }
            }
          }
        }
      }

      log('Merged attendance data from server');
    } catch (error) {
      console.log('Error merging attendance data:', error);
    }
  }

  /**
   * Get attendance sync status
   */
  async getAttendanceSyncStatus(userID: string): Promise<AttendanceRecord[]> {
    return await this.getUnsyncedAttendanceRecords(userID);
  }
}

export const attendanceSyncService = new AttendanceSyncService();

