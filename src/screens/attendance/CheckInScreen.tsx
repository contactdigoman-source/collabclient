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
import { insertAttendancePunchRecord, getAttendanceData } from '../../services';
import moment from 'moment';
import { getCurrentUTCTimestamp, getCurrentUTCDate} from '../../utils/time-utils';
import { PUNCH_DIRECTIONS } from '../../constants/location';
import { useTranslation } from '../../hooks/useTranslation';
import { useCheckInStatus } from '../../hooks/useCheckInStatus';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';
import { logger } from '../../services/logger';
import { getShiftEndTimestamp } from '../../utils/shift-utils';

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

  // Use shared hook for check-in status
  const isUserCheckedIn = useCheckInStatus();

  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState<boolean>(false);
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState<boolean>(false);
  
  // Use refs to prevent unnecessary re-renders and address fetches
  const addressFetchedRef = useRef<boolean>(false);
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);

 
  const stopWatching = useCallback((): void => {
    // watchIdRef is not needed here as watchUserLocation handles it internally
    // Just clear any existing watch
  }, []);

  const handleLocationUpdate = useCallback(
    (coords: Coordinates): void => {
      const logContext = { _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'handleLocationUpdate' } };
      logger.debug('handleLocationUpdate: Called with coords', { ...logContext, coords });
      if (!coords) {
        logger.debug('handleLocationUpdate: No coords, returning', logContext);
        return;
      }

      logger.debug('handleLocationUpdate: Processing location', { ...logContext, latitude: coords.latitude, longitude: coords.longitude });
      const locationRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: coords.latitudeDelta || ZOOM_IN_DELTA,
        longitudeDelta: coords.longitudeDelta || ZOOM_IN_DELTA,
      };

      logger.debug('handleLocationUpdate: Dispatching location region', logContext);
      dispatch(setUserLocationRegion(locationRegion));
      setIsFetchingLocation(false);

      // Fetch address immediately when location is available using Google API (only if not already fetched)
      if (coords.latitude && coords.longitude && !addressFetchedRef.current) {
        logger.debug('handleLocationUpdate: Fetching address from Google API', { ...logContext, latitude: coords.latitude, longitude: coords.longitude });
        setIsFetchingAddress(true);
        getLocationFromLatLon(coords.latitude, coords.longitude)
          .then((address) => {
            logger.debug('handleLocationUpdate: Address fetched from Google API', { ...logContext, address });
            setCurrentAddress(address);
            addressFetchedRef.current = true; // Mark as fetched
            setIsFetchingAddress(false);
          })
          .catch((error) => {
            logger.warn('handleLocationUpdate: Error fetching address from Google API', error, logContext);
            setCurrentAddress(null);
            setIsFetchingAddress(false);
          });
      } else {
        if (addressFetchedRef.current) {
          logger.debug('handleLocationUpdate: Address already fetched, skipping', logContext);
        } else {
          logger.debug('handleLocationUpdate: Missing latitude or longitude', logContext);
        }
      }

      if (mapRef.current) {
        logger.debug('handleLocationUpdate: Animating map to region', logContext);
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
        logger.debug('handleLocationUpdate: mapRef.current is null', logContext);
      }
    },
    [dispatch],
  );

  const onCancelPress = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const startWatching = useCallback(async (): Promise<void> => {
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
      
      // Get current position first (this will call handleLocationUpdate immediately)
      Geolocation.getCurrentPosition(
        (position) => {
          logger.debug('startWatching: Current position received', { coords: position.coords });
          handleLocationUpdate(position.coords);
        },
        (error) => {
          logger.warn('startWatching: Error getting current position', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
      
      // Then start watching for updates
      watchUserLocation(handleLocationUpdate);
    } else {
      logger.debug('startWatching: Location is not enabled');
      navigation.goBack();
    }
  }, [handleLocationUpdate, stopWatching, onCancelPress, navigation]);

  useEffect(() => {
    startWatching();
    return stopWatching;
  }, [startWatching, stopWatching]);

  // Fetch address when location region changes (only once, prevent flickering)
  useEffect(() => {
    const fetchAddress = async (): Promise<void> => {
      // Only fetch if we have location and haven't fetched address yet
      if (
        userLocationRegion?.latitude &&
        userLocationRegion?.longitude &&
        !isFetchingLocation &&
        !addressFetchedRef.current
      ) {
        // Check if location has changed significantly (more than 10 meters)
        const currentLat = userLocationRegion.latitude;
        const currentLon = userLocationRegion.longitude;
        const lastLocation = lastLocationRef.current;
        
        if (lastLocation) {
          // Calculate distance (rough approximation)
          const latDiff = Math.abs(currentLat - lastLocation.lat);
          const lonDiff = Math.abs(currentLon - lastLocation.lon);
          // If location hasn't changed significantly, skip fetch
          if (latDiff < 0.0001 && lonDiff < 0.0001) {
            logger.debug('useEffect: Location unchanged, skipping address fetch');
            return;
          }
        }

        // Only fetch if we don't already have an address
        if (currentAddress) {
          logger.debug('useEffect: Address already exists, skipping fetch');
          addressFetchedRef.current = true;
          return;
        }

        logger.debug('useEffect: Fetching address from Google API', { 
          latitude: currentLat, 
          longitude: currentLon 
        });
        
        // Update last location
        lastLocationRef.current = { lat: currentLat, lon: currentLon };
        
        setIsFetchingAddress(true);
        try {
          // Use Google API to get address
          const address = await getLocationFromLatLon(
            currentLat,
            currentLon,
          );
          logger.debug('useEffect: Address fetched from Google API', { address });
          setCurrentAddress(address);
          addressFetchedRef.current = true; // Mark as fetched
          
          // Focus map on current location when address is fetched (only once)
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: currentLat,
                longitude: currentLon,
                latitudeDelta: ZOOM_IN_DELTA,
                longitudeDelta: ZOOM_IN_DELTA,
              },
              500,
            );
          }
        } catch (error) {
          logger.warn('useEffect: Error fetching address from Google API', error);
          setCurrentAddress(null);
          // Don't mark as fetched on error, allow retry
        } finally {
          setIsFetchingAddress(false);
        }
      } else {
        logger.debug('useEffect: Skipping address fetch', { 
          isFetchingLocation, 
          hasLocation: !!userLocationRegion?.latitude,
          addressFetched: addressFetchedRef.current
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

  /**
   * Determine the correct date for check-in based on shift type and last attendance
   * Rules:
   * 1. For normal shift: 
   *    - User can do multiple checkouts/check-ins on same day
   *    - BUT if check-in happens on next day (compared to last checkout date), use next day's date
   * 2. For 2-day shift:
   *    - If checkout was on/after shift end time, next check-in uses next day
   *    - If checkout was before shift end time, check if current check-in is on/after shift start time
   *      - If yes, it's next day's check-in
   *      - If no, use today
   * 3. Otherwise: Use today
   */
  const getCheckInDate = useCallback((): string => {
    const today = getCurrentUTCDate();
    const now = moment.utc();
    
    // If no last attendance or last attendance is IN, use today
    if (!userLastAttendance || userLastAttendance.PunchDirection === PUNCH_DIRECTIONS.in) {
      return today;
    }
    
    // Last attendance is OUT - check if we should use next day
    const shiftStartTime = userData?.shiftStartTime || '09:00';
    const shiftEndTime = userData?.shiftEndTime || '17:00';
    
    // Check if shift spans 2 days
    const [startHour, startMin] = shiftStartTime.split(':').map(Number);
    const [endHour, endMin] = shiftEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const doesShiftSpanTwoDays = endMinutes < startMinutes;
    
    try {
      const checkoutTimestamp = typeof userLastAttendance.Timestamp === 'string'
        ? parseInt(userLastAttendance.Timestamp, 10)
        : userLastAttendance.Timestamp;
      
      if (!checkoutTimestamp) {
        return today;
      }
      
      // Get checkout date
      const checkoutDate = userLastAttendance.DateOfPunch || moment.utc(checkoutTimestamp).format('YYYY-MM-DD');
      const checkoutUTC = moment.utc(checkoutTimestamp);
      
      if (!doesShiftSpanTwoDays) {
        // Normal shift: Check if current check-in is on a different day compared to checkout date
        // Use string comparison for reliability
        const isDifferentDay = today !== checkoutDate;
        
        logger.debug('Normal shift check-in date calculation', {
          _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
          checkoutDate,
          today,
          isDifferentDay,
        });
        
        // If today is different from checkout date, use today (it's a new day's attendance)
        if (isDifferentDay) {
          logger.debug('Using today as check-in date (different day from checkout)', {
            _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
            date: today,
          });
          return today;
        }
        
        // Same day as checkout, use today (user can do multiple check-ins/checkouts on same day)
        logger.debug('Using today as check-in date (same day as checkout)', {
          _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
          date: today,
        });
        return today;
      }
      
      // 2-day shift logic
      // Get shift end timestamp for checkout date
      const shiftEndTimestamp = getShiftEndTimestamp(checkoutDate, shiftEndTime);
      
      if (!shiftEndTimestamp) {
        return today;
      }
      
      const shiftEndUTC = moment.utc(shiftEndTimestamp);
      
      // Check if checkout was on or after shift end time
      if (checkoutUTC.isSameOrAfter(shiftEndUTC)) {
        // Checkout was on/after shift end time, next check-in should be next day
        logger.debug('2-day shift: Checkout was on/after shift end, using next day', {
          _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
          checkoutDate,
          checkoutTime: checkoutUTC.format('YYYY-MM-DD HH:mm'),
          shiftEndTime: shiftEndUTC.format('YYYY-MM-DD HH:mm'),
          nextDay: moment.utc(today).add(1, 'day').format('YYYY-MM-DD'),
        });
        const nextDay = moment.utc(today).add(1, 'day').format('YYYY-MM-DD');
        return nextDay;
      }
      
      // Checkout was before shift end time
      // Check if current check-in time is on/after shift start time
      // If yes, it's next day's check-in (since shift time is about to start)
      const [currentHour, currentMin] = [now.hour(), now.minute()];
      const currentMinutes = currentHour * 60 + currentMin;
      
      logger.debug('2-day shift: Checking if check-in is on/after shift start', {
        _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
        checkoutDate,
        checkoutTime: checkoutUTC.format('YYYY-MM-DD HH:mm'),
        shiftEndTime: shiftEndUTC.format('YYYY-MM-DD HH:mm'),
        currentTime: now.format('YYYY-MM-DD HH:mm'),
        currentMinutes,
        startMinutes,
        shiftStartTime,
      });
      
      if (currentMinutes >= startMinutes) {
        // Current check-in is on/after shift start time, it's next day's check-in
        // (since checkout was before shift end, but we're now at/after shift start)
        logger.debug('2-day shift: Check-in is on/after shift start, using next day', {
          _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
          nextDay: moment.utc(today).add(1, 'day').format('YYYY-MM-DD'),
        });
        const nextDay = moment.utc(today).add(1, 'day').format('YYYY-MM-DD');
        return nextDay;
      }
      
      // Current check-in is before shift start time, use today
      logger.debug('2-day shift: Check-in is before shift start, using today', {
        _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'getCheckInDate' },
        date: today,
      });
      return today;
    } catch (error) {
      logger.error('Error determining check-in date', error);
      return today;
    }
  }, [userLastAttendance, userData?.shiftStartTime, userData?.shiftEndTime]);

  const getCurrentDate = (): string => getCurrentUTCDate();
  const getCurrentTimestamp = useCallback((): number => {
    // Return UTC timestamp (milliseconds since epoch)
    // All punch records are stored in UTC
    // UI will convert to local time for display using formatUTCForDisplay()
    return getCurrentUTCTimestamp();
  }, []);

  // Calculate hours worked from check-in time
  const hoursWorked = useMemo((): number => {
    if (!isUserCheckedIn || !userLastAttendance?.CreatedOn) {
      return 0;
    }

    try {
      // Parse check-in time (timestamp is UTC)
      let checkInTime: moment.Moment;
      if (typeof userLastAttendance.CreatedOn === 'string') {
        checkInTime = moment.utc(parseInt(userLastAttendance.CreatedOn, 10));
      } else if (typeof userLastAttendance.CreatedOn === 'number') {
        checkInTime = moment.utc(userLastAttendance.CreatedOn);
      } else {
        return 0;
      }

      // Calculate difference in hours (both in UTC)
      const now = moment.utc(); // Current time in UTC
      const hours = now.diff(checkInTime, 'hours', true); // true for decimal precision
      return hours;
    } catch (error) {
      logger.warn('Error calculating hours worked', error);
      return 0;
    }
  }, [isUserCheckedIn, userLastAttendance?.CreatedOn]);

  const onCheckInPress = useCallback(async (): Promise<void> => {
    // Get minimum working hours from profile (default to 9 if not set)
    const minimumWorkingHours = userData?.minimumWorkingHours || 9;
    
    // If checking out and hours worked is less than minimum working hours, show early checkout modal
    if (isUserCheckedIn && hoursWorked < minimumWorkingHours) {
      setShowEarlyCheckoutModal(true);
      return;
    }

    // Proceed with normal check-in/check-out
    const currentTimeTS = getCurrentTimestamp();
    // Use getCheckInDate() for check-in, getCurrentDate() for checkout
    const currentDate = isUserCheckedIn ? getCurrentDate() : getCheckInDate();

    logger.debug('Inserting attendance record', {
      _context: { service: 'attendance', fileName: 'CheckInScreen.tsx', methodName: 'onCheckInPress' },
      isUserCheckedIn,
      currentDate,
      currentTimeTS,
      timestampDate: moment.utc(currentTimeTS).format('YYYY-MM-DD'),
      lastAttendance: userLastAttendance ? {
        DateOfPunch: userLastAttendance.DateOfPunch,
        PunchDirection: userLastAttendance.PunchDirection,
        Timestamp: userLastAttendance.Timestamp,
      } : null,
    });

    try {
      await insertAttendancePunchRecord({
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
        dateOfPunch: currentDate, // Explicitly set dateOfPunch to ensure correct grouping
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

      // Navigate immediately to prevent button flicker
      // State will be updated in the background via insertAttendancePunchRecord callback
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'DashboardScreen' }],
        }),
      );

      // Refresh attendance data from database to update Redux state (async, after navigation)
      // This happens in the background and won't affect the current screen
      if (userData?.email) {
        getAttendanceData(userData.email).catch((error) => {
          logger.error('Error refreshing attendance data after check-in', error);
        });
      }
    } catch (error) {
      logger.error('Error inserting attendance record', error);
      // Show error to user or handle gracefully
      return; // Don't navigate if insert failed
    }
  }, [
    userLocationRegion,
    isUserCheckedIn,
    userData?.email,
    userData?.minimumWorkingHours,
    navigation,
    currentAddress,
    getCurrentTimestamp,
    hoursWorked,
    getCheckInDate,
  ]);

  const handleBreakStatusSelect = useCallback(
    async (status: string): Promise<void> => {
      setShowEarlyCheckoutModal(false);
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

        // Navigate immediately to prevent button flicker
        // State will be updated in the background via insertAttendancePunchRecord callback
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'DashboardScreen' }],
          }),
        );

        // Refresh attendance data from database to update Redux state (async, after navigation)
        // This happens in the background and won't affect the current screen
        if (userData?.email) {
          getAttendanceData(userData.email).catch((error) => {
            logger.error('Error refreshing attendance data after checkout', error);
          });
        }
      } catch (error) {
        logger.error('Error inserting attendance record', error);
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

      // Navigate immediately to prevent button flicker
      // State will be updated in the background via insertAttendancePunchRecord callback
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'DashboardScreen' }],
        }),
      );

      // Refresh attendance data from database to update Redux state (async, after navigation)
      // This happens in the background and won't affect the current screen
      if (userData?.email) {
        getAttendanceData(userData.email).catch((error) => {
          logger.error('Error refreshing attendance data after early checkout', error);
        });
      }
    } catch (error) {
      logger.error('Error inserting attendance record', error);
    }
  }, [
    userLocationRegion,
    userData?.email,
    navigation,
    currentAddress,
    getCurrentTimestamp,
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
