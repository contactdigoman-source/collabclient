import React, { useCallback, useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurvedBottomBar } from 'react-native-curved-bottom-bar';

import { hp, Icons, Images } from '../constants';
import { AppImage, AppText, RippleButton } from '../components';
import { DaysBottomTabScreen, HomeScreen } from '../screens';
import { useAppSelector } from '../redux';
import { createTableForAttendance } from '../services';
import { PUNCH_DIRECTIONS } from '../constants/location';
import { APP_THEMES } from '../themes';
import {
  isLocationEnabled,
  requestLocationPermission,
} from '../services';
import { NavigationProp } from '../types/navigation';
import { ImageSourcePropType } from 'react-native';

const ATTENDANCE_ICON_SIZE = hp('9%');
const CIRCLE_WIDTH = 60;

interface RouteConfig {
  icon: ImageSourcePropType;
  label: string;
}

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  HomeTab: { icon: Icons.home, label: 'Home' },
  DaysTab: { icon: Icons.calendar, label: 'Days' },
};

interface TabBarProps {
  routeName: string;
  selectedTab: string;
  navigate: (routeName: string) => void;
}

export default function BottomTabBar(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { appTheme } = useAppSelector(state => state.appState);
  const {
    userLastAttendance,
    userAadhaarFaceValidated,
    lastAadhaarVerificationDate,
  } = useAppSelector(state => state.userState);

  useEffect(() => {
    createTableForAttendance();
  }, []);

  const onCancelPress = (): void => {
    // on cancel press of location enabler dialog for android
  };

  // Check if Aadhaar verification is needed (only once per day)
  const isAadhaarVerificationNeeded = useMemo((): boolean => {
    if (!userAadhaarFaceValidated) {
      return true; // Not verified at all
    }

    // Check if verification was done today
    if (!lastAadhaarVerificationDate) {
      return true; // No date stored, need verification
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastVerificationDate = lastAadhaarVerificationDate;

    // If last verification was not today, need to verify again
    return lastVerificationDate !== today;
  }, [userAadhaarFaceValidated, lastAadhaarVerificationDate]);

  const onPunchButtonLongPress = useCallback(async (): Promise<void> => {
    // First checking: Verify Aadhaar is validated (once per day) before allowing punch
    if (isAadhaarVerificationNeeded) {
      navigation.navigate('AadhaarInputScreen');
      return;
    }

    // If Aadhaar is validated, proceed with location check and punch
    const granted = await requestLocationPermission(onCancelPress);
    if (!granted) {
      return;
    }
    const isLocationOn = await isLocationEnabled();
    if (isLocationOn) {
      navigation.navigate('CheckInScreen');
    }
  }, [navigation, isAadhaarVerificationNeeded]);

  const isUserCheckedIn = useMemo(() => {
    return userLastAttendance?.PunchDirection === PUNCH_DIRECTIONS.in;
  }, [userLastAttendance?.PunchDirection]);

  const getAttendanceIcon = useMemo<ImageSourcePropType>(() => {
    if (isUserCheckedIn) {
      return appTheme === APP_THEMES.dark
        ? Images.out_circle_dark
        : Images.out_circle_light;
    }
    return appTheme === APP_THEMES.dark
      ? Images.in_circle_dark
      : Images.in_circle_light;
  }, [appTheme, isUserCheckedIn]);

  const renderIcon = useCallback(
    (routeName: string, selectedTab: string): React.JSX.Element => {
      const { icon, label } = ROUTE_CONFIG[routeName] || ROUTE_CONFIG.HomeTab;
      const isActive = routeName === selectedTab;

      const tintColor = isActive ? colors.primary : colors.white;
      const textColor = isActive ? colors.primary : colors.white;

      return (
        <View style={styles.centered}>
          <AppImage size={hp('2.48%')} source={icon} style={{ tintColor } as any} />
          <AppText size={hp('1.49%')} color={textColor}>
            {label}
          </AppText>
        </View>
      );
    },
    [colors],
  );

  const renderTabBar = useCallback(
    ({ routeName, selectedTab, navigate }: TabBarProps): React.JSX.Element => (
      <RippleButton
        rippleContainerBorderRadius={hp('5%')}
        style={styles.tabButton}
        accessibilityRole="button"
        accessibilityLabel={`${ROUTE_CONFIG[routeName]?.label || 'Tab'} button`}
        onPress={() => navigate(routeName)}
      >
        <View style={styles.centered}>
          {renderIcon(routeName, selectedTab)}
        </View>
      </RippleButton>
    ),
    [renderIcon],
  );

  return (
    <View
      style={[
        styles.flex1,
        {
          backgroundColor: colors.home_footer_bg,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <CurvedBottomBar.Navigator
        type="DOWN"
        screenOptions={{ headerShown: false }}
        style={styles.bottomBar}
        strokeWidth={1}
        shadowStyle={[
          styles.shadow,
          { shadowColor: colors.home_footer_border },
        ]}
        circleWidth={CIRCLE_WIDTH}
        height={CIRCLE_WIDTH}
        circlePosition="CENTER"
        bgColor={colors.home_footer_bg}
        initialRouteName="HomeTab"
        renderCircle={() => (
          <Animated.View
            style={[styles.btnCircle, { backgroundColor: colors.transparent }]}
          >
            <RippleButton
              rippleContainerBorderRadius={ATTENDANCE_ICON_SIZE}
              rippleColor={colors.black}
              style={styles.flex1}
              onLongPress={onPunchButtonLongPress}
              accessibilityRole="button"
              accessibilityLabel="Punch Button"
            >
              <AppImage
                size={ATTENDANCE_ICON_SIZE}
                isRounded
                source={getAttendanceIcon}
              />
            </RippleButton>
          </Animated.View>
        )}
        tabBar={renderTabBar}
      >
        <CurvedBottomBar.Screen
          name="HomeTab"
          position="LEFT"
          component={HomeScreen}
        />
        <CurvedBottomBar.Screen
          name="DaysTab"
          component={DaysBottomTabScreen}
          position="RIGHT"
        />
      </CurvedBottomBar.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  bottomBar: {},
  shadow: {
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 1,
    shadowRadius: 1,
  },
  btnCircle: {
    width: ATTENDANCE_ICON_SIZE,
    height: ATTENDANCE_ICON_SIZE,
    borderRadius: ATTENDANCE_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: ATTENDANCE_ICON_SIZE / 2,
  },
  tabButton: {
    paddingVertical: hp('1%'),
    borderRadius: hp('5%'),
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

