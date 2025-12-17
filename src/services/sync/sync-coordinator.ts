import { networkService } from '../network/network-service';
import { profileSyncService } from './profile-sync-service';
import { attendanceSyncService } from './attendance-sync-service';
import { settingsSyncService } from './settings-sync-service';
import { syncQueueService } from './sync-queue-service';
import { retryService } from './retry-service';
import { logger } from '../logger';

// Removed DEBUG log helper - use logger.debug() directly

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
        logger.debug('[SyncCoordinator] Offline - cannot sync');
        result.success = false;
        result.errors.push('No network connection');
        return result;
      }

      // Phase 1: Push unsynced items
      logger.debug('[SyncCoordinator] Starting push phase...');
      const pushResult = await this.syncPushOnly(email, userID);
      result.profile = pushResult.profile;
      result.attendance = pushResult.attendance;
      result.settings = pushResult.settings;
      result.errors.push(...pushResult.errors);

      // Phase 2: Pull from server (only if push was successful)
      if (pushResult.success) {
        logger.debug('[SyncCoordinator] Starting pull phase...');
        await this.syncPullOnly(email, userID);
      }

      result.success = pushResult.success && result.errors.length === 0;
      logger.debug('[SyncCoordinator] Sync completed', { result });
      return result;
    } catch (error: any) {
      logger.error('syncAll error', error, undefined, { email, userID });
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
        logger.debug('[SyncCoordinator] Offline - cannot push');
        result.success = false;
        result.errors.push('No network connection');
        return result;
      }

      // Push unsynced profile properties
      try {
        result.profile = await profileSyncService.syncAllUnsyncedProperties(email);
        logger.debug('[SyncCoordinator] Profile sync', { succeeded: result.profile.success, failed: result.profile.failed });
      } catch (error: any) {
        result.errors.push(`Profile sync error: ${error.message}`);
        result.success = false;
      }

      // Push unsynced attendance records
      try {
        result.attendance = await attendanceSyncService.syncAllUnsyncedAttendance(userID);
        logger.debug('[SyncCoordinator] Attendance sync', { succeeded: result.attendance.success, failed: result.attendance.failed });
      } catch (error: any) {
        result.errors.push(`Attendance sync error: ${error.message}`);
        result.success = false;
      }

      // Push unsynced settings
      try {
        result.settings = await settingsSyncService.syncAllUnsyncedSettings();
        logger.debug('[SyncCoordinator] Settings sync', { succeeded: result.settings.success, failed: result.settings.failed });
      } catch (error: any) {
        result.errors.push(`Settings sync error: ${error.message}`);
        result.success = false;
      }

      return result;
    } catch (error: any) {
      logger.error('syncPushOnly error', error, undefined, { email, userID });
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
        logger.debug('[SyncCoordinator] Offline - cannot pull');
        return;
      }

      // Pull profile from server
      try {
        await profileSyncService.syncProfileFromServer(email);
        logger.debug('[SyncCoordinator] Profile pulled from server');
      } catch (error: any) {
        logger.error('syncPullOnly - profile error', error, undefined, { email });
      }

      // Pull attendance from server
      try {
        await attendanceSyncService.syncAttendanceFromServer(userID);
        logger.debug('[SyncCoordinator] Attendance pulled from server');
      } catch (error: any) {
        logger.error('syncPullOnly - attendance error', error, undefined, { userID });
      }

      // Pull settings from server
      try {
        await settingsSyncService.syncSettingsFromServer();
        logger.debug('[SyncCoordinator] Settings pulled from server');
      } catch (error: any) {
        logger.error('syncPullOnly - settings error', error);
      }
    } catch (error: any) {
      logger.error('syncPullOnly error', error, undefined, { email, userID });
    }
  }

  /**
   * Process sync queue (retry failed items)
   */
  async processSyncQueue(): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        logger.debug('[SyncCoordinator] Offline - cannot process queue');
        return;
      }

      const pendingItems = await syncQueueService.getPendingItems();
      logger.debug('[SyncCoordinator] Processing items from sync queue', { count: pendingItems.length });

      for (const item of pendingItems) {
        try {
          // Check if should retry
          if (!retryService.shouldRetry(item.attempts)) {
            logger.debug('[SyncCoordinator] Max attempts reached, removing from queue', { itemId: item.id });
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
            logger.debug('[SyncCoordinator] Successfully synced item', { itemId: item.id });
          } else {
            await syncQueueService.incrementAttempts(item.id);
            logger.debug('[SyncCoordinator] Failed to sync item, will retry later', { itemId: item.id });
          }
        } catch (error: any) {
          logger.error('processSyncQueue item error', error, undefined, { itemId: item.id });
          await syncQueueService.incrementAttempts(item.id);
        }
      }
    } catch (error: any) {
      logger.error('processSyncQueue error', error);
    }
  }
}

export const syncCoordinator = new SyncCoordinator();

