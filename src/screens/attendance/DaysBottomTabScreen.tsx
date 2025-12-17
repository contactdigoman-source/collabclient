import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';

import { AppContainer, AppText, HomeHeader } from '../../components';
import DayAttendanceItem from '../../components/app-list-items/DayAttendanceItem';
import AttendanceDetailModal from '../../components/app-modals/AttendanceDetailModal';
import { useAppSelector } from '../../redux';
import { hp, wp, FontTypes, Icons } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { AttendanceDay } from '../../services';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { groupAttendanceByDate } from '../../services/attendance/attendance-utils';
import { getAttendanceData } from '../../services/attendance/attendance-db-service';
import { getDaysAttendance } from '../../services/attendance/attendance-service';
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
  attendanceStatus?: 'PRESENT' | 'ABSENT' | 'PARTIAL';
  totalDuration?: string;
  breakDuration?: string;
}

export default function DaysBottomTabScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation();
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);
  const userAttendanceHistory = useAppSelector(
    state => state.userState.userAttendanceHistory,
  );

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

  // Get today's attendance records (first check-in and last checkout) in UTC date format
  const todayAttendance = useMemo(() => {
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      return { checkIn: null, checkout: null };
    }
    
    const today = moment.utc().format('YYYY-MM-DD');
    
    // Find today's check-in and checkout records
    let checkIn: typeof userAttendanceHistory[0] | null = null;
    let checkout: typeof userAttendanceHistory[0] | null = null;
    let checkoutTimestamp = 0;
    
    for (const record of userAttendanceHistory) {
      // Check DateOfPunch field first, then derive from Timestamp
      let recordDate: string;
      if (record.DateOfPunch) {
        recordDate = record.DateOfPunch;
      } else if (record.Timestamp) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        recordDate = moment.utc(timestamp).format('YYYY-MM-DD');
      } else {
        continue;
      }
      
      if (recordDate === today) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        
        if (record.PunchDirection === 'IN') {
          // Get first check-in of the day (earliest timestamp)
          if (!checkIn || timestamp < (typeof checkIn.Timestamp === 'string' ? parseInt(checkIn.Timestamp, 10) : checkIn.Timestamp)) {
            checkIn = record;
          }
        } else if (record.PunchDirection === 'OUT') {
          // Get last checkout of the day (most recent/latest timestamp)
          if (timestamp > checkoutTimestamp) {
            checkout = record;
            checkoutTimestamp = timestamp;
          }
        }
      }
    }
    
    return { checkIn, checkout };
  }, [userAttendanceHistory]);

  // Load attendance data from database
  const loadAttendanceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        // On refresh, sync from server to get latest data
        if (userData?.email) {
          await getDaysAttendance(userData.email);
        }
      }
      
      // Refresh data from database (this will update Redux store)
      if (userData?.email) {
        getAttendanceData(userData.email);
      }
      
      // Note: Actual data update happens via Redux selector (userAttendanceHistory)
      // which triggers re-render when database is updated
    } catch (err: any) {
      logger.error('[DaysTab] Error loading attendance data', err);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [userData?.email]);

  const onRefresh = useCallback(() => {
    loadAttendanceData(true);
  }, [loadAttendanceData]);

  // Load attendance data from database on mount and sync from server
  useEffect(() => {
    const loadData = async () => {
      if (userData?.email) {
        // Sync from server to get latest data (this also updates the database)
        try {
          await getDaysAttendance(userData.email);
        } catch (error) {
          logger.error('[DaysTab] Error syncing from server', error);
        }
      }
    };
    loadData();
  }, [userData?.email]);

  // Reset month to current month when tab is focused and sync from server
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const currentMonth = moment.utc();
        setSelectedMonth(currentMonth);
        // Sync from server when tab is focused (this also updates the database)
        if (userData?.email) {
          try {
            await getDaysAttendance(userData.email);
          } catch (error) {
            logger.error('[DaysTab] Error syncing from server on focus', error);
          }
        }
      };
      loadData();
    }, [userData?.email])
  );

  // Transform database records to grouped format
  const attendanceData = useMemo<AttendanceDay[]>(() => {
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      return [];
    }
    
    // Group and transform records from database
    return groupAttendanceByDate(userAttendanceHistory);
  }, [userAttendanceHistory]);

  // Group attendance by date and filter by selected month
  const groupedAttendance = useMemo<GroupedAttendance[]>(() => {
    if (!attendanceData?.length) {
      return [];
    }

    // Use UTC for month comparisons (selectedMonth is already UTC)
    const monthStart = selectedMonth.clone().startOf('month');
    const monthEnd = selectedMonth.clone().endOf('month');
    
    const filtered = attendanceData.filter((day) => {
      // Compare dates using UTC for consistency
      const dayDate = moment.utc(day.dateOfPunch, 'YYYY-MM-DD');
      return dayDate.isSameOrAfter(monthStart) && dayDate.isSameOrBefore(monthEnd);
    });

    // Convert to GroupedAttendance format and sort by date (most recent first)
    return filtered
      .map((day) => ({
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
      }))
      .sort((a, b) => moment.utc(b.date).diff(moment.utc(a.date)));
  }, [attendanceData, selectedMonth]);

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
    
    // Sync attendance data for the selected month from server
    if (userData?.email) {
      try {
        await getDaysAttendance(userData.email, newMonth);
      } catch (error) {
        logger.error('[DaysTab] Error syncing month data', error);
      }
    }
  }, [selectedMonth, userData?.email]);

  const handleNextMonth = useCallback(async () => {
    const newMonth = selectedMonth.clone().add(1, 'month');
    setSelectedMonth(newMonth);
    
    // Sync attendance data for the selected month from server
    if (userData?.email) {
      try {
        await getDaysAttendance(userData.email, newMonth);
      } catch (error) {
        logger.error('[DaysTab] Error syncing month data', error);
      }
    }
  }, [selectedMonth, userData?.email]);

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
          // Only show today's check-in time (first check-in)
          todayAttendance.checkIn?.Timestamp || undefined
        }
        checkoutTimestamp={
          // Only show today's checkout time (last checkout)
          todayAttendance.checkout?.Timestamp || undefined
        }
        punchDirection={todayAttendance.checkIn?.PunchDirection || undefined}
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
