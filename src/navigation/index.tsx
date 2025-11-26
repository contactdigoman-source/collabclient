import * as React from 'react';
import { View, StatusBar, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AadhaarInputScreen,
  AttendanceLogsScreen,
  ChangeForgottenPassword,
  ConfirmPunchScreen,
  FirstTimeLoginScreen,
  ForgotPasswordScreen,
  LoginScreen,
  OtpScreen,
  PermissionsScreen,
  PrivacyPolicyScreen,
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
import { checkUsbDebuggingStatus, hasCompletedFirstTimeLogin } from '../services';
import { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigation(): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const [isUsbDebuggingEnabled, setIsUsbDebuggingEnabled] = React.useState<boolean>(false);
  const [isChecking, setIsChecking] = React.useState<boolean>(true);

  // Check USB debugging status on mount and periodically
  React.useEffect(() => {
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

    // Check every 5 seconds if USB debugging is enabled
    const interval = setInterval(() => {
      if (Platform.OS === 'android') {
        checkUsbDebuggingStatus().then((isEnabled: boolean) => {
          setIsUsbDebuggingEnabled(isEnabled);
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Show blocking screen if USB debugging is enabled
  if (Platform.OS === 'android' && (isChecking || isUsbDebuggingEnabled)) {
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
      >
        <Stack.Navigator
          initialRouteName={
            store.getState().userState.userData?.email
              ? hasCompletedFirstTimeLogin()
                ? 'DashboardScreen'
                : 'FirstTimeLoginScreen'
              : 'LoginScreen'
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
            name="PrivacyPolicyScreen"
            component={PrivacyPolicyScreen}
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

