import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, FlatList, Animated, RefreshControl, AppState, AppStateStatus } from 'react-native';
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
import { useAppSelector, useAppDispatch } from '../../redux';
import { APP_THEMES } from '../../themes';
import { useTranslation } from '../../hooks/useTranslation';
import {
  isUserOnBreak,
  scheduleBreakReminderNotifications,
  cancelBreakReminderNotifications,
  getCurrentPositionOfUser,
  requestLocationPermission,
  isSessionExpired,
  logoutUser,
  getProfile,
  insertAttendancePunchRecord,
} from '../../services';
import { getJWTToken } from '../../services/auth/login-service';
import { needsAutoCheckout } from '../../utils/shift-utils';
import { setUserLastAttendance } from '../../redux/reducers/userReducer';
import {
  profileSyncService,
  syncCoordinator,
  syncStatusService,
} from '../../services/sync';
import { setSyncing, setLastSyncAt, setUnsyncedItems } from '../../redux/reducers/syncReducer';
import { initializeDatabaseTables } from '../../services/database';
import moment from 'moment';
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
  layout: typeof SECTION_LIST_LAYOUTS[keyof typeof SECTION_LIST_LAYOUTS];
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

  // Use granular selectors to prevent unnecessary re-renders
  // (Combining into one object would create new object reference on every state change)
  const appTheme = useAppSelector(state => state.appState.appTheme);
  const userLastAttendance = useAppSelector(state => state.userState.userLastAttendance);
  const userAttendanceHistory = useAppSelector(state => state.userState.userAttendanceHistory);
  const userData = useAppSelector(state => state.userState.userData);
  const expiresAt = useAppSelector(state => state.userState.expiresAt);
  const displayBreakStatus = useAppSelector(state => state.userState.displayBreakStatus);
  
  // Get today's attendance records (first check-in and last checkout) in UTC date format
  // Optimized with early returns and pre-computed today string
  const todayAttendance = useMemo(() => {
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      return { checkIn: null, checkout: null };
    }
    
    const today = moment.utc().format('YYYY-MM-DD');
    
    // Find today's check-in and checkout records
    let checkIn: typeof userAttendanceHistory[0] | null = null;
    let checkout: typeof userAttendanceHistory[0] | null = null;
    let checkoutTimestamp = 0;
    let checkInTimestamp = Infinity;
    
    // Early exit optimization: if we find both and they're the only ones we need, we can break
    // But we still need to check all records to ensure we get the first IN and last OUT
    for (const record of userAttendanceHistory) {
      // Check DateOfPunch field first (faster than parsing timestamp)
      let recordDate: string;
      if (record.DateOfPunch) {
        recordDate = record.DateOfPunch;
        // Early skip if not today
        if (recordDate !== today) continue;
      } else if (record.Timestamp) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        recordDate = moment.utc(timestamp).format('YYYY-MM-DD');
        // Early skip if not today
        if (recordDate !== today) continue;
      } else {
        continue;
      }
      
      // Process only today's records
      const timestamp = typeof record.Timestamp === 'string' 
        ? parseInt(record.Timestamp, 10) 
        : record.Timestamp;
      
      if (record.PunchDirection === 'IN') {
        // Get first check-in of the day (earliest timestamp)
        if (timestamp < checkInTimestamp) {
          checkIn = record;
          checkInTimestamp = timestamp;
        }
      } else if (record.PunchDirection === 'OUT') {
        // Get last checkout of the day (most recent/latest timestamp)
        if (timestamp > checkoutTimestamp) {
          checkout = record;
          checkoutTimestamp = timestamp;
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
  const lastLocationUpdateRef = useRef<number>(0);
  const LOCATION_UPDATE_DEBOUNCE_MS = 5000; // 5 seconds

  // Check if user is on break
  const isOnBreak = useMemo(() => {
    return isUserOnBreak(
      userLastAttendance?.AttendanceStatus,
      userLastAttendance?.PunchDirection,
    );
  }, [userLastAttendance?.AttendanceStatus, userLastAttendance?.PunchDirection]);

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
      PERSONALTIMEOUT: t('attendance.breakStatus.personalTimeout', 'Personal Timeout'),
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
      // Convert UTC timestamp to local time for display
      const createdOn =
        typeof userLastAttendance.CreatedOn === 'string'
          ? moment(userLastAttendance.CreatedOn)
          : moment(userLastAttendance.CreatedOn);
      return createdOn.format('hh:mm A');
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

  // Auto-checkout after 3 hours if user hasn't checked out
  useEffect(() => {
    const performAutoCheckout = async () => {
      // Check if user has checked in today but not checked out
      if (!todayAttendance.checkIn || todayAttendance.checkout) {
        return; // No check-in or already checked out
      }

      const checkInTimestamp = typeof todayAttendance.checkIn.Timestamp === 'string'
        ? parseInt(todayAttendance.checkIn.Timestamp, 10)
        : todayAttendance.checkIn.Timestamp;

      // Check if 3 hours have passed since check-in
      if (!needsAutoCheckout(checkInTimestamp)) {
        return; // Not yet 3 hours
      }

      // Don't auto-checkout if user is on break
      if (isOnBreak) {
        return;
      }

      try {
        // Get current location for auto-checkout
        const hasPermission = await requestLocationPermission(() => {
          logger.debug('Location permission denied for auto-checkout');
        });

        let latLon = '';
        let address = '';

        if (hasPermission && currentLocation) {
          latLon = `${currentLocation.latitude.toFixed(4)},${currentLocation.longitude.toFixed(4)}`;
          // For auto-checkout, we don't have address, but that's okay
        }

        // Get current timestamp and date in UTC
        const currentTimeTS = Date.now();
        const currentDate = moment.utc().format('YYYY-MM-DD');

        // Perform auto-checkout
        await insertAttendancePunchRecord({
          timestamp: currentTimeTS,
          orgID: '123',
          userID: userData?.email || '',
          punchType: 'CHECK',
          punchDirection: 'OUT',
          latLon,
          address,
          createdOn: currentTimeTS,
          isSynced: 'N',
          dateOfPunch: currentDate,
          attendanceStatus: 'AUTOCHECKOUT', // Mark as auto-checkout
          moduleID: '',
          tripType: '',
          passengerID: '',
          allowanceData: JSON.stringify([]),
          isCheckoutQrScan: 0,
          travelerName: '',
          phoneNumber: '',
        });

        // Cancel break notifications since user is checked out
        cancelBreakReminderNotifications();

        logger.info('Auto-checkout performed after 3 hours');
      } catch (error) {
        logger.error('Error performing auto-checkout', error);
      }
    };

    performAutoCheckout();

    // Check every minute for auto-checkout
    const interval = setInterval(performAutoCheckout, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [todayAttendance, isOnBreak, currentLocation, userData?.email]);

  const barStyle = useMemo<StatusBar['props']['barStyle']>(
    () => (appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'),
    [appTheme],
  );

  // Function to update current location (debounced)
  const updateCurrentLocation = useCallback(async () => {
    const now = Date.now();
    // Debounce: only update if enough time has passed since last update
    if (now - lastLocationUpdateRef.current < LOCATION_UPDATE_DEBOUNCE_MS) {
      logger.debug('Location update skipped (debounced)');
      return false;
    }
    
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
      lastLocationUpdateRef.current = now;
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

  // Check session expiration function
  const checkSessionExpiration = useCallback(() => {
    if (expiresAt && isSessionExpired(expiresAt)) {
      // Session expired, logout user
      logoutUser().catch(error => {
        logger.error('Error during logout on home screen', error);
      });
    }
  }, [expiresAt]);

  // Check session expiration on mount and when expiresAt changes
  useEffect(() => {
    checkSessionExpiration();
  }, [checkSessionExpiration]);

  // Check session expiration when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App has come to the foreground, check if session expired
        checkSessionExpiration();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkSessionExpiration]);

  // Initialize database tables and load profile from DB on mount
  useEffect(() => {
    const initializeAndLoadProfile = async () => {
      try {
        // Initialize database tables
        await initializeDatabaseTables();
        
        // Load profile from DB
        const email = userData?.email;
        if (email) {
          const dbProfile = await profileSyncService.loadProfileFromDB(email);
          if (dbProfile) {
            // Profile loaded from DB, now sync unsynced items
            const userID = userData?.id?.toString() || email;
            await syncUnsyncedItems(email, userID);
          } else {
            // No profile in DB, sync from server
            await syncCoordinator.syncPullOnly(email, userData?.id?.toString() || email);
          }
        }
      } catch (error) {
        logger.error('Error initializing and loading profile', error);
      }
    };

    initializeAndLoadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.email, userData?.id]);

  // Sync unsynced items helper function
  const syncUnsyncedItems = useCallback(async (email: string, userID: string) => {
    try {
      dispatch(setSyncing(true));
      
      // Get unsynced items and update Redux
      const unsyncedItems = await syncStatusService.getAllUnsyncedItems(email, userID);
      dispatch(setUnsyncedItems(unsyncedItems));
      
      // Sync all unsynced items
      const result = await syncCoordinator.syncAll(email, userID);
      
      // Update last sync time
      if (result.success) {
        dispatch(setLastSyncAt(Date.now()));
      }
      
      // Refresh unsynced items after sync
      const updatedUnsyncedItems = await syncStatusService.getAllUnsyncedItems(email, userID);
      dispatch(setUnsyncedItems(updatedUnsyncedItems));
    } catch (error) {
      logger.error('Error syncing unsynced items', error);
    } finally {
      dispatch(setSyncing(false));
    }
  }, [dispatch]);

  // Get current location on mount
  useEffect(() => {
    updateCurrentLocation();
  }, [updateCurrentLocation]);

  // Update location when screen is focused (e.g., after granting permissions)
  useFocusEffect(
    useCallback(() => {
      updateCurrentLocation();
    }, [updateCurrentLocation]),
  );

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Check session expiration first
    if (expiresAt && isSessionExpired(expiresAt)) {
      // Session expired, logout user
      setRefreshing(false);
      logoutUser().catch(error => {
        logger.error('Error during logout on pull-to-refresh', error);
      });
      return;
    }
    
    // Update location if session is still valid
    await updateCurrentLocation();
    
    // Sync profile data from server (getProfile() will update DB only if server.lastSyncedAt >= local.lastUpdatedAt)
    const email = userData?.email;
    if (email) {
      try {
        // Check if authentication token exists before attempting to sync
        const token = await getJWTToken(email);
        if (token) {
          await getProfile(); // This will sync profile data to DB
        }
        // If no token, skip sync silently (user might not be logged in)
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
  }, [updateCurrentLocation, expiresAt, userData, syncUnsyncedItems]);

  // Animate map to current location when it's updated
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
      layout: typeof SECTION_LIST_LAYOUTS[keyof typeof SECTION_LIST_LAYOUTS],
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
    ({ section, index }: { section: SectionData; index: number }): React.ReactElement | null => {
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
          <View style={[
            styles.breakBanner,
            {
              backgroundColor: colors.card || '#272727',
              borderWidth: 1,
              borderColor: colors.border || (appTheme === APP_THEMES.dark ? '#444444' : '#E0E0E0'),
              borderRadius: 12,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: appTheme === APP_THEMES.dark ? 0.4 : 0.2,
              shadowRadius: 6,
              elevation: 6,
            }
          ]}>
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
          <AppIconButton title={t('home.myWorkspace')} source={Icons.my_space} />
          <AppIconButton
            title={t('home.myFiles')}
            style={styles.myFilesBtn}
            source={Icons.my_files}
          />
          <AppIconButton title={t('home.announcements')} source={Icons.announcements} />
        </View>
      </View>
    ),
    [mapRegion, markerCoordinates, t, isOnBreak, breakStatusLabel, breakStartTime, displayBreakStatus, appTheme, colors.border, colors.card, colors.text],
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
    outputRange: [appTheme === APP_THEMES.dark ? '#FFFFFF' : '#000000', '#FFFFFF'],
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
        removeClippedSubviews={true}
        windowSize={10}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        onEndReachedThreshold={0.5}
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

