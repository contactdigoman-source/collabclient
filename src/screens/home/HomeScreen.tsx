import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, FlatList, Animated, RefreshControl, AppState, AppStateStatus } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
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
import { useAppSelector } from '../../redux';
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
} from '../../services';
import moment from 'moment';

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
  const mapRef = useRef<MapView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const appTheme = useAppSelector(state => state.appState.appTheme);
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);
  const expiresAt = useAppSelector(state => state.userState.expiresAt);
  const displayBreakStatus = useAppSelector(state => state.userState.displayBreakStatus);
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

  // Get break start time
  const breakStartTime = useMemo(() => {
    if (!isOnBreak || !userLastAttendance?.CreatedOn) {
      return null;
    }
    try {
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
  }, [isOnBreak, userLastAttendance?.AttendanceStatus]);

  const barStyle = useMemo<StatusBar['props']['barStyle']>(
    () => (appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'),
    [appTheme],
  );

  // Function to update current location
  const updateCurrentLocation = useCallback(async () => {
    try {
      // Request permission first (on Android, iOS handles this automatically)
      const hasPermission = await requestLocationPermission(() => {
        console.log('Location permission denied by user');
      });

      if (!hasPermission) {
        console.log('Location permission not granted');
        return false;
      }

      const coords = await getCurrentPositionOfUser();
      console.log('Current location fetched:', coords);
      setCurrentLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      return true;
    } catch (error) {
      console.log('Error getting current location:', error);
      // Fallback to last attendance location if current location fails
      return false;
    }
  }, []);

  // Check session expiration function
  const checkSessionExpiration = useCallback(() => {
    if (expiresAt && isSessionExpired(expiresAt)) {
      // Session expired, logout user
      logoutUser().catch(error => {
        console.error('Error during logout on home screen:', error);
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
        console.error('Error during logout on pull-to-refresh:', error);
      });
      return;
    }
    
    // Update location if session is still valid
    await updateCurrentLocation();
    setRefreshing(false);
  }, [updateCurrentLocation, expiresAt]);

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
          <View style={styles.breakBanner}>
            <AppText
              size={hp(1.8)}
              fontType={FontTypes.medium}
              style={styles.breakText}
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
    [mapRegion, markerCoordinates, t, isOnBreak, breakStatusLabel, breakStartTime, displayBreakStatus],
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
        punchTimestamp={userLastAttendance?.Timestamp}
        punchDirection={userLastAttendance?.PunchDirection}
        textColor={headerTextColor}
        bgColor={headerBgColor}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  map: { height: hp('35%') },
  breakBanner: {
    backgroundColor: '#272727',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(5),
    marginTop: hp(1),
    marginHorizontal: wp(5),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakText: {
    color: '#FFFFFF',
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
});

