import SQLite from 'react-native-sqlite-storage';
import { logger } from '../logger';
import { getDB } from '../attendance/attendance-db-service';
import { retryService } from './retry-service';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && logger.debug('[SyncQueue]', ...args);

export interface SyncQueueItem {
  id: string;
  type: 'profile' | 'attendance' | 'settings';
  entityId: string; // email for profile, timestamp for attendance, key for settings
  property?: string; // property name for profile (firstName, lastName, etc.), null for attendance
  operation: 'create' | 'update' | 'delete';
  data: any; // JSON string or object
  timestamp: number;
  attempts: number;
  nextRetryAt: number;
  createdAt: number;
}

/**
 * Sync Queue Service
 * Manages pending sync operations with property-level tracking
 */
class SyncQueueService {
  /**
   * Add operation to sync queue
   */
  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'nextRetryAt' | 'createdAt'>): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const id = `${item.type}_${item.entityId}_${item.property || 'all'}_${item.timestamp}`;
          const attempts = 0;
          const nextRetryAt = retryService.calculateNextRetryAt(attempts);
          const createdAt = Date.now();
          const dataString = typeof item.data === 'string' ? item.data : JSON.stringify(item.data);

          tx.executeSql(
            `INSERT OR REPLACE INTO sync_queue 
              (id, type, entityId, property, operation, data, timestamp, attempts, nextRetryAt, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.type,
              item.entityId,
              item.property || null,
              item.operation,
              dataString,
              item.timestamp,
              attempts,
              nextRetryAt,
              createdAt,
            ],
            () => {
              logger.debug('Added to sync queue:', id);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Add to queue error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Sync queue transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Get pending items ready for sync (nextRetryAt <= now)
   */
  async getPendingItems(): Promise<SyncQueueItem[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const now = Date.now();
          tx.executeSql(
            `SELECT * FROM sync_queue WHERE nextRetryAt <= ? ORDER BY nextRetryAt ASC`,
            [now],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const items: SyncQueueItem[] = [];
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                items.push({
                  id: row.id,
                  type: row.type,
                  entityId: row.entityId,
                  property: row.property || undefined,
                  operation: row.operation,
                  data: this.safeParseJSON(row.data),
                  timestamp: row.timestamp,
                  attempts: row.attempts,
                  nextRetryAt: row.nextRetryAt,
                  createdAt: row.createdAt,
                });
              }
              logger.debug(`[SettingsSync] Found ${items.length} pending items`);
              resolve(items);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get pending items error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Get pending items transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Get pending items by type
   */
  async getPendingItemsByType(type: 'profile' | 'attendance' | 'settings'): Promise<SyncQueueItem[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const now = Date.now();
          tx.executeSql(
            `SELECT * FROM sync_queue WHERE type = ? AND nextRetryAt <= ? ORDER BY nextRetryAt ASC`,
            [type, now],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const items: SyncQueueItem[] = [];
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                items.push({
                  id: row.id,
                  type: row.type,
                  entityId: row.entityId,
                  property: row.property || undefined,
                  operation: row.operation,
                  data: this.safeParseJSON(row.data),
                  timestamp: row.timestamp,
                  attempts: row.attempts,
                  nextRetryAt: row.nextRetryAt,
                  createdAt: row.createdAt,
                });
              }
              resolve(items);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get pending items by type error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Get pending items by type transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Mark item as synced (remove from queue)
   */
  async markAsSynced(id: string): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `DELETE FROM sync_queue WHERE id = ?`,
            [id],
            () => {
              logger.debug('Marked as synced:', id);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Mark as synced error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Mark as synced transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Increment retry attempts and update nextRetryAt
   */
  async incrementAttempts(id: string): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          // Get current attempts
          tx.executeSql(
            `SELECT attempts FROM sync_queue WHERE id = ?`,
            [id],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                reject(new Error('Item not found in queue'));
                return;
              }

              const currentAttempts = result.rows.item(0).attempts;
              const newAttempts = currentAttempts + 1;
              const nextRetryAt = retryService.calculateNextRetryAt(newAttempts);

              tx.executeSql(
                `UPDATE sync_queue SET attempts = ?, nextRetryAt = ? WHERE id = ?`,
                [newAttempts, nextRetryAt, id],
                () => {
                  logger.debug(`[SettingsSync] Incremented attempts for ${id}: ${newAttempts}`);
                  resolve();
                },
                (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                  logger.error('Increment attempts error', error);
                  reject(error);
                },
              );
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get attempts error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Increment attempts transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Remove all items from queue (for cleanup)
   */
  async clearQueue(): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `DELETE FROM sync_queue`,
            [],
            () => {
              logger.debug('Queue cleared');
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Clear queue error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Clear queue transaction error', error);
          reject(error);
        },
      );
    });
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT COUNT(*) as count FROM sync_queue`,
            [],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const count = result.rows.item(0).count;
              resolve(count);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get queue size error', error);
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Get queue size transaction error', error);
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
      return str ? JSON.parse(str) : null;
    } catch {
      return str;
    }
  }
}

export const syncQueueService = new SyncQueueService();

