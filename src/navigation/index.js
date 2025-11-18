import * as React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AadhaarInputScreen,
  AttendanceLogsScreen,
  ChangeForgottenPassword,
  ConfirmPunchScreen,
  ForgotPasswordScreen,
  LoginScreen,
  OtpScreen,
  PrivacyPolicyScreen,
  ProfileDrawerScreen,
  ViewProfileScreen,
} from '../screens';
import {
  APP_THEMES,
  DarkTheme,
  DarkThemeColors,
  LightTheme,
  LightThemeColors,
} from '../themes';
import store from '../redux/store';
import DashboardScreen from './BottomTabBar';
import { useAppSelector } from '../redux';

const Stack = createNativeStackNavigator();

export default function AppNavigation() {
  const { appTheme } = useAppSelector(state => state.appState);

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
              ? store.getState().userState?.userAadhaarFaceValidated
                ? 'DashboardScreen'
                : 'AadhaarInputScreen'
              : 'LoginScreen'
          }
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
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
