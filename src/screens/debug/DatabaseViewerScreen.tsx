import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppContainer, AppText, BackHeader } from '../../components';
import { hp, wp, FontTypes } from '../../constants';
import { getAllDatabaseData, clearAllDatabaseData, DatabaseView } from '../../services/database/debug-db-service';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';
import { useAppSelector } from '../../redux';
import moment from 'moment';
import { logger } from '../../services/logger';

export default function DatabaseViewerScreen(): React.JSX.Element {
  const theme = useTheme();
  const colors = theme?.colors || {};
  const insets = useSafeAreaInsets();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  const [data, setData] = useState<DatabaseView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'stats' | 'attendance' | 'profile' | 'settings' | 'syncQueue' | 'pending'>('stats');

  const loadData = useCallback(async () => {
    try {
      const dbData = await getAllDatabaseData();
      setData(dbData);
    } catch (error) {
      logger.error('Error loading database data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleClearDatabase = useCallback(() => {
    Alert.alert(
      'Clear Database',
      'Are you sure you want to delete all database data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllDatabaseData();
              Alert.alert('Success', 'Database cleared successfully');
              await loadData();
            } catch (error) {
              logger.error('Error clearing database', error);
              Alert.alert('Error', 'Failed to clear database');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }, [loadData]);

  /**
   * Format date/time values for display
   */
  const formatDateTime = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    // If it's already a formatted string that looks like a date, try to parse it
    if (typeof value === 'string') {
      // Check if it's an ISO date string
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = moment(value);
        if (date.isValid()) {
          return date.format('YYYY-MM-DD HH:mm:ss');
        }
      }
      // Check if it's a timestamp string
      if (/^\d+$/.test(value)) {
        const timestamp = parseInt(value, 10);
        if (timestamp > 1000000000) { // Likely a Unix timestamp (seconds or milliseconds)
          const date = moment(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
          if (date.isValid()) {
            return date.format('YYYY-MM-DD HH:mm:ss');
          }
        }
      }
    }

    // If it's a number (Unix timestamp)
    if (typeof value === 'number') {
      if (value > 1000000000) { // Likely a Unix timestamp
        const date = moment(value > 1000000000000 ? value : value * 1000);
        if (date.isValid()) {
          return date.format('YYYY-MM-DD HH:mm:ss');
        }
      }
    }

    // Return as-is if not a date/time
    return String(value);
  };

  /**
   * Format an object for display, converting date/time fields
   */
  const formatObjectForDisplay = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => formatObjectForDisplay(item));
    }

    if (typeof obj === 'object') {
      const formatted: any = {};
      const dateTimeFields = [
        'Timestamp', 'CreatedOn', 'DateOfPunch', 'createdAt', 'updatedAt',
        'lastUpdatedAt', 'server_lastSyncedAt', 'lastSyncedAt',
        'dateOfBirth', 'dateOfActivation', 'lastLoginAt',
        'lastVerifiedDate', 'createdOn', 'updatedOn'
      ];

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Check if this field should be formatted as date/time
          if (dateTimeFields.some(field => key.toLowerCase().includes(field.toLowerCase()) || 
              key.toLowerCase().includes('time') || 
              key.toLowerCase().includes('date'))) {
            formatted[key] = formatDateTime(value);
          } else if (typeof value === 'object' && value !== null) {
            // Recursively format nested objects
            formatted[key] = formatObjectForDisplay(value);
          } else {
            formatted[key] = value;
          }
        }
      }
      return formatted;
    }

    return obj;
  };

  const renderSyncExplanation = () => {
    return (
      <View style={[styles.card, styles.explanationCard, { backgroundColor: colors.card || themeColors.cardBg, borderColor: colors.border || themeColors.cardBorder }]}>
        <AppText size={hp(1.8)} fontType={FontTypes.bold} style={[styles.explanationTitle, { color: colors.primary || themeColors.primary }]}>
          📚 Sync Status Explained
        </AppText>
        
        <View style={styles.explanationSection}>
          <AppText size={hp(1.6)} fontType={FontTypes.bold} color={colors.text || themeColors.text} style={styles.explanationSubtitle}>
            ✅ Synced Records (IsSynced = 'Y')
          </AppText>
          <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.explanationText}>
            • Successfully uploaded to the server{'\n'}
            • Server has acknowledged and stored the record{'\n'}
            • These records are safe and match server data{'\n'}
            • Can be updated if server sends newer data{'\n'}
            • lastSyncedAt: When the record was synced to server
          </AppText>
        </View>

        <View style={styles.explanationSection}>
          <AppText size={hp(1.6)} fontType={FontTypes.bold} color={colors.text || themeColors.text} style={styles.explanationSubtitle}>
            ⏳ Unsynced Records (IsSynced = 'N') - In Queue to Sync
          </AppText>
          <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.explanationText}>
            • Created locally but NOT yet sent to server{'\n'}
            • Waiting to be uploaded (in sync queue){'\n'}
            • Protected from being overwritten by server data{'\n'}
            • Will be synced when:{'\n'}
            {'  '}- Network is available{'\n'}
            {'  '}- App performs automatic sync{'\n'}
            {'  '}- User manually triggers sync{'\n'}
            • lastSyncedAt: null (not synced yet)
          </AppText>
        </View>

        <View style={styles.explanationSection}>
          <AppText size={hp(1.6)} fontType={FontTypes.bold} color={colors.text || themeColors.text} style={styles.explanationSubtitle}>
            🔄 Sync Behavior
          </AppText>
          <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.explanationText}>
            • Unsynced records are NEVER overwritten by server{'\n'}
            • Server data is merged without losing local changes{'\n'}
            • Only synced records can be updated from server{'\n'}
            • New server records are inserted as synced{'\n'}
            • All UI displays read from local database only
          </AppText>
        </View>

        <View style={styles.explanationSection}>
          <AppText size={hp(1.6)} fontType={FontTypes.bold} color={colors.text || themeColors.text} style={styles.explanationSubtitle}>
            📊 Timestamp Fields
          </AppText>
          <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.explanationText}>
            • Timestamp: Primary key (when record was created){'\n'}
            • CreatedOn: Original creation time{'\n'}
            • lastUpdatedAt: Last time record was modified locally{'\n'}
            • lastSyncedAt: When record was successfully synced to server{'\n'}
            • server_Timestamp: Server's timestamp for this record
          </AppText>
        </View>
      </View>
    );
  };

  const renderStats = () => {
    if (!data) return null;

    return (
      <View style={styles.section}>
        <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
          Database Statistics
        </AppText>
        
        {renderSyncExplanation()}
        
        <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg, borderColor: colors.border || themeColors.cardBorder }]}>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Attendance Records:
            </AppText>
            <AppText style={styles.statValue} color={colors.text || themeColors.text}>
              {data.stats.attendanceCount}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ✅ Synced Attendance:
            </AppText>
            <AppText style={[styles.statValue, { color: '#4ECDC4' }]}>
              {data.stats.attendanceCount - data.stats.unsyncedAttendance}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ⏳ Unsynced (In Queue):
            </AppText>
            <AppText style={[styles.statValue, { color: data.stats.unsyncedAttendance > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {data.stats.unsyncedAttendance}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Profile Records:
            </AppText>
            <AppText style={styles.statValue} color={colors.text || themeColors.text}>
              {data.stats.profileCount}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ✅ Synced Profile:
            </AppText>
            <AppText style={[styles.statValue, { color: '#4ECDC4' }]}>
              {data.stats.profileCount - data.stats.unsyncedProfile}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ⏳ Unsynced Profile:
            </AppText>
            <AppText style={[styles.statValue, { color: data.stats.unsyncedProfile > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {data.stats.unsyncedProfile}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Settings:
            </AppText>
            <AppText style={styles.statValue} color={colors.text || themeColors.text}>
              {data.stats.settingsCount}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ✅ Synced Settings:
            </AppText>
            <AppText style={[styles.statValue, { color: '#4ECDC4' }]}>
              {data.stats.settingsCount - data.stats.unsyncedSettings}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              ⏳ Unsynced Settings:
            </AppText>
            <AppText style={[styles.statValue, { color: data.stats.unsyncedSettings > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {data.stats.unsyncedSettings}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Sync Queue Items (Total):
            </AppText>
            <AppText style={styles.statValue} color={colors.text || themeColors.text}>
              {data.stats.syncQueueCount}
            </AppText>
          </View>
          
          <View style={[styles.statRow, { marginTop: hp(1), paddingTop: hp(1), borderTopWidth: 1, borderTopColor: '#E0E0E0' }]}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text} fontType={FontTypes.bold}>
              Total Pending Sync:
            </AppText>
            <AppText style={[styles.statValue, { color: (data.stats.unsyncedAttendance + data.stats.unsyncedProfile + data.stats.unsyncedSettings) > 0 ? '#FF6B6B' : '#4ECDC4' }]} fontType={FontTypes.bold}>
              {data.stats.unsyncedAttendance + data.stats.unsyncedProfile + data.stats.unsyncedSettings}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text} fontType={FontTypes.bold}>
              Total Synced:
            </AppText>
            <AppText style={[styles.statValue, { color: '#4ECDC4' }]} fontType={FontTypes.bold}>
              {(data.stats.attendanceCount - data.stats.unsyncedAttendance) + 
               (data.stats.profileCount - data.stats.unsyncedProfile) + 
               (data.stats.settingsCount - data.stats.unsyncedSettings)}
            </AppText>
          </View>
        </View>
      </View>
    );
  };

  const renderDataTable = (title: string, items: any[]) => {
    if (!items || items.length === 0) {
      return (
        <View style={styles.section}>
          <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
            {title}
          </AppText>
          <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
            <AppText color={colors.text || themeColors.text}>No data available</AppText>
          </View>
        </View>
      );
    }

    // For attendance, separate synced and unsynced
    if (title === 'Attendance Records') {
      const syncedItems = items.filter(item => item.IsSynced === 'Y' || item.IsSynced === 'y');
      const unsyncedItems = items.filter(item => item.IsSynced === 'N' || item.IsSynced === 'n');
      
      return (
        <View style={styles.section}>
          <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
            {title} ({items.length} total)
          </AppText>
          
          {renderSyncExplanation()}
          
          {/* Unsynced Records (In Queue) */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING SYNC - In Queue ({unsyncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These records are waiting to be synced to the server. They are protected from being overwritten.
            </AppText>
            {unsyncedItems.length > 0 ? (
              unsyncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`unsynced-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.unsyncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                        ⏳ PENDING SYNC
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Created: {formattedItem.CreatedOn || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || formattedItem.CreatedOn || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.lastSyncedAt || 'Never'}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>✅ All records synced - No pending sync</AppText>
              </View>
            )}
          </View>

          {/* Synced Records */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#4ECDC4' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ✅ SYNCED TO SERVER ({syncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These records have been successfully synced to the server and can be updated from server data.
            </AppText>
            {syncedItems.length > 0 ? (
              syncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`synced-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.syncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#4ECDC4', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#4ECDC4">
                        ✅ SYNCED TO SERVER
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Created: {formattedItem.CreatedOn || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || formattedItem.CreatedOn || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.lastSyncedAt || 'N/A'}
                      </AppText>
                      {formattedItem.server_Timestamp && (
                        <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                          Server Timestamp: {formattedItem.server_Timestamp}
                        </AppText>
                      )}
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>No synced records</AppText>
              </View>
            )}
          </View>
        </View>
      );
    }

    // For Profile, separate synced and unsynced
    if (title === 'Profile Data') {
      const syncedItems = items.filter(item => {
        const synced = item.isSynced;
        return synced === 1 || synced === '1' || synced === true || synced === 'true';
      });
      const unsyncedItems = items.filter(item => {
        const synced = item.isSynced;
        return synced === 0 || synced === '0' || synced === false || synced === 'false' || synced === null || synced === undefined;
      });
      
      return (
        <View style={styles.section}>
          <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
            {title} ({items.length} total)
          </AppText>
          
          {/* Unsynced Profile */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING SYNC ({unsyncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Profile properties that have been modified locally but not yet synced to the server.
            </AppText>
            {unsyncedItems.length > 0 ? (
              unsyncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`unsynced-profile-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.unsyncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                        ⏳ PENDING SYNC - Profile Properties
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Email: {formattedItem.email || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.server_lastSyncedAt || 'Never'}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>✅ All profile properties synced</AppText>
              </View>
            )}
          </View>

          {/* Synced Profile */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#4ECDC4' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ✅ SYNCED TO SERVER ({syncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Profile properties that have been successfully synced to the server.
            </AppText>
            {syncedItems.length > 0 ? (
              syncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`synced-profile-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.syncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#4ECDC4', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#4ECDC4">
                        ✅ SYNCED TO SERVER
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Email: {formattedItem.email || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.server_lastSyncedAt || 'N/A'}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>No synced profile data</AppText>
              </View>
            )}
          </View>
        </View>
      );
    }

    // For Settings, separate synced and unsynced
    if (title === 'Settings') {
      const syncedItems = items.filter(item => {
        const synced = item.isSynced;
        return synced === 1 || synced === '1' || synced === true || synced === 'true';
      });
      const unsyncedItems = items.filter(item => {
        const synced = item.isSynced;
        return synced === 0 || synced === '0' || synced === false || synced === 'false' || synced === null || synced === undefined;
      });
      
      return (
        <View style={styles.section}>
          <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
            {title} ({items.length} total)
          </AppText>
          
          {/* Unsynced Settings */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING SYNC ({unsyncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Settings that have been modified locally but not yet synced to the server.
            </AppText>
            {unsyncedItems.length > 0 ? (
              unsyncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`unsynced-setting-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.unsyncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                        ⏳ PENDING SYNC
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Key: {formattedItem.key || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.server_lastUpdatedAt || 'Never'}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>✅ All settings synced</AppText>
              </View>
            )}
          </View>

          {/* Synced Settings */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#4ECDC4' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ✅ SYNCED TO SERVER ({syncedItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Settings that have been successfully synced to the server.
            </AppText>
            {syncedItems.length > 0 ? (
              syncedItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                return (
                  <View
                    key={`synced-setting-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      styles.syncedCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#4ECDC4', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#4ECDC4">
                        ✅ SYNCED TO SERVER
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Key: {formattedItem.key || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Updated: {formattedItem.lastUpdatedAt || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Last Synced: {formattedItem.server_lastUpdatedAt || 'N/A'}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>No synced settings</AppText>
              </View>
            )}
          </View>
        </View>
      );
    }

    // For Sync Queue, show detailed information
    if (title === 'Sync Queue') {
      const now = Date.now();
      const readyItems = items.filter(item => {
        const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
        return nextRetry && nextRetry <= now;
      });
      const waitingItems = items.filter(item => {
        const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
        return nextRetry && nextRetry > now;
      });
      
      return (
        <View style={styles.section}>
          <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
            {title} ({items.length} total)
          </AppText>
          
          <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg, marginBottom: hp(2) }]}>
            <AppText size={hp(1.6)} fontType={FontTypes.bold} color={colors.text || themeColors.text} style={styles.marginBottom}>
              Sync Queue Overview
            </AppText>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text}>
              Ready to Sync: <AppText fontType={FontTypes.bold}>{readyItems.length}</AppText>
            </AppText>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text}>
              Waiting for Retry: <AppText fontType={FontTypes.bold}>{waitingItems.length}</AppText>
            </AppText>
          </View>

          {/* Ready to Sync Items */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FFA500' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                🔄 READY TO SYNC ({readyItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Queue items that are ready to be synced now (nextRetryAt is less than or equal to current time).
            </AppText>
            {readyItems.length > 0 ? (
              readyItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
                const createdAt = typeof item.createdAt === 'string' ? parseInt(item.createdAt, 10) : item.createdAt;
                const nextRetryDate = nextRetry ? formatDateTime(nextRetry) : 'N/A';
                const createdAtDate = createdAt ? formatDateTime(createdAt) : 'N/A';
                
                return (
                  <View
                    key={`ready-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FFA500', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FFA500">
                        🔄 READY TO SYNC
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Type: {formattedItem.type || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Entity ID: {formattedItem.entityId || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Property: {formattedItem.property || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Operation: {formattedItem.operation || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Attempts: {formattedItem.attempts || 0}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Next Retry: {nextRetryDate}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Created: {createdAtDate}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>No items ready to sync</AppText>
              </View>
            )}
          </View>

          {/* Waiting for Retry Items */}
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#9B59B6' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏰ WAITING FOR RETRY ({waitingItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              Queue items that are waiting for their retry time (nextRetryAt is greater than current time).
            </AppText>
            {waitingItems.length > 0 ? (
              waitingItems.map((item, index) => {
                const formattedItem = formatObjectForDisplay(item);
                const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
                const createdAt = typeof item.createdAt === 'string' ? parseInt(item.createdAt, 10) : item.createdAt;
                const nextRetryDate = nextRetry ? formatDateTime(nextRetry) : 'N/A';
                const createdAtDate = createdAt ? formatDateTime(createdAt) : 'N/A';
                const waitTime = nextRetry ? Math.max(0, Math.floor((nextRetry - now) / 1000)) : 0;
                
                return (
                  <View
                    key={`waiting-${index}`}
                    style={[
                      styles.card,
                      styles.dataCard,
                      { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#9B59B6', borderWidth: 2 },
                    ]}
                  >
                    <View style={styles.syncStatusHeader}>
                      <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#9B59B6">
                        ⏰ WAITING FOR RETRY
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Type: {formattedItem.type || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Entity ID: {formattedItem.entityId || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Property: {formattedItem.property || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Operation: {formattedItem.operation || 'N/A'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Attempts: {formattedItem.attempts || 0}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Next Retry: {nextRetryDate}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Wait Time: {waitTime > 0 ? `${Math.floor(waitTime / 60)}m ${waitTime % 60}s` : 'Ready'}
                      </AppText>
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        Created: {createdAtDate}
                      </AppText>
                    </View>
                    <AppText
                      size={hp(1.4)}
                      style={styles.jsonText}
                      color={colors.text || themeColors.text}
                    >
                      {JSON.stringify(formattedItem, null, 2)}
                    </AppText>
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg }]}>
                <AppText color={colors.text || themeColors.text}>No items waiting for retry</AppText>
              </View>
            )}
          </View>
        </View>
      );
    }

    // For other tables, show normally
    return (
      <View style={styles.section}>
        <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
          {title} ({items.length})
        </AppText>
        {items.map((item, index) => {
          // Format the item for display (convert dates/times)
          const formattedItem = formatObjectForDisplay(item);
          
          return (
            <View
              key={index}
              style={[
                styles.card,
                styles.dataCard,
                { backgroundColor: colors.card || themeColors.cardBg, borderColor: colors.border || themeColors.cardBorder },
              ]}
            >
              <AppText
                size={hp(1.4)}
                style={styles.jsonText}
                color={colors.text || themeColors.text}
              >
                {JSON.stringify(formattedItem, null, 2)}
              </AppText>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPendingSyncDetails = () => {
    if (!data) return null;

    // Get all unsynced items
    const unsyncedAttendance = data.attendance.filter(item => item.IsSynced === 'N' || item.IsSynced === 'n');
    const unsyncedProfile = data.profile.filter(item => {
      const synced = item.isSynced;
      return synced === 0 || synced === '0' || synced === false || synced === 'false' || synced === null || synced === undefined;
    });
    const unsyncedSettings = data.settings.filter(item => {
      const synced = item.isSynced;
      return synced === 0 || synced === '0' || synced === false || synced === 'false' || synced === null || synced === undefined;
    });
    
    const now = Date.now();
    const readyToSyncQueueItems = data.syncQueue.filter(item => {
      const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
      return nextRetry && nextRetry <= now;
    });

    const totalPending = unsyncedAttendance.length + unsyncedProfile.length + unsyncedSettings.length + readyToSyncQueueItems.length;

    return (
      <View style={styles.section}>
        <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
          Pending Sync Details
        </AppText>
        
        {/* Summary */}
        <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2, marginBottom: hp(2) }]}>
          <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FF6B6B" style={styles.marginBottom}>
            📋 Pending Sync Summary
          </AppText>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Total Pending Items:
            </AppText>
            <AppText style={[styles.statValue, { color: '#FF6B6B' }]} fontType={FontTypes.bold}>
              {totalPending}
            </AppText>
          </View>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Pending Attendance Records:
            </AppText>
            <AppText style={[styles.statValue, { color: unsyncedAttendance.length > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {unsyncedAttendance.length}
            </AppText>
          </View>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Pending Profile Records:
            </AppText>
            <AppText style={[styles.statValue, { color: unsyncedProfile.length > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {unsyncedProfile.length}
            </AppText>
          </View>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Pending Settings:
            </AppText>
            <AppText style={[styles.statValue, { color: unsyncedSettings.length > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {unsyncedSettings.length}
            </AppText>
          </View>
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Queue Items Ready to Sync:
            </AppText>
            <AppText style={[styles.statValue, { color: readyToSyncQueueItems.length > 0 ? '#FFA500' : '#4ECDC4' }]}>
              {readyToSyncQueueItems.length}
            </AppText>
          </View>
        </View>

        {/* Pending Attendance Records */}
        {unsyncedAttendance.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING ATTENDANCE RECORDS ({unsyncedAttendance.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These attendance records are waiting to be synced to the server.
            </AppText>
            {unsyncedAttendance.map((item, index) => {
              const formattedItem = formatObjectForDisplay(item);
              return (
                <View
                  key={`pending-attendance-${index}`}
                  style={[
                    styles.card,
                    styles.dataCard,
                    styles.unsyncedCard,
                    { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                  ]}
                >
                  <View style={styles.syncStatusHeader}>
                    <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                      ⏳ PENDING SYNC - Attendance Record #{index + 1}
                    </AppText>
                    <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.bold}>Record ID (Timestamp):</AppText> {formattedItem.Timestamp || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Punch Type:</AppText> {formattedItem.PunchType || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Punch Direction:</AppText> {formattedItem.PunchDirection || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Date of Punch:</AppText> {formattedItem.DateOfPunch || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Created On:</AppText> {formattedItem.CreatedOn || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Last Updated:</AppText> {formattedItem.lastUpdatedAt || formattedItem.CreatedOn || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Last Synced:</AppText> {formattedItem.lastSyncedAt || 'Never - Not synced yet'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Location:</AppText> {formattedItem.LatLon || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Address:</AppText> {formattedItem.Address || 'N/A'}
                    </AppText>
                  </View>
                  <AppText size={hp(1.3)} fontType={FontTypes.medium} color={colors.text || themeColors.text} style={styles.marginBottom}>
                    Full Record Data:
                  </AppText>
                  <AppText
                    size={hp(1.2)}
                    style={styles.jsonText}
                    color={colors.text || themeColors.text}
                  >
                    {JSON.stringify(formattedItem, null, 2)}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* Pending Profile Records */}
        {unsyncedProfile.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING PROFILE RECORDS ({unsyncedProfile.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These profile records have been modified locally but not yet synced to the server.
            </AppText>
            {unsyncedProfile.map((item, index) => {
              const formattedItem = formatObjectForDisplay(item);
              // Identify which properties have values (not synced)
              const propertiesWithValues: string[] = [];
              const PROFILE_PROPERTIES = ['firstName', 'lastName', 'dateOfBirth', 'employmentType', 'designation', 'profilePhoto'];
              PROFILE_PROPERTIES.forEach(prop => {
                if (formattedItem[prop] && formattedItem[prop] !== null && formattedItem[prop] !== undefined && formattedItem[prop] !== '') {
                  propertiesWithValues.push(prop);
                }
              });
              
              return (
                <View
                  key={`pending-profile-${index}`}
                  style={[
                    styles.card,
                    styles.dataCard,
                    styles.unsyncedCard,
                    { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                  ]}
                >
                  <View style={styles.syncStatusHeader}>
                    <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                      ⏳ PENDING SYNC - Profile Record #{index + 1}
                    </AppText>
                    <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.bold}>Email:</AppText> {formattedItem.email || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.medium}>Properties with Pending Changes:</AppText>
                    </AppText>
                    {propertiesWithValues.length > 0 ? (
                      propertiesWithValues.map((prop, propIndex) => (
                        <View key={propIndex} style={{ marginLeft: wp(2), marginBottom: hp(0.5) }}>
                          <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                            • <AppText fontType={FontTypes.medium}>{prop}:</AppText> {String(formattedItem[prop] || 'N/A').substring(0, 50)}{formattedItem[prop] && String(formattedItem[prop]).length > 50 ? '...' : ''}
                          </AppText>
                        </View>
                      ))
                    ) : (
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text} style={{ marginLeft: wp(2) }}>
                        (All properties empty)
                      </AppText>
                    )}
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text} style={{ marginTop: hp(1) }}>
                      <AppText fontType={FontTypes.medium}>Last Updated:</AppText> {formattedItem.lastUpdatedAt || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Last Synced:</AppText> {formattedItem.server_lastSyncedAt || 'Never - Not synced yet'}
                    </AppText>
                  </View>
                  <AppText size={hp(1.3)} fontType={FontTypes.medium} color={colors.text || themeColors.text} style={styles.marginBottom}>
                    Full Profile Data:
                  </AppText>
                  <AppText
                    size={hp(1.2)}
                    style={styles.jsonText}
                    color={colors.text || themeColors.text}
                  >
                    {JSON.stringify(formattedItem, null, 2)}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* Pending Settings */}
        {unsyncedSettings.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FF6B6B' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                ⏳ PENDING SETTINGS ({unsyncedSettings.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These settings have been modified locally but not yet synced to the server.
            </AppText>
            {unsyncedSettings.map((item, index) => {
              const formattedItem = formatObjectForDisplay(item);
              return (
                <View
                  key={`pending-setting-${index}`}
                  style={[
                    styles.card,
                    styles.dataCard,
                    styles.unsyncedCard,
                    { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FF6B6B', borderWidth: 2 },
                  ]}
                >
                  <View style={styles.syncStatusHeader}>
                    <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FF6B6B">
                      ⏳ PENDING SYNC - Setting #{index + 1}
                    </AppText>
                    <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.bold}>Setting Key:</AppText> {formattedItem.key || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.medium}>Setting Value:</AppText>
                    </AppText>
                    <View style={{ marginLeft: wp(2), marginBottom: hp(1) }}>
                      <AppText size={hp(1.3)} style={styles.jsonText} color={colors.text || themeColors.text}>
                        {typeof formattedItem.value === 'object' ? JSON.stringify(formattedItem.value, null, 2) : String(formattedItem.value || 'N/A')}
                      </AppText>
                    </View>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Last Updated:</AppText> {formattedItem.lastUpdatedAt || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Last Synced:</AppText> {formattedItem.server_lastUpdatedAt || 'Never - Not synced yet'}
                    </AppText>
                  </View>
                  <AppText size={hp(1.3)} fontType={FontTypes.medium} color={colors.text || themeColors.text} style={styles.marginBottom}>
                    Full Setting Data:
                  </AppText>
                  <AppText
                    size={hp(1.2)}
                    style={styles.jsonText}
                    color={colors.text || themeColors.text}
                  >
                    {JSON.stringify(formattedItem, null, 2)}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* Ready to Sync Queue Items */}
        {readyToSyncQueueItems.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.syncBadge, { backgroundColor: '#FFA500' }]}>
              <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#FFFFFF">
                🔄 SYNC QUEUE - READY TO SYNC ({readyToSyncQueueItems.length})
              </AppText>
            </View>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.badgeDescription}>
              These queue items are ready to be synced now and are waiting for the sync process to pick them up.
            </AppText>
            {readyToSyncQueueItems.map((item, index) => {
              const formattedItem = formatObjectForDisplay(item);
              const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
              const createdAt = typeof item.createdAt === 'string' ? parseInt(item.createdAt, 10) : item.createdAt;
              const nextRetryDate = nextRetry ? formatDateTime(nextRetry) : 'N/A';
              const createdAtDate = createdAt ? formatDateTime(createdAt) : 'N/A';
              
              return (
                <View
                  key={`pending-queue-${index}`}
                  style={[
                    styles.card,
                    styles.dataCard,
                    { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#FFA500', borderWidth: 2 },
                  ]}
                >
                  <View style={styles.syncStatusHeader}>
                    <AppText size={hp(1.6)} fontType={FontTypes.bold} color="#FFA500">
                      🔄 READY TO SYNC - Queue Item #{index + 1}
                    </AppText>
                    <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={styles.marginBottom}>
                      <AppText fontType={FontTypes.bold}>Queue ID:</AppText> {formattedItem.id || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Type:</AppText> {formattedItem.type || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Entity ID:</AppText> {formattedItem.entityId || 'N/A'}
                    </AppText>
                    {formattedItem.property && (
                      <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                        <AppText fontType={FontTypes.medium}>Property:</AppText> {formattedItem.property}
                      </AppText>
                    )}
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Operation:</AppText> {formattedItem.operation || 'N/A'}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Attempts:</AppText> {formattedItem.attempts || 0}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Next Retry:</AppText> {nextRetryDate}
                    </AppText>
                    <AppText size={hp(1.3)} color={colors.text || themeColors.text}>
                      <AppText fontType={FontTypes.medium}>Created:</AppText> {createdAtDate}
                    </AppText>
                  </View>
                  <AppText size={hp(1.3)} fontType={FontTypes.medium} color={colors.text || themeColors.text} style={styles.marginBottom}>
                    Queue Item Data:
                  </AppText>
                  <AppText
                    size={hp(1.2)}
                    style={styles.jsonText}
                    color={colors.text || themeColors.text}
                  >
                    {JSON.stringify(formattedItem, null, 2)}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {totalPending === 0 && (
          <View style={[styles.card, { backgroundColor: colors.card || themeColors.cardBg, borderColor: '#4ECDC4', borderWidth: 2 }]}>
            <AppText size={hp(1.8)} fontType={FontTypes.bold} color="#4ECDC4" style={{ textAlign: 'center', marginBottom: hp(1) }}>
              ✅ All Items Synced!
            </AppText>
            <AppText size={hp(1.4)} color={colors.text || themeColors.text} style={{ textAlign: 'center' }}>
              There are no pending sync items. Everything is up to date with the server.
            </AppText>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <AppText color={colors.text || themeColors.text}>Loading database...</AppText>
        </View>
      );
    }

    if (!data) {
      return (
        <View style={styles.centerContainer}>
          <AppText color={colors.text || themeColors.text}>No data available</AppText>
        </View>
      );
    }

    switch (selectedTab) {
      case 'stats':
        return renderStats();
      case 'attendance':
        return renderDataTable('Attendance Records', data.attendance);
      case 'profile':
        return renderDataTable('Profile Data', data.profile);
      case 'settings':
        return renderDataTable('Settings', data.settings);
      case 'syncQueue':
        return renderDataTable('Sync Queue', data.syncQueue);
      case 'pending':
        return renderPendingSyncDetails();
      default:
        return renderStats();
    }
  };

  return (
    <AppContainer>
      <BackHeader 
        title="Database Viewer" 
        isTitleVisible
        rightContent={
          <TouchableOpacity
            onPress={handleClearDatabase}
            style={[styles.clearButton, { backgroundColor: '#FF6B6B' }]}
          >
            <AppText size={hp(1.6)} color="#FFFFFF" fontType={FontTypes.medium}>
              Clear DB
            </AppText>
          </TouchableOpacity>
        }
      />
      
      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card || themeColors.cardBg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['stats', 'pending', 'attendance', 'profile', 'settings', 'syncQueue'] as const).map((tab) => {
            const tabLabel = tab === 'pending' ? 'Pending Sync' : (tab === 'syncQueue' ? 'Sync Queue' : tab.charAt(0).toUpperCase() + tab.slice(1));
            // Show badge count for pending tab
            const pendingCount = data ? 
              (data.stats.unsyncedAttendance + data.stats.unsyncedProfile + data.stats.unsyncedSettings) : 0;
            const queueReadyCount = data && data.syncQueue ? 
              data.syncQueue.filter((item: any) => {
                const nextRetry = typeof item.nextRetryAt === 'string' ? parseInt(item.nextRetryAt, 10) : item.nextRetryAt;
                return nextRetry && nextRetry <= Date.now();
              }).length : 0;
            const totalPendingCount = pendingCount + queueReadyCount;
            
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  selectedTab === tab && [
                    styles.tabActive,
                    { backgroundColor: colors.primary || themeColors.primary },
                  ],
                  tab === 'pending' && totalPendingCount > 0 && { borderWidth: 2, borderColor: '#FF6B6B' },
                ]}
                onPress={() => setSelectedTab(tab)}
              >
                <AppText
                  size={hp(1.6)}
                  color={selectedTab === tab ? '#FFFFFF' : (colors.text || themeColors.text)}
                  fontType={FontTypes.medium}
                >
                  {tabLabel}
                  {tab === 'pending' && totalPendingCount > 0 && ` (${totalPendingCount})`}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + hp(2) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary || themeColors.primary}
          />
        }
      >
        {renderContent()}
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: wp(4),
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
  },
  tabContainer: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    marginRight: wp(2),
    borderRadius: hp(1),
  },
  tabActive: {
    // Active style handled inline
  },
  section: {
    marginBottom: hp(2),
  },
  sectionTitle: {
    marginBottom: hp(1),
    color: '#FFFFFF',
  },
  card: {
    padding: wp(4),
    borderRadius: hp(1),
    borderWidth: 1,
    marginBottom: hp(1),
  },
  dataCard: {
    marginBottom: hp(1.5),
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(0.5),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statLabel: {
    flex: 1,
  },
  statValue: {
    fontWeight: 'bold',
  },
  jsonText: {
    fontFamily: 'monospace',
  },
  clearButton: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: hp(1),
  },
  explanationCard: {
    marginBottom: hp(2),
  },
  explanationTitle: {
    marginBottom: hp(1.5),
  },
  explanationSection: {
    marginBottom: hp(2),
    paddingBottom: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  explanationSubtitle: {
    marginBottom: hp(0.8),
  },
  explanationText: {
    lineHeight: hp(2.2),
  },
  syncBadge: {
    padding: wp(3),
    borderRadius: hp(0.8),
    marginBottom: hp(0.8),
  },
  badgeDescription: {
    marginBottom: hp(1),
    fontStyle: 'italic',
  },
  unsyncedCard: {
    borderLeftWidth: 4,
  },
  syncedCard: {
    borderLeftWidth: 4,
  },
  syncStatusHeader: {
    marginBottom: hp(1.5),
    paddingBottom: hp(1),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  marginBottom: {
    marginBottom: hp(1),
  },
});

