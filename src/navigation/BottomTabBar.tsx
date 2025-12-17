import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurvedBottomBar } from 'react-native-curved-bottom-bar';

import { hp, Icons, Images } from '../constants';
import { DarkThemeColors } from '../themes';
import { AppImage, AppText, RippleButton, FaceRDVerificationModal } from '../components';
import { DaysBottomTabScreen, HomeScreen } from '../screens';
import { useAppSelector } from '../redux';
import { createTableForAttendance } from '../services';
import { PUNCH_DIRECTIONS } from '../constants/location';
import { APP_THEMES } from '../themes';
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
    userLastAttendance,
    userAttendanceHistory,
    userAadhaarFaceValidated,
    lastAadhaarVerificationDate,
    userData,
  } = useAppSelector(state => state.userState);

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

    // After device biometric success, check if Aadhaar validation is needed (once per day)
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

  const handleBiometricOTPFallback = useCallback((): void => {
    setShowFaceRDModal(false);
    setIsFaceRDVerifying(false);
    setFaceRDError(null);

    // Navigate to OTP screen for punch flow
    // After OTP success, it will check Aadhaar validation and then proceed to CheckInScreen
    navigation.navigate('OtpScreen', {
      emailID: userData?.email || '',
      isPunchFlow: true,
    });
  }, [navigation, userData]);

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

  // Get today's attendance status - check if user is currently checked in TODAY
  const isUserCheckedIn = useMemo(() => {
    // Check today's attendance - user is checked in if they have checked in today but not checked out
    if (!userAttendanceHistory || userAttendanceHistory.length === 0) {
      logger.debug('isUserCheckedIn: No attendance history');
      return false;
    }
    
    const today = moment.utc().format('YYYY-MM-DD');
    let hasCheckedInToday = false;
    let hasCheckedOutToday = false;
    let lastCheckoutTimestamp = 0;
    let lastCheckInTimestamp = 0;
    
    logger.debug(`isUserCheckedIn: Checking ${userAttendanceHistory.length} records for today: ${today}`);
    
    // Find today's check-in and checkout
    for (const record of userAttendanceHistory) {
      let recordDate: string;
      if (record.DateOfPunch) {
        recordDate = record.DateOfPunch;
      } else if (record.Timestamp) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        recordDate = moment.utc(timestamp).format('YYYY-MM-DD');
      } else {
        continue;
      }
      
      if (recordDate === today) {
        const timestamp = typeof record.Timestamp === 'string' 
          ? parseInt(record.Timestamp, 10) 
          : record.Timestamp;
        
        logger.debug(`isUserCheckedIn: Found today's record - Date: ${recordDate}, PunchDirection: ${record.PunchDirection}, Timestamp: ${timestamp}`);
        
        if (record.PunchDirection === PUNCH_DIRECTIONS.in) {
          hasCheckedInToday = true;
          if (timestamp > lastCheckInTimestamp) {
            lastCheckInTimestamp = timestamp;
          }
        } else if (record.PunchDirection === PUNCH_DIRECTIONS.out) {
          hasCheckedOutToday = true;
          if (timestamp > lastCheckoutTimestamp) {
            lastCheckoutTimestamp = timestamp;
          }
        }
      }
    }
    
    logger.debug(`isUserCheckedIn: hasCheckedInToday=${hasCheckedInToday}, hasCheckedOutToday=${hasCheckedOutToday}, lastCheckIn=${lastCheckInTimestamp}, lastCheckout=${lastCheckoutTimestamp}`);
    
    // User is checked in if they have checked in today and either:
    // 1. Haven't checked out yet, OR
    // 2. Last action was check-in (check-in timestamp > checkout timestamp)
    if (hasCheckedInToday) {
      if (!hasCheckedOutToday) {
        logger.debug('isUserCheckedIn: User checked in today, no checkout - returning true');
        return true; // Checked in but not checked out
      }
      // Both exist - check which was last
      const result = lastCheckInTimestamp > lastCheckoutTimestamp;
      logger.debug(`isUserCheckedIn: Both check-in and checkout exist, lastCheckIn > lastCheckout: ${result}`);
      return result;
    }

    return false; // Not checked in today
  }, [userAttendanceHistory, userLastAttendance?.Timestamp]);

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
          backgroundColor: (colors as any).home_footer_bg || DarkThemeColors.home_footer_bg,
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
          { shadowColor: (colors as any).home_footer_border || DarkThemeColors.home_footer_border },
        ]}
        circleWidth={CIRCLE_WIDTH}
        height={CIRCLE_WIDTH}
        circlePosition="CENTER"
        bgColor={(colors as any).home_footer_bg || DarkThemeColors.home_footer_bg}
        initialRouteName="HomeTab"
        renderCircle={() => (
          <Animated.View
            style={[styles.btnCircle, { backgroundColor: (colors as any).transparent || DarkThemeColors.transparent }]}
          >
            <RippleButton
              rippleContainerBorderRadius={ATTENDANCE_ICON_SIZE}
              rippleColor={(colors as any).black || DarkThemeColors.black}
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

