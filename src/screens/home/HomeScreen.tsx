import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  FlatList,
  Animated,
  RefreshControl,
  AppState,
  AppStateStatus,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import {
  AppContainer,
  AppIconButton,
  AppImage,
  AppMap,
  AppText,
  ChatListItem,
  HomeHeader,
  MyTeamListItem,
  UserImage,
  SyncStatusIndicator,
} from '../../components';
import {
  DEFAULT_REGION,
  hp,
  wp,
  Icons,
  ZOOM_IN_DELTA,
  FontTypes,
  Images,
} from '../../constants';
import type { Region } from 'react-native-maps';
import { useAppSelector, useAppDispatch, store } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';
import { useTranslation } from '../../hooks/useTranslation';
import {
  isUserOnBreak,
  scheduleBreakReminderNotifications,
  cancelBreakReminderNotifications,
  getCurrentPositionOfUser,
  requestLocationPermission,
  checkAndRefreshSession,
  logoutUser,
  getProfile,
  registerDevice,
  getCurrentTimeAndZone,
  checkClockAccuracy,
} from '../../services';
// import { needsAutoCheckoutByShiftEnd } from '../../utils/shift-utils'; // Commented out - auto-checkout disabled
import {
  setDeviceRegistration,
  setTimeZoneData,
} from '../../redux/reducers/appReducer';
import {
  profileSyncService,
  syncCoordinator,
  syncStatusService,
} from '../../services/sync';
import {
  setSyncing,
  setLastSyncAt,
  setUnsyncedItems,
} from '../../redux/reducers/syncReducer';
import { initializeDatabaseTables } from '../../services/database';
import {
  getCurrentUTCDate,
  getDateFromUTCTimestamp,
  formatUTCForDisplay,
} from '../../utils/time-utils';
import { getAttendanceData } from '../../services/attendance/attendance-db-service';
import { logger } from '../../services/logger';

const COLLEAGUE_NUM_COLUMNS = 4;
const TEAM_NUM_COLUMNS = 2;

const SECTION_LIST_LAYOUTS = {
  recentColab: 'recentColab',
  colleagues: 'colleagues',
  teams: 'teams',
} as const;

interface SectionData {
  title: string;
  data: Array<{ dummy?: boolean }>;
  layout: (typeof SECTION_LIST_LAYOUTS)[keyof typeof SECTION_LIST_LAYOUTS];
}

interface GridItem {
  dummy?: boolean;
}

export default function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const appTheme = useAppSelector(state => state.appState.appTheme);
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userAttendanceHistory = useAppSelector(
    state => state.userState.userAttendanceHistory,
  );
  const userData = useAppSelector(state => state.userState.userData);
  const expiresAt = useAppSelector(state => state.userState.expiresAt);
  const displayBreakStatus = useAppSelector(
    state => state.userState.displayBreakStatus,
  );

  // Get today's attendance records (first check-in and last checkout) in UTC date format
  const todayAttendance = useMemo(() => {
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      return { checkIn: null, checkout: null };
    }

    const today = getCurrentUTCDate(); // Get today's date in UTC

    // Find today's check-in and checkout records
    let checkIn: (typeof userAttendanceHistory)[0] | null = null;
    let checkout: (typeof userAttendanceHistory)[0] | null = null;
    let checkoutTimestamp = 0;

    for (const record of userAttendanceHistory) {
      // Check DateOfPunch field first, then derive from Timestamp (timestamp is UTC)
      let recordDate: string;
      if (record.DateOfPunch) {
        recordDate = record.DateOfPunch;
      } else if (record.Timestamp) {
        const timestamp =
          typeof record.Timestamp === 'string'
            ? parseInt(record.Timestamp, 10)
            : record.Timestamp;
        recordDate = getDateFromUTCTimestamp(timestamp);
      } else {
        continue;
      }

      if (recordDate === today) {
        const timestamp =
          typeof record.Timestamp === 'string'
            ? parseInt(record.Timestamp, 10)
            : record.Timestamp;

        if (record.PunchDirection === 'IN') {
          // Get first check-in of the day (earliest timestamp)
          if (
            !checkIn ||
            timestamp <
              (typeof checkIn.Timestamp === 'string'
                ? parseInt(checkIn.Timestamp, 10)
                : checkIn.Timestamp)
          ) {
            checkIn = record;
          }
        } else if (record.PunchDirection === 'OUT') {
          // Get last checkout of the day (most recent/latest timestamp)
          if (timestamp > checkoutTimestamp) {
            checkout = record;
            checkoutTimestamp = timestamp;
          }
        }
      }
    }

    return { checkIn, checkout };
  }, [userAttendanceHistory]);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // Check if user is on break
  const isOnBreak = useMemo(() => {
    return isUserOnBreak(
      userLastAttendance?.AttendanceStatus,
      userLastAttendance?.PunchDirection,
    );
  }, [
    userLastAttendance?.AttendanceStatus,
    userLastAttendance?.PunchDirection,
  ]);

  // Get break status label
  const breakStatusLabel = useMemo(() => {
    if (!isOnBreak || !userLastAttendance?.AttendanceStatus) {
      return '';
    }
    const status = userLastAttendance.AttendanceStatus.toUpperCase();
    const statusMap: Record<string, string> = {
      LUNCH: t('attendance.breakStatus.atLunch', 'At Lunch'),
      SHORTBREAK: t('attendance.breakStatus.shortBreak', 'Short Break'),
      COMMUTING: t('attendance.breakStatus.commuting', 'Commuting'),
      PERSONALTIMEOUT: t(
        'attendance.breakStatus.personalTimeout',
        'Personal Timeout',
      ),
      OUTFORDINNER: t('attendance.breakStatus.outForDinner', 'Out for Dinner'),
    };
    return statusMap[status] || userLastAttendance.AttendanceStatus;
  }, [isOnBreak, userLastAttendance?.AttendanceStatus, t]);

  // Get break start time (convert from UTC to local time for display)
  const breakStartTime = useMemo(() => {
    if (!isOnBreak || !userLastAttendance?.CreatedOn) {
      return null;
    }
    try {
      // Timestamp is in UTC - convert to local time for display
      const timestamp =
        typeof userLastAttendance.CreatedOn === 'string'
          ? parseInt(userLastAttendance.CreatedOn, 10)
          : userLastAttendance.CreatedOn;
      return formatUTCForDisplay(timestamp, 'hh:mm A');
    } catch {
      return null;
    }
  }, [isOnBreak, userLastAttendance?.CreatedOn]);

  // Set up notifications when user goes on break
  useEffect(() => {
    if (isOnBreak && userLastAttendance?.AttendanceStatus) {
      scheduleBreakReminderNotifications(userLastAttendance.AttendanceStatus);
    } else {
      cancelBreakReminderNotifications();
    }

    // Cleanup on unmount
    return () => {
      if (!isOnBreak) {
        cancelBreakReminderNotifications();
      }
    };
  }, [isOnBreak, userLastAttendance?.AttendanceStatus, userData?.shiftEndTime]);

  const barStyle = useMemo<StatusBar['props']['barStyle']>(
    () => (appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'),
    [appTheme],
  );

  // ============================================================================
  // Refs for tracking initialization state
  // ============================================================================
  const lastCheckedExpiresAtRef = useRef<string | null>(null);
  const initializationDoneRef = useRef(false);
  const lastInitializedEmailRef = useRef<string | null>(null);
  const deviceRegistrationDoneRef = useRef(false);
  const locationFetchedOnMountRef = useRef(false);

  // ============================================================================
  // Callbacks
  // ============================================================================
  // Function to update current location
  const updateCurrentLocation = useCallback(async () => {
    try {
      // Request permission first (on Android, iOS handles this automatically)
      const hasPermission = await requestLocationPermission(() => {
        logger.debug('Location permission denied by user');
      });

      if (!hasPermission) {
        logger.debug('Location permission not granted');
        return false;
      }

      const coords = await getCurrentPositionOfUser();
      logger.debug('Current location fetched', { coords });
      setCurrentLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      return true;
    } catch (error) {
      logger.warn('Error getting current location', error);
      // Fallback to last attendance location if current location fails
      return false;
    }
  }, []);

  // Check session expiration and refresh if about to expire
  const checkSessionExpiration = useCallback(async () => {
    if (!expiresAt) {
      return; // No expiration date, skip check
    }

    // Check if session is expired or about to expire, and refresh if needed
    const isSessionValid = await checkAndRefreshSession(expiresAt, 30); // 30 minutes before expiry

    if (!isSessionValid) {
      // Session expired and couldn't be refreshed, logout user
      logoutUser().catch(error => {
        logger.error('Error during logout on home screen', error);
      });
    }
  }, [expiresAt]);

  // Sync unsynced items helper function
  const syncUnsyncedItems = useCallback(
    async (email: string, userID: string) => {
      try {
        dispatch(setSyncing(true));

        // Get unsynced items and update Redux
        const unsyncedItems = await syncStatusService.getAllUnsyncedItems(
          email,
          userID,
        );
        dispatch(setUnsyncedItems(unsyncedItems));

        // Sync all unsynced items
        const result = await syncCoordinator.syncAll(email, userID);

        // Update last sync time
        if (result.success) {
          dispatch(setLastSyncAt(Date.now()));
        }

        // Refresh unsynced items after sync
        const updatedUnsyncedItems =
          await syncStatusService.getAllUnsyncedItems(email, userID);
        dispatch(setUnsyncedItems(updatedUnsyncedItems));
      } catch (error) {
        logger.error('Error syncing unsynced items', error);
      } finally {
        dispatch(setSyncing(false));
      }
    },
    [dispatch],
  );

  // ============================================================================
  // useEffect Hooks - Grouped together
  // ============================================================================

  // 1. Check session expiration on mount
  useEffect(() => {
    // Skip if no expiration date or if we already checked this expiresAt
    if (!expiresAt || lastCheckedExpiresAtRef.current === expiresAt) {
      return;
    }

    // Mark as checked
    lastCheckedExpiresAtRef.current = expiresAt;

    // Check if session is expired or about to expire, and refresh if needed
    checkAndRefreshSession(expiresAt, 30).then(isSessionValid => {
      if (!isSessionValid) {
        // Session expired and couldn't be refreshed, logout user
        logoutUser().catch(error => {
          logger.error('Error during logout on home screen', error);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount only - expiresAt check is handled inside with ref guard

  // 2. Initialize database tables and load profile from DB on mount
  useEffect(() => {
    const email = userData?.email;
    const userID = userData?.id?.toString();

    // Skip if no email or if already initialized for this email
    if (
      !email ||
      (initializationDoneRef.current &&
        lastInitializedEmailRef.current === email)
    ) {
      return;
    }

    const initializeAndLoadProfile = async () => {
      try {
        // Initialize database tables (only once)
        if (!initializationDoneRef.current) {
          await initializeDatabaseTables();
          initializationDoneRef.current = true;
        }

        // Load profile from DB
        const dbProfile = await profileSyncService.loadProfileFromDB(email);
        if (dbProfile) {
          // Profile loaded from DB, now sync unsynced items
          await syncUnsyncedItems(email, userID || email);
        } else {
          // No profile in DB, sync from server
          await syncCoordinator.syncPullOnly(email, userID || email);
        }

        // Mark as initialized for this email
        lastInitializedEmailRef.current = email;
      } catch (error) {
        logger.error('Error initializing and loading profile', error);
      }
    };

    initializeAndLoadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount only - userData check is handled inside with ref guard

  // 3. Register device and fetch current time on mount
  useEffect(() => {
    // Only run once on mount
    if (deviceRegistrationDoneRef.current) {
      return;
    }

    let isMounted = true;

    const registerDeviceAndFetchTime = async () => {
      // Register device
      try {
        const deviceData = await registerDevice();
        if (isMounted) {
          dispatch(
            setDeviceRegistration({
              deviceId: deviceData.deviceId,
              registeredAt: deviceData.registeredAt,
              platform: Platform.OS,
              platformVersion: Platform.Version?.toString() || 'unknown',
            }),
          );
          logger.info('Device registered successfully', {
            deviceId: deviceData.deviceId,
          });
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to register device', error);
        }
      }

      if (!isMounted) return;

      // Fetch timezone data
      try {
        const timeData = await getCurrentTimeAndZone();
        if (isMounted) {
          dispatch(setTimeZoneData(timeData));
          logger.info('Current time and timezone fetched', {
            timezone: timeData.timezone,
            currentTime: timeData.currentTime,
          });
        }

        if (!isMounted) return;

        // Check clock accuracy after fetching server time
        const clockCheck = await checkClockAccuracy(5); // Allow 5 minutes difference
        if (!clockCheck.isAccurate && isMounted) {
          logger.warn('Device clock is incorrect', {
            differenceMinutes: clockCheck.differenceMinutes,
            differenceSeconds: clockCheck.differenceSeconds,
            deviceTime: new Date(clockCheck.deviceTime).toISOString(),
            serverTime: new Date(clockCheck.serverTime).toISOString(),
          });

          // Show alert to user (use hardcoded strings to avoid 't' dependency)
          const differenceText =
            clockCheck.differenceMinutes > 0
              ? `${clockCheck.differenceMinutes} minute${
                  clockCheck.differenceMinutes > 1 ? 's' : ''
                }`
              : `${clockCheck.differenceSeconds} second${
                  clockCheck.differenceSeconds > 1 ? 's' : ''
                }`;

          Alert.alert(
            'Device Clock Incorrect',
            `Your device clock is ${differenceText} off from the server time. Please enable automatic date & time setting to ensure accurate attendance tracking.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  } else {
                    // iOS: Open Settings app
                    Linking.openURL('app-settings:');
                  }
                },
              },
            ],
            { cancelable: true },
          );
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to fetch current time and timezone', error);
        }
      }

      // Mark as done
      if (isMounted) {
        deviceRegistrationDoneRef.current = true;
      }
    };

    registerDeviceAndFetchTime();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount only - ref guard prevents re-runs

  // 4. Check clock accuracy when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (
      nextAppState: AppStateStatus,
    ): Promise<void> => {
      if (nextAppState === 'active') {
        // App came to foreground - check clock accuracy
        try {
          const clockCheck = await checkClockAccuracy(5); // Allow 5 minutes difference
          if (!clockCheck.isAccurate) {
            logger.warn('Device clock is incorrect (on app foreground)', {
              differenceMinutes: clockCheck.differenceMinutes,
              differenceSeconds: clockCheck.differenceSeconds,
            });

            const differenceText =
              clockCheck.differenceMinutes > 0
                ? `${clockCheck.differenceMinutes} minute${
                    clockCheck.differenceMinutes > 1 ? 's' : ''
                  }`
                : `${clockCheck.differenceSeconds} second${
                    clockCheck.differenceSeconds > 1 ? 's' : ''
                  }`;

            Alert.alert(
              'Device Clock Incorrect',
              `Your device clock is ${differenceText} off from the server time. Please enable automatic date & time setting to ensure accurate attendance tracking.`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    if (Platform.OS === 'android') {
                      Linking.openSettings();
                    } else {
                      Linking.openURL('app-settings:');
                    }
                  },
                },
              ],
              { cancelable: true },
            );
          }
        } catch (error) {
          logger.error(
            'Failed to check clock accuracy on app foreground',
            error,
          );
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // 5. Update location on mount
  useEffect(() => {
    if (!locationFetchedOnMountRef.current) {
      locationFetchedOnMountRef.current = true;
      updateCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount, updateCurrentLocation is stable

  // 6. Update location and refresh attendance data when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Only update if already fetched on mount (to avoid duplicate calls on initial mount)
      if (locationFetchedOnMountRef.current) {
        updateCurrentLocation();
      }
      
      // Refresh attendance data when screen comes into focus to update header
      if (userData?.email) {
        getAttendanceData(userData.email);
      }
    }, [updateCurrentLocation, userData?.email]),
  );

  // 7. Animate map to current location when it's updated
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: ZOOM_IN_DELTA,
        longitudeDelta: ZOOM_IN_DELTA,
      };
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  }, [currentLocation]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    // Check session expiration and refresh if about to expire
    // This will handle session expiry check, token refresh if needed, and logout if expired
    await checkSessionExpiration();

    // If session was expired, checkSessionExpiration would have logged out the user
    // Get fresh expiresAt from store in case it was updated during refresh
    const currentExpiresAt = store.getState().userState?.expiresAt;
    if (!currentExpiresAt) {
      // No expiration date or user was logged out, stop refresh
      setRefreshing(false);
      return;
    }

    // Register device and fetch current time on pull-to-refresh
    try {
      // Register device
      const deviceData = await registerDevice();
      dispatch(
        setDeviceRegistration({
          deviceId: deviceData.deviceId,
          registeredAt: deviceData.registeredAt,
          platform: Platform.OS,
          platformVersion: Platform.Version?.toString() || 'unknown',
        }),
      );
      logger.info('Device registered successfully on pull-to-refresh', {
        deviceId: deviceData.deviceId,
      });
    } catch (error) {
      logger.error('Failed to register device on pull-to-refresh', error);
    }

    try {
      // Get current time and timezone
      const timeData = await getCurrentTimeAndZone();
      dispatch(setTimeZoneData(timeData));
      logger.info('Current time and timezone fetched on pull-to-refresh', {
        timezone: timeData.timezone,
        currentTime: timeData.currentTime,
      });
    } catch (error) {
      logger.error(
        'Failed to fetch current time and timezone on pull-to-refresh',
        error,
      );
    }

    // Update location if session is still valid
    await updateCurrentLocation();

    // Sync profile data from server (getProfile() will update DB only if server.lastSyncedAt >= local.lastUpdatedAt)
    const email = userData?.email;
    if (email) {
      try {
        await getProfile(); // This will sync profile data to DB
      } catch (error) {
        logger.error('Error syncing profile on pull-to-refresh', error);
      }
    }

    // Sync unsynced items
    const userID = userData?.id?.toString() || email || '';
    if (email) {
      await syncUnsyncedItems(email, userID);
    }

    setRefreshing(false);
  }, [
    updateCurrentLocation,
    userData,
    syncUnsyncedItems,
    dispatch,
    checkSessionExpiration,
  ]);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  // Get map region - prefer current location, fallback to last attendance, then default
  const mapRegion = useMemo<Region>(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: ZOOM_IN_DELTA,
        longitudeDelta: ZOOM_IN_DELTA,
      };
    }
    const latLon = userLastAttendance?.LatLon;
    if (latLon) {
      const [lat, lon] = latLon.split(',').map(Number);
      return {
        latitude: lat,
        longitude: lon,
        latitudeDelta: ZOOM_IN_DELTA,
        longitudeDelta: ZOOM_IN_DELTA,
      };
    }
    return DEFAULT_REGION;
  }, [currentLocation, userLastAttendance?.LatLon]);

  // Get marker coordinates - prefer current location
  const markerCoordinates = useMemo(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      };
    }
    const latLon = userLastAttendance?.LatLon;
    if (latLon) {
      const [lat, lon] = latLon.split(',').map(Number);
      return { latitude: lat, longitude: lon };
    }
    return {
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
    };
  }, [currentLocation, userLastAttendance?.LatLon]);

  const sections = useMemo<SectionData[]>(
    () => [
      {
        title: t('home.colleagues'),
        data: Array(4).fill({ dummy: true }) as GridItem[],
        layout: SECTION_LIST_LAYOUTS.colleagues,
      },
      {
        title: t('home.teams'),
        data: Array(2).fill({ dummy: true }) as GridItem[],
        layout: SECTION_LIST_LAYOUTS.teams,
      },
    ],
    [t],
  );

  const renderGridSection = useCallback(
    (
      data: GridItem[],
      layout: (typeof SECTION_LIST_LAYOUTS)[keyof typeof SECTION_LIST_LAYOUTS],
      numColumns: number,
      itemStyle?: any,
    ) => (
      <FlatList
        data={data}
        numColumns={numColumns}
        keyExtractor={(_, index) => `grid-${layout}-${index}`}
        scrollEnabled={false}
        removeClippedSubviews
        windowSize={5}
        initialNumToRender={numColumns}
        maxToRenderPerBatch={numColumns}
        renderItem={({ item, index }) => {
          if (layout === SECTION_LIST_LAYOUTS.colleagues) {
            return (
              <View style={itemStyle}>
                <UserImage
                  size={hp(5.7)}
                  isClickable={!item?.dummy}
                  isDummy={item?.dummy || false}
                  isAttendanceStatusVisible={!item?.dummy}
                />
              </View>
            );
          }
          if (layout === SECTION_LIST_LAYOUTS.teams) {
            return (
              <MyTeamListItem
                teamName={`My Team ${index + 1}`}
                isDummy={item?.dummy || false}
              />
            );
          }
          return null;
        }}
      />
    ),
    [],
  );

  const renderItem = useCallback(
    ({
      section,
      index,
    }: {
      section: SectionData;
      index: number;
    }): React.ReactElement | null => {
      switch (section.layout) {
        case SECTION_LIST_LAYOUTS.colleagues:
          if (index === 0) {
            return renderGridSection(
              section.data,
              section.layout,
              COLLEAGUE_NUM_COLUMNS,
              styles.colleagueItem,
            );
          }
          return null;

        case SECTION_LIST_LAYOUTS.teams:
          if (index === 0) {
            return (
              <View style={{ marginHorizontal: hp(2) }}>
                {renderGridSection(
                  section.data,
                  section.layout,
                  TEAM_NUM_COLUMNS,
                )}
              </View>
            );
          }
          return null;

        case SECTION_LIST_LAYOUTS.recentColab:
          return <ChatListItem />;

        default:
          return null;
      }
    },
    [renderGridSection],
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: SectionData }) => (
      <AppText
        size={hp(2)}
        fontType={FontTypes.bold}
        style={styles.sectionTitle}
      >
        {title}
      </AppText>
    ),
    [],
  );

  const headerComponent = useMemo(
    () => (
      <View>
        <AppMap
          ref={mapRef}
          region={mapRegion}
          zoomEnabled={false}
          scrollEnabled={false}
          style={styles.map}
        >
          <Marker
            coordinate={markerCoordinates}
            title={t('home.currentLocation', 'Current Location')}
          />
        </AppMap>
        {/* Break Status Banner */}
        {isOnBreak && breakStatusLabel && displayBreakStatus && (
          <View
            style={[
              styles.breakBanner,
              {
                backgroundColor: colors.card || '#272727',
                borderWidth: 1,
                borderColor:
                  colors.border ||
                  (appTheme === APP_THEMES.dark ? '#444444' : '#E0E0E0'),
                borderRadius: 12,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: appTheme === APP_THEMES.dark ? 0.4 : 0.2,
                shadowRadius: 6,
                elevation: 6,
              },
            ]}
          >
            <AppText
              size={hp(1.8)}
              fontType={FontTypes.medium}
              style={styles.breakText}
              color={colors.text}
            >
              {breakStatusLabel}
              {breakStartTime && ` • Since ${breakStartTime}`}
            </AppText>
          </View>
        )}
        <View style={styles.mySpaceContainer}>
          <AppIconButton
            title={t('home.myWorkspace')}
            source={Icons.my_space}
          />
          <AppIconButton
            title={t('home.myFiles')}
            style={styles.myFilesBtn}
            source={Icons.my_files}
          />
          <AppIconButton
            title={t('home.announcements')}
            source={Icons.announcements}
          />
        </View>
      </View>
    ),
    [
      mapRegion,
      markerCoordinates,
      t,
      isOnBreak,
      breakStatusLabel,
      breakStartTime,
      displayBreakStatus,
      appTheme,
      colors.border,
      colors.card,
      colors.text,
    ],
  );

  const footerComponent = useMemo(
    () => (
      <View style={styles.footerContainer}>
        <View style={styles.footerSubContainer}>
          <AppText size={hp(2)} fontType={FontTypes.bold}>
            {t('home.bePatient')}
          </AppText>
          <AppText style={{ marginTop: hp(1) }}>
            {t('home.waitingMessage')}
          </AppText>
        </View>
        <AppImage size={hp(15)} source={Images.be_patient} />
      </View>
    ),
    [t],
  );

  // 🔹 Animated colors
  const headerBgColor = scrollY.interpolate({
    inputRange: [0, hp('20%')],
    outputRange: [
      'rgba(0,0,0,0)',
      appTheme === APP_THEMES.dark ? '#000' : '#fff',
    ],
    extrapolate: 'clamp',
  });

  const headerTextColor = scrollY.interpolate({
    inputRange: [0, hp('20%')],
    outputRange: [
      appTheme === APP_THEMES.dark ? '#FFFFFF' : '#000000',
      '#FFFFFF',
    ],
    extrapolate: 'clamp',
  });

  return (
    <AppContainer>
      <StatusBar
        translucent
        backgroundColor="rgba(0,0,0,0)"
        barStyle={barStyle}
      />

      <Animated.SectionList
        sections={sections}
        keyExtractor={(_, index) => `section-${index}`}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={10}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={16}
        contentContainerStyle={styles.sectionListContent}
        ListHeaderComponent={headerComponent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }, // Colors need JS thread
        )}
        scrollEventThrottle={16}
        ListFooterComponent={footerComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <HomeHeader
        userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        punchTimestamp={
          // Only show today's check-in time (active shift)
          todayAttendance.checkIn?.Timestamp || undefined
        }
        checkoutTimestamp={
          // Only show today's checkout time (active shift)
          todayAttendance.checkout?.Timestamp || undefined
        }
        punchDirection={todayAttendance.checkIn?.PunchDirection || undefined}
        textColor={headerTextColor}
        bgColor={headerBgColor}
      />

      {/* Token Expiration Info - Debug Display */}
      {__DEV__ && expiresAt && (
        <View style={styles.tokenInfoContainer}>
          <AppText
            fontType={FontTypes.regular}
            size={10}
            color={
              appTheme === APP_THEMES.dark
                ? DarkThemeColors.separator
                : LightThemeColors.separator
            }
          >
            Token expires: {new Date(expiresAt).toLocaleString()}
          </AppText>
        </View>
      )}

      {/* Sync Status Indicator */}
      <View style={styles.syncIndicatorContainer}>
        <SyncStatusIndicator />
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  map: { height: hp('35%') },
  breakBanner: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(5),
    marginTop: hp(1),
    marginHorizontal: wp(5),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakText: {
    textAlign: 'center',
  },
  mySpaceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(2),
    marginHorizontal: hp(2),
  },
  myFilesBtn: { marginHorizontal: hp('1.24%') },
  sectionTitle: { marginVertical: hp(1), marginHorizontal: hp(2) },
  sectionListContent: { paddingBottom: hp(10) },
  colleagueItem: {
    flex: 0.25,
    paddingVertical: hp(1),
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamItem: {
    flex: 1,
    height: hp(11.11),
    margin: wp(1),
    borderWidth: 1,
    borderRadius: hp(1.86),
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: hp(2),
  },
  tokenInfoContainer: {
    paddingHorizontal: hp(2),
    paddingVertical: hp(0.5),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: hp(0.5),
    marginHorizontal: hp(2),
    marginTop: hp(1),
  },
  footerSubContainer: {
    flex: 1,
    marginEnd: wp(5),
    opacity: 0.7,
  },
  syncIndicatorContainer: {
    position: 'absolute',
    top: hp(12),
    right: wp(5),
    zIndex: 1000,
  },
});
