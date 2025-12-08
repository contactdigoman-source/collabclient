import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import moment from 'moment';

import { AppText, AppMap } from '..';
import { hp, wp } from '../../constants';
import { DarkThemeColors } from '../../themes';
import { Region, ZOOM_IN_DELTA } from '../../constants/location';

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
  const mapRef = useRef<MapView>(null);

  // Get check-in record
  const checkInRecord = useMemo(() => {
    return records.find(r => r.PunchDirection === 'IN');
  }, [records]);

  // Get check-out record
  const checkOutRecord = useMemo(() => {
    return records.find(r => r.PunchDirection === 'OUT');
  }, [records]);

  // Parse all locations from records
  const allLocations = useMemo(() => {
    const locations: Array<{ coordinate: Region; record: AttendanceRecord; label: string }> = [];
    
    records.forEach((record) => {
      if (record?.LatLon) {
        try {
          const [lat, lon] = record.LatLon.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lon)) {
            const direction = record.PunchDirection === 'IN' ? 'Check In' : 'Check Out';
            const time = moment(record.Timestamp).format('HH:mm');
            locations.push({
              coordinate: {
                latitude: lat,
                longitude: lon,
                latitudeDelta: ZOOM_IN_DELTA,
                longitudeDelta: ZOOM_IN_DELTA,
              },
              record,
              label: `${direction} - ${time}`,
            });
          }
        } catch {
          // Skip invalid locations
        }
      }
    });
    
    return locations;
  }, [records]);

  // Calculate map region to fit all markers
  const mapRegion = useMemo<Region | null>(() => {
    if (allLocations.length === 0) return null;

    if (allLocations.length === 1) {
      return allLocations[0].coordinate;
    }

    // Calculate bounds to fit all markers
    const latitudes = allLocations.map(loc => loc.coordinate.latitude);
    const longitudes = allLocations.map(loc => loc.coordinate.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    // Add padding
    const latDelta = Math.max((maxLat - minLat) * 1.5, ZOOM_IN_DELTA * 2);
    const lonDelta = Math.max((maxLon - minLon) * 1.5, ZOOM_IN_DELTA * 2);

    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
  }, [allLocations]);

  // Get addresses for all records
  const addresses = useMemo(() => {
    return allLocations.map(loc => ({
      address: loc.record.Address || 'Address not available',
      label: loc.label,
      direction: loc.record.PunchDirection,
    }));
  }, [allLocations]);

  // Check if has checkout
  const hasCheckout = !!checkOutRecord;
  const statusColor = hasCheckout ? '#62C268' : '#E53131';

  // Format date
  const formattedDate = useMemo(() => {
    const dateMoment = moment(date, 'YYYY-MM-DD');
    const today = moment().startOf('day');
    
    if (dateMoment.isSame(today, 'day')) {
      return 'Today';
    } else {
      return dateMoment.format('ddd, D MMM YYYY');
    }
  }, [date]);

  // Focus map on location when modal opens
  React.useEffect(() => {
    if (visible && mapRegion && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.animateToRegion(mapRegion, 500);
      }, 100);
    }
  }, [visible, mapRegion]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { paddingTop: insets.top + hp(2) }]}>
          {/* Header */}
          <View style={styles.header}>
            <AppText size={hp(2.5)} fontType="bold" color={DarkThemeColors.white_common}>
              {formattedDate}
            </AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <AppText style={styles.closeIcon} color={DarkThemeColors.white_common}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Map View */}
          {mapRegion ? (
            <View style={styles.mapContainer}>
              <AppMap
                ref={mapRef}
                region={mapRegion}
                style={styles.map}
                onMapReady={() => {
                  if (mapRef.current && mapRegion) {
                    mapRef.current.animateToRegion(mapRegion, 500);
                  }
                }}
              >
                {allLocations.map((location, index) => (
                  <Marker
                    key={`marker-${index}`}
                    coordinate={location.coordinate}
                    title={location.label}
                  />
                ))}
              </AppMap>
            </View>
          ) : (
            <View style={[styles.mapContainer, styles.mapPlaceholder]}>
              <AppText color={DarkThemeColors.white_common}>
                Location not available
              </AppText>
            </View>
          )}

          {/* Addresses and Status */}
          <View style={[styles.detailsContainer, { paddingBottom: insets.bottom + hp(2) }]}>
            {addresses.map((addr, index) => (
              <View key={`address-${index}`} style={styles.addressSection}>
                <AppText 
                  size={hp(1.6)} 
                  color={DarkThemeColors.white_common} 
                  style={styles.addressLabel}
                >
                  {addr.label}
                </AppText>
                <AppText size={hp(1.8)} color={DarkThemeColors.white_common} style={styles.addressText}>
                  {addr.address}
                </AppText>
              </View>
            ))}

            <View style={styles.statusSection}>
              <AppText size={hp(2)} color={statusColor} style={styles.statusText}>
                {hasCheckout ? 'OD' : 'No Checkout'}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DarkThemeColors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
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
  mapContainer: {
    height: hp(40),
    width: '100%',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    backgroundColor: DarkThemeColors.grey_dark_37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    gap: hp(2),
  },
  addressSection: {
    paddingVertical: hp(1),
    marginBottom: hp(1),
  },
  addressLabel: {
    opacity: 0.7,
    marginBottom: hp(0.5),
    fontWeight: '500',
  },
  addressText: {
    lineHeight: hp(2.5),
  },
  statusSection: {
    alignItems: 'center',
    paddingVertical: hp(1),
  },
  statusText: {
    fontWeight: '600',
  },
});

