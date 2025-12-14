import SQLite from 'react-native-sqlite-storage';
import { getDB } from '../attendance/attendance-db-service';
import { logger } from '../logger';

const log = (...args: any[]): void => {
  logger.debug(args.join(' '));
};

/**
 * Database Service
 * Manages SQLite database schema for profile, settings, and sync queue tables
 */

// Profile properties that need sync tracking
export const PROFILE_PROPERTIES = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'employmentType',
  'designation',
  'profilePhoto',
] as const;

export type ProfileProperty = typeof PROFILE_PROPERTIES[number];

/**
 * Create Profile Table with granular sync tracking
 */
export const createProfileTable = (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        // Build column definitions for each property (no per-property sync flags)
        const propertyColumns = PROFILE_PROPERTIES.map((prop) => {
          return `${prop} TEXT`;
        }).join(', ');

        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS profile (
            email TEXT PRIMARY KEY,
            ${propertyColumns},
            lastUpdatedAt INTEGER,
            server_lastSyncedAt INTEGER,
            isSynced INTEGER DEFAULT 1,
            createdAt INTEGER,
            updatedAt INTEGER
          );
        `;

        tx.executeSql(
          createTableSQL,
          [],
          () => log('Profile table created successfully'),
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Profile table creation error', error);
            reject(error);
          },
        );

        // Create indexes
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);`,
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Profile table transaction error', error);
        reject(error);
      },
      () => {
        log('Profile table transaction successful');
        resolve();
      },
    );
  });
};

/**
 * Update Profile Table structure (add missing columns)
 */
export const updateProfileTableStructure = (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        tx.executeSql(
          `PRAGMA table_info(profile);`,
          [],
          (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
            const existing = new Set<string>();
            for (let i = 0; i < result.rows.length; i++) {
              existing.add(result.rows.item(i).name);
            }

            // Add email column if table doesn't exist
            if (result.rows.length === 0) {
              createProfileTable().then(resolve).catch(reject);
              return;
            }

            // Add missing property columns (no per-property sync flags)
            PROFILE_PROPERTIES.forEach((prop) => {
              if (!existing.has(prop)) {
                tx.executeSql(
                  `ALTER TABLE profile ADD COLUMN ${prop} TEXT;`,
                  [],
                  () => log(`Added column: ${prop}`),
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error('Error adding column', error, undefined, { column: prop }),
                );
              }
            });

            // Add metadata columns if missing
            const metadataColumns = [
              { name: 'lastUpdatedAt', type: 'INTEGER' },
              { name: 'server_lastSyncedAt', type: 'INTEGER' },
              { name: 'isSynced', type: 'INTEGER DEFAULT 1' },
              { name: 'createdAt', type: 'INTEGER' },
              { name: 'updatedAt', type: 'INTEGER' },
            ];

            metadataColumns.forEach(({ name, type }) => {
              if (!existing.has(name)) {
                tx.executeSql(
                  `ALTER TABLE profile ADD COLUMN ${name} ${type};`,
                  [],
                  () => log(`Added column: ${name}`),
                  (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error('Error adding column', error, undefined, { column: name }),
                );
              }
            });

            // Remove old per-property columns if they exist (cleanup migration)
            const oldColumnsToRemove: string[] = [];
            PROFILE_PROPERTIES.forEach((prop) => {
              // Remove old _synced columns
              if (existing.has(`${prop}_synced`)) {
                oldColumnsToRemove.push(`${prop}_synced`);
              }
              // Remove old _lastUpdatedAt columns
              if (existing.has(`${prop}_lastUpdatedAt`)) {
                oldColumnsToRemove.push(`${prop}_lastUpdatedAt`);
              }
            });

            // Remove old per-property columns by recreating table (SQLite doesn't support DROP COLUMN)
            if (oldColumnsToRemove.length > 0) {
              log('Old columns detected, migrating to new schema:', oldColumnsToRemove.join(', '));
              
              // Step 1: Create new table with correct schema
              const propertyColumns = PROFILE_PROPERTIES.map((prop) => `${prop} TEXT`).join(', ');
              const createNewTableSQL = `
                CREATE TABLE IF NOT EXISTS profile_new (
                  email TEXT PRIMARY KEY,
                  ${propertyColumns},
                  lastUpdatedAt INTEGER,
                  server_lastSyncedAt INTEGER,
                  isSynced INTEGER DEFAULT 1,
                  createdAt INTEGER,
                  updatedAt INTEGER
                );
              `;
              
              tx.executeSql(createNewTableSQL, [], (_tx2: SQLite.Transaction) => {
                // Step 2: Copy data from old table to new table (only valid columns)
                const propertyList = PROFILE_PROPERTIES.join(', ');
                const copyDataSQL = `
                  INSERT INTO profile_new (email, ${propertyList}, lastUpdatedAt, server_lastSyncedAt, isSynced, createdAt, updatedAt)
                  SELECT 
                    email,
                    ${propertyList},
                    lastUpdatedAt,
                    server_lastSyncedAt,
                    COALESCE(isSynced, 1) as isSynced,
                    createdAt,
                    updatedAt
                  FROM profile;
                `;
                
                _tx2.executeSql(copyDataSQL, [], (_tx3: SQLite.Transaction) => {
                  // Step 3: Drop old table
                  _tx3.executeSql('DROP TABLE profile;', [], (_tx4: SQLite.Transaction) => {
                    // Step 4: Rename new table
                    _tx4.executeSql('ALTER TABLE profile_new RENAME TO profile;', [], () => {
                      log('Profile table migration completed successfully - old columns removed');
                    }, (_tx5: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Error renaming table', error, undefined, { operation: 'rename_table' });
                    });
                  }, (_tx5: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Error dropping old table', error, undefined, { operation: 'drop_table' });
                  });
                }, (_tx3: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Error copying data', error, undefined, {
              operation: 'copy_data',
            });
                });
              }, (_tx2: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Error creating new table', error, undefined, {
              operation: 'create_table',
            });
              });
            }
          },
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('PRAGMA error', error);
            reject(error);
          },
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Profile table transaction error', error);
        reject(error);
      },
      () => {
        log('Profile table structure update successful');
        resolve();
      },
    );
  });
};

/**
 * Create Settings Table
 */
export const createSettingsTable = (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            isSynced INTEGER DEFAULT 1,
            lastUpdatedAt INTEGER,
            server_lastUpdatedAt INTEGER,
            createdAt INTEGER,
            updatedAt INTEGER
          );
        `;

        tx.executeSql(
          createTableSQL,
          [],
          () => log('Settings table created successfully'),
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Profile table creation error', error);
            reject(error);
          },
        );

        // Create indexes
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_settings_synced ON settings(isSynced);`,
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Settings table transaction error', error);
        reject(error);
      },
      () => {
        log('Settings table transaction successful');
        resolve();
      },
    );
  });
};

/**
 * Create Sync Queue Table
 */
export const createSyncQueueTable = (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            type TEXT,
            entityId TEXT,
            property TEXT,
            operation TEXT,
            data TEXT,
            timestamp INTEGER,
            attempts INTEGER DEFAULT 0,
            nextRetryAt INTEGER,
            createdAt INTEGER
          );
        `;

        tx.executeSql(
          createTableSQL,
          [],
          () => log('Sync queue table created successfully'),
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('Profile table creation error', error);
            reject(error);
          },
        );

        // Create indexes
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_sync_queue_entityId ON sync_queue(entityId);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_sync_queue_nextRetryAt ON sync_queue(nextRetryAt);`,
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Profile table transaction error', error);
        reject(error);
      },
      () => {
        log('Sync queue table transaction successful');
        resolve();
      },
    );
  });
};

/**
 * Initialize all database tables
 */
export const initializeDatabaseTables = async (): Promise<void> => {
  try {
    await createProfileTable();
    await updateProfileTableStructure();
    await createSettingsTable();
    await createSyncQueueTable();
    log('All database tables initialized successfully');
  } catch (error) {
    logger.error('Error initializing database tables', error as Error);
    throw error;
  }
};

/**
 * Extend Attendance Table with additional sync columns
 */
export const extendAttendanceTable = (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        tx.executeSql(
          `PRAGMA table_info(attendance);`,
          [],
          (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
            const existing = new Set<string>();
            for (let i = 0; i < result.rows.length; i++) {
              existing.add(result.rows.item(i).name);
            }

            // Add server_Timestamp if missing
            if (!existing.has('server_Timestamp')) {
              tx.executeSql(
                `ALTER TABLE attendance ADD COLUMN server_Timestamp BIGINT;`,
                [],
                () => log('Added column: server_Timestamp'),
                (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error('Error adding server_Timestamp column', error, undefined, {
              column: 'server_Timestamp',
            }),
              );
            }

            // Add lastSyncedAt if missing
            if (!existing.has('lastSyncedAt')) {
              tx.executeSql(
                `ALTER TABLE attendance ADD COLUMN lastSyncedAt BIGINT;`,
                [],
                () => log('Added column: lastSyncedAt'),
                (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error('Error adding lastSyncedAt column', error, undefined, {
              column: 'lastSyncedAt',
            }),
              );
            }
          },
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            logger.error('PRAGMA error', error);
            reject(error);
          },
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Extend attendance table error', error);
        reject(error);
      },
      () => {
        log('Attendance table extension successful');
        resolve();
      },
    );
  });
};

