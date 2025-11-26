import React, { useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, StatusBar, FlatList, Animated } from 'react-native';
import { useTheme } from '@react-navigation/native';
import MapView from 'react-native-maps';
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
  ZOOM_OUT_DELTA,
  FontTypes,
  Images,
  Region,
} from '../../constants';
import { useAppSelector } from '../../redux';
import { APP_THEMES } from '../../themes';

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
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const appTheme = useAppSelector(state => state.appState.appTheme);
  const userLocationRegion = useAppSelector(
    state => state.userState.userLocationRegion,
  );
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  const barStyle = useMemo<StatusBar['props']['barStyle']>(
    () => (appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'),
    [appTheme],
  );

  const onRefreshMap = useCallback((): void => {
    if (!mapRef.current || !userLocationRegion) return;

    const regionOut: Region = {
      ...userLocationRegion,
      latitudeDelta: ZOOM_OUT_DELTA,
      longitudeDelta: ZOOM_OUT_DELTA,
    };
    const regionIn: Region = {
      ...userLocationRegion,
      latitudeDelta: ZOOM_IN_DELTA,
      longitudeDelta: ZOOM_IN_DELTA,
    };

    mapRef.current.animateToRegion(regionOut, 1000);
    setTimeout(() => {
      mapRef.current?.animateToRegion(regionIn, 1000);
    }, 1000);
  }, [userLocationRegion]);

  const lastAttendanceCoords = useMemo<Region>(() => {
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
  }, [userLastAttendance?.LatLon]);

  const sections = useMemo<SectionData[]>(
    () => [
      {
        title: 'Colleagues',
        data: Array(4).fill({ dummy: true }) as GridItem[],
        layout: SECTION_LIST_LAYOUTS.colleagues,
      },
      {
        title: 'Teams',
        data: Array(2).fill({ dummy: true }) as GridItem[],
        layout: SECTION_LIST_LAYOUTS.teams,
      },
    ],
    [],
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
    ({ section, index }: { section: SectionData; index: number }) => {
      switch (section.layout) {
        case SECTION_LIST_LAYOUTS.colleagues:
          return (
            index === 0 &&
            renderGridSection(
              section.data,
              section.layout,
              COLLEAGUE_NUM_COLUMNS,
              styles.colleagueItem,
            )
          );

        case SECTION_LIST_LAYOUTS.teams:
          return (
            index === 0 && (
              <View style={{ marginHorizontal: hp(2) }}>
                {renderGridSection(
                  section.data,
                  section.layout,
                  TEAM_NUM_COLUMNS,
                )}
              </View>
            )
          );

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
          region={lastAttendanceCoords}
          zoomEnabled={false}
          scrollEnabled={false}
          style={styles.map}
        />
        <View style={styles.mySpaceContainer}>
          <AppIconButton title="My Workspace" source={Icons.my_space} />
          <AppIconButton
            title="My Files"
            style={styles.myFilesBtn}
            source={Icons.my_files}
          />
          <AppIconButton title="Announcements" source={Icons.announcements} />
        </View>
      </View>
    ),
    [lastAttendanceCoords],
  );

  const footerComponent = useMemo(
    () => (
      <View style={styles.footerContainer}>
        <View style={styles.footerSubContainer}>
          <AppText size={hp(2)} fontType={FontTypes.bold}>
            {'Be Patient'}
          </AppText>
          <AppText style={{ marginTop: hp(1) }}>
            {'till the time your team and colleague show up'}
          </AppText>
        </View>
        <AppImage size={hp(15)} source={Images.be_patient} />
      </View>
    ),
    [],
  );

  // 🔹 Animated colors
  const headerBgColor = scrollY.interpolate({
    inputRange: [0, hp('20%')],
    outputRange: [
      'transparent',
      appTheme === APP_THEMES.dark ? '#000' : '#fff',
    ],
    extrapolate: 'clamp',
  });

  const headerTextColor = scrollY.interpolate({
    inputRange: [0, hp('20%')],
    outputRange: [colors.black_common, colors.white],
    extrapolate: 'clamp',
  });

  return (
    <AppContainer>
      <StatusBar
        translucent
        backgroundColor={colors.transparent}
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

