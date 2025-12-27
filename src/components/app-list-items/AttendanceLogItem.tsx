import React, { memo, useMemo, useEffect } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { useTheme } from '@react-navigation/native';
import moment from 'moment';
import { formatUTCForDisplay } from '../../utils/time-utils';

import AppText from '../app-texts/AppText';
import AppImage from '../app-images/AppImage';
import { hp, Icons } from '../../constants';
import { AttendanceRecord } from '../../redux/types/userTypes';

interface AttendanceLogItemProps {
  item: AttendanceRecord[];
}

const AttendanceLogItem: React.FC<AttendanceLogItemProps> = ({ item }) => {
  const { colors } = useTheme();

  /** Precompute today's formatted date once */
  const todayFormatted = useMemo(() => moment().format('DD/MM/YYYY'), []);

  /** Memoized computed header date */
  const headerDate = useMemo(() => {
    const firstItem = item?.[0];
    if (!firstItem?.Timestamp) return '';
    // Timestamp is in UTC - convert to local time for display
    const date = formatUTCForDisplay(firstItem.Timestamp, 'DD/MM/YYYY');
    const formattedDate = date;
    if (formattedDate === todayFormatted) {
      return `Today, ${moment().format('DD MMM')}`;
    }
    return formatUTCForDisplay(firstItem.Timestamp, 'ddd, DD MMM YY');
  }, [item, todayFormatted]);

  /** Reusable rotating animation for unsynced icon */
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotateAnim]);

  const rotateStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [rotateAnim],
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.attendance_log_card_bg },
      ]}
    >
      <AppText size={hp(2.24)} style={styles.headerText}>
        {headerDate}
      </AppText>

      <View style={styles.itemsWrapper}>
        {item.map((attendanceItem) => {
          const { Timestamp, PunchType = '', PunchDirection = 'IN', IsSynced = 'N', CreatedOn } =
            attendanceItem;

          // Timestamp is in UTC - convert to local time for display
          const formattedTime = formatUTCForDisplay(Timestamp, 'hh:mm A');

          return (
            <View key={Timestamp} style={styles.subItemList}>
              {/* Punch Type & Direction */}
              <View style={styles.flex1}>
                <AppText
                  style={styles.capitalizeText}
                >
                  {PunchDirection === 'IN' ? 'Check In' : PunchDirection === 'OUT' ? 'Check Out' : PunchDirection}
                </AppText>
              </View>

              {/* Divider */}
              <View
                style={[styles.divider, { backgroundColor: colors.white }]}
              />

              {/* Time */}
              <View style={styles.timeContainer}>
                <AppText color={colors.primary}>{formattedTime}</AppText>
              </View>

              {/* Sync Status */}
              <View style={styles.syncStatusView}>
                {IsSynced === 'Y' ? (
                  <AppImage
                    key={CreatedOn}
                    source={Icons.tick}
                    size={hp('1.8%')}
                    tintColor={colors.primary}
                  />
                ) : (
                  <Animated.Image
                    key={CreatedOn}
                    source={Icons.sync}
                    style={[
                      styles.syncIcon,
                      rotateStyle,
                      { tintColor: (colors as any).green || colors.primary },
                    ]}
                    resizeMode="contain"
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: hp(1.86),
    marginVertical: hp(1),
    borderRadius: hp(1.74),
    alignSelf: 'stretch',
  },
  headerText: {
    opacity: 0.5,
  },
  itemsWrapper: {
    marginTop: hp(0.25),
  },
  subItemList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(1.5),
  },
  divider: {
    width: hp(0.25),
    height: hp(1.86),
    alignSelf: 'center',
    marginHorizontal: hp(1.24),
    opacity: 0.2,
  },
  flex1: { flex: 1 },
  capitalizeText: { textTransform: 'capitalize' },
  timeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusView: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  syncIcon: {
    width: hp('2.5%'),
    height: hp('2.5%'),
  },
});

export default memo(AttendanceLogItem);
