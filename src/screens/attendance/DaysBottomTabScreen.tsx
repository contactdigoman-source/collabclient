import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useTheme, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';

import { AppContainer, AppText, HomeHeader } from '../../components';
import DayAttendanceItem from '../../components/app-list-items/DayAttendanceItem';
import AttendanceDetailModal from '../../components/app-modals/AttendanceDetailModal';
import { useAppSelector } from '../../redux';
import { hp, wp, FontTypes, Icons } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { groupAttendanceByDate } from '../../services/attendance/attendance-grouping-service';
import { fillMissingDatesInMonth } from '../../services/attendance/attendance-utils';
import { getAttendanceData } from '../../services/attendance/attendance-db-service';
import { attendanceSyncService } from '../../services/sync/attendance-sync-service';
import { logger } from '../../services/logger';

interface GroupedAttendance {
  date: string;
  records: Array<{
    Timestamp: number;
    PunchDirection: 'IN' | 'OUT';
    AttendanceStatus?: string;
    LatLon?: string;
    Address?: string;
    DateOfPunch?: string;
  }>;
  attendanceStatus?: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'HOURS_DEFICIT';
  totalDuration?: string;
  breakDuration?: string;
  workedHours?: number;
  requiresApproval?: boolean;
  // Shift data extracted from first check-in record
  shiftStart?: string;
  shiftEnd?: string;
  minimumHours?: number;
  linkedEntryDate?: string;
}

export default function DaysBottomTabScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation();
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userData = useAppSelector(state => state.userState.userData);
  const userAttendanceHistory = useAppSelector(state => state.userState.userAttendanceHistory,);
  const userLastAttendance = useAppSelector(state => state.userState.userLastAttendance,);

  const [selectedDay, setSelectedDay] = useState<GroupedAttendance | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<moment.Moment>(moment.utc());
  const [refreshing, setRefreshing] = useState(false);

  // Calculate header height: safe area top + padding + content height (UserImage ~10% width)
  const headerHeight = useMemo(() => {
    const safeAreaTop = insets.top || wp('2%');
    const paddingVertical = wp('2%') * 2; // top and bottom padding
    const contentHeight = wp('10%'); // UserImage size
    return safeAreaTop + paddingVertical + contentHeight + hp(1); // Add extra buffer
  }, [insets.top]);

  // Load attendance data with explicit flow:
  // 1. Load from DB → Update Redux (immediate UI update)
  // 2. Sync from server → Update DB
  // 3. Load from DB again → Update Redux (show synced data)
  const loadAttendanceData = useCallback(async (month?: moment.Moment) => {
    try {
      // Get email from userData
      const email = userData?.email;
      if (!email) {
        logger.warn('[DaysTab] No email found in userData');
        return;
      }

      // STEP 1: Load from DB → Update Redux (FAST - immediate UI update)
      await getAttendanceData(email);
      logger.debug('[DaysTab] Loaded from DB and updated Redux');

      // STEP 2: Sync from server → Update DB (SLOWER - network)
      await attendanceSyncService.syncAttendanceFromServer(email, month);
      logger.debug('[DaysTab] Synced from server and updated DB');

      // STEP 3: Load from DB again → Update Redux (show synced data)
      await getAttendanceData(email);
      logger.debug('[DaysTab] Reloaded from DB and updated Redux with synced data');
    } catch (err: any) {
      logger.error('[DaysTab] Error loading attendance data', err);
    }
  }, [userData?.email]);

  // Refresh data from server (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadAttendanceData();
    } catch (err: any) {
      logger.error('[DaysTab] Error refreshing attendance data', err);
    } finally {
      setRefreshing(false);
    }
  }, [loadAttendanceData]);

  // Load data on mount: Load from DB → Update Redux → Sync from server → Update DB → Reload from DB → Update Redux
  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Reset month to current month when tab is focused and reload data
  useFocusEffect(
    useCallback(() => {
      const currentMonth = moment.utc();
      setSelectedMonth(currentMonth);
      // Reload data: Load from DB → Update Redux → Sync from server → Update DB → Reload from DB → Update Redux
      loadAttendanceData();
    }, [loadAttendanceData])
  );

  // Group attendance by date and filter by selected month
  // 🔧 FIX: Combined attendanceData + groupedAttendance into single useMemo
  // to eliminate intermediate render cycles that cause "0s" flashing
  const groupedAttendance = useMemo<GroupedAttendance[]>(() => {
    // Early return if no data - fill with ABSENT entries for selected month
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      const filledData = fillMissingDatesInMonth([], selectedMonth);
      return filledData.map((day) => ({
        date: day.dateOfPunch,
        records: [],
        attendanceStatus: day.attendanceStatus,
        totalDuration: day.totalDuration,
        breakDuration: day.breakDuration,
        workedHours: day.workedHours,
        requiresApproval: day.requiresApproval,
      }));
    }

    // Group and transform records from database
    const attendanceData = groupAttendanceByDate(userAttendanceHistory);

    // Use UTC for month comparisons (selectedMonth is already UTC)
    const monthStart = selectedMonth.clone().startOf('month');
    const monthEnd = selectedMonth.clone().endOf('month');
    
    const filtered = attendanceData.filter((day) => {
      // Compare dates using UTC for consistency
      const dayDate = moment.utc(day.dateOfPunch, 'YYYY-MM-DD');
      return dayDate.isSameOrAfter(monthStart) && dayDate.isSameOrBefore(monthEnd);
    });

    // Fill missing dates in the month with ABSENT entries
    const filledData = fillMissingDatesInMonth(filtered, selectedMonth);

    // Create a map of original records by date for efficient lookup (computed once per useMemo execution)
    const recordsByDateMap = new Map<string, typeof userAttendanceHistory>();
    userAttendanceHistory.forEach((record) => {
      const recordDate = record.DateOfPunch || moment.utc(record.Timestamp).format('YYYY-MM-DD');
      if (!recordsByDateMap.has(recordDate)) {
        recordsByDateMap.set(recordDate, []);
      }
      recordsByDateMap.get(recordDate)!.push(record);
    });

    // Convert to GroupedAttendance format (already sorted by fillMissingDatesInMonth)
    return filledData.map((day) => {
      // Find first check-in record from original data to extract shift info
      const dayOriginalRecords = recordsByDateMap.get(day.dateOfPunch) || [];
      const firstCheckInRecord = dayOriginalRecords.find(r => r.PunchDirection === 'IN');
      
      // Extract shift data from first check-in record (stored at check-in time)
      const shiftStart = (firstCheckInRecord as any)?.ShiftStartTime || undefined;
      const shiftEnd = (firstCheckInRecord as any)?.ShiftEndTime || undefined;
      const minimumHours = (firstCheckInRecord as any)?.MinimumHoursRequired || undefined;
      
      // Find LinkedEntryDate from any checkout record (for overnight shifts)
      const checkoutRecord = dayOriginalRecords.find(r => r.PunchDirection === 'OUT');
      const linkedEntryDate = (checkoutRecord as any)?.LinkedEntryDate || undefined;

      return {
        date: day.dateOfPunch,
        records: day.records.map((record) => ({
          Timestamp: record.Timestamp,
          PunchDirection: record.PunchDirection,
          AttendanceStatus: record.AttendanceStatus === null ? undefined : record.AttendanceStatus,
          LatLon: record.LatLon,
          Address: record.Address,
          DateOfPunch: record.DateOfPunch,
        })),
        attendanceStatus: day.attendanceStatus,
        totalDuration: day.totalDuration,
        breakDuration: day.breakDuration,
        workedHours: day.workedHours,
        requiresApproval: day.requiresApproval,
        // Add shift data extracted from original records
        shiftStart,
        shiftEnd,
        minimumHours,
        linkedEntryDate,
      };
    });
  }, [userAttendanceHistory, selectedMonth]);

  const handleDayItemPress = useCallback((item: GroupedAttendance) => {
    logger.debug('[DaysTab] Opening modal', {
      date: item.date,
      recordsCount: item.records?.length || 0,
      records: item.records,
    });
    setSelectedDay(item);
    setShowDetailModal(true);
  }, []);

  const handlePreviousMonth = useCallback(async () => {
    const newMonth = selectedMonth.clone().subtract(1, 'month');
    setSelectedMonth(newMonth);
    
    // Load data for new month: Load from DB → Update Redux → Sync from server → Update DB → Reload from DB → Update Redux
    await loadAttendanceData(newMonth);
  }, [selectedMonth, loadAttendanceData]);

  const handleNextMonth = useCallback(async () => {
    const newMonth = selectedMonth.clone().add(1, 'month');
    setSelectedMonth(newMonth);
    
    // Load data for new month: Load from DB → Update Redux → Sync from server → Update DB → Reload from DB → Update Redux
    await loadAttendanceData(newMonth);
  }, [selectedMonth, loadAttendanceData]);

  const handleLogsToggle = useCallback(() => {
    navigation.navigate('AttendanceLogsScreen' as never);
  }, [navigation]);

  const renderDayItem = useCallback(
    ({ item }: { item: GroupedAttendance }) => (
      <DayAttendanceItem
        date={item.date}
        records={item.records}
        onDetailPress={() => handleDayItemPress(item)}
        attendanceStatus={item.attendanceStatus}
        totalDuration={item.totalDuration}
        breakDuration={item.breakDuration}
        workedHours={item.workedHours}
        requiresApproval={item.requiresApproval}
        shiftStart={item.shiftStart}
        shiftEnd={item.shiftEnd}
        minimumHours={item.minimumHours}
        linkedEntryDate={item.linkedEntryDate}
      />
    ),
    [handleDayItemPress],
  );

  const keyExtractor = useCallback(
    (item: GroupedAttendance) => item.date,
    [],
  );

  // Format month names
  const previousMonthName = useMemo(() => {
    return selectedMonth.clone().subtract(1, 'month').format('MMMM');
  }, [selectedMonth]);

  const currentMonthName = useMemo(() => {
    return selectedMonth.format('MMMM YYYY');
  }, [selectedMonth]);

  const nextMonthName = useMemo(() => {
    return selectedMonth.clone().add(1, 'month').format('MMMM');
  }, [selectedMonth]);

  // Dynamic styles for theme-aware backgrounds and borders
  const dynamicStyles = useMemo(() => ({
    headerContainer: {
      backgroundColor: colors.background || DarkThemeColors.black,
      borderBottomWidth: appTheme === APP_THEMES.light ? 1 : 0,
      borderBottomColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
      shadowColor: appTheme === APP_THEMES.light ? (colors as any).black_common || '#000000' : 'transparent',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: appTheme === APP_THEMES.light ? 0.1 : 0,
      shadowRadius: appTheme === APP_THEMES.light ? 4 : 0,
      elevation: appTheme === APP_THEMES.light ? 2 : 0,
    },
    topRow: {
      borderBottomColor: appTheme === APP_THEMES.light 
        ? (colors as any).cardBorder || '#E0E0E0'
        : DarkThemeColors.white_common + '12',
    },
  }), [colors, appTheme]);

  return (
    <AppContainer>
      <HomeHeader
        userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        borderBottomColor={(colors as any).home_header_border || DarkThemeColors.home_header_border}
        punchTimestamp={
          // Show last punch timestamp (regardless of date)
          // This ensures header displays correctly even on weekends/holidays
          userLastAttendance?.Timestamp || undefined
        }
        checkoutTimestamp={
          // Show last checkout only if last action was checkout
          userLastAttendance?.PunchDirection === 'OUT' ? userLastAttendance.Timestamp : undefined
        }
        punchDirection={userLastAttendance?.PunchDirection || undefined}
      />
      
      {/* Month Switcher Header */}
      <View style={[styles.headerContainer, dynamicStyles.headerContainer, { marginTop: headerHeight }]}>
        {/* Top Row: My Days and Logs */}
        <View style={[styles.topRow, dynamicStyles.topRow]}>
          {/* Left: My Days */}
          <View style={styles.leftSection}>
            <AppText size={14} color={colors.text || '#626262'} style={styles.myDaysText}>
              My Days
            </AppText>
          </View>

          {/* Right: Logs Toggle */}
          <View style={styles.rightSection}>
            <TouchableOpacity
              style={styles.logsContainer}
              onPress={handleLogsToggle}
              activeOpacity={0.7}
            >
              <View style={styles.logsCheckbox}>
                <Image
                  source={Icons.tick}
                  style={[styles.logsCheckmarkIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
                  resizeMode="contain"
                />
              </View>
              <AppText size={17} fontType={FontTypes.medium} color={colors.text || '#626262'} style={styles.logsText}>
                Logs
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Row: Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            onPress={handlePreviousMonth}
            style={styles.monthButton}
            activeOpacity={0.7}
          >
            <Image
              source={Icons.back_arrow}
              tintColor={colors.text || '#626262'}
              style={[
                styles.arrowIcon,
                styles.leftArrow,
              ]}
              resizeMode="contain"
            />
            <AppText size={14} fontType={FontTypes.medium} color={colors.text || '#626262'} style={styles.monthNameText}>
              {previousMonthName}
            </AppText>
          </TouchableOpacity>

          <View style={styles.currentMonthContainer}>
            <AppText size={22} fontType={FontTypes.medium} color={colors.primary || '#62C268'}>
              {currentMonthName}
            </AppText>
          </View>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.monthButton}
            activeOpacity={0.7}
          >
            <AppText size={14} fontType={FontTypes.medium} color={colors.text || '#626262'} style={styles.monthNameText}>
              {nextMonthName}
            </AppText>
            <Image
              source={Icons.back_arrow}
              style={[styles.arrowIcon, styles.rightArrow, { tintColor: colors.text || '#626262' }]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={groupedAttendance}
        renderItem={renderDayItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary || DarkThemeColors.primary}
            colors={[colors.primary || DarkThemeColors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText size={hp(2)} color={colors.text}>{t('attendance.noDataFound')}</AppText>
          </View>
        }
      />

      {selectedDay && (
        <AttendanceDetailModal
          visible={showDetailModal}
          date={selectedDay.date}
          records={selectedDay.records || []}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDay(null);
          }}
        />
      )}
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    zIndex: 10,
    paddingBottom: hp(1),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  myDaysText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'left',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  logsCheckbox: {
    width: 18.59,
    height: 18.59,
    borderWidth: 1.37,
    borderColor: '#62C268',
    borderRadius: 2.94,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsCheckboxSelected: {
    backgroundColor: '#62C268',
  },
  logsCheckmarkIcon: {
    width: 12,
    height: 12,
  },
  logsText: {
    fontFamily: 'Noto Sans',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 23,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.5),
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(0.5),
    paddingHorizontal: wp(1),
    gap: wp(1),
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  leftArrow: {
    transform: [{ rotate: '0deg' }],
  },
  rightArrow: {
    transform: [{ rotate: '180deg' }],
  },
  monthNameText: {
    marginHorizontal: wp(0.5),
  },
  currentMonthContainer: {
    flex: 1,
    alignItems: 'center',
  },
  listContent: {
    paddingTop: hp(1),
    paddingBottom: hp(2),
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(20),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(20),
  },
});
