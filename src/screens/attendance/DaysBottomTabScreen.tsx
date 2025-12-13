import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';

import { AppContainer, AppText, HomeHeader } from '../../components';
import DayAttendanceItem from '../../components/app-list-items/DayAttendanceItem';
import AttendanceDetailModal from '../../components/app-modals/AttendanceDetailModal';
import { useAppSelector } from '../../redux';
import { hp, wp, FontTypes, Icons } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { getDaysAttendance, AttendanceDay } from '../../services';
import { DarkThemeColors } from '../../themes';

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
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  const [selectedDay, setSelectedDay] = useState<GroupedAttendance | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<moment.Moment>(moment());
  const [showLogs, setShowLogs] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate header height: safe area top + padding + content height (UserImage ~10% width)
  const headerHeight = useMemo(() => {
    const safeAreaTop = insets.top || wp('2%');
    const paddingVertical = wp('2%') * 2; // top and bottom padding
    const contentHeight = wp('10%'); // UserImage size
    return safeAreaTop + paddingVertical + contentHeight + hp(1); // Add extra buffer
  }, [insets.top]);

  const loadAttendanceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await getDaysAttendance();
      console.log('[DaysTab] Loaded attendance data:', data?.length || 0, 'days');
      console.log('[DaysTab] Sample data:', data?.[0]);
      setAttendanceData(data || []);
    } catch (err: any) {
      console.error('[DaysTab] Error loading attendance data:', err);
      // Don't set error - just show empty state with "No data available"
      setAttendanceData([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    loadAttendanceData(true);
  }, [loadAttendanceData]);

  // Load attendance data on mount
  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Reset month to current month and reload data when tab is focused
  useFocusEffect(
    useCallback(() => {
      const currentMonth = moment();
      setSelectedMonth(currentMonth);
      loadAttendanceData();
    }, [loadAttendanceData])
  );

  // Reload data when month selection changes
  const selectedMonthKey = useMemo(() => selectedMonth.format('YYYY-MM'), [selectedMonth]);
  useEffect(() => {
    loadAttendanceData();
  }, [selectedMonthKey, loadAttendanceData]);

  // Group attendance by date and filter by selected month
  const groupedAttendance = useMemo<GroupedAttendance[]>(() => {
    if (!attendanceData?.length) {
      console.log('[DaysTab] No attendance data available for filtering');
      return [];
    }

    const monthStart = selectedMonth.clone().startOf('month');
    const monthEnd = selectedMonth.clone().endOf('month');
    
    console.log('[DaysTab] Filtering for month:', selectedMonth.format('YYYY-MM'));
    console.log('[DaysTab] Month range:', monthStart.format('YYYY-MM-DD'), 'to', monthEnd.format('YYYY-MM-DD'));
    console.log('[DaysTab] Total data items:', attendanceData.length);
    console.log('[DaysTab] Available dates:', attendanceData.map(d => d.dateOfPunch).join(', '));
    
    const filtered = attendanceData.filter((day) => {
      const dayDate = moment(day.dateOfPunch, 'YYYY-MM-DD');
      const isInRange = dayDate.isSameOrAfter(monthStart) && dayDate.isSameOrBefore(monthEnd);
      if (isInRange) {
        console.log('[DaysTab] Matched date:', day.dateOfPunch);
      }
      return isInRange;
    });

    console.log('[DaysTab] Filtered items:', filtered.length);

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
      .sort((a, b) => moment(b.date).diff(moment(a.date)));
  }, [attendanceData, selectedMonth]);

  const handleDayItemPress = useCallback((item: GroupedAttendance) => {
    console.log('[DaysTab] Opening modal for:', {
      date: item.date,
      recordsCount: item.records?.length || 0,
      records: item.records,
    });
    setSelectedDay(item);
    setShowDetailModal(true);
  }, []);

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth(prev => prev.clone().subtract(1, 'month'));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth(prev => prev.clone().add(1, 'month'));
  }, []);

  const handleLogsToggle = useCallback(() => {
    setShowLogs(prev => !prev);
  }, []);

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

  return (
    <AppContainer>
      <HomeHeader
        userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        borderBottomColor={(colors as any).home_header_border || DarkThemeColors.home_header_border}
        punchTimestamp={userLastAttendance?.Timestamp}
        punchDirection={userLastAttendance?.PunchDirection}
      />
      
      {/* Month Switcher Header */}
      <View style={[styles.headerContainer, { marginTop: headerHeight }]}>
        {/* Top Row: My Days and Logs */}
        <View style={styles.topRow}>
          {/* Left: My Days */}
          <View style={styles.leftSection}>
            <AppText size={14} color="#626262" style={styles.myDaysText}>
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
              <View style={[styles.logsCheckbox, showLogs && styles.logsCheckboxSelected]}>
                {showLogs && (
                  <Image
                    source={Icons.tick}
                    style={styles.logsCheckmarkIcon}
                    resizeMode="contain"
                  />
                )}
              </View>
              <AppText size={17} fontType={FontTypes.medium} color="#626262" style={styles.logsText}>
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
              style={[styles.arrowIcon, styles.leftArrow]}
              resizeMode="contain"
            />
            <AppText size={17} fontType={FontTypes.medium} color="#626262" style={styles.monthNameText}>
              {previousMonthName}
            </AppText>
          </TouchableOpacity>

          <View style={styles.currentMonthContainer}>
            <AppText size={22} fontType={FontTypes.medium} color="#62C268">
              {currentMonthName}
            </AppText>
          </View>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.monthButton}
            activeOpacity={0.7}
          >
            <AppText size={17} fontType={FontTypes.medium} color="#626262" style={styles.monthNameText}>
              {nextMonthName}
            </AppText>
            <Image
              source={Icons.back_arrow}
              style={[styles.arrowIcon, styles.rightArrow]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DarkThemeColors.primary} />
        </View>
      ) : (
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
              tintColor={DarkThemeColors.primary}
              colors={[DarkThemeColors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AppText size={hp(2)}>{t('attendance.noDataFound')}</AppText>
            </View>
          }
        />
      )}

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
    backgroundColor: DarkThemeColors.black,
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
    borderBottomColor: DarkThemeColors.white_common + '12',
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
    color: '#626262',
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
    tintColor: DarkThemeColors.white_common,
  },
  logsText: {
    fontFamily: 'Noto Sans',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 23,
    color: '#626262',
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
    tintColor: '#626262',
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
