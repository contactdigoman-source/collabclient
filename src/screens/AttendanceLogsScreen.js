import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import {
  AppContainer,
  AppText,
  AttendanceLogItem,
  BackHeader,
} from '../components';
import { useAppSelector } from '../redux';

export default function AttendanceLogsScreen() {
  const { userAttendanceHistory } = useAppSelector(state => state.userState);

  /** Group attendance logs by date — memoized for performance */
  const groupedData = useMemo(() => {
    if (!userAttendanceHistory?.length) return [];
    const grouped = userAttendanceHistory.reduce((group, attendance) => {
      const date = attendance.DateOfPunch;
      if (!group[date]) group[date] = [];
      group[date].push(attendance);
      return group;
    }, {});
    // Reverse order (most recent first)
    return Object.values(grouped);
  }, [userAttendanceHistory]);

  /** Stable renderItem reference */
  const renderHistoryItem = useCallback(
    ({ item }) => <AttendanceLogItem item={item} />,
    [],
  );

  return (
    <AppContainer>
      <BackHeader title={'Attendance Logs'} isTitleVisible={true} />
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

const EmptyList = React.memo(() => (
  <View style={styles.emptyContainer}>
    <AppText>{'No Attendance Data Found!'}</AppText>
  </View>
));

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
