import SQLite from 'react-native-sqlite-storage';

import { store, setUserAttendanceHistory } from '../../redux';

// 🔹 Debug Logger
const DEBUG = true;
const log = (...args: any[]): void => DEBUG && console.log('[SQLite]', ...args);

// 🔹 Singleton DB
let db: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabase(
      { name: 'RadiumDB', location: 'default' },
      () => log('Database opened'),
      (error: any) => console.log('DB open error:', error),
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
            console.log('Table creation error:', error),
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
        console.log('Transaction error:', error);
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
                  console.log(`Error adding ${col}:`, error),
              );
            }
          });
        },
        (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
          console.log('PRAGMA error:', error),
      );
    },
    (error: SQLite.SQLError) => console.log('Transaction error:', error),
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
        console.log('Fetch error:', error),
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
          (_tx: SQLite.Transaction, res: SQLite.ResultSet) => {
            log('Insert success');
            getAttendanceData(record.userID);
            resolve(res);
          },
          (_tx: SQLite.Transaction, error: SQLite.SQLError) => {
            console.log('Insert error:', error);
            reject(error);
          },
        );
      },
      (error: SQLite.SQLError) => reject(error),
    );
  });
}

// 🔹 Get Attendance Data
export const getAttendanceData = (userID: string): void => {
  const db = getDB();
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
        console.log('getAttendanceData', data);
        store.dispatch(setUserAttendanceHistory(data));
      },
      (_tx: SQLite.Transaction, error: SQLite.SQLError) =>
        console.log('Get attendance data error:', error),
    );
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
        console.log('Update sync error:', error),
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
        console.log('Get unsynced records error:', error),
    );
  });
};

