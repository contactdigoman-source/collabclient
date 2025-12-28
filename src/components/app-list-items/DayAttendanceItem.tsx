import React, { useState, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import moment from 'moment';
import { formatUTCForDisplay } from '../../utils/time-utils';

import AppText from '../app-texts/AppText';
import { hp, wp, Icons } from '../../constants';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useAppSelector } from '../../redux';
import { useTranslation } from '../../hooks/useTranslation';

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
  attendanceStatus?: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'HOURS_DEFICIT' | 'PENDING_APPROVAL';
  totalDuration?: string;
  breakDuration?: string;
  workedHours?: number;
  requiresApproval?: boolean;
  // New fields for shift display
  shiftStart?: string;      // "HH:mm" - stored shift from record
  shiftEnd?: string;        // "HH:mm" - stored shift from record
  minimumHours?: number;    // Minimum hours for this day
  linkedEntryDate?: string; // For overnight shifts - links to primary entry date
}

/**
 * Calculate status color based on attendanceStatus and requiresApproval
 * 
 * Rules:
 * - YELLOW: Requires approval (forgot checkout, manual correction)
 * - RED: Hours deficit (PARTIAL/HOURS_DEFICIT without approval) OR ABSENT (no check-in)
 * - GREEN: Valid attendance (PRESENT without approval)
 */
const getStatusColor = (
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'HOURS_DEFICIT' | 'PENDING_APPROVAL' | undefined,
  requiresApproval: boolean,
): 'GREEN' | 'RED' | 'YELLOW' => {
  // YELLOW takes priority - if approval is required (for any status)
  if (requiresApproval || attendanceStatus === 'PENDING_APPROVAL') {
    return 'YELLOW';
  }
  
  // RED - hours deficit (PARTIAL/HOURS_DEFICIT without approval) or ABSENT (no check-in)
  if (attendanceStatus === 'PARTIAL' || attendanceStatus === 'HOURS_DEFICIT' || attendanceStatus === 'ABSENT') {
    return 'RED';
  }
  
  // GREEN - valid attendance (PRESENT without approval)
  return 'GREEN';
};

const DayAttendanceItem: React.FC<DayAttendanceItemProps> = ({
  date,
  records,
  onPress,
  onDetailPress,
  attendanceStatus,
  totalDuration,
  breakDuration,
  workedHours: _workedHours, // Renamed to indicate intentionally unused
  requiresApproval = false,
  shiftStart,
  shiftEnd,
  minimumHours,
  linkedEntryDate,
}) => {
  const theme = useTheme();
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate status color dynamically
  // Special case: If today is within shift window and has check-in, show GREEN (even if PARTIAL)
  const statusColor = useMemo(() => {
    // If today is within shift window AND has check-in, show GREEN
    if (isTodayWithinShiftWindow && firstCheckIn) {
      // Override to show GREEN if check-in is present (even if status is PARTIAL)
      if (attendanceStatus === 'PARTIAL' || attendanceStatus === 'ABSENT') {
        return 'GREEN'; // Show green if check-in is present and today is within shift window
      }
    }
    // For other cases, use normal status color logic
    return getStatusColor(attendanceStatus, requiresApproval);
  }, [attendanceStatus, requiresApproval, isTodayWithinShiftWindow, firstCheckIn]);

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
  // Keeping for potential future use
  // const isValidAttendance = useMemo(() => {
  //   if (attendanceStatus === 'PRESENT') return true;
  //   if (attendanceStatus === 'ABSENT') return false;
  //   // For PARTIAL, check if we have both check-in and check-out
  //   return !!firstCheckIn && !!lastCheckOut;
  // }, [attendanceStatus, firstCheckIn, lastCheckOut]);

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
          // Timestamps are UTC ticks - use moment.utc() to interpret as UTC, then convert to local for calculations
          const outTime = moment.utc(record.Timestamp).local(); // UTC ticks → local time
          const inTime = moment.utc(nextIn.Timestamp).local(); // UTC ticks → local time
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
    
    // Simple calculation: last checkout - first checkin (in milliseconds)
    const firstCheckInTime = typeof firstCheckIn.Timestamp === 'string' 
      ? parseInt(firstCheckIn.Timestamp, 10) 
      : firstCheckIn.Timestamp;
    const lastCheckOutTime = typeof lastCheckOut.Timestamp === 'string' 
      ? parseInt(lastCheckOut.Timestamp, 10) 
      : lastCheckOut.Timestamp;
    
    const diffMs = lastCheckOutTime - firstCheckInTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
  }, [firstCheckIn, lastCheckOut, totalDuration]);

  // Format date header (e.g., "8 Apr" or "9 Apr")
  const dateHeader = useMemo(() => {
    // Date strings (YYYY-MM-DD) are date-only, can format directly
    const dateMoment = moment(date, 'YYYY-MM-DD');
    return dateMoment.format('D MMM');
  }, [date]);

  // Format day of week (e.g., "Sun" or "Mon")
  const dayOfWeek = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    return dateMoment.format('ddd');
  }, [date]);

  // Check if today (compare dates using UTC for consistency)
  const isToday = useMemo(() => {
    // Date string is YYYY-MM-DD format, compare using UTC
    const dateMoment = moment.utc(date, 'YYYY-MM-DD');
    const todayUTC = moment.utc().startOf('day');
    return dateMoment.isSame(todayUTC, 'day');
  }, [date]);

  // Check if today is within shift window
  const isTodayWithinShiftWindow = useMemo(() => {
    if (!isToday || !shiftStart || !shiftEnd) {
      return false;
    }

    try {
      // Parse shift times (HH:mm format)
      const [startHour, startMin] = shiftStart.split(':').map(Number);
      const [endHour, endMin] = shiftEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Get current time in IST (UTC+5:30)
      const nowUTC = moment.utc();
      const nowIST = nowUTC.clone().utcOffset(330); // IST is UTC+5:30 = 330 minutes
      const currentHour = nowIST.hour();
      const currentMin = nowIST.minute();
      const currentMinutes = currentHour * 60 + currentMin;

      // Check if shift is overnight (end < start)
      const isOvernight = endMinutes < startMinutes;

      if (isOvernight) {
        // Overnight shift: Check if current time is after shift start OR before shift end
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      } else {
        // Same-day shift: Check if current time is between start and end
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      }
    } catch (error) {
      return false;
    }
  }, [isToday, shiftStart, shiftEnd]);

  // Format time with date for check-in (e.g., "11:30 In |")
  // Timestamp is UTC ticks - convert to local time for display
  const formatTimeIn = (timestamp: string | number): string => {
    const time = formatUTCForDisplay(timestamp, 'HH:mm');
    return `${time} In |`;
  };

  // Format time with date for check-out (e.g., "22:30 Out | 9 Apr")
  // Timestamp is UTC ticks - convert to local time for display
  const formatTimeOut = (timestamp: string | number): string => {
    const time = formatUTCForDisplay(timestamp, 'HH:mm');
    const dateStr = formatUTCForDisplay(timestamp, 'D MMM');
    return `${time} Out | ${dateStr}`;
  };

  // Format date only (e.g., "9 Apr")
  // Timestamp is UTC ticks - convert to local time for display
  const formatDateOnly = (timestamp: string | number): string => {
    return formatUTCForDisplay(timestamp, 'D MMM');
  };

  // Format time only (e.g., "10:30")
  // Timestamp is UTC ticks - convert to local time for display
  const formatTimeOnly = (timestamp: string | number): string => {
    return formatUTCForDisplay(timestamp, 'HH:mm');
  };

  const handlePress = () => {
    setIsExpanded(!isExpanded);
    onPress?.();
  };

  const handleDetailPress = () => {
    onDetailPress?.();
  };

  // Determine border color based on status color
  const getStatusBorderColor = (): string => {
    switch (statusColor) {
      case 'GREEN':
        return '#62C268'; // Green - valid attendance
      case 'RED':
        return '#FF4444'; // Red - hours deficit
      case 'YELLOW':
        return '#FFA500'; // Orange/Amber - requires approval
      default:
        return '#62C268';
    }
  };
  
  const borderColor = getStatusBorderColor();
  const hasAttendance = !!firstCheckIn || !!lastCheckOut;
  // Show color bar for all days (including ABSENT days with RED)
  const showColorBar = hasAttendance || attendanceStatus === 'ABSENT' || statusColor === 'RED';

  // Get status badge text and color based on attendanceStatus (not statusColor)
  const getStatusBadge = (): { text: string; color: string } | null => {
    // Priority 1: Pending Approval (YELLOW)
    if (requiresApproval || attendanceStatus === 'PENDING_APPROVAL') {
      return { text: t('attendance.pendingApproval', 'Pending Approval'), color: '#FFA500' };
    }
    
    // Priority 2: Absent (RED) - no check-in at all
    // BUT: If today is within shift window, don't show ABSENT badge yet
    if (attendanceStatus === 'ABSENT') {
      if (isTodayWithinShiftWindow) {
        return null; // Don't show ABSENT badge if today is within shift window
      }
      return { text: t('attendance.absent', 'Absent'), color: '#FF4444' };
    }
    
    // Priority 3: Hours Deficit (RED) - checked out but insufficient hours
    if (attendanceStatus === 'HOURS_DEFICIT') {
      return { text: t('attendance.hoursDeficit', 'Hours Deficit'), color: '#FF4444' };
    }
    
    // Priority 4: Partial (RED) - missing checkout
    // BUT: If today is within shift window and has check-in, don't show PARTIAL badge (will show green)
    if (attendanceStatus === 'PARTIAL') {
      if (isTodayWithinShiftWindow && firstCheckIn) {
        return null; // Don't show PARTIAL badge if today is within shift window and has check-in
      }
      return { text: t('attendance.partial', 'Incomplete'), color: '#FF4444' };
    }
    
    // PRESENT status shows no badge (green color bar is enough)
    return null;
  };

  const statusBadge = getStatusBadge();

  // Dynamic styles for theme-aware backgrounds and borders
  const dynamicStyles = useMemo(() => ({
    container: {
      backgroundColor: (colors as any).cardBg || '#272727',
      borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
      borderColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
      shadowColor: appTheme === APP_THEMES.light ? (colors as any).black_common || '#000000' : 'transparent',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: appTheme === APP_THEMES.light ? 0.1 : 0,
      shadowRadius: appTheme === APP_THEMES.light ? 4 : 0,
      elevation: appTheme === APP_THEMES.light ? 2 : 0,
    },
    divider: {
      backgroundColor: (colors as any).separator || '#444444',
    },
  }), [colors, appTheme]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        dynamicStyles.container,
        isExpanded && styles.containerExpanded,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Main Content Container - Color bar only applies to this section */}
      <View style={styles.mainContentWrapper}>
        {/* Colored vertical bar on the left - green for valid, red for invalid/absent */}
        {showColorBar && <View style={[styles.colorBar, { backgroundColor: borderColor }]} />}

        <View style={[styles.content, showColorBar && styles.contentWithBar]}>
        {/* Left: Date Section */}
        <View style={styles.dateSection}>
          <AppText size={22.7635} color={colors.text || DarkThemeColors.white_common} style={styles.dateText}>
            {dateHeader}
          </AppText>
          <AppText size={16.8252} color={colors.text || '#A5A5A5'} style={styles.dayText}>
            {dayOfWeek}
          </AppText>
          {isToday && (
            <AppText size={16.8252} color={colors.primary || '#62C268'} style={styles.todayText}>
              Today
            </AppText>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Right: Times and Info */}
        <View style={styles.infoSection}>
          {/* Check-in/Check-out Times - Show FIRST check-in and LAST check-out */}
          <View style={styles.timesContainer}>
            {firstCheckIn ? (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={[styles.clockIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
                  resizeMode="contain"
                />
                <AppText size={15} color={colors.text || DarkThemeColors.white_common} style={styles.timeText}>
                  {formatTimeIn(firstCheckIn.Timestamp)}
                </AppText>
                <AppText size={15} color={colors.text || DarkThemeColors.white_common} style={styles.dateTextSmall}>
                  {formatDateOnly(firstCheckIn.Timestamp)}
                </AppText>
              </View>
            ) : (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={[styles.clockIcon, { tintColor: '#FF4444' }]}
                  resizeMode="contain"
                />
                <AppText size={15} color="#FF4444" style={styles.missingText}>
                  {t('attendance.inMissing', 'IN: Missing')}
                </AppText>
              </View>
            )}

            {lastCheckOut ? (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={[styles.clockIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
                  resizeMode="contain"
                />
                <AppText size={15} color={colors.text || DarkThemeColors.white_common} style={styles.timeText}>
                  {formatTimeOut(lastCheckOut.Timestamp)}
                </AppText>
              </View>
            ) : (
              <View style={styles.timeRow}>
                <Image
                  source={Icons.clock}
                  style={[styles.clockIcon, { tintColor: '#FF4444' }]}
                  resizeMode="contain"
                />
                <AppText size={15} color="#FF4444" style={styles.missingText}>
                  {t('attendance.outMissing', 'OUT: Missing')}
                </AppText>
              </View>
            )}
          </View>

          {/* Duration Info - always show if has both check-in and check-out */}
          {calculatedTotalDuration && (
            <View style={styles.durationInfo}>
              <AppText size={15} color={colors.text} style={styles.durationLabel}>
                Total Duration:{' '}
                <AppText size={15} color={colors.text} style={styles.durationValue}>
                  {calculatedTotalDuration}
                </AppText>
              </AppText>
              <AppText size={15} color={colors.text} style={styles.breakLabel}>
                Break:{' '}
                <AppText size={15} color={colors.text} style={styles.breakValue}>
                  {calculatedBreakDuration}
                </AppText>
              </AppText>
            </View>
          )}

          {/* Status Badge */}
          {statusBadge && (
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color + '20', borderColor: statusBadge.color }]}>
              <AppText size={12} color={statusBadge.color} style={styles.statusBadgeText}>
                {statusBadge.text}
              </AppText>
            </View>
          )}

          {/* Shift Info - Show stored shift times */}
          {shiftStart && shiftEnd && (
            <View style={styles.shiftInfo}>
              <AppText size={12} color={colors.text} style={styles.shiftInfoText}>
                Shift: {shiftStart} - {shiftEnd}
                {minimumHours && ` (${minimumHours}h min)`}
              </AppText>
            </View>
          )}

          {/* Overnight Linkage - Show if this is part of an overnight shift */}
          {linkedEntryDate && (
            <View style={styles.overnightLinkage}>
              <AppText size={12} color="#FFA500" style={styles.overnightText}>
                ↔ Linked to {moment(linkedEntryDate).format('D MMM')} (Overnight Shift)
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
          <View style={[styles.expandedDivider, { backgroundColor: (colors as any).separator || '#444444' }]} />
          <View style={styles.expandedContainer}>
            {sortedRecords.map((record, index) => {
              // Get break label if it's a break
              const isBreakRecord = record.PunchDirection === 'OUT' && record.AttendanceStatus && 
                ['LUNCH', 'SHORTBREAK', 'COMMUTING', 'PERSONALTIMEOUT', 'OUTFORDINNER'].includes(record.AttendanceStatus.toUpperCase());
              
              const getBreakLabel = (status?: string): string => {
                if (!status) return '';
                const statusUpper = status.toUpperCase();
                switch (statusUpper) {
                  case 'LUNCH': return t('attendance.breakStatus.lunch', 'Lunch');
                  case 'SHORTBREAK': return t('attendance.breakStatus.shortBreak', 'Short Break');
                  case 'COMMUTING': return t('attendance.breakStatus.commuting', 'Commuting');
                  case 'PERSONALTIMEOUT': return t('attendance.breakStatus.personalTimeout', 'Personal Timeout');
                  case 'OUTFORDINNER': return t('attendance.breakStatus.outForDinner', 'Out for Dinner');
                  default: return '';
                }
              };

              const breakLabel = isBreakRecord ? getBreakLabel(record.AttendanceStatus) : '';

              return (
                <View key={`${record.Timestamp}-${index}`} style={styles.expandedRecordItem}>
                  <Image
                    source={Icons.clock}
                    style={[styles.expandedClockIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
                    resizeMode="contain"
                  />
                  <View style={styles.expandedTextContainer}>
                    <AppText size={15} color={colors.text} style={styles.expandedTimeText}>
                      {formatTimeOnly(record.Timestamp)} {record.PunchDirection === 'IN' ? t('attendance.in', 'In') : t('attendance.out', 'Out')} | {formatDateOnly(record.Timestamp)}
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
              <View style={[styles.expandedDurationContainer, { borderTopColor: (colors as any).separator || '#444444' }]}>
                <AppText size={15} color={colors.text} style={styles.expandedDurationLabel}>
                  Total Duration:{' '}
                  <AppText size={15} color={colors.text} style={styles.expandedDurationValue}>
                    {calculatedTotalDuration}
                  </AppText>
                </AppText>
                <AppText size={15} color={colors.text} style={styles.expandedBreakLabel}>
                  Break:{' '}
                  <AppText size={15} color={colors.text} style={styles.expandedBreakValue}>
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
  },
  dayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 16.8252,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: hp(0.3),
  },
  todayText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 16.8252,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: hp(0.3),
  },
  divider: {
    width: 1,
    height: 53,
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
  },
  timeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
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
  statusBadge: {
    marginTop: hp(0.8),
    paddingVertical: hp(0.4),
    paddingHorizontal: wp(2),
    borderRadius: wp(1),
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Noto Sans',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
  },
  shiftInfo: {
    marginTop: hp(0.6),
    paddingTop: hp(0.6),
    borderTopWidth: 0.5,
    borderTopColor: '#888',
  },
  shiftInfoText: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  overnightLinkage: {
    marginTop: hp(0.5),
    paddingVertical: hp(0.4),
    paddingHorizontal: wp(2),
    backgroundColor: '#FFA50010',
    borderRadius: wp(1),
    borderWidth: 1,
    borderColor: '#FFA50040',
  },
  overnightText: {
    fontSize: 11,
    fontWeight: '500',
  },
  durationLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
  },
  durationValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
  },
  breakLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
  },
  breakValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
  },
  expandedDivider: {
    width: '100%',
    height: 1,
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
    width: '100%',
    gap: hp(0.3),
  },
  expandedDurationLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'left',
  },
  expandedDurationValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
  },
  expandedBreakLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'left',
  },
  expandedBreakValue: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
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
