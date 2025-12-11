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
  ChangeForgottenPassword,
  CheckInScreen,
  ConfirmPunchScreen,
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
} from '../services';
import { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigation(): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const [isUsbDebuggingEnabled, setIsUsbDebuggingEnabled] =
    React.useState<boolean>(false);
  const [isChecking, setIsChecking] = React.useState<boolean>(true);

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
      >
        <Stack.Navigator
          initialRouteName={
            (() => {
              const userData = store.getState().userState.userData;
              if (!userData?.email) {
                return 'LoginScreen';
              }
              // Use firstTimeLogin from userData (set by API response)
              const isFirstTime = userData.firstTimeLogin ?? false;
              return isFirstTime ? 'FirstTimeLoginScreen' : 'DashboardScreen';
            })()
          }
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
            name="ConfirmPunchScreen"
            component={ConfirmPunchScreen}
          />
          <Stack.Screen
            name="ProfileDrawerScreen"
            component={ProfileDrawerScreen}
          />
          <Stack.Screen
            name="AttendanceLogsScreen"
            component={AttendanceLogsScreen}
          />
          <Stack.Screen
            name="ViewProfileScreen"
            component={ViewProfileScreen}
          />
          <Stack.Screen name="OtpScreen" component={OtpScreen} />
          <Stack.Screen
            name="ChangeForgottenPassword"
            component={ChangeForgottenPassword}
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
