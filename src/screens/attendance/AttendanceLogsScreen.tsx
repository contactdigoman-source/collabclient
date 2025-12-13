import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import moment from 'moment';
import {
  AppContainer,
  AppText,
  AttendanceLogItem,
  BackHeader,
} from '../../components';
import { useAppSelector } from '../../redux';
import { useTranslation } from '../../hooks/useTranslation';
import { wp } from '../../constants';
import { AttendanceRecord } from '../../redux/types/userTypes';

export default function AttendanceLogsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { userAttendanceHistory } = useAppSelector(state => state.userState);

  /** Group attendance logs by date — memoized for performance */
  const groupedData = useMemo<AttendanceRecord[][]>(() => {
    if (!userAttendanceHistory?.length) return [];
    const grouped: { [key: string]: AttendanceRecord[] } = userAttendanceHistory.reduce(
      (group: { [key: string]: AttendanceRecord[] }, attendance: AttendanceRecord) => {
        const date = attendance.DateOfPunch || 
          (attendance.Timestamp 
            ? moment(attendance.Timestamp).format('YYYY-MM-DD')
            : moment().format('YYYY-MM-DD'));
        if (!group[date]) group[date] = [];
        group[date].push(attendance);
        return group;
      },
      {},
    );
    // Reverse order (most recent first)
    return Object.values(grouped);
  }, [userAttendanceHistory]);

  /** Stable renderItem reference */
  const renderHistoryItem = useCallback(
    ({ item }: { item: AttendanceRecord[] }) => <AttendanceLogItem item={item} />,
    [],
  );

  return (
    <AppContainer>
      <BackHeader title={t('profile.attendanceLogs')} isTitleVisible={true} />
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
});
