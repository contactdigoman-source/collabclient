import { networkService } from '../network/network-service';
import { profileSyncService } from './profile-sync-service';
import { attendanceSyncService } from './attendance-sync-service';
import { settingsSyncService } from './settings-sync-service';
import { syncQueueService } from './sync-queue-service';
import { retryService } from './retry-service';
import { logServiceError } from '../logger';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && console.log('[SyncCoordinator]', ...args);

export interface SyncResult {
  success: boolean;
  profile: { success: number; failed: number };
  attendance: { success: number; failed: number };
  settings: { success: number; failed: number };
  errors: string[];
}

/**
 * Sync Coordinator
 * Orchestrates push-first (only unsynced items), then pull sync strategy
 * with timestamp-based conflict resolution
 */
class SyncCoordinator {
  /**
   * Full sync: Push all unsynced items, then pull from server
   */
  async syncAll(email: string, userID: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      profile: { success: 0, failed: 0 },
      attendance: { success: 0, failed: 0 },
      settings: { success: 0, failed: 0 },
      errors: [],
    };

    try {
      // Check network connectivity
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot sync');
        result.success = false;
        result.errors.push('No network connection');
        return result;
      }

      // Phase 1: Push unsynced items
      log('Starting push phase...');
      const pushResult = await this.syncPushOnly(email, userID);
      result.profile = pushResult.profile;
      result.attendance = pushResult.attendance;
      result.settings = pushResult.settings;
      result.errors.push(...pushResult.errors);

      // Phase 2: Pull from server (only if push was successful)
      if (pushResult.success) {
        log('Starting pull phase...');
        await this.syncPullOnly(email, userID);
      }

      result.success = pushResult.success && result.errors.length === 0;
      log('Sync completed:', result);
      return result;
    } catch (error: any) {
      logServiceError(
        'sync',
        'sync-coordinator.ts',
        'syncAll',
        error,
        { email, userID },
      );
      result.success = false;
      result.errors.push(error.message || 'Unknown error');
      return result;
    }
  }

  /**
   * Push only: Sync all unsynced items to server
   */
  async syncPushOnly(email: string, userID: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      profile: { success: 0, failed: 0 },
      attendance: { success: 0, failed: 0 },
      settings: { success: 0, failed: 0 },
      errors: [],
    };

    try {
      // Check network connectivity
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot push');
        result.success = false;
        result.errors.push('No network connection');
        return result;
      }

      // Push unsynced profile properties
      try {
        result.profile = await profileSyncService.syncAllUnsyncedProperties(email);
        log(`Profile sync: ${result.profile.success} succeeded, ${result.profile.failed} failed`);
      } catch (error: any) {
        result.errors.push(`Profile sync error: ${error.message}`);
        result.success = false;
      }

      // Push unsynced attendance records
      try {
        result.attendance = await attendanceSyncService.syncAllUnsyncedAttendance(userID);
        log(`Attendance sync: ${result.attendance.success} succeeded, ${result.attendance.failed} failed`);
      } catch (error: any) {
        result.errors.push(`Attendance sync error: ${error.message}`);
        result.success = false;
      }

      // Push unsynced settings
      try {
        result.settings = await settingsSyncService.syncAllUnsyncedSettings();
        log(`Settings sync: ${result.settings.success} succeeded, ${result.settings.failed} failed`);
      } catch (error: any) {
        result.errors.push(`Settings sync error: ${error.message}`);
        result.success = false;
      }

      return result;
    } catch (error: any) {
      logServiceError(
        'sync',
        'sync-coordinator.ts',
        'syncPushOnly',
        error,
        { email, userID },
      );
      result.success = false;
      result.errors.push(error.message || 'Unknown error');
      return result;
    }
  }

  /**
   * Pull only: Pull latest data from server
   */
  async syncPullOnly(email: string, userID: string): Promise<void> {
    try {
      // Check network connectivity
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot pull');
        return;
      }

      // Pull profile from server
      try {
        await profileSyncService.syncProfileFromServer(email);
        log('Profile pulled from server');
      } catch (error: any) {
        logServiceError(
          'sync',
          'sync-coordinator.ts',
          'syncPullOnly - profile',
          error,
          { email },
        );
      }

      // Pull attendance from server
      try {
        await attendanceSyncService.syncAttendanceFromServer(userID);
        log('Attendance pulled from server');
      } catch (error: any) {
        logServiceError(
          'sync',
          'sync-coordinator.ts',
          'syncPullOnly - attendance',
          error,
          { userID },
        );
      }

      // Pull settings from server
      try {
        await settingsSyncService.syncSettingsFromServer();
        log('Settings pulled from server');
      } catch (error: any) {
        logServiceError(
          'sync',
          'sync-coordinator.ts',
          'syncPullOnly - settings',
          error,
        );
      }
    } catch (error: any) {
      logServiceError(
        'sync',
        'sync-coordinator.ts',
        'syncPullOnly',
        error,
        { email, userID },
      );
    }
  }

  /**
   * Process sync queue (retry failed items)
   */
  async processSyncQueue(): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot process queue');
        return;
      }

      const pendingItems = await syncQueueService.getPendingItems();
      log(`Processing ${pendingItems.length} items from sync queue`);

      for (const item of pendingItems) {
        try {
          // Check if should retry
          if (!retryService.shouldRetry(item.attempts)) {
            log(`Max attempts reached for ${item.id}, removing from queue`);
            await syncQueueService.markAsSynced(item.id);
            continue;
          }

          // Process based on type
          let success = false;
          if (item.type === 'profile' && item.property) {
            success = await profileSyncService.syncProfilePropertyToServer(
              item.entityId,
              item.property as any,
              item.data[item.property],
            );
          } else if (item.type === 'attendance') {
            success = await attendanceSyncService.syncAttendanceRecordToServer(item.data);
          } else if (item.type === 'settings') {
            success = await settingsSyncService.syncSettingToServer(item.entityId, item.data[item.entityId]);
          }

          if (success) {
            await syncQueueService.markAsSynced(item.id);
            log(`Successfully synced ${item.id}`);
          } else {
            await syncQueueService.incrementAttempts(item.id);
            log(`Failed to sync ${item.id}, will retry later`);
          }
        } catch (error: any) {
          logServiceError(
            'sync',
            'sync-coordinator.ts',
            'processSyncQueue',
            error,
            { itemId: item.id },
          );
          await syncQueueService.incrementAttempts(item.id);
        }
      }
    } catch (error: any) {
      logServiceError(
        'sync',
        'sync-coordinator.ts',
        'processSyncQueue',
        error,
      );
    }
  }
}

export const syncCoordinator = new SyncCoordinator();

