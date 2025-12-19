import React, { useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import moment from 'moment';
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
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { logger } from '../../services/logger';

export default function AttendanceLogsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const userAttendanceHistory = useAppSelector(state => state.userState.userAttendanceHistory);
  const userData = useAppSelector(state => state.userState.userData);
  const { colors } = useTheme();
  const appTheme = useAppSelector(state => state.appState.appTheme);

  // Date range state - default to today
  const [startDate, setStartDate] = useState<moment.Moment | null>(
    moment.utc()
  );
  const [endDate, setEndDate] = useState<moment.Moment | null>(
    moment.utc()
  );
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<moment.Moment>(moment.utc());
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
      const startTimestamp = startDate.clone().startOf('day').valueOf();
      const endTimestamp = endDate.clone().endOf('day').valueOf();
      
      const hasRecordsInRange = allRecords.some((record) => {
        const recordTimestamp = typeof record.Timestamp === 'string'
          ? parseInt(record.Timestamp, 10)
          : record.Timestamp;
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
    const today = moment.utc().endOf('day');
    const initialDate = currentDate ? currentDate.clone() : moment.utc();
    // If the date is in the future, set it to today
    const dateToSet = initialDate.isAfter(today) ? moment.utc() : initialDate;
    setTempDate(dateToSet);
    setShowDatePicker(type);
  }, [startDate, endDate]);

  const handleDatePickerConfirm = useCallback(() => {
    const today = moment.utc().endOf('day');
    // Prevent confirming future dates
    if (tempDate.isAfter(today)) {
      return; // Don't confirm if date is in the future
    }
    
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
    setTempDate(prev => {
      const today = moment.utc().endOf('day');
      // Clamp current date to today if it's somehow in the future
      const currentDate = prev.isAfter(today) ? moment.utc() : prev;
      const newDate = currentDate.clone().add(delta, type);
      // Prevent selecting future dates
      if (newDate.isAfter(today)) {
        return currentDate; // Return current date (clamped to today) if new date is in the future
      }
      return newDate;
    });
  }, []);

  const handleResetDateRange = useCallback(() => {
    setStartDate(moment.utc());
    setEndDate(moment.utc());
  }, []);

  return (
    <AppContainer>
      <BackHeader title={t('profile.attendanceLogs')} isTitleVisible={true} />
      
      {/* Date Range Selector */}
      <View style={[styles.dateRangeContainer, {
        backgroundColor: appTheme === APP_THEMES.light
          ? (colors as any).cardBg || '#F6F6F6'
          : DarkThemeColors.black + '40',
        borderColor: appTheme === APP_THEMES.light
          ? (colors as any).cardBorder || '#E0E0E0'
          : DarkThemeColors.white_common + '40',
      }]}>
        <TouchableOpacity
          style={[styles.dateButton, {
            borderColor: colors.primary,
            backgroundColor: startDate 
              ? (appTheme === APP_THEMES.light ? colors.primary + '20' : colors.primary + '30')
              : (appTheme === APP_THEMES.light ? 'transparent' : DarkThemeColors.cardBg),
          }]}
          onPress={() => handleDatePickerOpen('start')}
        >
          <AppText size={hp(1.8)} color={startDate ? colors.primary : colors.text}>
            {startDate ? startDate.format('DD MMM YY') : t('attendance.selectStartDate', 'Start Date')}
          </AppText>
        </TouchableOpacity>
        
        <AppText size={hp(2)} color={colors.text} style={styles.dateSeparator}>
          -
        </AppText>
        
        <TouchableOpacity
          style={[styles.dateButton, {
            borderColor: colors.primary,
            backgroundColor: endDate 
              ? (appTheme === APP_THEMES.light ? colors.primary + '20' : colors.primary + '30')
              : (appTheme === APP_THEMES.light ? 'transparent' : DarkThemeColors.cardBg),
          }]}
          onPress={() => handleDatePickerOpen('end')}
        >
          <AppText size={hp(1.8)} color={endDate ? colors.primary : colors.text}>
            {endDate ? endDate.format('DD MMM YY') : t('attendance.selectEndDate', 'End Date')}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetDateRange}
        >
          <AppText size={hp(1.6)} color={colors.text} style={{ opacity: 0.7 }}>
            {t('common.reset', 'Reset')}
          </AppText>
        </TouchableOpacity>
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
        removeClippedSubviews={true}
        initialNumToRender={10}
        windowSize={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => {
          // Approximate item height: header + items (variable, estimate 200)
          const ITEM_HEIGHT = 200;
          return {
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          };
        }}
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
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                  }]}
                  onPress={() => changeDate('year', -1)}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium} color={colors.text}>
                    {tempDate.year()}
                  </AppText>
                  <AppText size={hp(1.5)} color={colors.text} style={{ opacity: 0.7 }}>Year</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                    opacity: tempDate.clone().add(1, 'year').isAfter(moment.utc().endOf('day')) ? 0.3 : 1,
                  }]}
                  onPress={() => changeDate('year', 1)}
                  disabled={tempDate.clone().add(1, 'year').isAfter(moment.utc().endOf('day'))}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                  }]}
                  onPress={() => changeDate('month', -1)}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium} color={colors.text}>
                    {tempDate.format('MMMM')}
                  </AppText>
                  <AppText size={hp(1.5)} color={colors.text} style={{ opacity: 0.7 }}>Month</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                    opacity: tempDate.clone().add(1, 'month').isAfter(moment.utc().endOf('day')) ? 0.3 : 1,
                  }]}
                  onPress={() => changeDate('month', 1)}
                  disabled={tempDate.clone().add(1, 'month').isAfter(moment.utc().endOf('day'))}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                  }]}
                  onPress={() => changeDate('day', -1)}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium} color={colors.text}>
                    {tempDate.date()}
                  </AppText>
                  <AppText size={hp(1.5)} color={colors.text} style={{ opacity: 0.7 }}>Day</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light ? '#F0F0F0' : colors.primary,
                    opacity: tempDate.clone().add(1, 'day').isAfter(moment.utc().endOf('day')) ? 0.3 : 1,
                  }]}
                  onPress={() => changeDate('day', 1)}
                  disabled={tempDate.clone().add(1, 'day').isAfter(moment.utc().endOf('day'))}
                >
                  <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#FFFFFF'}>+</AppText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleDatePickerCancel}
              >
                <AppText size={hp(2)} color={appTheme === APP_THEMES.light ? colors.text : '#000000'}>
                  {t('common.cancel', 'Cancel')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, {
                  opacity: tempDate.isAfter(moment.utc().endOf('day')) ? 0.5 : 1,
                }]}
                onPress={handleDatePickerConfirm}
                disabled={tempDate.isAfter(moment.utc().endOf('day'))}
              >
                <AppText size={hp(2)} color={colors.primary || '#62C268'}>
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
    backgroundColor: '#F0F0F0',
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
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: '#E8F5E9',
  },
});
