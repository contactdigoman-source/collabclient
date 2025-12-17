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
  clearWatch,
  getLocationFromLatLon,
  isLocationEnabled,
  cancelBreakReminderNotifications,
} from '../../services';
import { useAppDispatch, useAppSelector } from '../../redux';
import { setUserLocationRegion } from '../../redux';
import { insertAttendancePunchRecord, getAttendanceData } from '../../services';
import moment from 'moment';
import { PUNCH_DIRECTIONS } from '../../constants/location';
import { useTranslation } from '../../hooks/useTranslation';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';
import { logger } from '../../services/logger';

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
  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState<boolean>(false);
  
  // Refs to prevent infinite loops and state changes during navigation
  const addressFetchedRef = useRef<boolean>(false);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const buttonStateLockedRef = useRef<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const isWatchingRef = useRef<boolean>(false);

  const isUserCheckedIn = useMemo(() => {
    return userLastAttendance?.PunchDirection === PUNCH_DIRECTIONS.in;
  }, [userLastAttendance?.PunchDirection]);

  const stopWatching = useCallback((): void => {
    if (watchIdRef.current !== null) {
      logger.debug('stopWatching: Clearing watch', { watchId: watchIdRef.current });
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      isWatchingRef.current = false;
    }
  }, []);

  const handleLocationUpdate = useCallback(
    (coords: Coordinates): void => {
      logger.debug('handleLocationUpdate: Called with coords', { coords });
      if (!coords) {
        logger.debug('handleLocationUpdate: No coords, returning');
        return;
      }

      // Check if location has actually changed significantly (prevent unnecessary updates)
      const hasLocationChanged = !lastLocationRef.current || 
        Math.abs(lastLocationRef.current.latitude - coords.latitude) > 0.0001 ||
        Math.abs(lastLocationRef.current.longitude - coords.longitude) > 0.0001;

      if (!hasLocationChanged && !isFetchingLocation) {
        logger.debug('handleLocationUpdate: Location unchanged, skipping update');
        return;
      }

      logger.debug('handleLocationUpdate: Processing location', { latitude: coords.latitude, longitude: coords.longitude });
      const locationRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: coords.latitudeDelta || ZOOM_IN_DELTA,
        longitudeDelta: coords.longitudeDelta || ZOOM_IN_DELTA,
      };

      // Update last location ref
      lastLocationRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      logger.debug('handleLocationUpdate: Dispatching location region');
      dispatch(setUserLocationRegion(locationRegion));
      setIsFetchingLocation(false);

      // Fetch address immediately when location is available using Google API (only if not already fetched)
      if (coords.latitude && coords.longitude && !addressFetchedRef.current && !currentAddress) {
        logger.debug('handleLocationUpdate: Fetching address from Google API', { latitude: coords.latitude, longitude: coords.longitude });
        addressFetchedRef.current = true;
        setIsFetchingAddress(true);
        getLocationFromLatLon(coords.latitude, coords.longitude)
          .then((address) => {
            logger.debug('handleLocationUpdate: Address fetched from Google API', { address });
            setCurrentAddress(address);
            setIsFetchingAddress(false);
          })
          .catch((error) => {
            logger.warn('handleLocationUpdate: Error fetching address from Google API', error);
            setCurrentAddress(null);
            setIsFetchingAddress(false);
            addressFetchedRef.current = false; // Allow retry on error
          });
      } else {
        logger.debug('handleLocationUpdate: Skipping address fetch', { 
          alreadyFetched: addressFetchedRef.current, 
          hasAddress: !!currentAddress 
        });
      }

      // Only animate map on initial location or significant location change
      if (mapRef.current && (isFetchingLocation || hasLocationChanged)) {
        logger.debug('handleLocationUpdate: Animating map to region');
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
        logger.debug('handleLocationUpdate: Skipping map animation');
      }
    },
    [dispatch, isFetchingLocation, currentAddress],
  );

  const onCancelPress = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const startWatching = useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous watch starts
    if (isWatchingRef.current) {
      logger.debug('startWatching: Already watching, skipping');
      return;
    }

    logger.debug('startWatching: Starting location watch');
    const granted = await requestLocationPermission(onCancelPress);
    if (!granted) {
      logger.debug('startWatching: Permission denied');
      setPermissionDenied(true);
      return;
    }

    stopWatching();
    const isLocationOn = await isLocationEnabled();
    if (isLocationOn) {
      logger.debug('startWatching: Location is enabled, fetching current position and starting watch');
      setIsFetchingLocation(true);
      isWatchingRef.current = true;
      
      // Get current position first (this will call handleLocationUpdate immediately)
      Geolocation.getCurrentPosition(
        (position) => {
          logger.debug('startWatching: Current position received', { coords: position.coords });
          handleLocationUpdate(position.coords);
        },
        (error) => {
          logger.warn('startWatching: Error getting current position', error);
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
      
      // Then start watching for updates
      const watchId = watchUserLocation(handleLocationUpdate);
      watchIdRef.current = watchId;
      logger.debug('startWatching: Watch started', { watchId });
    } else {
      logger.debug('startWatching: Location is not enabled');
      navigation.goBack();
    }
  }, [handleLocationUpdate, stopWatching, onCancelPress, navigation]);

  useEffect(() => {
    startWatching();
    return () => {
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch address when location region changes (backup/retry mechanism) - only once on initial load
  useEffect(() => {
    const fetchAddress = async (): Promise<void> => {
      // Only fetch if we have location, don't have address, and haven't already fetched
      if (
        userLocationRegion?.latitude &&
        userLocationRegion?.longitude &&
        !isFetchingLocation &&
        !addressFetchedRef.current &&
        !currentAddress
      ) {
        logger.debug('useEffect: Fetching address from Google API', { 
          latitude: userLocationRegion.latitude, 
          longitude: userLocationRegion.longitude 
        });
        addressFetchedRef.current = true;
        setIsFetchingAddress(true);
        try {
          // Use Google API to get address
          const address = await getLocationFromLatLon(
            userLocationRegion.latitude,
            userLocationRegion.longitude,
          );
          logger.debug('useEffect: Address fetched from Google API', { address });
          setCurrentAddress(address);
        } catch (error) {
          logger.warn('useEffect: Error fetching address from Google API', error);
          setCurrentAddress(null);
          addressFetchedRef.current = false; // Allow retry on error
        } finally {
          setIsFetchingAddress(false);
        }
      } else {
        logger.debug('useEffect: Skipping address fetch', { 
          isFetchingLocation, 
          hasLocation: !!userLocationRegion?.latitude,
          alreadyFetched: addressFetchedRef.current,
          hasAddress: !!currentAddress
        });
      }
    };

    // Fetch address when location is ready (only once)
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

  const getCurrentDate = (): string => moment.utc().format('YYYY-MM-DD');
  const getCurrentTimestamp = useCallback((): number => {
    // Return UTC ticks (milliseconds since epoch UTC) - stored as BIGINT in SQLite
    // Date.now() returns UTC ticks, which is what we need for backend
    // UI will convert to local time for display using moment(timestamp)
    return moment.utc().valueOf(); // Explicitly UTC ticks
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
        checkInTime = moment.utc(userLastAttendance.CreatedOn);
      } else if (typeof userLastAttendance.CreatedOn === 'number') {
        checkInTime = moment.utc(userLastAttendance.CreatedOn);
      } else {
        return 0;
      }

      // Calculate difference in hours (UTC)
      const now = moment.utc();
      const hours = now.diff(checkInTime, 'hours', true); // true for decimal precision
      return hours;
    } catch (error) {
      logger.warn('Error calculating hours worked', error);
      return 0;
    }
  }, [isUserCheckedIn, userLastAttendance?.CreatedOn]);

  const onCheckInPress = useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous check-in/out attempts
    if (isProcessingCheckIn) {
      logger.debug('onCheckInPress: Already processing, skipping');
      return;
    }

    // If checking out and hours worked is less than 9, show early checkout modal
    if (isUserCheckedIn && hoursWorked < 9) {
      setShowEarlyCheckoutModal(true);
      return;
    }

    // Lock button state to prevent text changes during processing
    buttonStateLockedRef.current = true;
    setIsProcessingCheckIn(true);

    // Store current state to prevent changes during navigation
    const currentIsCheckedIn = isUserCheckedIn;
    const currentTimeTS = getCurrentTimestamp();
    const currentDate = getCurrentDate();

    try {
      await insertAttendancePunchRecord({
        timestamp: currentTimeTS,
        orgID: '123',
        userID: userData?.email || '',
        punchType: 'CHECK',
        punchDirection: currentIsCheckedIn
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
      if (currentIsCheckedIn) {
        cancelBreakReminderNotifications();
      }

      // Refresh attendance data from database to update Redux state
      // Note: getAttendanceData is also called in insertAttendancePunchRecord callback,
      // but we call it here as well to ensure state is updated before navigation
      if (userData?.email) {
        await getAttendanceData(userData.email);
      }
    } catch (error) {
      logger.error('Error inserting attendance record', error);
      // Reset processing state on error
      setIsProcessingCheckIn(false);
      buttonStateLockedRef.current = false;
      // Show error to user or handle gracefully
      return; // Don't navigate if insert failed
    }

    // Navigate immediately without waiting for state propagation
    // The state will update in the background, but we navigate before it changes
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
    getCurrentTimestamp,
    hoursWorked,
    isProcessingCheckIn,
  ]);

  const handleBreakStatusSelect = useCallback(
    async (status: string): Promise<void> => {
      setShowEarlyCheckoutModal(false);
      buttonStateLockedRef.current = true;
      setIsProcessingCheckIn(true);
      
      const currentTimeTS = getCurrentTimestamp();
      const currentDate = getCurrentDate();

      try {
        await insertAttendancePunchRecord({
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

        // Refresh attendance data from database to update Redux state
        if (userData?.email) {
          await getAttendanceData(userData.email);
        }

        // Navigate to DashboardScreen (home) and reset the stack
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'DashboardScreen' }],
          }),
        );
      } catch (error) {
        logger.error('Error inserting attendance record', error);
        setIsProcessingCheckIn(false);
        buttonStateLockedRef.current = false;
      }
    },
    [
      userLocationRegion,
      userData?.email,
      navigation,
      currentAddress,
      getCurrentTimestamp,
    ],
  );

  const handleSkip = useCallback(async (): Promise<void> => {
    setShowEarlyCheckoutModal(false);
    buttonStateLockedRef.current = true;
    setIsProcessingCheckIn(true);
    
    const currentTimeTS = getCurrentTimestamp();
    const currentDate = getCurrentDate();

    try {
      await insertAttendancePunchRecord({
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

      // Refresh attendance data from database to update Redux state
      if (userData?.email) {
        await getAttendanceData(userData.email);
      }

      // Navigate to DashboardScreen (home) and reset the stack
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'DashboardScreen' }],
        }),
      );
    } catch (error) {
      logger.error('Error inserting attendance record', error);
      setIsProcessingCheckIn(false);
      buttonStateLockedRef.current = false;
    }
  }, [
    userLocationRegion,
    userData?.email,
    navigation,
    currentAddress,
    getCurrentTimestamp,
  ]);

  const buttonText = useMemo(() => {
    // If button state is locked (during check-in/out), don't change text
    if (buttonStateLockedRef.current) {
      // Return text based on the state when lock was applied
      if (isUserCheckedIn) {
        return 'Confirm Check Out';
      }
      return 'Confirm CheckIn';
    }
    
    if (isProcessingCheckIn) {
      return t('attendance.processing') || 'Processing...';
    }
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
  }, [isUserCheckedIn, isFetchingLocation, isFetchingAddress, permissionDenied, isProcessingCheckIn, t]);

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
          disabled={isFetchingLocation || permissionDenied || !userLocationRegion?.latitude || !userLocationRegion?.longitude || isProcessingCheckIn}
          title={buttonText}
          titleColor={buttonTextColor}
          titleSize={hp(2.24)} // Standard button text size
          loading={isFetchingLocation || isFetchingAddress || isProcessingCheckIn}
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
