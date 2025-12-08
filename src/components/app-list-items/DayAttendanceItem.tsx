import React, { useState, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import moment from 'moment';

import AppText from '../app-texts/AppText';
import AppImage from '../app-images/AppImage';
import { hp, wp, Icons } from '../../constants';
import { DarkThemeColors, LightThemeColors } from '../../themes';
import { useAppSelector } from '../../redux';
import { APP_THEMES } from '../../themes';

interface AttendanceRecord {
  Timestamp: string | number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string;
  DateOfPunch?: string;
  CreatedOn?: string | number;
  [key: string]: any;
}

interface DayAttendanceItemProps {
  date: string;
  records: AttendanceRecord[];
  onPress?: () => void;
  onDetailPress?: () => void;
}

const DayAttendanceItem: React.FC<DayAttendanceItemProps> = ({
  date,
  records,
  onPress,
  onDetailPress,
}) => {
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort records by timestamp
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const timeA = typeof a.Timestamp === 'string' ? parseInt(a.Timestamp) : a.Timestamp;
      const timeB = typeof b.Timestamp === 'string' ? parseInt(b.Timestamp) : b.Timestamp;
      return timeA - timeB;
    });
  }, [records]);

  // Find check-in and check-out
  const checkIn = useMemo(() => {
    return sortedRecords.find(r => r.PunchDirection === 'IN');
  }, [sortedRecords]);

  const checkOut = useMemo(() => {
    return sortedRecords.find(r => r.PunchDirection === 'OUT');
  }, [sortedRecords]);

  // Calculate duration in hours
  const duration = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const inTime = typeof checkIn.Timestamp === 'string' 
      ? moment(checkIn.Timestamp) 
      : moment(checkIn.Timestamp);
    const outTime = typeof checkOut.Timestamp === 'string' 
      ? moment(checkOut.Timestamp) 
      : moment(checkOut.Timestamp);
    const diff = moment.duration(outTime.diff(inTime));
    const hours = Math.floor(diff.asHours());
    const minutes = diff.minutes();
    // Format as "HH:mm hr" (e.g., "11:00 hr")
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
  }, [checkIn, checkOut]);

  // Calculate break duration (sum of break status durations)
  const breakDuration = useMemo(() => {
    // For now, return 00:00 as break calculation would need more complex logic
    // This can be enhanced later to track break periods
    return '00:00';
  }, []);

  // Format date header (e.g., "9 Apr")
  const dateHeader = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    return dateMoment.format('D MMM');
  }, [date]);

  // Format day of week (e.g., "Mon")
  const dayOfWeek = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    return dateMoment.format('ddd');
  }, [date]);

  // Check if today
  const isToday = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    const today = moment().startOf('day');
    return dateMoment.isSame(today, 'day');
  }, [date]);

  // Format time with date (e.g., "11:30 In | 9 Apr")
  const formatTimeWithDate = (timestamp: string | number, direction: string): string => {
    const timeMoment = typeof timestamp === 'string' 
      ? moment(timestamp) 
      : moment(timestamp);
    const time = timeMoment.format('HH:mm');
    const dateStr = timeMoment.format('D MMM');
    return `${time} ${direction} | ${dateStr}`;
  };

  // Check if has checkout (red if no checkout, green otherwise)
  const hasCheckout = !!checkOut;
  const statusColor = hasCheckout ? '#62C268' : '#E53131'; // Green if has checkout, red if not

  const handlePress = () => {
    setIsExpanded(!isExpanded);
    onPress?.();
  };

  const handleDetailPress = () => {
    onDetailPress?.();
  };

  const handleLongPress = () => {
    // Long press to open detail modal
    onDetailPress?.();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isExpanded && styles.containerExpanded,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Left: Date Section */}
        <View style={styles.dateSection}>
          <AppText size={hp(2.8)} color={themeColors.white_common} style={styles.dateText}>
            {dateHeader}
          </AppText>
          <AppText size={hp(1.9)} color="#A5A5A5" style={styles.dayText}>
            {dayOfWeek}
          </AppText>
          {isToday && (
            <AppText size={hp(1.9)} color="#62C268" style={styles.todayText}>
              Today
            </AppText>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Right: Times and Info */}
        <View style={styles.infoSection}>
          {/* Check-in/Check-out Times */}
          <View style={styles.timesContainer}>
            {checkIn ? (
              <AppText size={hp(1.6)} color={themeColors.white_common} style={styles.timeText}>
                {formatTimeWithDate(checkIn.Timestamp, 'In')}
              </AppText>
            ) : (
              <AppText size={hp(1.6)} color={themeColors.white_common} style={styles.missingText}>
                -- In
              </AppText>
            )}

            {checkOut ? (
              <AppText size={hp(1.6)} color={themeColors.white_common} style={styles.timeText}>
                {formatTimeWithDate(checkOut.Timestamp, 'Out')}
              </AppText>
            ) : (
              <AppText size={hp(1.6)} color={themeColors.white_common} style={styles.missingText}>
                -- Out
              </AppText>
            )}
          </View>

          {/* Duration Info */}
          {duration && (
            <View style={styles.durationInfo}>
              <AppText size={hp(1.6)} color="#888888" style={styles.durationText}>
                Total Duration: {duration}
              </AppText>
              <View style={styles.breakRow}>
                <AppText size={hp(1.6)} color="#888888" style={styles.durationText}>
                  Break: {breakDuration}
                </AppText>
                {hasCheckout && (
                  <View style={styles.odBadge}>
                    <AppText size={hp(1.5)} color={themeColors.white_common} style={styles.odText}>
                      OD
                    </AppText>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded View - Show all records */}
          {isExpanded && sortedRecords.length > 0 && (
            <>
              <View style={styles.expandedDivider} />
              <View style={styles.expandedContainer}>
                {sortedRecords.map((record, index) => (
                  <TouchableOpacity
                    key={`${record.Timestamp}-${index}`}
                    style={styles.recordItem}
                    onPress={handleDetailPress}
                    activeOpacity={0.7}
                  >
                    <AppText size={hp(1.5)} color={themeColors.white_common} style={styles.expandedTimeText}>
                      {formatTimeWithDate(record.Timestamp, record.PunchDirection)}
                    </AppText>
                  </TouchableOpacity>
                ))}
                {duration && (
                  <AppText size={hp(1.5)} color="#888888" style={styles.expandedDurationText}>
                    Duration: {duration}
                  </AppText>
                )}
              </View>
            </>
          )}
        </View>

        {/* Map Pin Button */}
        <TouchableOpacity
          onPress={handleDetailPress}
          style={styles.mapPinButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.mapPinButtonInner}>
            <AppImage
              source={Icons.location_reset}
              size={hp(1.8)}
              tintColor={themeColors.white_common}
            />
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: wp(90.93), // 341px / 375px * 100
    minHeight: hp(14.4), // 117px / 813.33px * 100
    marginVertical: hp(1),
    borderRadius: 10,
    marginHorizontal: wp(4.53), // 17px / 375px * 100
    backgroundColor: '#272727',
  },
  containerExpanded: {
    minHeight: hp(26.9), // 218.64px / 813.33px * 100
  },
  content: {
    flexDirection: 'row',
    padding: hp(2),
    position: 'relative',
  },
  dateSection: {
    width: wp(19.73), // 74px (36px to 110px)
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dateText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(2.8), // 22.7635px
    lineHeight: hp(3.8), // 31px
    textAlign: 'center',
    color: '#FFFFFF',
  },
  dayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(2.07), // 16.8252px
    lineHeight: hp(2.83), // 23px
    textAlign: 'center',
    color: '#A5A5A5',
    marginTop: hp(0.3),
  },
  todayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(2.07), // 16.8252px
    lineHeight: hp(2.83), // 23px
    textAlign: 'center',
    color: '#62C268',
    marginTop: hp(0.3),
  },
  divider: {
    width: 1,
    height: hp(6.5), // 53px
    backgroundColor: '#444444',
    marginHorizontal: wp(2.67), // 10px
    alignSelf: 'center',
  },
  infoSection: {
    flex: 1,
    paddingLeft: wp(2.67), // 10px
  },
  timesContainer: {
    gap: hp(0.5),
    marginBottom: hp(1),
  },
  timeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.85), // 15px
    lineHeight: hp(2.46), // 20px
    color: '#FFFFFF',
  },
  missingText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.85), // 15px
    lineHeight: hp(2.46), // 20px
    color: '#FFFFFF',
    opacity: 0.5,
  },
  durationInfo: {
    gap: hp(0.5),
  },
  durationText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.85), // 15px
    lineHeight: hp(2.46), // 20px
    color: '#888888',
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  odBadge: {
    width: wp(9.5), // 35.63px
    height: hp(2.4), // 19.64px
    backgroundColor: '#D78407',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  odText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.72), // 14px
    lineHeight: hp(2.34), // 19px
    color: '#FFFFFF',
  },
  expandedDivider: {
    width: '100%',
    height: 2,
    backgroundColor: '#383838',
    borderRadius: 6.56452,
    marginVertical: hp(1.5),
  },
  expandedContainer: {
    gap: hp(1),
  },
  recordItem: {
    paddingVertical: hp(0.3),
  },
  expandedTimeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.72), // 14px
    lineHeight: hp(2.34), // 19px
    color: '#FFFFFF',
  },
  expandedDurationText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: hp(1.72), // 14px
    lineHeight: hp(2.34), // 19px
    color: '#888888',
    marginTop: hp(0.5),
  },
  mapPinButton: {
    position: 'absolute',
    right: wp(2.67), // 10px
    top: hp(1.5), // ~12px
    width: hp(2.95), // 24px
    height: hp(2.95), // 24px
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinButtonInner: {
    width: hp(2.95), // 24px
    height: hp(2.95), // 24px
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
});

export default DayAttendanceItem;

