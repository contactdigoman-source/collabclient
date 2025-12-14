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

export default function DatabaseViewerScreen(): React.JSX.Element {
  const theme = useTheme();
  const colors = theme?.colors || {};
  const insets = useSafeAreaInsets();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  const [data, setData] = useState<DatabaseView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'stats' | 'attendance' | 'profile' | 'settings' | 'syncQueue'>('stats');

  const loadData = useCallback(async () => {
    try {
      const dbData = await getAllDatabaseData();
      setData(dbData);
    } catch (error) {
      console.error('Error loading database data:', error);
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
              console.error('Error clearing database:', error);
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

  const renderStats = () => {
    if (!data) return null;

    return (
      <View style={styles.section}>
        <AppText size={hp(2)} fontType={FontTypes.bold} style={styles.sectionTitle}>
          Database Statistics
        </AppText>
        
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
              Unsynced Attendance:
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
              Unsynced Profile Properties:
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
              Unsynced Settings:
            </AppText>
            <AppText style={[styles.statValue, { color: data.stats.unsyncedSettings > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {data.stats.unsyncedSettings}
            </AppText>
          </View>
          
          <View style={styles.statRow}>
            <AppText style={styles.statLabel} color={colors.text || themeColors.text}>
              Sync Queue Items:
            </AppText>
            <AppText style={styles.statValue} color={colors.text || themeColors.text}>
              {data.stats.syncQueueCount}
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
          {(['stats', 'attendance', 'profile', 'settings', 'syncQueue'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                selectedTab === tab && [
                  styles.tabActive,
                  { backgroundColor: colors.primary || themeColors.primary },
                ],
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <AppText
                size={hp(1.6)}
                color={selectedTab === tab ? '#FFFFFF' : (colors.text || themeColors.text)}
                fontType={FontTypes.medium}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </AppText>
            </TouchableOpacity>
          ))}
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
});

