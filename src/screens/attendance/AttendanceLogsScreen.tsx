import React, { useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect, useRoute, RouteProp, useTheme } from '@react-navigation/native';
import moment from 'moment';
import { getDateFromUTCTimestamp } from '../../utils/time-utils';
import {
  AppContainer,
  AppText,
  AttendanceLogItem,
  BackHeader,
} from '../../components';
import { useAppSelector } from '../../redux';
import { useTranslation } from '../../hooks/useTranslation';
import { wp, hp, FontTypes } from '../../constants';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { getAttendanceData, getAllAttendanceRecords } from '../../services/attendance/attendance-db-service';
import { getDaysAttendance } from '../../services/attendance/attendance-service';
import { DarkThemeColors, LightThemeColors, APP_THEMES } from '../../themes';
import { logger } from '../../services/logger';

type AttendanceLogsRouteParams = {
  filterToday?: boolean;
};

type AttendanceLogsRouteProp = RouteProp<{ params: AttendanceLogsRouteParams }, 'params'>;

export default function AttendanceLogsScreen(): React.JSX.Element {
  const route = useRoute<AttendanceLogsRouteProp>();
  const filterTodayParam = route.params?.filterToday || false;
  const { t } = useTranslation();
  const { userAttendanceHistory, userData } = useAppSelector(state => state.userState);
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);

  // Date range state (in local timezone for filtering)
  const [startDate, setStartDate] = useState<moment.Moment | null>(
    filterTodayParam ? moment() : null
  );
  const [endDate, setEndDate] = useState<moment.Moment | null>(
    filterTodayParam ? moment() : null
  );
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<moment.Moment>(moment());
  const [isLoading, setIsLoading] = useState(false);

  // Load attendance data from SQL when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (userData?.email) {
        getAttendanceData(userData.email);
      }
    }, [userData?.email])
  );

  // Check if data exists in SQLite for the selected date range and pull from server if needed
  const checkAndSyncDateRange = useCallback(async () => {
    if (!userData?.email || !startDate || !endDate) return;

    try {
      setIsLoading(true);
      
      // Get all records from SQLite
      const allRecords = await getAllAttendanceRecords(userData.email);
      
      // Check if any records exist in the date range
      // Convert date range to UTC timestamps for comparison (records are stored as UTC)
      const startUTC = startDate.clone().utc().startOf('day');
      const endUTC = endDate.clone().utc().endOf('day');
      const startTimestamp = startUTC.valueOf();
      const endTimestamp = endUTC.valueOf();
      
      const hasRecordsInRange = allRecords.some((record) => {
        const recordTimestamp = typeof record.Timestamp === 'string'
          ? parseInt(record.Timestamp, 10)
          : record.Timestamp;
        // Compare UTC timestamps
        return recordTimestamp >= startTimestamp && recordTimestamp <= endTimestamp;
      });

      // If no records in range, pull from server
      if (!hasRecordsInRange) {
        logger.debug('[AttendanceLogs] No data in SQLite for selected range, pulling from server');
        // Calculate the month range - if range spans multiple months, sync each month
        const startMonth = startDate.clone().startOf('month');
        const endMonth = endDate.clone().startOf('month');
        
        let currentMonth = startMonth.clone();
        while (currentMonth.isSameOrBefore(endMonth, 'month')) {
          await getDaysAttendance(userData.email, currentMonth.clone());
          currentMonth.add(1, 'month');
        }
      }
      
      // Refresh data from DB
      await getAttendanceData(userData.email);
    } catch (error) {
      logger.error('[AttendanceLogs] Error checking/syncing date range', error);
    } finally {
      setIsLoading(false);
    }
  }, [userData?.email, startDate, endDate]);

  // Check and sync when date range changes
  React.useEffect(() => {
    if (startDate && endDate && userData?.email) {
      checkAndSyncDateRange();
    }
  }, [startDate, endDate, userData?.email, checkAndSyncDateRange]);

  /** Check if all records are synced */
  const allSynced = useMemo(() => {
    if (!userAttendanceHistory?.length) return true;
    return userAttendanceHistory.every(record => record.IsSynced === 'Y');
  }, [userAttendanceHistory]);

  /** Group attendance logs by date — memoized for performance */
  const groupedData = useMemo<AttendanceRecord[][]>(() => {
    if (!userAttendanceHistory?.length) return [];
    
    // Filter by date range if specified
    let filteredHistory = userAttendanceHistory;
    
    if (startDate && endDate) {
      const startTimestamp = startDate.clone().startOf('day').valueOf();
      const endTimestamp = endDate.clone().endOf('day').valueOf();
      
      filteredHistory = userAttendanceHistory.filter((attendance: AttendanceRecord) => {
        const recordTimestamp = typeof attendance.Timestamp === 'string'
          ? parseInt(attendance.Timestamp, 10)
          : attendance.Timestamp;
        return recordTimestamp >= startTimestamp && recordTimestamp <= endTimestamp;
      });
    }
    
    const grouped: { [key: string]: AttendanceRecord[] } = filteredHistory.reduce(
      (group: { [key: string]: AttendanceRecord[] }, attendance: AttendanceRecord) => {
        // Group by UTC date for consistency, but will display in local time later
        const date = attendance.DateOfPunch || 
          (attendance.Timestamp 
            ? moment.utc(attendance.Timestamp).format('YYYY-MM-DD')
            : moment.utc().format('YYYY-MM-DD'));
        if (!group[date]) group[date] = [];
        group[date].push(attendance);
        return group;
      },
      {},
    );
    // Reverse order (most recent first)
    return Object.values(grouped);
  }, [userAttendanceHistory, startDate, endDate]);

  /** Stable renderItem reference */
  const renderHistoryItem = useCallback(
    ({ item }: { item: AttendanceRecord[] }) => <AttendanceLogItem item={item} />,
    [],
  );

  /** Date selection handlers */
  const handleDatePickerOpen = useCallback((type: 'start' | 'end') => {
    const currentDate = type === 'start' ? startDate : endDate;
    setTempDate(currentDate ? currentDate.clone() : moment.utc());
    setShowDatePicker(type);
  }, [startDate, endDate]);

  const handleDatePickerConfirm = useCallback(() => {
    if (showDatePicker === 'start') {
      setStartDate(tempDate.clone());
      // If end date is before start date, update end date
      if (endDate && tempDate.isAfter(endDate)) {
        setEndDate(tempDate.clone());
      }
    } else if (showDatePicker === 'end') {
      setEndDate(tempDate.clone());
      // If start date is after end date, update start date
      if (startDate && tempDate.isBefore(startDate)) {
        setStartDate(tempDate.clone());
      }
    }
    setShowDatePicker(null);
  }, [showDatePicker, tempDate, startDate, endDate]);

  const handleDatePickerCancel = useCallback(() => {
    setShowDatePicker(null);
  }, []);

  const changeDate = useCallback((type: 'year' | 'month' | 'day', delta: number) => {
    setTempDate(prev => prev.clone().add(delta, type));
  }, []);

  const handleResetDateRange = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
  }, []);

  return (
    <AppContainer>
      <BackHeader title={t('profile.attendanceLogs')} isTitleVisible={true} />
      
      {/* Date Range Selector */}
      <View style={[styles.dateRangeContainer, {
        backgroundColor: appTheme === APP_THEMES.light
          ? (colors as any).cardBg || '#F6F6F6'
          : DarkThemeColors.black + '40',
      }]}>
        <TouchableOpacity
          style={[styles.dateButton, {
            backgroundColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBg || LightThemeColors.white_common
              : DarkThemeColors.black + '60',
            borderColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBorder || '#E0E0E0'
              : DarkThemeColors.white_common + '40',
          }]}
          onPress={() => handleDatePickerOpen('start')}
        >
          <AppText 
            size={hp(1.8)} 
            color={appTheme === APP_THEMES.light 
              ? (colors as any).text || LightThemeColors.black_common
              : DarkThemeColors.white_common}
          >
            {startDate ? startDate.format('DD MMM YY') : t('attendance.selectStartDate', 'Start Date')}
          </AppText>
        </TouchableOpacity>
        
        <AppText 
          size={hp(2)} 
          color={appTheme === APP_THEMES.light 
            ? (colors as any).text || LightThemeColors.black_common
            : DarkThemeColors.white_common} 
          style={styles.dateSeparator}
        >
          -
        </AppText>
        
        <TouchableOpacity
          style={[styles.dateButton, {
            backgroundColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBg || LightThemeColors.white_common
              : DarkThemeColors.black + '60',
            borderColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBorder || '#E0E0E0'
              : DarkThemeColors.white_common + '40',
          }]}
          onPress={() => handleDatePickerOpen('end')}
        >
          <AppText 
            size={hp(1.8)} 
            color={appTheme === APP_THEMES.light 
              ? (colors as any).text || LightThemeColors.black_common
              : DarkThemeColors.white_common}
          >
            {endDate ? endDate.format('DD MMM YY') : t('attendance.selectEndDate', 'End Date')}
          </AppText>
        </TouchableOpacity>

        {(startDate || endDate) && (
          <TouchableOpacity
            style={[styles.resetButton, {
              backgroundColor: appTheme === APP_THEMES.light
                ? (colors as any).cardBg || LightThemeColors.white_common
                : DarkThemeColors.black + '60',
            }]}
            onPress={handleResetDateRange}
          >
            <AppText 
              size={hp(1.6)} 
              color={appTheme === APP_THEMES.light 
                ? (colors as any).text || LightThemeColors.black_common
                : DarkThemeColors.white_common} 
              style={{ opacity: 0.7 }}
            >
              {t('common.reset', 'Reset')}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <AppText style={styles.loadingText}>
            {t('attendance.loading', 'Loading...')}
          </AppText>
        </View>
      )}

      {/* Sync Status Summary */}
      {userAttendanceHistory?.length > 0 && !isLoading && (
        <View style={styles.syncStatusContainer}>
          <AppText style={styles.syncStatusText}>
            {allSynced 
              ? t('attendance.allSynced', 'All attendances are synched') 
              : t('attendance.someUnsynced', 'Some attendances are not synced')}
          </AppText>
        </View>
      )}
      <FlatList
        data={groupedData}
        renderItem={renderHistoryItem}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        // FlatList performance optimizations
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={7}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        ListEmptyComponent={<EmptyList />}
      />

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDatePickerCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModal, {
            backgroundColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBg || '#FFFFFF'
              : DarkThemeColors.black,
          }]}>
            <AppText size={hp(2.5)} fontType={FontTypes.medium} color={colors.text} style={styles.modalTitle}>
              {showDatePicker === 'start' 
                ? t('attendance.selectStartDate', 'Select Start Date')
                : t('attendance.selectEndDate', 'Select End Date')}
            </AppText>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('year', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium} 
                    color={colors.text}
                  >
                    {tempDate.year()}
                  </AppText>
                  <AppText 
                    size={hp(1.5)} 
                    color={colors.text} 
                    style={{ opacity: 0.7 }}
                  >Year</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('year', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('month', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium} 
                    color={colors.text}
                  >
                    {tempDate.format('MMMM')}
                  </AppText>
                  <AppText 
                    size={hp(1.5)} 
                    color={colors.text} 
                    style={{ opacity: 0.7 }}
                  >Month</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('month', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('day', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium} 
                    color={colors.text}
                  >
                    {tempDate.date()}
                  </AppText>
                  <AppText 
                    size={hp(1.5)} 
                    color={colors.text} 
                    style={{ opacity: 0.7 }}
                  >Day</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('day', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, {
                  backgroundColor: appTheme === APP_THEMES.light
                    ? LightThemeColors.white_common
                    : DarkThemeColors.white_common + '20',
                }]}
                onPress={handleDatePickerCancel}
              >
                <AppText 
                  size={hp(2)} 
                  color={appTheme === APP_THEMES.light 
                    ? LightThemeColors.black_common
                    : DarkThemeColors.white_common}
                >
                  {t('common.cancel', 'Cancel')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {
                  backgroundColor: colors.primary || DarkThemeColors.primary,
                }]}
                onPress={handleDatePickerConfirm}
              >
                <AppText 
                  size={hp(2)} 
                  color={DarkThemeColors.white_common}
                >
                  {t('common.confirm', 'Confirm')}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppContainer>
  );
}

const EmptyList = React.memo((): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <AppText>{t('attendance.noDataFound')}</AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: wp(4.27), // 17px / 375px * 100 (matching DayAttendanceItem margin)
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusContainer: {
    paddingHorizontal: wp(4.27),
    paddingVertical: wp(2),
    alignItems: 'center',
  },
  syncStatusText: {
    fontSize: wp(3.5),
    opacity: 0.7,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4.27),
    paddingVertical: hp(1.5),
    marginHorizontal: wp(4.27),
    marginTop: hp(1),
    marginBottom: hp(0.5),
    borderRadius: wp(2),
    borderWidth: 1,
  },
  dateButton: {
    flex: 1,
    paddingVertical: hp(1),
    paddingHorizontal: wp(3),
    borderRadius: wp(2),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSeparator: {
    marginHorizontal: wp(2),
    opacity: 0.7,
  },
  resetButton: {
    marginLeft: wp(2),
    paddingVertical: hp(1),
    paddingHorizontal: wp(3),
  },
  loadingContainer: {
    paddingHorizontal: wp(4.27),
    paddingVertical: wp(2),
    alignItems: 'center',
  },
  loadingText: {
    fontSize: wp(3.5),
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    borderTopLeftRadius: wp(5),
    borderTopRightRadius: wp(5),
    padding: wp(5),
    paddingBottom: hp(3),
  },
  modalTitle: {
    marginBottom: hp(2),
    textAlign: 'center',
  },
  datePickerContainer: {
    marginVertical: hp(2),
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: hp(1),
  },
  datePickerButton: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerValue: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: wp(4),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(2),
  },
  modalButton: {
    flex: 1,
    paddingVertical: hp(1.5),
    borderRadius: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: wp(2),
  },
});
