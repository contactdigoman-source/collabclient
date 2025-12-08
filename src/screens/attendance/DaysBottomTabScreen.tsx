import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';

import { AppContainer, AppText, HomeHeader } from '../../components';
import DayAttendanceItem from '../../components/app-list-items/DayAttendanceItem';
import AttendanceDetailModal from '../../components/app-modals/AttendanceDetailModal';
import { useAppSelector } from '../../redux';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { getAttendanceData } from '../../services';

interface AttendanceRecord {
  DateOfPunch?: string;
  Timestamp: string | number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string;
  [key: string]: any;
}

interface GroupedAttendance {
  date: string;
  records: AttendanceRecord[];
}

export default function DaysBottomTabScreen(): React.JSX.Element {
  const { colors } = useTheme();
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

  // Calculate header height: safe area top + padding + content height (UserImage ~10% width)
  const headerHeight = useMemo(() => {
    const safeAreaTop = insets.top || wp('2%');
    const paddingVertical = wp('2%') * 2; // top and bottom padding
    const contentHeight = wp('10%'); // UserImage size
    return safeAreaTop + paddingVertical + contentHeight + hp(1); // Add extra buffer
  }, [insets.top]);

  // Load attendance data on mount
  useEffect(() => {
    if (userData?.email) {
      getAttendanceData(userData.email);
    }
  }, [userData?.email]);

  // Group attendance by date
  const groupedAttendance = useMemo<GroupedAttendance[]>(() => {
    if (!userAttendanceHistory?.length) return [];

    const grouped: { [key: string]: AttendanceRecord[] } = {};
    
    userAttendanceHistory.forEach((record: AttendanceRecord) => {
      const dateKey = record.DateOfPunch || 
        (record.Timestamp 
          ? moment(record.Timestamp).format('YYYY-MM-DD')
          : moment().format('YYYY-MM-DD'));
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(record);
    });

    // Convert to array and sort by date (most recent first)
    return Object.entries(grouped)
      .map(([date, records]) => ({ date, records }))
      .sort((a, b) => moment(b.date).diff(moment(a.date)));
  }, [userAttendanceHistory]);

  const handleDayItemPress = useCallback((item: GroupedAttendance) => {
    setSelectedDay(item);
    setShowDetailModal(true);
  }, []);

  const renderDayItem = useCallback(
    ({ item }: { item: GroupedAttendance }) => (
      <DayAttendanceItem
        date={item.date}
        records={item.records}
        onDetailPress={() => handleDayItemPress(item)}
      />
    ),
    [handleDayItemPress],
  );

  const keyExtractor = useCallback(
    (item: GroupedAttendance) => item.date,
    [],
  );

  return (
    <AppContainer>
      <HomeHeader
        userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        borderBottomColor={colors.home_header_border}
        punchTimestamp={userLastAttendance?.Timestamp}
        punchDirection={userLastAttendance?.PunchDirection}
      />
      <FlatList
        data={groupedAttendance}
        renderItem={renderDayItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + hp(1) },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText size={hp(2)}>{t('attendance.noDataFound')}</AppText>
          </View>
        }
      />

      {selectedDay && (
        <AttendanceDetailModal
          visible={showDetailModal}
          date={selectedDay.date}
          records={selectedDay.records}
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
  listContent: {
    paddingBottom: hp(2),
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(20),
  },
});

