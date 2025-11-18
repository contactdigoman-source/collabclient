import SQLite from 'react-native-sqlite-storage';

import store from '../redux/store';
import { setUserAttendanceHistory } from '../redux/userReducer';
import { Alert } from 'react-native';

// 🔹 Debug Logger
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[SQLite]', ...args);

// 🔹 Singleton DB
let db;
export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabase(
      { name: 'RadiumDB', location: 'default' },
      () => log('Database opened'),
      error => console.log('DB open error:', error),
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
};

// 🔹 Safe JSON Parse
const safeParseJSON = (str, fallback = []) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

// 🔹 Create Attendance Table
export const createTableForAttendance = async () => {
  const db = getDB();
  db.transaction(
    tx => {
      const columnDefs = Object.entries(ATTENDANCE_COLUMNS)
        .map(([col, type]) => `${col} ${type}`)
        .join(', ');

      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS attendance (${columnDefs});`,
        [],
        () => log('Table created successfully'),
        (_, error) => console.log('Table creation error:', error),
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
    error => console.log('Transaction error:', error),
    () => {
      updateTableStructure();
      log('Transaction successful');
    },
  );
};

// 🔹 Update Table Structure (add missing columns)
export const updateTableStructure = () => {
  const db = getDB();
  log('Checking table structure...');
  db.transaction(
    tx => {
      tx.executeSql(
        `PRAGMA table_info(attendance);`,
        [],
        (_, result) => {
          const existing = new Set();
          for (let i = 0; i < result.rows.length; i++) {
            existing.add(result.rows.item(i).name);
          }

          Object.entries(ATTENDANCE_COLUMNS).forEach(([col, type]) => {
            if (!existing.has(col)) {
              tx.executeSql(
                `ALTER TABLE attendance ADD COLUMN ${col} ${type};`,
                [],
                () => log(`Added column: ${col}`),
                (_, error) => console.log(`Error adding ${col}:`, error),
              );
            }
          });
        },
        (_, error) => console.log('PRAGMA error:', error),
      );
    },
    error => console.log('Transaction error:', error),
    () => {
      if (store.getState().userState?.userData?.email) {
        getAttendanceData(store.getState().userState?.userData?.email);
      }
    },
  );
};

// 🔹 Get All Table Data (for debug)
const getTableData = () => {
  const db = getDB();
  log('Fetching table data...');
  db.transaction(tx => {
    tx.executeSql(
      `SELECT * FROM attendance;`,
      [],
      (_, result) => {
        const rows = [];
        for (let i = 0; i < result.rows.length; i++) {
          rows.push(result.rows.item(i));
        }
        log('Attendance Data:', JSON.stringify(rows, null, 2));
      },
      (_, error) => console.log('Fetch error:', error),
    );
  });
};

// 🔹 Insert Record
export function insertAttendancePunchRecord(record) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          `INSERT INTO attendance 
            (Timestamp, OrgID, UserID, PunchType, PunchDirection, LatLon, Address, CreatedOn, IsSynced, DateOfPunch, AttendanceStatus, ModuleID, TripType, PassengerID, AllowanceData, IsCheckoutQrScan, TravelerName, PhoneNumber) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            record.timestamp,
            record.orgID,
            record.userID,
            record.punchType,
            record.punchDirection,
            record.latLon,
            record.address,
            record.createdOn,
            record.isSynced,
            record.dateOfPunch,
            record.attendanceStatus || '',
            record.moduleID || '',
            record.tripType || '',
            record.passengerID || '',
            record.allowanceData || JSON.stringify([]),
            record.isCheckoutQrScan || 0,
            record.travelerName || '',
            record.phoneNumber || '',
          ],
          (_, res) => {
            log('Insert success');
            getAttendanceData(record.userID);
            resolve(res);
          },
          (_, error) => {
            console.log('Insert error:', error);
            reject(error);
          },
        );
      },
      error => reject(error),
    );
  });
}

// 🔹 Get Attendance Data
export const getAttendanceData = userID => {
  const db = getDB();
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM attendance WHERE UserID=? ORDER BY Timestamp DESC',
      [userID],
      (_, results) => {
        const data = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          data.push({
            ...row,
            AllowanceData: safeParseJSON(row.AllowanceData),
          });
        }
        console.log('getAttendanceData', data);
        store.dispatch(setUserAttendanceHistory(data));
      },
    );
  });
};

// 🔹 Update Sync State
export const updateAttendanceSyncState = (timestamp, isSync) => {
  const db = getDB();
  db.transaction(tx => {
    tx.executeSql(
      'UPDATE attendance SET IsSynced=? WHERE Timestamp=?',
      [isSync, timestamp],
      () => {
        let history = store.getState().userState.userAttendanceHistory;
        const updated = history.map(item =>
          item.Timestamp === timestamp ? { ...item, IsSynced: 'Y' } : item,
        );
        store.dispatch(setUserAttendanceHistory(updated));
        log('Sync state updated');
      },
      error => console.log('Update sync error:', error),
    );
  });
};

// 🔹 Get Unsynced Records
export const getUnsyncedAttendanceRecord = userID => {
  const db = getDB();
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM attendance WHERE IsSynced=? AND UserID=?',
      ['N', userID],
      (_, results) => {
        const unsynced = [];
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
    );
  });
};
