import { profileSyncService, UnsyncedProfileProperty } from './profile-sync-service';
import { attendanceSyncService } from './attendance-sync-service';
import { settingsSyncService, UnsyncedSetting } from './settings-sync-service';
import { AttendanceRecord } from '../../redux/types/userTypes';

export interface AllUnsyncedItems {
  profile: UnsyncedProfileProperty[];
  attendance: AttendanceRecord[];
  settings: UnsyncedSetting[];
}

export interface SyncSummary {
  totalUnsynced: number;
  profileUnsynced: number;
  attendanceUnsynced: number;
  settingsUnsynced: number;
  lastSyncAt: number | null;
}

/**
 * Sync Status Service
 * Provides unified interface to query and return all unsynced items for UI display
 */
class SyncStatusService {
  /**
   * Get all unsynced items (profile properties, attendance records, settings)
   */
  async getAllUnsyncedItems(email: string, userID: string): Promise<AllUnsyncedItems> {
    try {
      const [profile, attendance, settings] = await Promise.all([
        profileSyncService.getUnsyncedProfileProperties(email),
        attendanceSyncService.getUnsyncedAttendanceRecords(userID),
        settingsSyncService.getUnsyncedSettings(),
      ]);

      return {
        profile,
        attendance,
        settings,
      };
    } catch (error) {
      console.log('Error getting all unsynced items:', error);
      return {
        profile: [],
        attendance: [],
        settings: [],
      };
    }
  }

  /**
   * Get unsynced profile properties
   */
  async getUnsyncedProfileProperties(email: string): Promise<UnsyncedProfileProperty[]> {
    try {
      return await profileSyncService.getUnsyncedProfileProperties(email);
    } catch (error) {
      console.log('Error getting unsynced profile properties:', error);
      return [];
    }
  }

  /**
   * Get unsynced attendance records
   */
  async getUnsyncedAttendanceRecords(userID: string): Promise<AttendanceRecord[]> {
    try {
      return await attendanceSyncService.getUnsyncedAttendanceRecords(userID);
    } catch (error) {
      console.log('Error getting unsynced attendance records:', error);
      return [];
    }
  }

  /**
   * Get unsynced settings
   */
  async getUnsyncedSettings(): Promise<UnsyncedSetting[]> {
    try {
      return await settingsSyncService.getUnsyncedSettings();
    } catch (error) {
      console.log('Error getting unsynced settings:', error);
      return [];
    }
  }

  /**
   * Get sync summary (counts and last sync time)
   */
  async getSyncSummary(email: string, userID: string): Promise<SyncSummary> {
    try {
      const [profile, attendance, settings, profileStatus] = await Promise.all([
        profileSyncService.getUnsyncedProfileProperties(email),
        attendanceSyncService.getUnsyncedAttendanceRecords(userID),
        settingsSyncService.getUnsyncedSettings(),
        profileSyncService.getProfileSyncStatus(email),
      ]);

      return {
        totalUnsynced: profile.length + attendance.length + settings.length,
        profileUnsynced: profile.length,
        attendanceUnsynced: attendance.length,
        settingsUnsynced: settings.length,
        lastSyncAt: profileStatus.serverLastSyncedAt,
      };
    } catch (error) {
      console.log('Error getting sync summary:', error);
      return {
        totalUnsynced: 0,
        profileUnsynced: 0,
        attendanceUnsynced: 0,
        settingsUnsynced: 0,
        lastSyncAt: null,
      };
    }
  }
}

export const syncStatusService = new SyncStatusService();

