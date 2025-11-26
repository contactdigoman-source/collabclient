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
} from '../../components';
import { hp, Icons } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../redux';
import { setAppTheme } from '../../redux';
import { APP_THEMES } from '../../themes';
import { logoutUser } from '../../services';
import { NavigationProp } from '../../types/navigation';

export default function ProfileDrawerScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp>();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData } = useAppSelector(state => state.userState);

  const [isDisplayCheckoutStatus, setIsDisplayCheckoutStatus] = useState<boolean>(false);

  const toggleBreakStatus = useCallback((): void => {
    //TODO
  }, []);

  const toggleAppTheme = useCallback((): void => {
    if (appTheme === APP_THEMES.dark) {
      dispatch(setAppTheme(APP_THEMES.light));
    } else {
      dispatch(setAppTheme(APP_THEMES.dark));
    }
  }, [appTheme, dispatch]);

  const onAttendanceLogsPress = useCallback((): void => {
    navigation.navigate('AttendanceLogsScreen');
  }, [navigation]);

  const onViewProfilePress = useCallback((): void => {
    navigation.navigate('ViewProfileScreen');
  }, [navigation]);

  const onSupportAndLearnPress = useCallback((): void => {
    //TODO
  }, []);

  const onLogoutPress = useCallback(async (): Promise<void> => {
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

