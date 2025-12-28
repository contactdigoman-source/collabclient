import React, { memo, useMemo, useEffect } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { useTheme } from '@react-navigation/native';
import moment from 'moment';
import { formatUTCForDisplay } from '../../utils/time-utils';

import AppText from '../app-texts/AppText';
import AppImage from '../app-images/AppImage';
import { hp, wp, Icons, FontTypes } from '../../constants';
import { AttendanceRecord } from '../../redux/types/userTypes';
import { AttendanceDay } from '../../services/attendance/attendance-service';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useAppSelector } from '../../redux';

interface AttendanceLogItemProps {
  item: AttendanceDay;
}

const AttendanceLogItem: React.FC<AttendanceLogItemProps> = ({ item }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { appTheme } = useAppSelector(state => state.appState);
  const userData = useAppSelector(state => state.userState.userData);

  /** Precompute today's formatted date once */
  const todayFormatted = useMemo(() => moment().format('DD/MM/YYYY'), []);

  /** Memoized computed header date */
  const headerDate = useMemo(() => {
    // Use dateOfPunch from AttendanceDay
    if (!item?.dateOfPunch) return '';
    const date = moment.utc(item.dateOfPunch).format('DD/MM/YYYY');
    if (date === todayFormatted) {
      return `Today, ${moment().format('DD MMM')}`;
    }
    return moment.utc(item.dateOfPunch).format('ddd, DD MMM YY');
  }, [item, todayFormatted]);

  // Use pre-calculated status and durations from AttendanceDay
  const attendanceSummary = useMemo(() => {
    if (!item || !item.records || item.records.length === 0) {
      return {
        status: 'ABSENT',
        statusColor: 'RED',
        totalDuration: '00:00',
        punchCount: 0,
        minimumHours: userData?.minimumWorkingHours || 8,
      };
    }

    // Use the status and durations already calculated by groupAttendanceByDate
    const status = item.attendanceStatus;
    const totalDuration = item.totalDuration || '00:00';
    const punchCount = item.records.length;
    
    // Get minimum hours from the first check-in record or use default
    const firstCheckIn = item.records.find(r => r.PunchDirection === 'IN');
    const minimumHours = (firstCheckIn as any)?.MinimumHoursRequired || userData?.minimumWorkingHours || 8;

    // Determine status color
    let statusColor: 'GREEN' | 'RED' | 'YELLOW' = 'RED';
    const requiresApproval = item.requiresApproval;

    if (requiresApproval) {
      statusColor = 'YELLOW'; // Pending approval (highest priority)
    } else if (status === 'PRESENT') {
      statusColor = 'GREEN'; // Met minimum hours
    } else if (status === 'PARTIAL' || status === 'HOURS_DEFICIT' || status === 'ABSENT') {
      statusColor = 'RED'; // Issue with attendance
    }

    return {
      status,
      statusColor,
      totalDuration,
      punchCount,
      minimumHours,
    };
  }, [item, userData?.minimumWorkingHours]);

  // Get status badge text
  const getStatusBadge = (status: string): string => {
    switch (status) {
      case 'PRESENT': return t('attendance.status.present', 'Present');
      case 'ABSENT': return t('attendance.status.absent', 'Absent');
      case 'PARTIAL': return t('attendance.status.partial', 'Partial');
      case 'HOURS_DEFICIT': return t('attendance.status.hoursDeficit', 'Hours Deficit');
      default: return status;
    }
  };

  // Get status color
  const getStatusColorValue = (statusColor: string) => {
    switch (statusColor) {
      case 'GREEN': return '#4CAF50';
      case 'RED': return '#F44336';
      case 'YELLOW': return '#FFA726';
      default: return colors.text;
    }
  };

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
      {/* Header with Date and Status Badge */}
      <View style={styles.headerRow}>
        <AppText size={hp(2.24)} fontType={FontTypes.medium} style={styles.headerText}>
          {headerDate}
        </AppText>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColorValue(attendanceSummary.statusColor) }]}>
          <AppText size={hp(1.5)} color="#FFFFFF" fontType={FontTypes.medium}>
            {getStatusBadge(attendanceSummary.status)}
          </AppText>
        </View>
      </View>

      {/* Summary Row: Duration and Punch Count */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <AppText size={hp(1.6)} style={styles.summaryLabel}>
            {t('attendance.totalDuration', 'Total Duration')}
          </AppText>
          <AppText size={hp(2)} fontType={FontTypes.medium} color={colors.primary}>
            {attendanceSummary.totalDuration} hr
          </AppText>
          <AppText size={hp(1.3)} style={[styles.summaryLabel, { marginTop: hp(0.3) }]}>
            (Min: {attendanceSummary.minimumHours}h)
          </AppText>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: colors.white }]} />
        <View style={styles.summaryItem}>
          <AppText size={hp(1.6)} style={styles.summaryLabel}>
            {t('attendance.totalPunches', 'Total Punches')}
          </AppText>
          <AppText size={hp(2)} fontType={FontTypes.medium} color={colors.primary}>
            {attendanceSummary.punchCount}
          </AppText>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.horizontalDivider, { backgroundColor: colors.white }]} />

      {/* Individual Punch Logs */}
      <View style={styles.itemsWrapper}>
        {item.records.map((attendanceItem) => {
          const { Timestamp, PunchDirection = 'IN', AttendanceStatus, IsSynced = 'Y', CreatedOn = Timestamp } = attendanceItem;

          // Timestamp is in UTC - convert to local time for display
          const formattedTime = formatUTCForDisplay(Timestamp, 'hh:mm A');

          // Format break status if present
          const getBreakStatusDisplay = (status: string | null | undefined): string => {
            if (!status || status.trim() === '') return '';
            switch (status.toUpperCase()) {
              case 'LUNCH': return t('attendance.breakStatus.lunch', 'Lunch');
              case 'SHORTBREAK': return t('attendance.breakStatus.shortBreak', 'Short Break');
              case 'COMMUTING': return t('attendance.breakStatus.commuting', 'Commuting');
              case 'PERSONALTIMEOUT': return t('attendance.breakStatus.personalTimeOut', 'Personal Time Out');
              case 'OUTFORDINNER': return t('attendance.breakStatus.outForDinner', 'Out for Dinner');
              case 'EARLY_CHECKOUT': return t('attendance.breakStatus.earlyCheckout', 'Early Checkout');
              default: return status;
            }
          };

          const breakStatus = getBreakStatusDisplay(AttendanceStatus);

          return (
            <View key={Timestamp} style={styles.subItemList}>
              {/* Punch Type & Direction */}
              <View style={styles.punchInfoContainer}>
                <AppText style={styles.punchDirection} fontType={FontTypes.medium}>
                  {PunchDirection === 'IN' ? t('attendance.in', 'In') : PunchDirection === 'OUT' ? t('attendance.out', 'Out') : PunchDirection}
                </AppText>
                {breakStatus && (
                  <AppText size={hp(1.4)} style={styles.breakStatus}>
                    ({breakStatus})
                  </AppText>
                )}
              </View>

              {/* Time */}
              <View style={styles.timeContainer}>
                <AppText color={colors.primary} fontType={FontTypes.medium}>{formattedTime}</AppText>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  headerText: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: hp(1),
    marginLeft: wp(2),
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: hp(1),
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    opacity: 0.6,
    marginBottom: hp(0.5),
  },
  verticalDivider: {
    width: hp(0.25),
    height: hp(3),
    opacity: 0.2,
  },
  horizontalDivider: {
    width: '100%',
    height: hp(0.15),
    opacity: 0.2,
    marginVertical: hp(1),
  },
  itemsWrapper: {
    marginTop: hp(0.5),
  },
  subItemList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(1.2),
    paddingVertical: hp(0.5),
  },
  punchInfoContainer: {
    flex: 2,
  },
  punchDirection: {
    textTransform: 'capitalize',
  },
  breakStatus: {
    opacity: 0.6,
    marginTop: hp(0.3),
  },
  timeContainer: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusView: {
    flex: 0.8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  syncIcon: {
    width: hp('2.5%'),
    height: hp('2.5%'),
  },
});

export default memo(AttendanceLogItem);
