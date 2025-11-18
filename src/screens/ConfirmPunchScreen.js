import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, Animated, Easing, Alert } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppMap, AppText, BackHeader } from '../components';
import {
  DEFAULT_REGION,
  hp,
  MINIMUM_ACCURACY_REQUIRED,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
} from '../constants';
import {
  requestLocationPermission,
  watchUserLocation,
  clearWatch,
  getLocationFromLatLon,
  isLocationEnabled,
} from '../services/location-service';
import { useAppDispatch, useAppSelector } from '../redux';
import { setUserLocationRegion } from '../redux/userReducer';
import { insertAttendancePunchRecord } from '../services/attendance-db-service';
import moment from 'moment';
import { PUNCH_DIRECTIONS } from '../constants/location';

export default function ConfirmPunchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  const appTheme = useAppSelector(state => state.appState.appTheme);
  const userLocationRegion = useAppSelector(
    state => state.userState.userLocationRegion,
  );
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(null);

  // Animated values
  const heightAnim = useRef(new Animated.Value(0)).current;

  // Animate height + opacity based on isFetchingLocation
  useEffect(() => {
    if (!isFetchingLocation) {
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: hp('20%'), // 👈 target height
          duration: 800,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false, // height cannot use native driver
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.exp),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isFetchingLocation]);

  useEffect(() => {
    const fetchAddress = async () => {
      if (userLocationRegion?.latitude && userLocationRegion?.longitude) {
        const address = await getLocationFromLatLon(
          userLocationRegion.latitude,
          userLocationRegion.longitude,
        );
        setCurrentAddress(address);
      }
    };

    fetchAddress();
  }, [userLocationRegion?.latitude, userLocationRegion?.longitude]);

  const isUserCheckedIn = useMemo(() => {
    return userLastAttendance?.PunchDirection === PUNCH_DIRECTIONS.in;
  }, [userLastAttendance?.PunchDirection]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleLocationUpdate = useCallback(
    coords => {
      if (!coords) return;

      dispatch(setUserLocationRegion(coords));
      setIsFetchingLocation(false);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...coords,
            latitudeDelta: ZOOM_IN_DELTA,
            longitudeDelta: ZOOM_IN_DELTA,
          },
          1000,
        );
      }
    },
    [dispatch],
  );

  const onCancelPress = useCallback(() => {
    navigation.goBack();
  }, []);

  const startWatching = useCallback(async () => {
    const granted = await requestLocationPermission(onCancelPress);
    if (!granted) {
      setPermissionDenied(true);
      return;
    }

    stopWatching();
    const isLocationOn = await isLocationEnabled();
    if (isLocationOn) {
      setIsFetchingLocation(true);
      watchIdRef.current = watchUserLocation(handleLocationUpdate);
    } else {
      navigation.goBack();
    }
  }, [handleLocationUpdate, stopWatching]);

  useEffect(() => {
    startWatching();
    return stopWatching;
  }, [startWatching, stopWatching]);

  const isDefaultRegion =
    userLocationRegion?.latitude === DEFAULT_REGION.latitude;
  const isLowAccuracy =
    !userLocationRegion?.accuracy ||
    userLocationRegion.accuracy > MINIMUM_ACCURACY_REQUIRED ||
    isFetchingLocation;

  const onRefreshMap = useCallback(() => {
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

  const getCurrentDate = () => moment().format('YYYY-MM-DD');
  const getCurrentTimestampFormatted = () =>
    moment().format('YYYY-MM-DDTHH:mm:ss');

  const onConfirmPress = useCallback(() => {
    const currentTimeTS = getCurrentTimestampFormatted();
    const currentDate = getCurrentDate();

    insertAttendancePunchRecord({
      timestamp: currentTimeTS,
      orgID: '123',
      userID: userData?.email,
      punchType: 'CHECK',
      punchDirection: isUserCheckedIn
        ? PUNCH_DIRECTIONS.out
        : PUNCH_DIRECTIONS.in,
      latLon: userLocationRegion
        ? `${userLocationRegion.latitude?.toFixed(
            4,
          )},${userLocationRegion.longitude?.toFixed(4)}`
        : '',
      address: '',
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

    navigation.goBack();
  }, [userLocationRegion, isUserCheckedIn]);

  const buttonColor = useMemo(() => {
    return isUserCheckedIn ? colors.check_out_button : colors.check_in_button;
  }, [isUserCheckedIn, appTheme]);

  const buttonTextColor = useMemo(() => {
    return isUserCheckedIn ? colors.black_common : colors.white_common;
  }, [isUserCheckedIn, appTheme]);

  return (
    <View style={styles.container}>
      <BackHeader
        title={`Confirm Check ${
          isUserCheckedIn ? PUNCH_DIRECTIONS.out : PUNCH_DIRECTIONS.in
        }`.toLowerCase()}
        isTitleVisible
        titleStyle={{ textTransform: 'capitalize' }}
      />

      <AppMap
        ref={mapRef}
        region={userLocationRegion}
        style={styles.map}
        isRefreshButton={!isFetchingLocation}
        onRefreshPress={onRefreshMap}
      />

      <Animated.View
        style={[
          styles.bottomContainer,
          {
            height: heightAnim,
          },
        ]}
      >
        <View style={styles.locationInfo}>
          {permissionDenied ? (
            <AppText color={colors.red}>
              {'Location permission denied. Enable it in settings.'}
            </AppText>
          ) : isFetchingLocation || isDefaultRegion ? (
            <AppText>{'Fetching your location...'}</AppText>
          ) : (
            <>
              {currentAddress ? (
                <AppText>{currentAddress}</AppText>
              ) : (
                <AppText>{`${userLocationRegion?.latitude?.toFixed(
                  4,
                )}, ${userLocationRegion?.longitude?.toFixed(4)}`}</AppText>
              )}
              <AppText>{`${userLocationRegion?.accuracy} meters accurate`}</AppText>
              {isLowAccuracy && (
                <AppText color={colors.yellow}>
                  {`Waiting for accuracy < ${MINIMUM_ACCURACY_REQUIRED}m`}
                </AppText>
              )}
            </>
          )}
        </View>
        <AppButton
          disabled={isFetchingLocation || permissionDenied}
          title={
            permissionDenied
              ? 'Location Permission Required'
              : isFetchingLocation
              ? 'Fetching Location...'
              : 'Confirm Location'
          }
          titleColor={buttonTextColor}
          style={[
            styles.confirmButton,
            {
              backgroundColor: buttonColor,
              marginBottom: insets.bottom || hp('2%'),
            },
          ]}
          accessibilityLabel="Confirm Punch Button"
          borderRadius={hp('1%')}
          onPress={onConfirmPress}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomContainer: {
    marginHorizontal: hp('2%'),
    overflow: 'hidden', // important for height animation
  },
  confirmButton: {
    borderRadius: hp('1%'),
  },
  map: { flex: 1 },
  locationInfo: { flex: 1, justifyContent: 'center' },
});
