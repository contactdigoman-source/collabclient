import { getDB } from '../attendance/attendance-db-service';
import SQLite from 'react-native-sqlite-storage';
import { logger } from '../logger';

export interface DatabaseView {
  attendance: any[];
  profile: any[];
  settings: any[];
  syncQueue: any[];
  stats: {
    attendanceCount: number;
    profileCount: number;
    settingsCount: number;
    syncQueueCount: number;
    unsyncedAttendance: number;
    unsyncedProfile: number;
    unsyncedSettings: number;
  };
}

/**
 * Get all database data for real-time viewing
 */
export const getAllDatabaseData = async (): Promise<DatabaseView> => {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    const result: DatabaseView = {
      attendance: [],
      profile: [],
      settings: [],
      syncQueue: [],
      stats: {
        attendanceCount: 0,
        profileCount: 0,
        settingsCount: 0,
        syncQueueCount: 0,
        unsyncedAttendance: 0,
        unsyncedProfile: 0,
        unsyncedSettings: 0,
      },
    };

    let completed = 0;
    const totalQueries = 4;

    const checkComplete = () => {
      completed++;
      if (completed === totalQueries) {
        resolve(result);
      }
    };

    // Get attendance records
    db.transaction(
      (tx: SQLite.Transaction) => {
        // Get total count first
        tx.executeSql(
          'SELECT COUNT(*) as count FROM attendance',
          [],
          (_tx: SQLite.Transaction, countResults: SQLite.ResultSet) => {
            if (countResults.rows.length > 0) {
              result.stats.attendanceCount = countResults.rows.item(0).count || 0;
            }
            
            // Count unsynced
            tx.executeSql(
              "SELECT COUNT(*) as count FROM attendance WHERE IsSynced = 'N'",
              [],
              (_tx2: SQLite.Transaction, unsyncedResults: SQLite.ResultSet) => {
                if (unsyncedResults.rows.length > 0) {
                  result.stats.unsyncedAttendance = unsyncedResults.rows.item(0).count || 0;
                }
                
                // Get attendance records (limited for display)
                tx.executeSql(
                  'SELECT * FROM attendance ORDER BY Timestamp DESC LIMIT 100',
                  [],
                  (_tx3: SQLite.Transaction, attendanceResults: SQLite.ResultSet) => {
                    for (let i = 0; i < attendanceResults.rows.length; i++) {
                      result.attendance.push(attendanceResults.rows.item(i));
                    }
                    checkComplete();
                  },
                  () => checkComplete(),
                );
              },
              () => checkComplete(),
            );
          },
          () => checkComplete(),
        );
      },
      () => checkComplete(),
    );

    // Get profile data
    db.transaction(
      (tx: SQLite.Transaction) => {
        tx.executeSql(
          'SELECT * FROM profile',
          [],
          (_tx: SQLite.Transaction, profileResults: SQLite.ResultSet) => {
            for (let i = 0; i < profileResults.rows.length; i++) {
              result.profile.push(profileResults.rows.item(i));
            }
            result.stats.profileCount = profileResults.rows.length;
            
            // Count unsynced profile (using single isSynced flag)
            tx.executeSql(
              `SELECT COUNT(*) as count FROM profile WHERE isSynced = 0`,
              [],
              (_tx2: SQLite.Transaction, unsyncedResults: SQLite.ResultSet) => {
                if (unsyncedResults.rows.length > 0) {
                  result.stats.unsyncedProfile = unsyncedResults.rows.item(0).count || 0;
                }
                checkComplete();
              },
              () => checkComplete(),
            );
          },
          () => checkComplete(),
        );
      },
      () => checkComplete(),
    );

    // Get settings
    db.transaction(
      (tx: SQLite.Transaction) => {
        tx.executeSql(
          'SELECT * FROM settings',
          [],
          (_tx: SQLite.Transaction, settingsResults: SQLite.ResultSet) => {
            for (let i = 0; i < settingsResults.rows.length; i++) {
              result.settings.push(settingsResults.rows.item(i));
            }
            result.stats.settingsCount = settingsResults.rows.length;
            
            // Count unsynced settings
            tx.executeSql(
              "SELECT COUNT(*) as count FROM settings WHERE isSynced = 0",
              [],
              (_tx2: SQLite.Transaction, unsyncedResults: SQLite.ResultSet) => {
                if (unsyncedResults.rows.length > 0) {
                  result.stats.unsyncedSettings = unsyncedResults.rows.item(0).count || 0;
                }
                checkComplete();
              },
              () => checkComplete(),
            );
          },
          () => checkComplete(),
        );
      },
      () => checkComplete(),
    );

    // Get sync queue
    db.transaction(
      (tx: SQLite.Transaction) => {
        // Get total count first
        tx.executeSql(
          'SELECT COUNT(*) as count FROM sync_queue',
          [],
          (_tx: SQLite.Transaction, countResults: SQLite.ResultSet) => {
            if (countResults.rows.length > 0) {
              result.stats.syncQueueCount = countResults.rows.item(0).count || 0;
            }
            
            // Get all sync queue items (removed limit to show all items)
            tx.executeSql(
              'SELECT * FROM sync_queue ORDER BY createdAt DESC',
              [],
              (_tx2: SQLite.Transaction, queueResults: SQLite.ResultSet) => {
                for (let i = 0; i < queueResults.rows.length; i++) {
                  result.syncQueue.push(queueResults.rows.item(i));
                }
                checkComplete();
              },
              () => checkComplete(),
            );
          },
          () => {
            // Fallback: get items without count if count query fails
            tx.executeSql(
              'SELECT * FROM sync_queue ORDER BY createdAt DESC',
              [],
              (_tx2: SQLite.Transaction, queueResults: SQLite.ResultSet) => {
                for (let i = 0; i < queueResults.rows.length; i++) {
                  result.syncQueue.push(queueResults.rows.item(i));
                }
                result.stats.syncQueueCount = queueResults.rows.length;
                checkComplete();
              },
              () => checkComplete(),
            );
          },
        );
      },
      () => checkComplete(),
    );
  });
};

/**
 * Log database data to console (for React Native Debugger)
 */
export const logDatabaseData = async (): Promise<void> => {
  const data = await getAllDatabaseData();
  
  // Use logger service - will log to console in dev mode
  const { logger } = require('../logger');
  
  logger.debug('\n========== DATABASE VIEW ==========');
  logger.debug('\n📊 STATS:', { stats: data.stats });
  logger.debug('\n📝 ATTENDANCE RECORDS:', { attendance: data.attendance });
  logger.debug('\n👤 PROFILE DATA:', { profile: data.profile });
  logger.debug('\n⚙️ SETTINGS:', { settings: data.settings });
  logger.debug('\n🔄 SYNC QUEUE:', { syncQueue: data.syncQueue });
  logger.debug('\n===================================\n');
  
  return data;
};

/**
 * Clear all data from database tables
 * WARNING: This will delete all data from attendance, profile, settings, and sync_queue tables
 */
export const clearAllDatabaseData = async (): Promise<void> => {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: SQLite.Transaction) => {
        // Clear all tables
        tx.executeSql('DELETE FROM attendance', [], () => {
          logger.debug('Cleared attendance table');
        });
        
        tx.executeSql('DELETE FROM profile', [], () => {
          logger.debug('Cleared profile table');
        });
        
        tx.executeSql('DELETE FROM settings', [], () => {
          logger.debug('Cleared settings table');
        });
        
        tx.executeSql('DELETE FROM sync_queue', [], () => {
          logger.debug('Cleared sync_queue table');
        });
        
        resolve();
      },
      (error: SQLite.SQLError) => {
        logger.error('Error clearing database', error);
        reject(error);
      },
      () => {
        logger.debug('Database cleared successfully');
        resolve();
      },
    );
  });
};

