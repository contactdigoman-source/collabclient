import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import moment from 'moment';
import { Marker, Region } from 'react-native-maps';

import { AppText, AppMap } from '..';
import { hp, wp, FontTypes } from '../../constants';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useAppSelector } from '../../redux';

interface AttendanceRecord {
  Timestamp: string | number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string;
  LatLon?: string;
  Address?: string;
  DateOfPunch?: string;
  [key: string]: any;
}

interface AttendanceDetailModalProps {
  visible: boolean;
  date: string;
  records: AttendanceRecord[];
  onClose: () => void;
}

export default function AttendanceDetailModal({
  visible,
  date,
  records,
  onClose,
}: AttendanceDetailModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);

  // Debug logging
  useEffect(() => {
    if (visible) {
      console.log('[AttendanceDetailModal] Modal opened');
      console.log('[AttendanceDetailModal] Date:', date);
      console.log('[AttendanceDetailModal] Records count:', records?.length || 0);
      console.log('[AttendanceDetailModal] Records:', JSON.stringify(records, null, 2));
      if (records && records.length > 0) {
        console.log('[AttendanceDetailModal] First record:', records[0]);
      }
    }
  }, [visible, date, records]);

  // Sort records by timestamp
  const sortedRecords = useMemo(() => {
    if (!records || !Array.isArray(records) || records.length === 0) {
      console.log('[AttendanceDetailModal] No records available');
      return [];
    }
    console.log('[AttendanceDetailModal] Processing records:', records.length);
    const sorted = [...records].sort((a, b) => {
      const timeA = typeof a.Timestamp === 'string' ? parseInt(a.Timestamp, 10) : a.Timestamp;
      const timeB = typeof b.Timestamp === 'string' ? parseInt(b.Timestamp, 10) : b.Timestamp;
      console.log('[AttendanceDetailModal] Sorting:', { timeA, timeB, diff: timeA - timeB });
      return timeA - timeB;
    });
    console.log('[AttendanceDetailModal] Sorted records:', sorted.length);
    return sorted;
  }, [records]);

  // Format time (e.g., "10:30")
  const formatTime = (timestamp: string | number): string => {
    try {
      // Handle both Unix timestamp (milliseconds) and ISO string
      const timeMoment = typeof timestamp === 'string' 
        ? moment(timestamp) 
        : moment(timestamp);
      if (!timeMoment.isValid()) {
        console.warn('[AttendanceDetailModal] Invalid timestamp:', timestamp);
        return '--:--';
      }
      return timeMoment.format('HH:mm');
    } catch (error) {
      console.error('[AttendanceDetailModal] Error formatting time:', error, timestamp);
      return '--:--';
    }
  };

  // Format date with year (e.g., "7 Apr, 25")
  const formatDateWithYear = (timestamp: string | number): string => {
    try {
      const timeMoment = typeof timestamp === 'string' 
        ? moment(timestamp) 
        : moment(timestamp);
      if (!timeMoment.isValid()) {
        console.warn('[AttendanceDetailModal] Invalid timestamp for date:', timestamp);
        return '--';
      }
      return timeMoment.format('D MMM, YY');
    } catch (error) {
      console.error('[AttendanceDetailModal] Error formatting date:', error, timestamp);
      return '--';
    }
  };

  // Get address or default
  const getAddress = (record: AttendanceRecord): string => {
    return record.Address || 'Address not available';
  };

  // Parse LatLon string to get coordinates
  const parseLatLon = (latLon?: string): { latitude: number; longitude: number } | null => {
    if (!latLon) return null;
    const parts = latLon.split(',');
    if (parts.length !== 2) return null;
    const latitude = parseFloat(parts[0].trim());
    const longitude = parseFloat(parts[1].trim());
    if (isNaN(latitude) || isNaN(longitude)) return null;
    return { latitude, longitude };
  };

  // Get map region for a record
  const getMapRegion = (record: AttendanceRecord): Region => {
    const coords = parseLatLon(record.LatLon);
    if (coords) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    // Default region if no coordinates
    return {
      latitude: 22.5726,
      longitude: 88.3639,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  // Check if record is a break
  const isBreak = (record: AttendanceRecord): boolean => {
    if (record.PunchDirection !== 'OUT') return false;
    if (!record.AttendanceStatus) return false;
    const breakStatuses = ['LUNCH', 'SHORTBREAK', 'COMMUTING', 'PERSONALTIMEOUT', 'OUTFORDINNER'];
    return breakStatuses.includes(record.AttendanceStatus.toUpperCase());
  };

  // Get break label
  const getBreakLabel = (record: AttendanceRecord): string => {
    if (!isBreak(record)) return '';
    const status = record.AttendanceStatus?.toUpperCase();
    switch (status) {
      case 'LUNCH':
        return 'Lunch';
      case 'SHORTBREAK':
        return 'Short Break';
      case 'COMMUTING':
        return 'Commuting';
      case 'PERSONALTIMEOUT':
        return 'Personal Timeout';
      case 'OUTFORDINNER':
        return 'Out for Dinner';
      default:
        return 'Break';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.drawerContainer,
            {
              backgroundColor: colors.background || DarkThemeColors.black,
              borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
              borderColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
              borderTopWidth: appTheme === APP_THEMES.light ? 1 : 0,
              shadowColor: appTheme === APP_THEMES.light ? (colors as any).black_common || '#000000' : 'transparent',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: appTheme === APP_THEMES.light ? 0.2 : 0,
              shadowRadius: appTheme === APP_THEMES.light ? 8 : 0,
              elevation: appTheme === APP_THEMES.light ? 8 : 0,
            },
            { 
              paddingTop: insets.top + hp(1),
              paddingBottom: insets.bottom + hp(2),
            },
          ]}
        >
          {/* Drawer Handle - Top */}
          <View style={[
            styles.drawerHandle,
            { backgroundColor: (colors as any).separator || DarkThemeColors.white_common + '40' }
          ]} />

          {/* Header - Fixed at top after handle */}
          <View style={[
            styles.header,
            { borderBottomColor: (colors as any).separator || DarkThemeColors.white_common + '20' }
          ]}>
            <AppText size={hp(2.5)} fontType={FontTypes.bold} color={colors.text || DarkThemeColors.white_common}>
              {moment(date, 'YYYY-MM-DD').format('D MMM YYYY')}
            </AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <AppText style={styles.closeIcon} color={colors.text || DarkThemeColors.white_common}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Records List - Scrollable content below header */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={false}
            bounces={true}
            scrollEventThrottle={16}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false}
          >
            {sortedRecords.length > 0 ? sortedRecords.map((record, index) => {
              console.log('[AttendanceDetailModal] Rendering record:', index, record);
              const coords = parseLatLon(record.LatLon);
              const mapRegion = getMapRegion(record);
              const breakLabel = getBreakLabel(record);

              return (
                <View key={`record-${record.Timestamp}-${index}-${record.PunchDirection}`} style={styles.recordCard}>
                  {/* Direction Label */}
                  <AppText
                    size={hp(2)}
                    fontType={FontTypes.medium}
                    color={colors.text || DarkThemeColors.white_common}
                    style={styles.directionText}
                  >
                    {record.PunchDirection === 'IN' ? 'In' : 'Out'}: {formatTime(record.Timestamp)}
                    {breakLabel && ` (${breakLabel})`}
                  </AppText>

                  {/* Date */}
                  <AppText
                    size={hp(1.8)}
                    color={colors.text || DarkThemeColors.white_common}
                    style={styles.dateText}
                  >
                    {formatDateWithYear(record.Timestamp)}
                  </AppText>

                  {/* Map - Always show a map for each record, non-scrollable */}
                  <View style={[
                    styles.mapContainer,
                    {
                      backgroundColor: colors.background || DarkThemeColors.black,
                      borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
                      borderColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
                    }
                  ]} key={`map-${record.Timestamp}-${index}`}>
                    <AppMap
                      style={styles.map}
                      region={mapRegion}
                      key={`appmap-${record.Timestamp}-${index}`}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      {coords && (
                        <Marker
                          key={`marker-${record.Timestamp}-${index}`}
                          coordinate={coords}
                          title={record.PunchDirection === 'IN' ? 'Check In' : 'Check Out'}
                        />
                      )}
                    </AppMap>
                  </View>

                  {/* Address */}
                  <AppText
                    size={hp(1.6)}
                    color={(colors.text || DarkThemeColors.white_common) + 'CC'}
                    style={styles.addressText}
                  >
                    {getAddress(record)}
                  </AppText>

                  {/* Divider (except last item) */}
                  {index < sortedRecords.length - 1 && (
                    <View style={[
                      styles.divider,
                      { backgroundColor: (colors as any).separator || DarkThemeColors.white_common + '20' }
                    ]} />
                  )}
                </View>
              );
            }) : null}

            {sortedRecords.length === 0 && (
              <View style={styles.emptyContainer}>
                <AppText size={hp(2)} color={(colors.text || DarkThemeColors.white_common) + '80'}>
                  No attendance records available for this date
                </AppText>
                <AppText size={hp(1.5)} color={(colors.text || DarkThemeColors.white_common) + '60'} style={{ marginTop: hp(1) }}>
                  Date: {moment(date, 'YYYY-MM-DD').format('D MMM YYYY')}
                </AppText>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    flexDirection: 'column',
    width: '100%',
  },
  drawerHandle: {
    width: wp(15),
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: hp(1),
    marginBottom: hp(1),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    width: '100%',
    zIndex: 10,
  },
  closeButton: {
    width: hp(3),
    height: hp(3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: hp(2.5),
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  recordCard: {
    paddingVertical: hp(2),
    marginBottom: hp(1),
    borderRadius: 8,
    paddingHorizontal: wp(2),
  },
  directionText: {
    fontFamily: 'Noto Sans',
    fontWeight: '500',
    marginBottom: hp(0.5),
  },
  dateText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    marginBottom: hp(1),
  },
  mapContainer: {
    width: '100%',
    height: hp(20), // ~160px height for maps
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: hp(1),
  },
  map: {
    width: '100%',
    height: '100%',
  },
  addressText: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    lineHeight: hp(2.2),
  },
  divider: {
    width: '100%',
    height: 1,
    marginTop: hp(2),
  },
  emptyContainer: {
    paddingVertical: hp(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
