import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurvedBottomBar } from 'react-native-curved-bottom-bar';

import { hp, Icons, Images } from '../constants';
import { DarkThemeColors } from '../themes';
import { AppImage, AppText, RippleButton, FaceRDVerificationModal } from '../components';
import { DaysBottomTabScreen, HomeScreen } from '../screens';
import { useAppSelector, store } from '../redux';
import { createTableForAttendance } from '../services';
import { APP_THEMES } from '../themes';
import { useCheckInStatus } from '../hooks/useCheckInStatus';
import {
  isLocationEnabled,
  requestLocationPermission,
  verifyBiometricForPunch,
} from '../services';
import { NavigationProp } from '../types/navigation';
import { ImageSourcePropType } from 'react-native';
import moment from 'moment';
import { logger } from '../services/logger';

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
  const theme = useTheme();
  const colors = useMemo(() => theme?.colors || {}, [theme?.colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { appTheme } = useAppSelector(state => state.appState);
  const {
    userAadhaarFaceValidated,
    lastAadhaarVerificationDate,
    userData,
  } = useAppSelector(state => state.userState);

  // Use shared hook for check-in status
  const checkInStatus = useCheckInStatus();
  const isUserCheckedIn = checkInStatus.isUserCheckedIn;
  
  // Check if data is initialized (userData must exist for button to work)
  const isDataInitialized = !!userData?.email;

  const [showFaceRDModal, setShowFaceRDModal] = useState<boolean>(false);
  const [isFaceRDVerifying, setIsFaceRDVerifying] = useState<boolean>(false);
  const [faceRDError, setFaceRDError] = useState<string | null>(null);

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

    // Use UTC date for consistency (stored dates are in UTC format YYYY-MM-DD)
    const today = moment.utc().format('YYYY-MM-DD');
    const lastVerificationDate = lastAadhaarVerificationDate;

    // If last verification was not today, need to verify again
    return lastVerificationDate !== today;
  }, [userAadhaarFaceValidated, lastAadhaarVerificationDate]);

  const handleBiometricSuccess = useCallback(async (): Promise<void> => {
    setShowFaceRDModal(false);
    setIsFaceRDVerifying(false);
    setFaceRDError(null);

    // Check profile data to see if Aadhaar is verified
    const aadhaarVerification = userData?.aadhaarVerification;
    const isAadhaarVerified = aadhaarVerification?.isVerified === true;

    // If Aadhaar is not verified in profile, navigate to Aadhaar screen
    if (!isAadhaarVerified) {
      navigation.navigate('AadhaarInputScreen');
      return;
    }

    // After device biometric success, check if Aadhaar validation is needed (once per day)
    // This checks if verification was done today (local state check)
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
  }, [navigation, isAadhaarVerificationNeeded, userData]);

  const handleBiometricOTPFallback = useCallback((): void => {
    setShowFaceRDModal(false);
    setIsFaceRDVerifying(false);
    setFaceRDError(null);

    // Navigate to OTP screen for punch flow
    const currentUserData = store.getState()?.userState?.userData;
    if (currentUserData?.email) {
      navigation.navigate('OtpScreen', {
        emailID: currentUserData.email,
        isPunchFlow: true,
      });
    } else {
      logger.error('BottomTabBar: User email not found for OTP fallback');
      // Fallback: navigate back to dashboard
      navigation.navigate('DashboardScreen');
    }
  }, [navigation]);

  const handleBiometricCancel = useCallback((): void => {
    setShowFaceRDModal(false);
    setIsFaceRDVerifying(false);
    setFaceRDError(null);
  }, []);

  const onPunchButtonLongPress = useCallback(async (): Promise<void> => {
    // First: Device Face ID/Biometric/OTP verification for punch (every time)
    // Show biometric verification modal
    setShowFaceRDModal(true);
    setIsFaceRDVerifying(true);
    setFaceRDError(null);

    try {
      logger.debug('onPunchButtonLongPress: Starting biometric verification');
      // Verify device biometric (Face ID/Touch ID/Fingerprint) for punch
      await verifyBiometricForPunch();
      logger.debug('onPunchButtonLongPress: Biometric verification successful');
      // Success will be handled by the modal's auto-dismiss
      setIsFaceRDVerifying(false);
    } catch (error: any) {
      logger.warn('onPunchButtonLongPress: Biometric verification failed', error);
      setIsFaceRDVerifying(false);
      // Show generic error (no detailed error message)
      setFaceRDError('Biometric verification failed');
    }
  }, []);

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

      const tintColor = isActive 
        ? (colors.primary || DarkThemeColors.primary) 
        : (colors.text || DarkThemeColors.white_common);
      const textColor = isActive 
        ? (colors.primary || DarkThemeColors.primary) 
        : (colors.text || DarkThemeColors.white_common);

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
        {...({ style: styles.tabButton } as any)}
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
          backgroundColor: (colors as any).home_footer_bg || DarkThemeColors.home_footer_bg,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <CurvedBottomBar.Navigator
        {...({
          type: "DOWN",
          screenOptions: { headerShown: false },
          style: styles.bottomBar,
          shadowStyle: [
            styles.shadow,
            { shadowColor: (colors as any).home_footer_border || DarkThemeColors.home_footer_border },
          ],
          circleWidth: CIRCLE_WIDTH,
          height: CIRCLE_WIDTH,
          circlePosition: "CENTER",
          bgColor: (colors as any).home_footer_bg || DarkThemeColors.home_footer_bg,
          initialRouteName: "HomeTab",
        } as any)}
        renderCircle={() => (
          <Animated.View
            style={[styles.btnCircle, { backgroundColor: (colors as any).transparent || DarkThemeColors.transparent }]}
          >
            <RippleButton
              rippleColor={(colors as any).black || DarkThemeColors.black}
              {...({ style: styles.flex1 } as any)}
              onLongPress={isDataInitialized ? onPunchButtonLongPress : undefined}
              disabled={!isDataInitialized}
              accessibilityRole="button"
              accessibilityLabel="Punch Button"
            >
              <AppImage
                size={ATTENDANCE_ICON_SIZE}
                isRounded
                source={getAttendanceIcon}
                style={!isDataInitialized ? { opacity: 0.5 } : undefined}
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
          options={{ lazy: true }}
        />
        <CurvedBottomBar.Screen
          name="DaysTab"
          component={DaysBottomTabScreen}
          position="RIGHT"
          options={{ lazy: true }}
        />
      </CurvedBottomBar.Navigator>

      <FaceRDVerificationModal
        visible={showFaceRDModal}
        isVerifying={isFaceRDVerifying}
        error={faceRDError}
        onSuccess={handleBiometricSuccess}
        onOTPFallback={handleBiometricOTPFallback}
        onCancel={handleBiometricCancel}
      />
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

