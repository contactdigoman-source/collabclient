import React, { useState, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import moment from 'moment';

import AppText from '../app-texts/AppText';
import { hp, wp, Icons } from '../../constants';
import { DarkThemeColors } from '../../themes';

interface AttendanceRecord {
  Timestamp: string | number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string;
  DateOfPunch?: string;
  CreatedOn?: string | number;
  LatLon?: string;
  Address?: string;
  [key: string]: any;
}

interface DayAttendanceItemProps {
  date: string;
  records: AttendanceRecord[];
  onPress?: () => void;
  onDetailPress?: () => void;
  attendanceStatus?: 'PRESENT' | 'ABSENT' | 'PARTIAL';
  totalDuration?: string;
  breakDuration?: string;
}

const DayAttendanceItem: React.FC<DayAttendanceItemProps> = ({
  date,
  records,
  onPress,
  onDetailPress,
  attendanceStatus,
  totalDuration,
  breakDuration,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort records by timestamp
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const timeA = typeof a.Timestamp === 'string' ? parseInt(a.Timestamp, 10) : a.Timestamp;
      const timeB = typeof b.Timestamp === 'string' ? parseInt(b.Timestamp, 10) : b.Timestamp;
      return timeA - timeB;
    });
  }, [records]);

  // Find FIRST check-in and LAST check-out
  const firstCheckIn = useMemo(() => {
    return sortedRecords.find(r => r.PunchDirection === 'IN');
  }, [sortedRecords]);

  const lastCheckOut = useMemo(() => {
    const outRecords = sortedRecords.filter(r => r.PunchDirection === 'OUT');
    return outRecords.length > 0 ? outRecords[outRecords.length - 1] : null;
  }, [sortedRecords]);

  // Determine if attendance is valid (has both check-in and check-out)
  const isValidAttendance = useMemo(() => {
    if (attendanceStatus === 'PRESENT') return true;
    if (attendanceStatus === 'ABSENT') return false;
    // For PARTIAL, check if we have both check-in and check-out
    return !!firstCheckIn && !!lastCheckOut;
  }, [attendanceStatus, firstCheckIn, lastCheckOut]);

  // Calculate break duration from records
  const calculatedBreakDuration = useMemo(() => {
    if (breakDuration) {
      // If breakDuration is provided from API, use it
      return breakDuration;
    }
    
    // Calculate break duration by finding OUT punches with break status and their corresponding IN punches
    let totalBreakMinutes = 0;
    const breakStatuses = ['LUNCH', 'SHORTBREAK', 'COMMUTING', 'PERSONALTIMEOUT', 'OUTFORDINNER'];
    
    for (let i = 0; i < sortedRecords.length; i++) {
      const record = sortedRecords[i];
      if (record.PunchDirection === 'OUT' && record.AttendanceStatus && 
          breakStatuses.includes(record.AttendanceStatus.toUpperCase())) {
        // Find the next IN punch after this OUT
        const nextIn = sortedRecords.slice(i + 1).find(r => r.PunchDirection === 'IN');
        if (nextIn) {
          const outTime = typeof record.Timestamp === 'string' 
            ? moment(record.Timestamp) 
            : moment(record.Timestamp);
          const inTime = typeof nextIn.Timestamp === 'string' 
            ? moment(nextIn.Timestamp) 
            : moment(nextIn.Timestamp);
          const diff = moment.duration(inTime.diff(outTime));
          totalBreakMinutes += diff.asMinutes();
        }
      }
    }
    
    const hours = Math.floor(totalBreakMinutes / 60);
    const minutes = Math.floor(totalBreakMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
  }, [sortedRecords, breakDuration]);

  // Calculate total duration if not provided
  const calculatedTotalDuration = useMemo(() => {
    if (totalDuration) {
      return totalDuration;
    }
    if (!firstCheckIn || !lastCheckOut) return null;
    const inTime = typeof firstCheckIn.Timestamp === 'string' 
      ? moment(firstCheckIn.Timestamp) 
      : moment(firstCheckIn.Timestamp);
    const outTime = typeof lastCheckOut.Timestamp === 'string' 
      ? moment(lastCheckOut.Timestamp) 
      : moment(lastCheckOut.Timestamp);
    const diff = moment.duration(outTime.diff(inTime));
    const hours = Math.floor(diff.asHours());
    const minutes = diff.minutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
  }, [firstCheckIn, lastCheckOut, totalDuration]);

  // Format date header (e.g., "8 Apr" or "9 Apr")
  const dateHeader = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    return dateMoment.format('D MMM');
  }, [date]);

  // Format day of week (e.g., "Sun" or "Mon")
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

  // Format time with date for check-in (e.g., "11:30 In |")
  const formatTimeIn = (timestamp: string | number): string => {
    const timeMoment = typeof timestamp === 'string' 
      ? moment(timestamp) 
      : moment(timestamp);
    const time = timeMoment.format('HH:mm');
    return `${time} In |`;
  };

  // Format time with date for check-out (e.g., "22:30 Out | 9 Apr")
  const formatTimeOut = (timestamp: string | number): string => {
    const timeMoment = typeof timestamp === 'string' 
      ? moment(timestamp) 
      : moment(timestamp);
    const time = timeMoment.format('HH:mm');
    const dateStr = timeMoment.format('D MMM');
    return `${time} Out | ${dateStr}`;
  };

  // Format date only (e.g., "9 Apr")
  const formatDateOnly = (timestamp: string | number): string => {
    const timeMoment = typeof timestamp === 'string' 
      ? moment(timestamp) 
      : moment(timestamp);
    return timeMoment.format('D MMM');
  };

  // Format time only (e.g., "10:30")
  const formatTimeOnly = (timestamp: string | number): string => {
    const timeMoment = typeof timestamp === 'string' 
      ? moment(timestamp) 
      : moment(timestamp);
    return timeMoment.format('HH:mm');
  };

  const handlePress = () => {
    setIsExpanded(!isExpanded);
    onPress?.();
  };

  const handleDetailPress = () => {
    onDetailPress?.();
  };

  // Determine border color
  const borderColor = isValidAttendance ? '#62C268' : '#FF4444';
  const hasAttendance = !!firstCheckIn || !!lastCheckOut;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isExpanded && styles.containerExpanded,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Main Content Container - Color bar only applies to this section */}
      <View style={styles.mainContentWrapper}>
        {/* Colored vertical bar on the left - green for valid, red for invalid - only for main item */}
        {hasAttendance && <View style={[styles.colorBar, { backgroundColor: borderColor }]} />}

        <View style={[styles.content, hasAttendance && styles.contentWithBar]}>
        {/* Left: Date Section */}
        <View style={styles.dateSection}>
          <AppText size={22.7635} color={DarkThemeColors.white_common} style={styles.dateText}>
            {dateHeader}
          </AppText>
          <AppText size={16.8252} color="#A5A5A5" style={styles.dayText}>
            {dayOfWeek}
          </AppText>
          {isToday && (
            <AppText size={16.8252} color="#62C268" style={styles.todayText}>
              Today
            </AppText>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Right: Times and Info */}
        <View style={styles.infoSection}>
          {/* Check-in/Check-out Times - Show FIRST check-in and LAST check-out */}
          <View style={styles.timesContainer}>
            {firstCheckIn ? (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={styles.clockIcon}
                  resizeMode="contain"
                />
                <AppText size={15} color={DarkThemeColors.white_common} style={styles.timeText}>
                  {formatTimeIn(firstCheckIn.Timestamp)}
                </AppText>
                <AppText size={15} color={DarkThemeColors.white_common} style={styles.dateTextSmall}>
                  {formatDateOnly(firstCheckIn.Timestamp)}
                </AppText>
              </View>
            ) : (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={styles.clockIcon}
                  resizeMode="contain"
                />
                <AppText size={15} color={DarkThemeColors.white_common} style={styles.missingText}>
                  -- In
                </AppText>
              </View>
            )}

            {lastCheckOut ? (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={styles.clockIcon}
                  resizeMode="contain"
                />
                <AppText size={15} color={DarkThemeColors.white_common} style={styles.timeText}>
                  {formatTimeOut(lastCheckOut.Timestamp)}
                </AppText>
              </View>
            ) : (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={styles.clockIcon}
                  resizeMode="contain"
                />
                <AppText size={15} color={DarkThemeColors.white_common} style={styles.missingText}>
                  -- Out
                </AppText>
              </View>
            )}
          </View>

          {/* Duration Info - always show if has both check-in and check-out */}
          {calculatedTotalDuration && (
            <View style={styles.durationInfo}>
              <AppText size={15} color="#888888" style={styles.durationLabel}>
                Total Duration:{' '}
                <AppText size={15} color="#FFFFFF" style={styles.durationValue}>
                  {calculatedTotalDuration}
                </AppText>
              </AppText>
              <AppText size={15} color="#888888" style={styles.breakLabel}>
                Break:{' '}
                <AppText size={15} color="#FFFFFF" style={styles.breakValue}>
                  {calculatedBreakDuration}
                </AppText>
              </AppText>
            </View>
          )}
        </View>

        {/* Map Pin Button */}
        <TouchableOpacity
          onPress={handleDetailPress}
          style={styles.mapPinButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.mapPinButtonInner, !hasAttendance && styles.mapPinButtonDisabled]}>
            <Image
              source={Icons.daymap}
              style={styles.mapPinIcon}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>
      </View>

      {/* Expanded View - Show all records with clock icon */}
      {isExpanded && sortedRecords.length > 0 && (
        <>
          <View style={styles.expandedDivider} />
          <View style={styles.expandedContainer}>
            {sortedRecords.map((record, index) => {
              // Get break label if it's a break
              const isBreakRecord = record.PunchDirection === 'OUT' && record.AttendanceStatus && 
                ['LUNCH', 'SHORTBREAK', 'COMMUTING', 'PERSONALTIMEOUT', 'OUTFORDINNER'].includes(record.AttendanceStatus.toUpperCase());
              
              const getBreakLabel = (status?: string): string => {
                if (!status) return '';
                const statusUpper = status.toUpperCase();
                switch (statusUpper) {
                  case 'LUNCH': return 'Lunch';
                  case 'SHORTBREAK': return 'Short Break';
                  case 'COMMUTING': return 'Commuting';
                  case 'PERSONALTIMEOUT': return 'Personal Timeout';
                  case 'OUTFORDINNER': return 'Out for Dinner';
                  default: return '';
                }
              };

              const breakLabel = isBreakRecord ? getBreakLabel(record.AttendanceStatus) : '';

              return (
                <View key={`${record.Timestamp}-${index}`} style={styles.expandedRecordItem}>
                  <Image
                    source={Icons.clock}
                    style={styles.expandedClockIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.expandedTextContainer}>
                    <AppText size={15} color={DarkThemeColors.white_common} style={styles.expandedTimeText}>
                      {formatTimeOnly(record.Timestamp)} {record.PunchDirection === 'IN' ? 'In' : 'Out'} | {formatDateOnly(record.Timestamp)}
                    </AppText>
                  </View>
                  {breakLabel && (
                    <AppText size={13} color="#FF9800" style={styles.expandedBreakText}>
                      {breakLabel}
                    </AppText>
                  )}
                </View>
              );
            })}
            {/* Total Duration and Break at the bottom of expanded section */}
            {calculatedTotalDuration && (
              <View style={styles.expandedDurationContainer}>
                <AppText size={15} color="#888888" style={styles.expandedDurationLabel}>
                  Total Duration:{' '}
                  <AppText size={15} color="#FFFFFF" style={styles.expandedDurationValue}>
                    {calculatedTotalDuration}
                  </AppText>
                </AppText>
                <AppText size={15} color="#888888" style={styles.expandedBreakLabel}>
                  Break:{' '}
                  <AppText size={15} color="#FFFFFF" style={styles.expandedBreakValue}>
                    {calculatedBreakDuration}
                  </AppText>
                </AppText>
              </View>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 117,
    marginVertical: hp(1),
    marginHorizontal: wp(4.53), // Padding from screen edges (17px / 375px * 100)
    borderRadius: 10,
    backgroundColor: '#272727',
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  containerExpanded: {
    minHeight: 117,
  },
  mainContentWrapper: {
    position: 'relative',
    minHeight: 117,
  },
  colorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 5,
    height: '100%',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  content: {
    flexDirection: 'row',
    padding: hp(2),
    paddingHorizontal: wp(5), // Decent padding on both sides
    position: 'relative',
    minHeight: 117,
  },
  contentWithBar: {
    paddingLeft: hp(2.5), // Extra padding when color bar is present
  },
  dateSection: {
    width: 74, // 36px to 110px = 74px
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: hp(1),
  },
  dateText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 22.7635,
    lineHeight: 31,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  dayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 16.8252,
    lineHeight: 23,
    textAlign: 'center',
    color: '#A5A5A5',
    marginTop: hp(0.3),
  },
  todayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 16.8252,
    lineHeight: 23,
    textAlign: 'center',
    color: '#62C268',
    marginTop: hp(0.3),
  },
  divider: {
    width: 1,
    height: 53,
    backgroundColor: '#444444',
    marginHorizontal: wp(2.67), // 10px
    alignSelf: 'center',
  },
  infoSection: {
    flex: 1,
    paddingLeft: wp(2.67), // 10px
    paddingTop: hp(1),
  },
  timesContainer: {
    gap: hp(0.5),
    marginBottom: hp(1),
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  clockIcon: {
    width: 16,
    height: 16,
    tintColor: DarkThemeColors.white_common,
  },
  timeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  dateTextSmall: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  missingText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  durationInfo: {
    gap: hp(0.3),
    marginTop: hp(0.5),
  },
  durationLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#888888',
  },
  durationValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  breakLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#888888',
  },
  breakValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  expandedDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#444444',
    marginVertical: hp(1),
  },
  expandedContainer: {
    gap: hp(0.5),
    marginTop: hp(0.5),
    paddingHorizontal: wp(5), // Match container padding
    alignItems: 'flex-start', // Left align all items
  },
  expandedRecordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(0.5),
    width: '100%',
    gap: wp(1.5),
  },
  expandedClockIcon: {
    width: 16,
    height: 16,
    tintColor: DarkThemeColors.white_common,
  },
  expandedTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  expandedTimeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  expandedBreakText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: '#FF9800',
    textAlign: 'right',
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  expandedDurationContainer: {
    marginTop: hp(1),
    paddingTop: hp(0.5),
    paddingBottom: hp(1.5), // Bottom padding after duration
    borderTopWidth: 1,
    borderTopColor: '#444444',
    width: '100%',
    gap: hp(0.3),
  },
  expandedDurationLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#888888',
    textAlign: 'left',
  },
  expandedDurationValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  expandedBreakLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#888888',
    textAlign: 'left',
  },
  expandedBreakValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  mapPinButton: {
    position: 'absolute',
    right: wp(2.67), // 10px
    top: hp(1.5), // ~12px
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinButtonInner: {
    width: 24,
    height: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapPinButtonDisabled: {
    opacity: 0.5,
  },
  mapPinIcon: {
    width: 24,
    height: 24,
  },
});

export default DayAttendanceItem;
