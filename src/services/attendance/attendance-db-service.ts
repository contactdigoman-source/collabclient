import SQLite from 'react-native-sqlite-storage';
import moment from 'moment';

import { store, setUserAttendanceHistory, setUserLastAttendance } from '../../redux';
import { logger } from '../logger';

// 🔹 Debug Logger
const log = (...args: any[]): void => {
  logger.debug(args.join(' '));
};

// 🔹 Singleton DB
let db: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabase(
      { name: 'RadiumDB', location: 'default' },
      () => log('Database opened'),
      (error: any) =>         logger.error('DB open error', error as Error, undefined, {
          operation: 'open_database',
        }),
    );
  }
  return db;
};

// 🔹 Table Schema
export const ATTENDANCE_COLUMNS = {
  Timestamp: 'BIGINT PRIMARY KEY',
  OrgID: 'TEXT',
  UserID: 'TEXT',
  PunchType: 'TEXT',
  PunchDirection: 'TEXT',
  LatLon: 'TEXT',
  Address: 'TEXT',
  CreatedOn: 'BIGINT',
  IsSynced: 'TEXT',
  DateOfPunch: 'TEXT',
  AttendanceStatus: 'TEXT',
  ModuleID: 'TEXT',
  TripType: 'TEXT',
  PassengerID: 'TEXT',
  AllowanceData: 'TEXT',
  IsCheckoutQrScan: 'INTEGER',
  TravelerName: 'TEXT',
  PhoneNumber: 'TEXT',
} as const;

interface AttendanceRecord {
  timestamp: string | number;
  orgID: string;
  userID: string;
  punchType: string;
  punchDirection: string;
  latLon: string;
  address: string;
  createdOn: string | number;
  isSynced: string;
  dateOfPunch: string;
  attendanceStatus?: string;
  moduleID?: string;
  tripType?: string;
  passengerID?: string;
  allowanceData?: string;
  isCheckoutQrScan?: number;
  travelerName?: string;
  phoneNumber?: string;
  lastUpdatedAt?: number; // When record was created/updated locally
  lastSyncedAt?: number | null; // When record was synced to server
  server_Timestamp?: number | null; // Server's timestamp for this record
}

interface AttendanceHistoryItem {
  Timestamp: string | number;
  OrgID: string;
  UserID: string;
  PunchType: string;
  PunchDirection: string;
  LatLon: string;
  Address: string;
  CreatedOn: string | number;
  IsSynced: string;
  DateOfPunch: string;
  AttendanceStatus: string;
  ModuleID: string;
  TripType: string;
  PassengerID: string;
  AllowanceData: any;
  IsCheckoutQrScan: number;
  TravelerName: string;
  PhoneNumber: string;
  lastUpdatedAt?: number | null; // When record was created/updated locally
  lastSyncedAt?: number | null; // When record was synced to server
  server_Timestamp?: number | null; // Server's timestamp for this record
}

// 🔹 Safe JSON Parse
const safeParseJSON = (str: string, fallback: any[] = []): any => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

// 🔹 Create Attendance Table
export const createTableForAttendance = async (): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        const columnDefs = Object.entries(ATTENDANCE_COLUMNS)
          .map(([col, type]) => `${col} ${type}`)
          .join(', ');

        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS attendance (${columnDefs});`,
          [],
          () => log('Table created successfully'),
          (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error('Table creation error', error),
        );

        // Indexes for performance
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_userid ON attendance(UserID);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_synced ON attendance(IsSynced);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_timestamp ON attendance(Timestamp);`,
        );
      },
      (error: SQLite.SQLError) => {
        logger.error('Transaction error', error);
        reject(error);
      },
      () => {
        updateTableStructure();
        log('Transaction successful');
        resolve();
      },
    );
  });
};

// 🔹 Update Table Structure (add missing columns)
export const updateTableStructure = (): void => {
  const db = getDB();
  log('Checking table structure...');
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

          Object.entries(ATTENDANCE_COLUMNS).forEach(([col, type]) => {
            if (!existing.has(col)) {
              tx.executeSql(
                `ALTER TABLE attendance ADD COLUMN ${col} ${type};`,
                [],
                () => log(`Added column: ${col}`),
                (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
            logger.error(`Error adding column: ${col}`, error, undefined, {
              column: col,
            }),
              );
            }
          });
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
        logger.error('PRAGMA error', error, undefined, {
          operation: 'pragma',
        }),
      );
    },
    (error: SQLite.SQLError) => {
      logger.error('extendAttendanceTable error', error, undefined, { operation: 'extend_table' });
    },
    () => {
      if (store.getState().userState?.userData?.email) {
        getAttendanceData(store.getState().userState?.userData?.email);
      }
    },
  );
};

// 🔹 Get All Table Data (for debug)
const getTableData = (): void => {
  const db = getDB();
  log('Fetching table data...');
  db.transaction((tx: SQLite.Transaction) => {
    tx.executeSql(
      `SELECT * FROM attendance;`,
      [],
      (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
        const rows: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          rows.push(result.rows.item(i));
        }
        log('Attendance Data:', JSON.stringify(rows, null, 2));
      },
      (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
        logger.error('Get attendance data error', error),
    );
  });
};

// 🔹 Insert Record
export function insertAttendancePunchRecord(
  record: AttendanceRecord,
): Promise<SQLite.ResultSet> {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        // Validate required fields
        if (!record.timestamp) {
          const error = new Error('Timestamp is required for attendance record');
          logger.error('Insert attendance record validation error', error, undefined, {
            userID: record.userID,
            operation: 'insert',
          });
          reject(error);
          return;
        }

        // Ensure timestamp is a number (ticks - milliseconds since epoch)
        // SQLite BIGINT stores ticks perfectly, no conversion needed
        const timestamp = typeof record.timestamp === 'string' 
          ? parseInt(record.timestamp, 10) 
          : record.timestamp;

        // Check if record with this timestamp already exists
        tx.executeSql(
          'SELECT Timestamp FROM attendance WHERE Timestamp = ?',
          [timestamp],
          (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
            if (result.rows.length > 0) {
              // Record already exists, log warning but don't fail
              logger.debug('Attendance record already exists, skipping insert', undefined, {
                timestamp,
                userID: record.userID,
                operation: 'insert_duplicate',
              });
              resolve(result); // Resolve with existing record instead of rejecting
              return;
            }

            // Proceed with insert
            insertNewRecord(tx, record, timestamp, resolve, reject);
          },
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            // Error checking for duplicate, proceed with insert anyway
            logger.warn('Error checking for duplicate record, proceeding with insert', error);
            insertNewRecord(tx, record, timestamp, resolve, reject);
          },
        );
      },
      (error: SQLite.SQLError) => reject(error),
    );
  });
}

// Helper function to insert a new attendance record
function insertNewRecord(
  tx: SQLite.Transaction,
  record: AttendanceRecord,
  timestamp: number,
  resolve: (value: SQLite.ResultSet) => void,
  reject: (reason?: any) => void,
): void {
  // Ensure DateOfPunch is set (derive from timestamp if not provided, in UTC format)
  // Note: Backend DB uses UTC, we only store necessary fields locally
  let dateOfPunch = record.dateOfPunch;
  if (!dateOfPunch && timestamp) {
    dateOfPunch = moment.utc(timestamp).format('YYYY-MM-DD');
  }

  // Build insert statement dynamically based on what columns exist
  // Only include columns that are in ATTENDANCE_COLUMNS (backend doesn't need lastUpdatedAt, lastSyncedAt, server_Timestamp)
  // Backend DB uses UTC, we store what's needed locally
  tx.executeSql(
    `INSERT INTO attendance 
      (Timestamp, OrgID, UserID, PunchType, PunchDirection, LatLon, Address, CreatedOn, IsSynced, DateOfPunch, AttendanceStatus, ModuleID, TripType, PassengerID, AllowanceData, IsCheckoutQrScan, TravelerName, PhoneNumber) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      timestamp,
      record.orgID || '',
      record.userID || '',
      record.punchType || '',
      record.punchDirection || '',
      record.latLon || '',
      record.address || '',
      record.createdOn || timestamp,
      record.isSynced || 'N',
      dateOfPunch || moment.utc().format('YYYY-MM-DD'),
      record.attendanceStatus || '',
      record.moduleID || '',
      record.tripType || '',
      record.passengerID || '',
      record.allowanceData || JSON.stringify([]),
      record.isCheckoutQrScan || 0,
      record.travelerName || '',
      record.phoneNumber || '',
    ],
    (_tx: SQLite.Transaction, res: SQLite.ResultSet) => {
      logger.debug('Insert attendance record success', undefined, {
        timestamp,
        userID: record.userID,
        punchDirection: record.punchDirection,
        rowsAffected: res.rowsAffected,
        insertId: res.insertId,
        operation: 'insert_success',
      });
      // Refresh Redux state after successful insert (don't await - async operation)
      getAttendanceData(record.userID).catch((error) => {
        logger.error('Error refreshing attendance data after insert', error);
      });
      resolve(res);
    },
    (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
      // Check if it's a duplicate key error (constraint violation)
      // SQLite error code 19 is SQLITE_CONSTRAINT (including UNIQUE constraint violations)
      if (error.code === 19 || error.message?.includes('UNIQUE constraint') || error.message?.includes('PRIMARY KEY') || error.message?.includes('unique constraint')) {
        logger.warn('Duplicate attendance record (timestamp already exists), skipping insert', error, {
          timestamp,
          userID: record.userID,
          operation: 'insert_duplicate',
        });
        // Query the existing record and resolve with it
        _tx.executeSql(
          'SELECT * FROM attendance WHERE Timestamp = ?',
          [timestamp],
          (queryTx: SQLite.Transaction, queryResult: SQLite.ResultSet) => {
            // Create a mock ResultSet-like object with the existing record
            const existingRecord = queryResult.rows.item(0);
            resolve(queryResult); // Resolve with the query result
          },
          (queryTx: SQLite.Transaction, queryError: SQLite.SQLError) => {
            // If we can't query the existing record, just resolve (record exists, that's okay)
            logger.warn('Could not query existing record after duplicate error', queryError);
            resolve({ rowsAffected: 0, insertId: timestamp } as SQLite.ResultSet);
          },
        );
      } else {
        logger.error('Insert attendance record error', error, undefined, {
          timestamp,
          userID: record.userID,
          operation: 'insert',
          dateOfPunch: record.dateOfPunch || dateOfPunch,
          punchDirection: record.punchDirection,
          errorCode: error.code,
          errorMessage: error.message,
        });
        reject(error);
      }
    },
  );
}

// 🔹 Get Attendance Data
export const getAttendanceData = (userID: string): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx: SQLite.Transaction) => {
      tx.executeSql(
        'SELECT * FROM attendance WHERE UserID=? ORDER BY Timestamp DESC',
        [userID],
        (_tx: SQLite.Transaction, results: SQLite.ResultSet) => {
          const data: AttendanceHistoryItem[] = [];
          let syncedCount = 0;
          let unsyncedCount = 0;
          for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            if (row.IsSynced === 'Y') {
              syncedCount++;
            } else {
              unsyncedCount++;
            }
            data.push({
              ...row,
              AllowanceData: safeParseJSON(row.AllowanceData),
            });
          }
          logger.debug(`Retrieved ${data.length} attendance records (${syncedCount} synced, ${unsyncedCount} unsynced) for user: ${userID}`);
          
          // Also update last attendance if records exist
          if (data.length > 0) {
            const lastRecord = data[0]; // Already sorted by Timestamp DESC
            logger.debug(`Last record: DateOfPunch=${lastRecord.DateOfPunch}, PunchDirection=${lastRecord.PunchDirection}, Timestamp=${lastRecord.Timestamp}`);
            store.dispatch(setUserLastAttendance(lastRecord));
          }
          
          // Dispatch attendance history update after last attendance to ensure proper state order
          store.dispatch(setUserAttendanceHistory(data));
          resolve();
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
          logger.error('Get attendance data error', error);
          reject(error);
        },
      );
    }, (error: SQLite.SQLError) => {
      logger.error('Get attendance data transaction error', error);
      reject(error);
    });
  });
};

// 🔹 Update Sync State
export const updateAttendanceSyncState = (
  timestamp: string | number,
  isSync: string,
): void => {
  const db = getDB();
  db.transaction((tx: SQLite.Transaction) => {
    tx.executeSql(
      'UPDATE attendance SET IsSynced=? WHERE Timestamp=?',
      [isSync, timestamp],
      () => {
        const history = store.getState().userState.userAttendanceHistory;
        const updated = history.map((item: AttendanceHistoryItem) =>
          item.Timestamp === timestamp ? { ...item, IsSynced: 'Y' } : item,
        );
        store.dispatch(setUserAttendanceHistory(updated));
        log('Sync state updated');
      },
      (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
        logger.error('Get attendance data error', error),
    );
  });
};

// 🔹 Get Unsynced Records
export const getUnsyncedAttendanceRecord = (userID: string): void => {
  const db = getDB();
  db.transaction((tx: SQLite.Transaction) => {
    tx.executeSql(
      'SELECT * FROM attendance WHERE IsSynced=? AND UserID=?',
      ['N', userID],
      (_tx: SQLite.Transaction, results: SQLite.ResultSet) => {
        const unsynced: AttendanceHistoryItem[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          unsynced.push({
            ...row,
            AllowanceData: safeParseJSON(row.AllowanceData),
          });
        }
        // store.dispatch(setUnsyncedAttendance(unsynced));
        log('Unsynced records fetched:', unsynced.length);
      },
      (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
        logger.error('Get attendance data error', error),
    );
  });
};

// 🔹 Get Unsynced Records (Promise-based for sync service)
export const getUnsyncedAttendanceRecords = (userID: string): Promise<AttendanceHistoryItem[]> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx: SQLite.Transaction) => {
      tx.executeSql(
        'SELECT * FROM attendance WHERE IsSynced=? AND UserID=? ORDER BY Timestamp ASC',
        ['N', userID],
        (_tx: SQLite.Transaction, results: SQLite.ResultSet) => {
          const unsynced: AttendanceHistoryItem[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            unsynced.push({
              ...row,
              AllowanceData: safeParseJSON(row.AllowanceData),
            });
          }
          log('Unsynced records fetched:', unsynced.length);
          resolve(unsynced);
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
          logger.error('Get unsynced records error', error);
          reject(error);
        },
      );
    }, (error: SQLite.SQLError) => {
      logger.error('Get unsynced records transaction error', error);
      reject(error);
    });
  });
};

// 🔹 Get All Attendance Records (for sync merge logic)
export const getAllAttendanceRecords = (userID: string): Promise<AttendanceHistoryItem[]> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx: SQLite.Transaction) => {
      tx.executeSql(
        'SELECT * FROM attendance WHERE UserID=? ORDER BY Timestamp DESC',
        [userID],
        (_tx: SQLite.Transaction, results: SQLite.ResultSet) => {
          const data: AttendanceHistoryItem[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            data.push({
              ...row,
              AllowanceData: safeParseJSON(row.AllowanceData),
            });
          }
          resolve(data);
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
          logger.error('Get all attendance records error', error);
          reject(error);
        },
      );
    }, (error: SQLite.SQLError) => {
      logger.error('Get all attendance records transaction error', error);
      reject(error);
    });
  });
};

// 🔹 Mark Attendance Record as Synced
export const markAttendanceRecordAsSynced = (
  timestamp: string | number,
  serverTimestamp?: number,
  lastSyncedAt?: number,
): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx: SQLite.Transaction) => {
      // Backend DB uses UTC, we only need to mark IsSynced in local DB
      tx.executeSql(
        'UPDATE attendance SET IsSynced=? WHERE Timestamp=?',
        ['Y', timestamp],
        () => {
          log('Marked attendance record as synced:', timestamp);
          // Update Redux store
          const history = store.getState().userState.userAttendanceHistory;
          const updated = history.map((item: AttendanceHistoryItem) =>
            item.Timestamp === timestamp 
              ? { ...item, IsSynced: 'Y' } 
              : item,
          );
          store.dispatch(setUserAttendanceHistory(updated));
          resolve();
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
          logger.error('Error marking record as synced', error, undefined, {
            timestamp,
            operation: 'mark_synced',
          });
          reject(error);
        },
      );
    }, (error: SQLite.SQLError) => {
      logger.error('Mark as synced transaction error', error, undefined, {
        timestamp,
        operation: 'mark_synced_transaction',
      });
      reject(error);
    });
  });
};

// 🔹 Update Attendance Record (for merge logic)
export const updateAttendanceRecord = (
  timestamp: string | number,
  updates: Partial<AttendanceHistoryItem>,
  userID: string,
): Promise<void> => {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx: SQLite.Transaction) => {
      // First check if record exists and is synced (we don't update unsynced records)
      tx.executeSql(
        'SELECT IsSynced FROM attendance WHERE Timestamp=? AND UserID=?',
        [timestamp, userID],
        (_tx: SQLite.Transaction, result: SQLite.ResultSet) => {
          if (result.rows.length === 0) {
            // Record doesn't exist, nothing to update
            resolve();
            return;
          }

          const record = result.rows.item(0);
          if (record.IsSynced === 'N') {
            // Don't overwrite unsynced records
            log('Skipping update - record is unsynced:', timestamp);
            resolve();
            return;
          }

          // Build update query dynamically
          const updateFields: string[] = [];
          const updateValues: any[] = [];

          if (updates.OrgID !== undefined) {
            updateFields.push('OrgID=?');
            updateValues.push(updates.OrgID);
          }
          if (updates.PunchType !== undefined) {
            updateFields.push('PunchType=?');
            updateValues.push(updates.PunchType);
          }
          if (updates.PunchDirection !== undefined) {
            updateFields.push('PunchDirection=?');
            updateValues.push(updates.PunchDirection);
          }
          if (updates.LatLon !== undefined) {
            updateFields.push('LatLon=?');
            updateValues.push(updates.LatLon);
          }
          if (updates.Address !== undefined) {
            updateFields.push('Address=?');
            updateValues.push(updates.Address);
          }
          if (updates.CreatedOn !== undefined) {
            updateFields.push('CreatedOn=?');
            updateValues.push(updates.CreatedOn);
          }
          if (updates.IsSynced !== undefined) {
            updateFields.push('IsSynced=?');
            updateValues.push(updates.IsSynced);
          }
          if (updates.DateOfPunch !== undefined) {
            updateFields.push('DateOfPunch=?');
            updateValues.push(updates.DateOfPunch);
          }
          if (updates.AttendanceStatus !== undefined) {
            updateFields.push('AttendanceStatus=?');
            updateValues.push(updates.AttendanceStatus);
          }
          if (updates.ModuleID !== undefined) {
            updateFields.push('ModuleID=?');
            updateValues.push(updates.ModuleID);
          }
          if (updates.TripType !== undefined) {
            updateFields.push('TripType=?');
            updateValues.push(updates.TripType);
          }
          if (updates.PassengerID !== undefined) {
            updateFields.push('PassengerID=?');
            updateValues.push(updates.PassengerID);
          }
          if (updates.AllowanceData !== undefined) {
            updateFields.push('AllowanceData=?');
            updateValues.push(typeof updates.AllowanceData === 'string' 
              ? updates.AllowanceData 
              : JSON.stringify(updates.AllowanceData));
          }
          if (updates.IsCheckoutQrScan !== undefined) {
            updateFields.push('IsCheckoutQrScan=?');
            updateValues.push(updates.IsCheckoutQrScan);
          }
          if (updates.TravelerName !== undefined) {
            updateFields.push('TravelerName=?');
            updateValues.push(updates.TravelerName);
          }
          if (updates.PhoneNumber !== undefined) {
            updateFields.push('PhoneNumber=?');
            updateValues.push(updates.PhoneNumber);
          }
          if (updates.lastSyncedAt !== undefined) {
            updateFields.push('lastSyncedAt=?');
            updateValues.push(updates.lastSyncedAt);
          }
          if (updates.lastUpdatedAt !== undefined) {
            updateFields.push('lastUpdatedAt=?');
            updateValues.push(updates.lastUpdatedAt);
          }
          if (updates.server_Timestamp !== undefined) {
            updateFields.push('server_Timestamp=?');
            updateValues.push(updates.server_Timestamp);
          }

          if (updateFields.length === 0) {
            resolve();
            return;
          }

          updateValues.push(timestamp);
          updateValues.push(userID);

          const updateSQL = `UPDATE attendance SET ${updateFields.join(', ')} WHERE Timestamp=? AND UserID=?`;

          tx.executeSql(
            updateSQL,
            updateValues,
            () => {
              log('Updated attendance record:', timestamp);
              getAttendanceData(userID);
              resolve();
            },
            (_tx2: SQLite.Transaction, error: SQLite.SQLError) => {
              logger.error('Error updating attendance record', error, undefined, {
                timestamp,
                operation: 'update_record',
              });
              reject(error);
            },
          );
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
          logger.error('Error checking record for update', error, undefined, {
            timestamp,
            operation: 'check_for_update',
          });
          reject(error);
        },
      );
    }, (error: SQLite.SQLError) => {
      logger.error('Update attendance record transaction error', error, undefined, {
        timestamp,
        operation: 'update_record_transaction',
      });
      reject(error);
    });
  });
};

