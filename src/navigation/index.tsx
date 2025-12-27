import * as React from 'react';
import { View, StatusBar, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, NavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Config from 'react-native-config';
import BootSplash from 'react-native-bootsplash';

import {
  AadhaarInputScreen,
  AadhaarOtpScreen,
  AttendanceLogsScreen,
  GeoLocationsScreen,
  ChangePasswordScreen,
  CheckInScreen,
  FirstTimeLoginScreen,
  ForgotPasswordScreen,
  LoginScreen,
  LoginOtpScreen,
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
  checkAndRefreshSession,
} from '../services';
import { RootStackParamList } from '../types/navigation';
import { logger } from '../services/logger';
import { navigationHelper } from '../services/navigation/navigation-helper';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigation ref to allow navigation from non-React contexts
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

export default function AppNavigation(): React.JSX.Element {
  
  const { appTheme } = useAppSelector(state => state.appState);
  const [isUsbDebuggingEnabled, setIsUsbDebuggingEnabled] = React.useState<boolean>(false)
  const [isChecking, setIsChecking] = React.useState<boolean>(true);
  const [isRehydrated, setIsRehydrated] = React.useState<boolean>(false);
  const [initialRoute, setInitialRoute] = React.useState<string>('LoginScreen');

  // Listen for logout navigation events from interceptors
  React.useEffect(() => {
    const unsubscribe = navigationHelper.onNavigateToLogin(() => {
      if (navigationRef.current?.isReady()) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'LoginScreen' }],
          })
        );
      }
    });

    return unsubscribe;
  }, []);

  // Determine initial route after Redux Persist rehydration
  // Use state to allow async session check with token refresh
  React.useEffect(() => {
    const determineInitialRoute = async () => {
      try {
        // Wait a bit for Redux Persist to rehydrate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const userState = store.getState()?.userState;
        if (!userState) {
          logger.debug('[Navigation] No userState, defaultting to LoginScreen');
          setInitialRoute('LoginScreen');
          setIsRehydrated(true);
          return;
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
          setInitialRoute('LoginScreen');
          setIsRehydrated(true);
          return;
        }
        
        // Check session and refresh if about to expire (only if expiresAt is provided)
        if (expiresAt) {
          const isSessionValid = await checkAndRefreshSession(expiresAt, 30); // 30 minutes before expiry
          logger.debug('[Navigation] Session check result', { expiresAt, isSessionValid });
          
          if (!isSessionValid) {
            // Session expired and couldn't be refreshed - navigate to login
            logger.debug('[Navigation] Session expired, going to LoginScreen');
            setInitialRoute('LoginScreen');
            setIsRehydrated(true);
            return;
          }
          
          // Get updated expiresAt after potential refresh
          const updatedUserState = store.getState()?.userState;
          const updatedExpiresAt = updatedUserState?.expiresAt;
          logger.debug('[Navigation] Session valid, expiresAt', { 
            original: expiresAt, 
            updated: updatedExpiresAt 
          });
        } else {
          // If no expiresAt but user is logged in, allow access (might be old session)
          logger.debug('[Navigation] No expiresAt, but user logged in, allowing access');
        }
        
        logger.debug('[Navigation] User logged in, navigating to DashboardScreen');
        setInitialRoute('DashboardScreen');
        setIsRehydrated(true);
      } catch (error) {
        logger.error('[Navigation] Error determining initial route', error);
        // Always fallback to LoginScreen if there's any error
        setInitialRoute('LoginScreen');
        setIsRehydrated(true);
      }
    };

    determineInitialRoute();
  }, []); // Only run once on mount

  // Check if USB debugging check should be bypassed
  const bypassUsbCheck = Config.BYPASS_USB_DEBUGGING_CHECK === 'true';

  // Check USB debugging status on mount and when app comes to foreground (Android only)
  // User needs to put app in background to change USB debugging settings, so we only check when app returns
  React.useEffect(() => {
    // USB debugging check is only needed on Android
    if (Platform.OS !== 'android') {
      setIsChecking(false);
      return;
    }

    // Bypass USB debugging check if env variable is set
    if (bypassUsbCheck) {
      setIsUsbDebuggingEnabled(false);
      setIsChecking(false);
      return;
    }

    const checkStatus = async (): Promise<void> => {
      const isEnabled = await checkUsbDebuggingStatus();
      setIsUsbDebuggingEnabled(isEnabled);
      setIsChecking(false);
    };

    // Check on mount
    checkStatus();

    // Listen for app state changes - check when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === 'active' && !bypassUsbCheck) {
        // App came to foreground - check USB debugging status
        checkStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
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

  // Wait for rehydration and initial route determination before rendering navigator
  if (!isRehydrated) {
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
        ref={navigationRef}
        theme={appTheme === APP_THEMES.dark ? DarkTheme : LightTheme}
        onReady={() => {
          // Hide splash screen only when navigation is ready to prevent black screen
          BootSplash.hide({ fade: true });
        }}
      >
        <Stack.Navigator initialRouteName={initialRoute || 'LoginScreen'} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name="FirstTimeLoginScreen" component={FirstTimeLoginScreen} />
          <Stack.Screen name="PermissionsScreen" component={PermissionsScreen} />
          <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
          <Stack.Screen name="ForgotPasswordScreen" component={ForgotPasswordScreen} />
          <Stack.Screen name="CheckInScreen" component={CheckInScreen} />
          <Stack.Screen name="ProfileDrawerScreen" component={ProfileDrawerScreen} />
          <Stack.Screen name="AttendanceLogsScreen" component={AttendanceLogsScreen} />
          <Stack.Screen name="GeoLocationsScreen" component={GeoLocationsScreen} />
          <Stack.Screen name="ViewProfileScreen" component={ViewProfileScreen} />
          <Stack.Screen name="DatabaseViewerScreen" component={DatabaseViewerScreen} />
          <Stack.Screen name="OtpScreen" component={OtpScreen} />
          <Stack.Screen name="LoginOtpScreen" component={LoginOtpScreen} />
          <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
          <Stack.Screen name="AadhaarInputScreen" component={AadhaarInputScreen} />
          <Stack.Screen name="AadhaarOtpScreen" component={AadhaarOtpScreen} />
          <Stack.Screen name="PanCardCaptureScreen" component={PanCardCaptureScreen} />
          <Stack.Screen name="ProfilePhotoScreen" component={ProfilePhotoScreen} />
          <Stack.Screen name="PrivacyPolicyScreen" component={PrivacyPolicyScreen} />
          <Stack.Screen name="TermsAndConditionsScreen" component={TermsAndConditionsScreen} />
          <Stack.Screen name="UsbDebuggingBlockScreen" component={UsbDebuggingBlockScreen} />
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

