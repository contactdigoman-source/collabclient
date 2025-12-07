import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import {
  AppContainer,
  AppText,
  AttendanceLogItem,
  BackHeader,
} from '../../components';
import { useAppSelector } from '../../redux';
import { useTranslation } from '../../hooks/useTranslation';

interface AttendanceItem {
  DateOfPunch: string;
  [key: string]: any;
}

export default function AttendanceLogsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { userAttendanceHistory } = useAppSelector(state => state.userState);

  /** Group attendance logs by date — memoized for performance */
  const groupedData = useMemo<AttendanceItem[][]>(() => {
    if (!userAttendanceHistory?.length) return [];
    const grouped: { [key: string]: AttendanceItem[] } = userAttendanceHistory.reduce(
      (group: { [key: string]: AttendanceItem[] }, attendance: AttendanceItem) => {
        const date = attendance.DateOfPunch;
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
    ({ item }: { item: AttendanceItem[] }) => <AttendanceLogItem item={item} />,
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
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

