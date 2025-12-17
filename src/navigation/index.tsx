import * as React from 'react';
import { View, StatusBar, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Config from 'react-native-config';
import BootSplash from 'react-native-bootsplash';

import {
  AadhaarInputScreen,
  AadhaarOtpScreen,
  AttendanceLogsScreen,
  GeoLocationsScreen,
  ChangeForgottenPassword,
  ChangePasswordScreen,
  CheckInScreen,
  FirstTimeLoginScreen,
  ForgotPasswordScreen,
  LoginScreen,
  OtpScreen,
  PanCardCaptureScreen,
  PermissionsScreen,
  PrivacyPolicyScreen,
  TermsAndConditionsScreen,
  ProfilePhotoScreen,
  ProfileDrawerScreen,
  UsbDebuggingBlockScreen,
  ViewProfileScreen,
  DatabaseViewerScreen,
} from '../screens';
import {
  APP_THEMES,
  DarkTheme,
  DarkThemeColors,
  LightTheme,
  LightThemeColors,
} from '../themes';
import { store } from '../redux';
import DashboardScreen from './BottomTabBar';
import { useAppSelector } from '../redux';
import {
  checkUsbDebuggingStatus,
  isSessionExpired,
  logoutUser,
} from '../services';
import { RootStackParamList } from '../types/navigation';
import { logger } from '../services/logger';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigation(): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const [isUsbDebuggingEnabled, setIsUsbDebuggingEnabled] =
    React.useState<boolean>(false);
  const [isChecking, setIsChecking] = React.useState<boolean>(true);

  // Compute initial route name once on mount
  // Use a fallback to ensure we always have a valid route name
  const initialRouteName = React.useMemo(() => {
    try {
      const userState = store.getState()?.userState;
      if (!userState) {
        logger.debug('[Navigation] No userState, defaulting to LoginScreen');
        return 'LoginScreen';
      }

      const userData = userState.userData;
      const expiresAt = userState.expiresAt;
      
      logger.debug('[Navigation] Checking initial route', {
        hasUserData: !!userData,
        email: userData?.email,
        expiresAt,
        jwtToken: !!userState.jwtToken,
      });
      
      // Check if user is logged in
      if (!userData?.email) {
        logger.debug('[Navigation] No user data, going to LoginScreen');
        return 'LoginScreen';
      }
      
      // Check if session is expired (only if expiresAt is provided)
      if (expiresAt) {
        const expired = isSessionExpired(expiresAt);
        logger.debug('[Navigation] Session expiration check', { expiresAt, expired });
        if (expired) {
          // Session expired - navigate to login
          // Don't call logoutUser here as it's async and navigation isn't ready yet
          // The logout will be handled when user tries to interact with the app
          logger.debug('[Navigation] Session expired, going to LoginScreen');
          return 'LoginScreen';
        }
      } else {
        // If no expiresAt but user is logged in, allow access (might be old session)
        logger.debug('[Navigation] No expiresAt, but user logged in, allowing access');
      }
      
      // Use firstTimeLogin from userData (set by API response)
      const isFirstTime = userData.firstTimeLogin ?? false;
      const route = isFirstTime ? 'FirstTimeLoginScreen' : 'DashboardScreen';
      logger.debug('[Navigation] Navigating to', { route });
      return route;
    } catch (error) {
      logger.error('[Navigation] Error determining initial route', error);
      // Always fallback to LoginScreen if there's any error
      return 'LoginScreen';
    }
  }, []); // Only compute once on mount

  // Check if USB debugging check should be bypassed
  const bypassUsbCheck = Config.BYPASS_USB_DEBUGGING_CHECK === 'true';

  // Check USB debugging status on mount and periodically
  React.useEffect(() => {
    // Bypass USB debugging check if env variable is set
    if (bypassUsbCheck) {
      setIsUsbDebuggingEnabled(false);
      setIsChecking(false);
      return;
    }

    const checkStatus = async (): Promise<void> => {
      if (Platform.OS === 'android') {
        const isEnabled = await checkUsbDebuggingStatus();
        setIsUsbDebuggingEnabled(isEnabled);
        setIsChecking(false);
      } else {
        setIsChecking(false);
      }
    };

    checkStatus();

    // Check every 5 seconds if USB debugging is enabled (only if not bypassed)
    const interval = setInterval(() => {
      if (Platform.OS === 'android' && !bypassUsbCheck) {
        checkUsbDebuggingStatus().then((isEnabled: boolean) => {
          setIsUsbDebuggingEnabled(isEnabled);
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [bypassUsbCheck]);

  // Hide splash when USB debugging screen is shown (moved to top level to follow Rules of Hooks)
  React.useEffect(() => {
    // Only hide splash if we're showing USB debugging screen and checking is complete
    if (
      Platform.OS === 'android' &&
      !bypassUsbCheck &&
      !isChecking &&
      isUsbDebuggingEnabled
    ) {
      BootSplash.hide({ fade: true });
    }
  }, [isChecking, isUsbDebuggingEnabled, bypassUsbCheck]);

  // Show blocking screen if USB debugging is enabled (unless bypassed)
  if (
    Platform.OS === 'android' &&
    !bypassUsbCheck &&
    (isChecking || isUsbDebuggingEnabled)
  ) {
    if (isChecking) {
      return (
        <View style={styles.container}>
          <StatusBar
            barStyle={
              appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'
            }
            translucent={false}
            backgroundColor={
              appTheme === APP_THEMES.dark
                ? DarkThemeColors.black
                : LightThemeColors.black
            }
          />
        </View>
      );
    }
    return <UsbDebuggingBlockScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={
          appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'
        }
        translucent={false}
        backgroundColor={
          appTheme === APP_THEMES.dark
            ? DarkThemeColors.black
            : LightThemeColors.black
        }
      />
      <NavigationContainer
        theme={appTheme === APP_THEMES.dark ? DarkTheme : LightTheme}
        onReady={() => {
          // Hide splash screen only when navigation is ready to prevent black screen
          BootSplash.hide({ fade: true });
        }}
        onError={(error) => {
          // Log navigation errors but don't crash the app
          logger.error('[Navigation] NavigationContainer error', error);
        }}
      >
        <Stack.Navigator
          initialRouteName={initialRouteName || 'LoginScreen'}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen
            name="FirstTimeLoginScreen"
            component={FirstTimeLoginScreen}
          />
          <Stack.Screen
            name="PermissionsScreen"
            component={PermissionsScreen}
          />
          <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
          <Stack.Screen
            name="ForgotPasswordScreen"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen name="CheckInScreen" component={CheckInScreen} />
          <Stack.Screen
            name="ProfileDrawerScreen"
            component={ProfileDrawerScreen}
          />
          <Stack.Screen
            name="AttendanceLogsScreen"
            component={AttendanceLogsScreen}
          />
          <Stack.Screen
            name="GeoLocationsScreen"
            component={GeoLocationsScreen}
          />
          <Stack.Screen
            name="ViewProfileScreen"
            component={ViewProfileScreen}
          />
          <Stack.Screen
            name="DatabaseViewerScreen"
            component={DatabaseViewerScreen}
          />
          <Stack.Screen name="OtpScreen" component={OtpScreen} />
          <Stack.Screen
            name="ChangeForgottenPassword"
            component={ChangeForgottenPassword}
          />
          <Stack.Screen
            name="ChangePasswordScreen"
            component={ChangePasswordScreen}
          />
          <Stack.Screen
            name="AadhaarInputScreen"
            component={AadhaarInputScreen}
          />
          <Stack.Screen
            name="AadhaarOtpScreen"
            component={AadhaarOtpScreen}
          />
          <Stack.Screen
            name="PanCardCaptureScreen"
            component={PanCardCaptureScreen}
          />
          <Stack.Screen
            name="ProfilePhotoScreen"
            component={ProfilePhotoScreen}
          />
          <Stack.Screen
            name="PrivacyPolicyScreen"
            component={PrivacyPolicyScreen}
          />
          <Stack.Screen
            name="TermsAndConditionsScreen"
            component={TermsAndConditionsScreen}
          />
          <Stack.Screen
            name="UsbDebuggingBlockScreen"
            component={UsbDebuggingBlockScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

