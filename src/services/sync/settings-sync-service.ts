import SQLite from 'react-native-sqlite-storage';
import { logger } from '../logger';
import { getDB } from '../attendance/attendance-db-service';
import { syncQueueService } from './sync-queue-service';
import { networkService } from '../network/network-service';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && logger.debug('[SettingsSync]', ...args);

export interface UnsyncedSetting {
  key: string;
  value: any;
  lastUpdatedAt: number;
}

export interface SettingSyncStatus {
  key: string;
  value: any;
  isSynced: boolean;
  lastUpdatedAt: number | null;
  serverLastUpdatedAt: number | null;
}

/**
 * Settings Sync Service
 * Handles syncing user preferences with per-key sync tracking
 */
class SettingsSyncService {
  /**
   * Save setting to SQLite and mark as unsynced
   */
  async saveSetting(key: string, value: any): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const now = Date.now();
          const valueString = typeof value === 'string' ? value : JSON.stringify(value);

          // Check if setting exists
          tx.executeSql(
            `SELECT key FROM settings WHERE key = ?`,
            [key],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                // Insert new setting
                tx.executeSql(
                  `INSERT INTO settings (key, value, isSynced, lastUpdatedAt, createdAt, updatedAt)
                    VALUES (?, ?, 0, ?, ?, ?)`,
                  [key, valueString, now, now, now],
                  () => {
                    logger.debug(`[SettingsSync] Saved new setting: ${key}`);
                    this.queueForSync(key, value, now);
                    resolve();
                  },
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Insert setting error', error);
                    reject(error);
                  },
                );
              } else {
                // Update existing setting
                tx.executeSql(
                  `UPDATE settings 
                    SET value = ?, 
                        isSynced = 0, 
                        lastUpdatedAt = ?,
                        updatedAt = ?
                    WHERE key = ?`,
                  [valueString, now, now, key],
                  () => {
                    logger.debug(`[SettingsSync] Updated setting: ${key}`);
                    this.queueForSync(key, value, now);
                    resolve();
                  },
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Update setting error', error);
                    reject(error);
                  },
                );
              }
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Check setting exists error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Save setting transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Queue setting for sync
   */
  private async queueForSync(key: string, value: any, timestamp: number): Promise<void> {
    try {
      await syncQueueService.addToQueue({
        type: 'settings',
        entityId: key,
        property: undefined,
        operation: 'update',
        data: { [key]: value },
        timestamp,
      });
    } catch (error) {
      logger.error('Error queueing setting for sync', error);
    }
  }

  /**
   * Get all unsynced settings
   */
  async getUnsyncedSettings(): Promise<UnsyncedSetting[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT * FROM settings WHERE isSynced = 0`,
            [],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const unsynced: UnsyncedSetting[] = [];
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                unsynced.push({
                  key: row.key,
                  value: this.safeParseJSON(row.value),
                  lastUpdatedAt: row.lastUpdatedAt || Date.now(),
                });
              }
              resolve(unsynced);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get unsynced settings error', error);
              reject(error);
            },
          );
        },
          (error: SQLite.SQLError) => {
            logger.error('Get unsynced settings transaction error', error);
            reject(error);
          },
      );
    });
  }

  /**
   * Sync single setting to server
   * Note: This assumes there's a settings API endpoint
   * If not available, settings can be synced as part of user configuration
   */
  async syncSettingToServer(key: string, value: any): Promise<boolean> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        logger.debug('Offline - cannot sync setting:', key);
        return false;
      }

      // TODO: Implement actual API call to sync settings
      // For now, we'll mark as synced after a delay to simulate sync
      // In production, this should call an actual API endpoint
      logger.debug(`[SettingsSync] Would sync setting ${key} to server (API not implemented yet)`);
      
      // Mark as synced for now (remove this when API is implemented)
      await this.markSettingAsSynced(key);
      return true;
    } catch (error: any) {
      logger.error('syncSettingToServer error', error, undefined, { key });
      return false;
    }
  }

  /**
   * Sync all unsynced settings
   */
  async syncAllUnsyncedSettings(): Promise<{ success: number; failed: number }> {
    const unsynced = await this.getUnsyncedSettings();
    let success = 0;
    let failed = 0;

    for (const item of unsynced) {
      const result = await this.syncSettingToServer(item.key, item.value);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    logger.debug(`[SettingsSync] Synced ${success} settings, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Sync settings from server (pull)
   */
  async syncSettingsFromServer(): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        logger.debug('Offline - cannot pull settings');
        return;
      }

      // TODO: Implement actual API call to pull settings
      // For now, this is a placeholder
      logger.debug('Would pull settings from server (API not implemented yet)');
    } catch (error: any) {
      logger.error('syncSettingsFromServer error', error);
    }
  }

  /**
   * Merge server settings with local settings using timestamp-based conflict resolution
   */
  private async mergeSettingsData(serverSettings: Record<string, any>): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const now = Date.now();

          Object.entries(serverSettings).forEach(([key, serverValue]) => {
            // Get local setting
            tx.executeSql(
              `SELECT * FROM settings WHERE key = ?`,
              [key],
              (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
                const valueString = typeof serverValue === 'string' ? serverValue : JSON.stringify(serverValue);

                if (result.rows.length === 0) {
                  // Insert new setting from server
                  tx.executeSql(
                    `INSERT INTO settings (key, value, isSynced, lastUpdatedAt, server_lastUpdatedAt, createdAt, updatedAt)
                      VALUES (?, ?, 1, ?, ?, ?, ?)`,
                    [key, valueString, now, now, now, now],
                     () => logger.debug(`[SettingsSync] Inserted setting from server: ${key}`),
                    (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
                      logger.error(`Error inserting setting ${key}`, error),
                  );
                } else {
                  const row = result.rows.item(0);
                  const localLastUpdatedAt = row.lastUpdatedAt;
                  const localSynced = row.isSynced;

                  // If local is unsynced, keep local (will be pushed later)
                  if (localSynced === 0 && localLastUpdatedAt) {
                    return;
                  }

                  // Server is newer or local doesn't exist - update from server
                  tx.executeSql(
                    `UPDATE settings 
                      SET value = ?, 
                          isSynced = 1, 
                          lastUpdatedAt = ?,
                          server_lastUpdatedAt = ?,
                          updatedAt = ?
                      WHERE key = ?`,
                    [valueString, now, now, now, key],
                     () => logger.debug(`[SettingsSync] Updated setting from server: ${key}`),
                      (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
                        logger.error(`Error updating setting ${key}`, error),
                  );
                }
              },
                (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
                  logger.error(`Error getting setting ${key}`, error),
            );
          });
        },
          (error: SQLite.SQLError) => {
            logger.error('Merge settings transaction error', error);
            reject(error);
          },
        () => {
          logger.debug('Merged settings from server');
          resolve();
        },
      );
    });
  }

  /**
   * Mark setting as synced
   */
  async markSettingAsSynced(key: string): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `UPDATE settings 
              SET isSynced = 1,
                  updatedAt = ?
              WHERE key = ?`,
            [Date.now(), key],
            () => {
               logger.debug(`[SettingsSync] Marked ${key} as synced`);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Mark setting as synced error', error);
              reject(error);
            },
          );
        },
          (error: SQLite.SQLError) => {
            logger.error('Mark setting as synced transaction error', error);
            reject(error);
          },
      );
    });
  }

  /**
   * Get sync status for all settings
   */
  async getSettingsSyncStatus(): Promise<SettingSyncStatus[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT * FROM settings`,
            [],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const statuses: SettingSyncStatus[] = [];
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                statuses.push({
                  key: row.key,
                  value: this.safeParseJSON(row.value),
                  isSynced: row.isSynced === 1,
                  lastUpdatedAt: row.lastUpdatedAt || null,
                  serverLastUpdatedAt: row.server_lastUpdatedAt || null,
                });
              }
              resolve(statuses);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get settings sync status error', error);
              reject(error);
            },
          );
        },
          (error: SQLite.SQLError) => {
            logger.error('Get settings sync status transaction error', error);
            reject(error);
          },
      );
    });
  }

  /**
   * Load setting from database
   */
  async loadSettingFromDB(key: string): Promise<any> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT value FROM settings WHERE key = ?`,
            [key],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                resolve(null);
                return;
              }

              const value = this.safeParseJSON(result.rows.item(0).value);
              resolve(value);
            },
              (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                logger.error('Load setting from DB error', error);
                reject(error);
              },
          );
        },
          (error: SQLite.SQLError) => {
            logger.error('Load setting from DB transaction error', error);
            reject(error);
          },
      );
    });
  }

  /**
   * Safe JSON parse
   */
  private safeParseJSON(str: string): any {
    try {
      return str ? JSON.parse(str) : str;
    } catch {
      return str;
    }
  }
}

export const settingsSyncService = new SettingsSyncService();

