import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation, CommonActions, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';

import { AppButton, AppMap, AppText, BackHeader, EarlyCheckoutModal } from '../../components';
import {
  hp,
  wp,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
} from '../../constants';
import Geolocation from '@react-native-community/geolocation';
import {
  requestLocationPermission,
  watchUserLocation,
  getLocationFromLatLon,
  isLocationEnabled,
  cancelBreakReminderNotifications,
} from '../../services';
import { useAppDispatch, useAppSelector } from '../../redux';
import { setUserLocationRegion } from '../../redux';
import { insertAttendancePunchRecord } from '../../services';
import moment from 'moment';
import { PUNCH_DIRECTIONS } from '../../constants/location';
import { useTranslation } from '../../hooks/useTranslation';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export default function CheckInScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const mapRef = useRef<MapView>(null);

  const userLocationRegion = useAppSelector(
    state => state.userState.userLocationRegion,
  );
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState<boolean>(false);
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState<boolean>(false);

  const isUserCheckedIn = useMemo(() => {
    return userLastAttendance?.PunchDirection === PUNCH_DIRECTIONS.in;
  }, [userLastAttendance?.PunchDirection]);

  const stopWatching = useCallback((): void => {
    // watchIdRef is not needed here as watchUserLocation handles it internally
    // Just clear any existing watch
  }, []);

  const handleLocationUpdate = useCallback(
    (coords: Coordinates): void => {
      console.log('handleLocationUpdate: Called with coords:', coords);
      if (!coords) {
        console.log('handleLocationUpdate: No coords, returning');
        return;
      }

      console.log('handleLocationUpdate: Processing location:', coords.latitude, coords.longitude);
      const locationRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: coords.latitudeDelta || ZOOM_IN_DELTA,
        longitudeDelta: coords.longitudeDelta || ZOOM_IN_DELTA,
      };

      console.log('handleLocationUpdate: Dispatching location region');
      dispatch(setUserLocationRegion(locationRegion));
      setIsFetchingLocation(false);

      // Fetch address immediately when location is available using Google API
      if (coords.latitude && coords.longitude) {
        console.log('handleLocationUpdate: Fetching address from Google API for:', coords.latitude, coords.longitude);
        setIsFetchingAddress(true);
        getLocationFromLatLon(coords.latitude, coords.longitude)
          .then((address) => {
            console.log('handleLocationUpdate: Address fetched from Google API:', address);
            setCurrentAddress(address);
            setIsFetchingAddress(false);
          })
          .catch((error) => {
            console.log('handleLocationUpdate: Error fetching address from Google API:', error);
            setCurrentAddress(null);
            setIsFetchingAddress(false);
          });
      } else {
        console.log('handleLocationUpdate: Missing latitude or longitude');
      }

      if (mapRef.current) {
        console.log('handleLocationUpdate: Animating map to region');
        // Focus on current location when location updates
        mapRef.current.animateToRegion(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: ZOOM_IN_DELTA,
            longitudeDelta: ZOOM_IN_DELTA,
          },
          1000,
        );
      } else {
        console.log('handleLocationUpdate: mapRef.current is null');
      }
    },
    [dispatch],
  );

  const onCancelPress = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const startWatching = useCallback(async (): Promise<void> => {
    console.log('startWatching: Starting location watch');
    const granted = await requestLocationPermission(onCancelPress);
    if (!granted) {
      console.log('startWatching: Permission denied');
      setPermissionDenied(true);
      return;
    }

    stopWatching();
    const isLocationOn = await isLocationEnabled();
    if (isLocationOn) {
      console.log('startWatching: Location is enabled, fetching current position and starting watch');
      setIsFetchingLocation(true);
      
      // Get current position first (this will call handleLocationUpdate immediately)
      Geolocation.getCurrentPosition(
        (position) => {
          console.log('startWatching: Current position received:', position.coords);
          handleLocationUpdate(position.coords);
        },
        (error) => {
          console.log('startWatching: Error getting current position:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
      
      // Then start watching for updates
      watchUserLocation(handleLocationUpdate);
    } else {
      console.log('startWatching: Location is not enabled');
      navigation.goBack();
    }
  }, [handleLocationUpdate, stopWatching, onCancelPress, navigation]);

  useEffect(() => {
    startWatching();
    return stopWatching;
  }, [startWatching, stopWatching]);

  // Fetch address when location region changes (backup/retry mechanism)
  useEffect(() => {
    const fetchAddress = async (): Promise<void> => {
      // Always try to fetch address if we have location and don't have address yet
      if (
        userLocationRegion?.latitude &&
        userLocationRegion?.longitude &&
        !isFetchingLocation
      ) {
        // Only fetch if we don't already have an address
        if (currentAddress) {
          console.log('useEffect: Address already exists, skipping fetch');
          return;
        }

        console.log('useEffect: Fetching address from Google API for:', 
          userLocationRegion.latitude, userLocationRegion.longitude);
        setIsFetchingAddress(true);
        try {
          // Use Google API to get address
          const address = await getLocationFromLatLon(
            userLocationRegion.latitude,
            userLocationRegion.longitude,
          );
          console.log('useEffect: Address fetched from Google API:', address);
          setCurrentAddress(address);
          
          // Focus map on current location when address is fetched
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: userLocationRegion.latitude,
                longitude: userLocationRegion.longitude,
                latitudeDelta: ZOOM_IN_DELTA,
                longitudeDelta: ZOOM_IN_DELTA,
              },
              500,
            );
          }
        } catch (error) {
          console.log('useEffect: Error fetching address from Google API:', error);
          setCurrentAddress(null);
        } finally {
          setIsFetchingAddress(false);
        }
      } else {
        console.log('useEffect: Skipping address fetch - isFetchingLocation:', isFetchingLocation, 
          'hasLocation:', !!userLocationRegion?.latitude);
      }
    };

    // Fetch address when location is ready
    fetchAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocationRegion?.latitude, userLocationRegion?.longitude, isFetchingLocation]);

  const onRefreshMap = useCallback((): void => {
    if (!mapRef.current || !userLocationRegion) return;

    mapRef.current.animateToRegion(
      {
        ...userLocationRegion,
        latitudeDelta: ZOOM_OUT_DELTA,
        longitudeDelta: ZOOM_OUT_DELTA,
      },
      1000,
    );

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...userLocationRegion,
            latitudeDelta: ZOOM_IN_DELTA,
            longitudeDelta: ZOOM_IN_DELTA,
          },
          1000,
        );
      }
    }, 1000);
  }, [userLocationRegion]);

  const getCurrentDate = (): string => moment().format('YYYY-MM-DD');
  const getCurrentTimestampFormatted = useCallback((): string => {
    // Capture timestamp with timezone offset
    return moment().format('YYYY-MM-DDTHH:mm:ss');
  }, []);

  // Calculate hours worked from check-in time
  const hoursWorked = useMemo((): number => {
    if (!isUserCheckedIn || !userLastAttendance?.CreatedOn) {
      return 0;
    }

    try {
      // Parse check-in time (can be string or number)
      let checkInTime: moment.Moment;
      if (typeof userLastAttendance.CreatedOn === 'string') {
        checkInTime = moment(userLastAttendance.CreatedOn);
      } else if (typeof userLastAttendance.CreatedOn === 'number') {
        checkInTime = moment(userLastAttendance.CreatedOn);
      } else {
        return 0;
      }

      // Calculate difference in hours
      const now = moment();
      const hours = now.diff(checkInTime, 'hours', true); // true for decimal precision
      return hours;
    } catch (error) {
      console.log('Error calculating hours worked:', error);
      return 0;
    }
  }, [isUserCheckedIn, userLastAttendance?.CreatedOn]);

  const onCheckInPress = useCallback((): void => {
    // If checking out and hours worked is less than 9, show early checkout modal
    if (isUserCheckedIn && hoursWorked < 9) {
      setShowEarlyCheckoutModal(true);
      return;
    }

    // Proceed with normal check-in/check-out
    const currentTimeTS = getCurrentTimestampFormatted();
    const currentDate = getCurrentDate();

    insertAttendancePunchRecord({
      timestamp: currentTimeTS,
      orgID: '123',
      userID: userData?.email || '',
      punchType: 'CHECK',
      punchDirection: isUserCheckedIn
        ? PUNCH_DIRECTIONS.out
        : PUNCH_DIRECTIONS.in,
      latLon: userLocationRegion
        ? `${userLocationRegion.latitude?.toFixed(
            4,
          )},${userLocationRegion.longitude?.toFixed(4)}`
        : '',
      address: currentAddress || '',
      createdOn: currentTimeTS,
      isSynced: 'N',
      dateOfPunch: currentDate,
      attendanceStatus: '',
      moduleID: '',
      tripType: '',
      passengerID: '',
      allowanceData: JSON.stringify([]),
      isCheckoutQrScan: 0,
      travelerName: '',
      phoneNumber: '',
    });

    // Cancel break notifications when checking in (returning from break)
    if (isUserCheckedIn) {
      cancelBreakReminderNotifications();
    }

    // Navigate to DashboardScreen (home) and reset the stack
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'DashboardScreen' }],
      }),
    );
  }, [
    userLocationRegion,
    isUserCheckedIn,
    userData?.email,
    navigation,
    currentAddress,
    getCurrentTimestampFormatted,
    hoursWorked,
  ]);

  const handleBreakStatusSelect = useCallback(
    (status: string): void => {
      setShowEarlyCheckoutModal(false);
      const currentTimeTS = getCurrentTimestampFormatted();
      const currentDate = getCurrentDate();

      insertAttendancePunchRecord({
        timestamp: currentTimeTS,
        orgID: '123',
        userID: userData?.email || '',
        punchType: 'CHECK',
        punchDirection: PUNCH_DIRECTIONS.out,
        latLon: userLocationRegion
          ? `${userLocationRegion.latitude?.toFixed(
              4,
            )},${userLocationRegion.longitude?.toFixed(4)}`
          : '',
        address: currentAddress || '',
        createdOn: currentTimeTS,
        isSynced: 'N',
        dateOfPunch: currentDate,
        attendanceStatus: status.toUpperCase(), // Mark with selected break status
        moduleID: '',
        tripType: '',
        passengerID: '',
        allowanceData: JSON.stringify([]),
        isCheckoutQrScan: 0,
        travelerName: '',
        phoneNumber: '',
      });

      // Navigate to DashboardScreen (home) and reset the stack
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'DashboardScreen' }],
        }),
      );
    },
    [
      userLocationRegion,
      userData?.email,
      navigation,
      currentAddress,
      getCurrentTimestampFormatted,
    ],
  );

  const handleSkip = useCallback((): void => {
    setShowEarlyCheckoutModal(false);
    const currentTimeTS = getCurrentTimestampFormatted();
    const currentDate = getCurrentDate();

    insertAttendancePunchRecord({
      timestamp: currentTimeTS,
      orgID: '123',
      userID: userData?.email || '',
      punchType: 'CHECK',
      punchDirection: PUNCH_DIRECTIONS.out,
      latLon: userLocationRegion
        ? `${userLocationRegion.latitude?.toFixed(
            4,
          )},${userLocationRegion.longitude?.toFixed(4)}`
        : '',
      address: currentAddress || '',
      createdOn: currentTimeTS,
      isSynced: 'N',
      dateOfPunch: currentDate,
      attendanceStatus: 'EARLY_CHECKOUT', // Mark as early checkout when skipped
      moduleID: '',
      tripType: '',
      passengerID: '',
      allowanceData: JSON.stringify([]),
      isCheckoutQrScan: 0,
      travelerName: '',
      phoneNumber: '',
    });

    // Navigate to DashboardScreen (home) and reset the stack
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'DashboardScreen' }],
      }),
    );
  }, [
    userLocationRegion,
    userData?.email,
    navigation,
    currentAddress,
    getCurrentTimestampFormatted,
  ]);

  const buttonText = useMemo(() => {
    if (isFetchingLocation || isFetchingAddress) {
      return t('attendance.fetchingLocation') || 'Fetching Location...';
    }
    if (permissionDenied) {
      return t('attendance.locationPermissionRequired') || 'Location Permission Required';
    }
    if (isUserCheckedIn) {
      return 'Confirm Check Out';
    }
    return 'Confirm CheckIn';
  }, [isUserCheckedIn, isFetchingLocation, isFetchingAddress, permissionDenied, t]);

  const handleClosePress = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const appTheme = useAppSelector(state => state.appState.appTheme);

  // Button styles based on check-in/check-out state
  const buttonStyle = useMemo<{
    backgroundColor: string;
    borderRadius: number;
    borderWidth?: number;
    borderColor?: string;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
  }>(() => {
    if (isUserCheckedIn) {
      // Check-out button: white background in dark mode, theme card in light mode
      return {
        backgroundColor: appTheme === APP_THEMES.dark ? DarkThemeColors.white_common : (colors.card || LightThemeColors.white_common),
        borderRadius: 7,
        borderWidth: 1,
        borderColor: colors.border || colors.text,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
      };
    } else {
      // Check-in: Green button with white text, shadow, and glossy feel
      return {
        backgroundColor: '#62C268',
        borderRadius: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 10,
      };
    }
  }, [isUserCheckedIn, colors.card, colors.border, colors.text, appTheme]);

  const buttonTextColor = useMemo(() => {
    if (isUserCheckedIn) {
      // Check-out button: dark text in dark mode (white background), dark text in light mode
      return '#000000';
    }
    // Check-in: always white text
    return '#FFFFFF';
  }, [isUserCheckedIn]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background}
      />
      <BackHeader
        bgColor={colors.background}
        title={isUserCheckedIn ? 'Check Out' : 'Check In'}
        rightContent={
          <TouchableOpacity
            onPress={handleClosePress}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <AppText style={styles.closeIcon} color={colors.text}>
              ✕
            </AppText>
          </TouchableOpacity>
        }
      />

      {userLocationRegion ? (
        <AppMap
          ref={mapRef}
          region={userLocationRegion}
          style={styles.map}
          isRefreshButton={!isFetchingLocation && !isFetchingAddress}
          onRefreshPress={onRefreshMap}
          onMapReady={() => {
            // Focus on current location when map is ready
            if (mapRef.current && userLocationRegion) {
              mapRef.current.animateToRegion(
                {
                  latitude: userLocationRegion.latitude,
                  longitude: userLocationRegion.longitude,
                  latitudeDelta: ZOOM_IN_DELTA,
                  longitudeDelta: ZOOM_IN_DELTA,
                },
                500,
              );
            }
          }}
        />
      ) : (
        <View style={[styles.map, styles.mapPlaceholder, { backgroundColor: colors.background }]}>
          <AppText color={colors.text} size={hp(2)}>
            {t('attendance.fetchingLocation')}
          </AppText>
        </View>
      )}

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom || hp(2), backgroundColor: colors.background }]}>
        <View style={styles.addressContainer}>
          {permissionDenied ? (
            <AppText color="#FF0000" style={styles.addressText}>
              {t('attendance.locationPermissionDenied')}
            </AppText>
          ) : isFetchingLocation || isFetchingAddress ? (
            <AppText style={styles.addressText} color={colors.text}>
              {t('attendance.fetchingLocation')}
            </AppText>
          ) : currentAddress ? (
            <AppText style={styles.addressText} color={colors.text}>
              {currentAddress}
            </AppText>
          ) : (
            <AppText style={styles.addressText} color={colors.text}>
              {userLocationRegion?.latitude?.toFixed(4)},{' '}
              {userLocationRegion?.longitude?.toFixed(4)}
            </AppText>
          )}
        </View>

        <AppButton
          disabled={isFetchingLocation || permissionDenied || !userLocationRegion?.latitude || !userLocationRegion?.longitude}
          title={buttonText}
          titleColor={buttonTextColor}
          titleSize={hp(2.24)} // Standard button text size
          loading={isFetchingLocation || isFetchingAddress}
          style={{
            ...styles.checkInButton,
            backgroundColor: buttonStyle.backgroundColor,
            borderRadius: buttonStyle.borderRadius,
            borderWidth: buttonStyle.borderWidth,
            borderColor: buttonStyle.borderColor,
            shadowColor: buttonStyle.shadowColor,
            shadowOffset: buttonStyle.shadowOffset,
            shadowOpacity: buttonStyle.shadowOpacity,
            shadowRadius: buttonStyle.shadowRadius,
            elevation: buttonStyle.elevation,
          }}
          borderRadius={buttonStyle.borderRadius}
          onPress={onCheckInPress}
        />
      </View>

      <EarlyCheckoutModal
        visible={showEarlyCheckoutModal}
        hoursWorked={hoursWorked}
        onSelectBreakStatus={handleBreakStatusSelect}
        onSkip={handleSkip}
        onCancel={() => setShowEarlyCheckoutModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(5.33), // 19.97px from Figma (19.97/375 = 5.33%)
    paddingTop: hp(2.5),
  },
  addressContainer: {
    width: wp(87.7), // 328.95px from Figma
    minHeight: hp(6), // 48.63px from Figma
    marginBottom: hp(1.5),
    justifyContent: 'center',
    alignSelf: 'center',
  },
  addressText: {
    fontSize: hp(1.8),
    lineHeight: hp(2.4),
    textAlign: 'left',
  },
  checkInButton: {
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(1),
    overflow: 'visible', // Allow shadow to be visible
  },
  closeButton: {
    width: hp(2.48),
    height: hp(2.48),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: hp(1.86),
  },
  closeIcon: {
    fontSize: hp(2.5),
    fontWeight: '300',
  },
});
