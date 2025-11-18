import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';

import {
  AnimatedSwitch,
  AppContainer,
  AppText,
  BackHeader,
  ProfileDrawerItem,
  UserImage,
} from '../components';
import { hp, Icons, Images } from '../constants';
import { useAppDispatch, useAppSelector } from '../redux';
import { setAppTheme } from '../redux/appReducer';
import { APP_THEMES } from '../themes';
import { clearStorage } from '../redux/storage';
import { logoutUser } from '../services/login-service';

export default function ProfileDrawerScreen() {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData } = useAppSelector(state => state.userState);

  const [isDisplayCheckoutStatus, setIsDisplayCheckoutStatus] = useState(false);

  const toggleBreakStatus = useCallback(() => {
    //TODO
  }, []);

  const toggleAppTheme = useCallback(() => {
    if (appTheme === APP_THEMES.dark) {
      dispatch(setAppTheme(APP_THEMES.light));
    } else {
      dispatch(setAppTheme(APP_THEMES.dark));
    }
  }, [appTheme]);

  const onAttendanceLogsPress = useCallback(() => {
    navigation.navigate('AttendanceLogsScreen');
  }, []);

  const onViewProfilePress = useCallback(() => {
    navigation.navigate('ViewProfileScreen');
  }, []);

  const onSupportAndLearnPress = useCallback(() => {
    //TODO
  }, []);

  const onLogoutPress = useCallback(async () => {
    await logoutUser();
    navigation.reset({
      index: 0,
      routes: [{ name: 'LoginScreen' }],
    });
  }, [navigation]);

  return (
    <AppContainer>
      <BackHeader />
      <View style={styles.profileContainer}>
        <UserImage
          size={hp(15)}
          source={null}
          userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
          isAttendanceStatusVisible={false}
        />
        <AppText numberOfLines={1} size={hp(2.73)} style={styles.userName}>
          {`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        </AppText>
        <AppText>{'Member'}</AppText>
      </View>
      <ProfileDrawerItem
        disabled
        title={'Display Break Status'}
        icon={Icons.display_break_status}
        iconColor={colors.white}
        rightContent={
          <AnimatedSwitch
            disabled
            value={isDisplayCheckoutStatus}
            onValueChange={setIsDisplayCheckoutStatus}
            style={{ marginEnd: hp(2) }}
          />
        }
      />
      <ProfileDrawerItem
        disabled
        title={'Dark Mode'}
        icon={Icons.dark_mode}
        iconColor={colors.white}
        rightContent={
          <AnimatedSwitch
            value={appTheme === APP_THEMES.dark}
            onValueChange={toggleAppTheme}
            style={{ marginEnd: hp(2) }}
          />
          // <RippleButton onPress={toggleAppTheme}>
          //   <AppText color={colors.primary} style={{ marginHorizontal: hp(2) }}>
          //     {appTheme === APP_THEMES.dark ? 'Disable' : 'Enable'}
          //   </AppText>
          // </RippleButton>
        }
      />
      <ProfileDrawerItem
        title={'Attendance Logs'}
        icon={Icons.attendance_logs}
        iconColor={colors.white}
        onPress={onAttendanceLogsPress}
      />
      <ProfileDrawerItem
        title={'View Profile'}
        icon={Icons.profile_circle}
        iconColor={colors.white}
        onPress={onViewProfilePress}
      />
      <ProfileDrawerItem
        title={'Support & Learn'}
        icon={Icons.support_learn}
        iconColor={colors.white}
        onPress={onSupportAndLearnPress}
      />
      <ProfileDrawerItem
        title={'Logout'}
        icon={Icons.logout}
        iconColor={colors.white}
        onPress={onLogoutPress}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  userName: {
    margin: hp(1),
  },
});
