import SQLite from 'react-native-sqlite-storage';
import { getDB } from '../attendance/attendance-db-service';
import { PROFILE_PROPERTIES, ProfileProperty } from '../database/database-service';
import { syncQueueService } from './sync-queue-service';
import { networkService } from '../network/network-service';
import { updateProfile, uploadProfilePhoto, getProfile, ProfileResponse } from '../auth/profile-service';
import { logger } from '../logger';

const DEBUG = true;
const log = (...args: any[]): void => {
  if (DEBUG) {
    logger.debug(args.join(' '));
  }
};

export interface UnsyncedProfileProperty {
  email: string;
  property: ProfileProperty;
  value: any;
  lastUpdatedAt: number;
}

export interface ProfileSyncStatus {
  email: string;
  properties: {
    [key in ProfileProperty]?: {
      value: any;
      isSynced: boolean;
    };
  };
  lastUpdatedAt: number | null; // Updated only when local changes are made (not from server)
  serverLastSyncedAt: number | null; // Updated only from server response (not from local)
}

/**
 * Profile Sync Service
 * Handles per-property sync tracking with timestamp-based conflict resolution
 */
class ProfileSyncService {
  /**
   * Update lastUpdatedAt timestamp (called before making update API call)
   */
  async updateLastUpdatedAt(email: string, timestamp: number): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `UPDATE profile SET lastUpdatedAt = ?, isSynced = 0, updatedAt = ? WHERE email = ?`,
            [timestamp, Date.now(), email],
            () => {
              log(`Updated lastUpdatedAt to ${timestamp}`);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Update lastUpdatedAt error', error, undefined, {
                email,
                timestamp,
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('updateLastUpdatedAt error', error, undefined, { email, timestamp });
          reject(error);
        },
      );
    });
  }

  /**
   * Save profile property to SQLite and mark as unsynced
   * Note: lastUpdatedAt should be set BEFORE calling this (via updateLastUpdatedAt)
   */
  async saveProfileProperty(
    email: string,
    property: ProfileProperty,
    value: any,
  ): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          const now = Date.now();
          const valueString = typeof value === 'string' ? value : JSON.stringify(value);

          // Check if profile exists
          tx.executeSql(
            `SELECT email FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                // Insert new profile
                const propertyColumns = PROFILE_PROPERTIES.join(', ');
                const propertyPlaceholders = PROFILE_PROPERTIES.map((prop) => {
                  return prop === property ? '?' : 'NULL';
                }).join(', ');

                const insertSQL = `
                  INSERT INTO profile (email, ${propertyColumns}, lastUpdatedAt, isSynced, createdAt, updatedAt)
                  VALUES (?, ${propertyPlaceholders}, ?, 0, ?, ?)
                `;

                // lastUpdatedAt should already be set, but use now as fallback
                const params = [email, valueString, now, now, now];

                tx.executeSql(
                  insertSQL,
                  params,
                  () => {
                    log(`Saved new profile property: ${property}`);
                    this.queueForSync(email, property, value, now);
                    resolve();
                  },
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Insert profile error', error, undefined, {
                      email,
                      property,
                      operation: 'insert',
                    });
                    reject(error);
                  },
                );
              } else {
                // Update existing profile - mark as unsynced (lastUpdatedAt already set before API call)
                tx.executeSql(
                  `UPDATE profile 
                    SET ${property} = ?, 
                        isSynced = 0,
                        updatedAt = ?
                    WHERE email = ?`,
                  [valueString, Date.now(), email],
                  () => {
                    log(`Updated profile property: ${property}`);
                    this.queueForSync(email, property, value, now);
                    resolve();
                  },
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Update profile property error', error, undefined, {
                      email,
                      property,
                      operation: 'update',
                    });
                    reject(error);
                  },
                );
              }
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Check profile exists error', error, undefined, {
                email,
                property,
                operation: 'check_exists',
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Save profile property transaction error', error, undefined, {
            email,
            property,
          });
          reject(error);
        },
      );
    });
  }

  /**
   * Queue property for sync
   */
  private async queueForSync(
    email: string,
    property: ProfileProperty,
    value: any,
    timestamp: number,
  ): Promise<void> {
    try {
      await syncQueueService.addToQueue({
        type: 'profile',
        entityId: email,
        property,
        operation: 'update',
        data: { [property]: value },
        timestamp,
      });
    } catch (error) {
      logger.error('Error queueing for sync', error as Error, undefined, {
        email,
        property,
      });
    }
  }

  /**
   * Get all unsynced profile properties for a user
   */
  async getUnsyncedProfileProperties(email: string): Promise<UnsyncedProfileProperty[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT * FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                resolve([]);
                return;
              }

              const row = result.rows.item(0);
              const unsynced: UnsyncedProfileProperty[] = [];

              // If isSynced = 0, all properties are unsynced
              if (row.isSynced === 0) {
                PROFILE_PROPERTIES.forEach((prop) => {
                  const value = this.safeParseJSON(row[prop]);
                  if (value !== null && value !== undefined) {
                    unsynced.push({
                      email,
                      property: prop,
                      value,
                      lastUpdatedAt: row.lastUpdatedAt || Date.now(),
                    });
                  }
                });
              }

              resolve(unsynced);
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get unsynced properties error', error, undefined, {
                email,
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Get unsynced properties transaction error', error, undefined, {
            email,
          });
          reject(error);
        },
      );
    });
  }

  /**
   * Sync single property to server
   */
  async syncProfilePropertyToServer(
    email: string,
    property: ProfileProperty,
    value: any,
  ): Promise<boolean> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot sync property:', property);
        return false;
      }

      // Special handling for profilePhoto
      if (property === 'profilePhoto') {
        const response = await uploadProfilePhoto(value);
        if (response.success) {
          await this.markPropertyAsSynced(email, property);
          return true;
        }
        return false;
      }

      // For other properties, use updateProfile
      const updateData: any = { [property]: value };
      await updateProfile(updateData);
      await this.markPropertyAsSynced(email, property);
      return true;
    } catch (error: any) {
      logger.error('syncProfilePropertyToServer error', error, undefined, { email, property });
      return false;
    }
  }

  /**
   * Sync all unsynced properties
   */
  async syncAllUnsyncedProperties(email: string): Promise<{ success: number; failed: number }> {
    const unsynced = await this.getUnsyncedProfileProperties(email);
    let success = 0;
    let failed = 0;

    for (const item of unsynced) {
      const result = await this.syncProfilePropertyToServer(email, item.property, item.value);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    log(`Synced ${success} properties, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Sync profile from server (pull)
   */
  async syncProfileFromServer(email: string): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Offline - cannot pull profile');
        return;
      }

      const serverProfile = await getProfile();
      await this.mergeServerProfileData(email, serverProfile);
    } catch (error: any) {
      logger.error('Failed to sync profile from server', error, undefined, {
        email,
      });
    }
  }

  /**
   * Merge server profile data with local data using timestamp-based conflict resolution
   * Public method to merge server data directly (used by getProfile to avoid recursion)
   */
  async mergeServerProfileData(email: string, serverProfile: ProfileResponse): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          // Get current local profile
          tx.executeSql(
            `SELECT * FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              const now = Date.now();

              if (result.rows.length === 0) {
                // Insert new profile from server
                const propertyColumns = PROFILE_PROPERTIES.join(', ');
                const propertyPlaceholders = PROFILE_PROPERTIES.map(() => '?').join(', ');

                const insertSQL = `
                  INSERT INTO profile (email, ${propertyColumns}, lastUpdatedAt, server_lastSyncedAt, isSynced, createdAt, updatedAt)
                  VALUES (?, ${propertyPlaceholders}, NULL, ?, 1, ?, ?)
                `;

                const params: any[] = [email];
                PROFILE_PROPERTIES.forEach((prop) => {
                  const value = serverProfile[prop as keyof ProfileResponse];
                  params.push(value ? (typeof value === 'string' ? value : JSON.stringify(value)) : null);
                });
                params.push(now, now, now);

                tx.executeSql(
                  insertSQL,
                  params,
                  () => {
                    log('Inserted profile from server');
                    resolve();
                  },
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Insert profile from server error', error, undefined, {
                      email,
                      operation: 'insert',
                    });
                    reject(error);
                  },
                );
              } else {
                // Update existing profile with conflict resolution using single timestamp
                const row = result.rows.item(0);
                const lastUpdatedAt = row.lastUpdatedAt || null; // Local last update time (only from local changes)
                const serverLastSyncedAt = serverProfile.lastSyncedAt 
                  ? new Date(serverProfile.lastSyncedAt).getTime() 
                  : now;
                
                // Compare timestamps: use whichever is greater
                // lastUpdatedAt is only updated when local changes are made, not from server
                // server_lastSyncedAt is only updated from server response
                const useServerData = lastUpdatedAt === null || serverLastSyncedAt >= lastUpdatedAt;
                
                const updates: string[] = [];
                const params: any[] = [];

                if (useServerData) {
                  // Server is newer or equal - update all properties from server
                  PROFILE_PROPERTIES.forEach((prop) => {
                    const serverValue = serverProfile[prop as keyof ProfileResponse];
                    if (serverValue !== undefined && serverValue !== null) {
                      const valueString = typeof serverValue === 'string' ? serverValue : JSON.stringify(serverValue);
                      updates.push(`${prop} = ?`);
                      params.push(valueString);
                    }
                  });
                  
                  // Update server_lastSyncedAt and mark as synced (but NOT lastUpdatedAt - that's only for local changes)
                  if (updates.length > 0) {
                    updates.push('server_lastSyncedAt = ?');
                    updates.push('isSynced = 1');
                    updates.push('updatedAt = ?');
                    params.push(serverLastSyncedAt, now, email);
                  }
                } else {
                  // Local is newer - keep local data, only update server_lastSyncedAt for tracking
                  updates.push('server_lastSyncedAt = ?');
                  updates.push('updatedAt = ?');
                  params.push(serverLastSyncedAt, now, email);
                }

                if (updates.length > 0) {

                  tx.executeSql(
                    `UPDATE profile SET ${updates.join(', ')} WHERE email = ?`,
                    params,
                    () => {
                      log('Merged profile from server');
                      resolve();
                    },
                    (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
                      logger.error('Merge profile error', error, undefined, {
                        email,
                        operation: 'update',
                      });
                      reject(error);
                    },
                  );
                } else {
                  // No updates needed
                  resolve();
                }
              }
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Get profile for merge error', error, undefined, {
                email,
                operation: 'get_profile',
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Merge profile transaction error', error, undefined, {
            email,
          });
          reject(error);
        },
      );
    });
  }

  /**
   * Mark profile as synced (sets isSynced = 1)
   */
  async markPropertyAsSynced(email: string, _property: ProfileProperty): Promise<void> {
    // For backward compatibility, but now marks entire profile as synced
    await this.markAsSynced(email);
  }

  /**
   * Mark entire profile as synced
   */
  async markAsSynced(email: string): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `UPDATE profile 
              SET isSynced = 1,
                  updatedAt = ?
              WHERE email = ?`,
            [Date.now(), email],
            () => {
              log(`Marked profile as synced`);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Mark as synced error', error, undefined, {
                email,
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('markAsSynced error', error, undefined, { email });
          reject(error);
        },
      );
    });
  }

  /**
   * Get sync status for all properties
   */
  async getProfileSyncStatus(email: string): Promise<ProfileSyncStatus> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT * FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                resolve({
                  email,
                  properties: {},
                  lastUpdatedAt: null,
                  serverLastSyncedAt: null,
                });
                return;
              }

              const row = result.rows.item(0);
              const properties: ProfileSyncStatus['properties'] = {};
              const isSynced = row.isSynced === 1;

              PROFILE_PROPERTIES.forEach((prop) => {
                properties[prop] = {
                  value: this.safeParseJSON(row[prop]),
                  isSynced: isSynced, // All properties share the same sync status
                };
              });

              resolve({
                email,
                properties,
                lastUpdatedAt: row.lastUpdatedAt || null,
                serverLastSyncedAt: row.server_lastSyncedAt || null,
              });
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('getProfileSyncStatus error', error, undefined, { email });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Get profile sync status transaction error', error, undefined, {
            email,
          });
          reject(error);
        },
      );
    });
  }

  /**
   * Load profile from database
   */
  async loadProfileFromDB(email: string): Promise<ProfileResponse | null> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `SELECT * FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              try {
                if (result.rows.length === 0) {
                  resolve(null);
                  return;
                }

                const row = result.rows.item(0);
                const profile: any = {
                  email: row.email,
                };

                PROFILE_PROPERTIES.forEach((prop) => {
                  try {
                    // Check if column exists in row before accessing
                    if (row.hasOwnProperty(prop)) {
                      const value = this.safeParseJSON(row[prop]);
                      if (value !== null && value !== undefined) {
                        // Map profilePhoto to profilePhotoUrl for ProfileResponse interface
                        if (prop === 'profilePhoto') {
                          profile.profilePhotoUrl = value;
                        } else {
                          profile[prop] = value;
                        }
                      }
                    }
                  } catch (propError) {
                    // Skip properties that cause parsing errors
                    logger.debug(`Error parsing profile property ${prop}:`, propError);
                  }
                });

                resolve(profile as ProfileResponse);
              } catch (parseError) {
                logger.error('Error parsing profile data from DB', parseError, undefined, {
                  email,
                  rowKeys: row ? Object.keys(row) : 'no row',
                });
                // Return null instead of rejecting to allow app to continue
                resolve(null);
              }
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Load profile from DB error', error, undefined, {
                email,
                errorCode: error.code,
                errorMessage: error.message,
              });
              // Return null instead of rejecting to allow app to continue with fallback data
              resolve(null);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('loadProfileFromDB error', error, undefined, { email, errorCode: error.code, errorMessage: error.message });
          // Return null instead of rejecting to allow app to continue
          resolve(null);
        },
      );
    });
  }

  /**
   * Sync lastUpdatedAt with server_lastSyncedAt when server is newer or equal
   * This ensures that after a service call, if server_lastSyncedAt >= lastUpdatedAt,
   * we update lastUpdatedAt to match server_lastSyncedAt
   */
  async syncLastUpdatedAtWithServer(email: string, serverLastSyncedAt: number): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          tx.executeSql(
            `UPDATE profile SET lastUpdatedAt = ? WHERE email = ?`,
            [serverLastSyncedAt, email],
            () => {
              log(`Synced lastUpdatedAt with server_lastSyncedAt: ${serverLastSyncedAt}`);
              resolve();
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Error syncing lastUpdatedAt', error, undefined, {
                email,
                serverLastSyncedAt,
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('syncLastUpdatedAtWithServer error', error, undefined, { email, serverLastSyncedAt });
          reject(error);
        },
      );
    });
  }

  /**
   * Update server last synced timestamp
   */
  async updateServerLastSyncedAt(email: string, timestamp: number): Promise<void> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.transaction(
        (tx: SQLite.Transaction) => {
          // Check if profile exists
          tx.executeSql(
            `SELECT email FROM profile WHERE email = ?`,
            [email],
            (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
              if (result.rows.length === 0) {
                // Profile doesn't exist, create it
                tx.executeSql(
                  `INSERT INTO profile (email, server_lastSyncedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
                  [email, timestamp, Date.now(), Date.now()],
                  () => {
                    log(`Created profile and set server_lastSyncedAt to ${timestamp}`);
                    resolve();
                  },
                  (_tx2: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Error creating profile with server_lastSyncedAt', error, undefined, {
                      email,
                      timestamp,
                      operation: 'create',
                    });
                    reject(error);
                  },
                );
              } else {
                // Update existing profile
                tx.executeSql(
                  `UPDATE profile SET server_lastSyncedAt = ?, updatedAt = ? WHERE email = ?`,
                  [timestamp, Date.now(), email],
                  () => {
                    log(`Updated server_lastSyncedAt to ${timestamp} for ${email}`);
                    resolve();
                  },
                  (_tx2: SQLite.Transaction, error: SQLite.SQLError) => {
                    logger.error('Error updating server_lastSyncedAt', error, undefined, {
                      email,
                      timestamp,
                      operation: 'update',
                    });
                    reject(error);
                  },
                );
              }
            },
            (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Error checking profile existence', error, undefined, {
                email,
                timestamp,
                operation: 'check_exists',
              });
              reject(error);
            },
          );
        },
        (error: SQLite.SQLError) => {
          logger.error('Update server_lastSyncedAt transaction error', error, undefined, {
            email,
            timestamp,
          });
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

export const profileSyncService = new ProfileSyncService();

