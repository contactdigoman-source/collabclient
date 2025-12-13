import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AnimatedSwitch,
  AppContainer,
  AppText,
  BackHeader,
  ProfileDrawerItem,
  UserImage,
  LanguagePickerModal,
} from '../../components';
import { hp, Icons } from '../../constants';
import { useAppDispatch, useAppSelector, setDisplayBreakStatus } from '../../redux';
import { setAppTheme } from '../../redux';
import { APP_THEMES, DarkThemeColors } from '../../themes';
import { logoutUser, getProfile } from '../../services';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProfileDrawerScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp>();
  const { t, currentLanguage } = useTranslation();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData, displayBreakStatus } = useAppSelector(state => state.userState);

  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState<boolean>(false);

  // Load profile data on mount - gracefully handle service unavailability
  useEffect(() => {
    const loadProfile = async () => {
      if (!userData?.email) return;
      
      try {
        await getProfile();
      } catch (error: any) {
        // Silently fail - app should work even if profile service is down
        // User can still use the app with cached data from Redux
        console.warn('[ProfileDrawer] Failed to load profile (service may be down):', error.message);
        // Don't show error to user - app should continue working
      }
    };

    loadProfile();
  }, [userData?.email]); // Run when email changes
  
  const getLanguageDisplayName = (code: string): string => {
    const languages: Record<string, string> = {
      en: t('profile.language.english', 'English'),
      es: t('profile.language.spanish', 'Spanish'),
      hi: t('profile.language.hindi', 'Hindi'),
      bn: t('profile.language.bengali', 'Bengali'),
    };
    return languages[code] || code;
  };



  const toggleAppTheme = useCallback((): void => {
    if (appTheme === APP_THEMES.dark) {
      dispatch(setAppTheme(APP_THEMES.light));
    } else {
      dispatch(setAppTheme(APP_THEMES.dark));
    }
  }, [appTheme, dispatch]);

  const toggleDisplayBreakStatus = useCallback((): void => {
    dispatch(setDisplayBreakStatus(!displayBreakStatus));
  }, [dispatch, displayBreakStatus]);

  const onAttendanceLogsPress = useCallback((): void => {
    navigation.navigate('AttendanceLogsScreen');
  }, [navigation]);

  const onViewProfilePress = useCallback((): void => {
    navigation.navigate('ViewProfileScreen');
  }, [navigation]);


  const onGeoLocationsPress = useCallback((): void => {
    // Disabled for now
  }, []);

  const onSecurityPress = useCallback((): void => {
    navigation.navigate('ChangePasswordScreen');
  }, [navigation]);

  const onSupportAndLearnPress = useCallback((): void => {
    const supportEmail = t('profile.supportEmail', 'support@example.com');
    Alert.alert(
      t('profile.supportAndLearn'),
      `${t('common.contact', 'Contact us at')}: ${supportEmail}`,
      [{ text: t('common.okay', 'Okay') }]
    );
  }, [t]);

  const onLogoutPress = useCallback(async (): Promise<void> => {
    try {
      await logoutUser();
      if (navigation && navigation.reset) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'LoginScreen' }],
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if navigation fails, try to navigate
      if (navigation && navigation.navigate) {
        navigation.navigate('LoginScreen');
      }
    }
  }, [navigation]);

  const onLanguagePress = useCallback((): void => {
    setIsLanguageModalVisible(true);
  }, []);

  return (
    <AppContainer>
      <BackHeader />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileContainer}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorder}>
              <UserImage
                size={hp(15.6)} // 127px equivalent
                source={userData?.profilePhoto ? { uri: userData.profilePhoto } : null}
                userName={userData?.profilePhoto ? undefined : `${userData?.firstName || ''} ${userData?.lastName || ''}`}
                isAttendanceStatusVisible={false}
                charsCount={2}
              />
            </View>
          </View>
          <AppText numberOfLines={1} size={hp(2.7)} style={styles.userName}>
            {`${userData?.firstName || ''} ${userData?.lastName || ''}`}
          </AppText>
          <AppText size={hp(1.47)} style={styles.memberText}>
            {t('profile.member')}
          </AppText>
        </View>

        {/* Display Break Status */}
        <ProfileDrawerItem
          title={t('profile.displayBreakStatus')}
          icon={Icons.display_break_status}
          iconColor={DarkThemeColors.white_common}
          rightContent={
            <AnimatedSwitch
              value={displayBreakStatus}
              onValueChange={toggleDisplayBreakStatus}
              style={{ marginEnd: hp(2) }}
            />
          }
        />

        {/* Dark Mode */}
        <ProfileDrawerItem
          disabled
          title={t('profile.darkMode')}
          icon={Icons.dark_mode}
          iconColor={DarkThemeColors.white_common}
          rightContent={
            <AnimatedSwitch
              value={appTheme === APP_THEMES.dark}
              onValueChange={toggleAppTheme}
              style={{ marginEnd: hp(2) }}
            />
          }
        />

        {/* Preferred Language */}
        <ProfileDrawerItem
          title={t('profile.preferredLanguage', 'Preferred Language')}
          icon={Icons.name}
          iconColor={DarkThemeColors.white_common}
          rightContent={
            <AppText
              size={hp(1.8)}
              style={{ marginEnd: hp(2), opacity: 0.7 }}
              color={DarkThemeColors.white_common}
            >
              {getLanguageDisplayName(currentLanguage)}
            </AppText>
          }
          onPress={onLanguagePress}
        />

        {/* Attendance Logs */}
        <ProfileDrawerItem
          disabled
          title={t('profile.attendanceLogs')}
          icon={Icons.attendance_logs}
          iconColor={DarkThemeColors.white_common}
          onPress={onAttendanceLogsPress}
        />

        {/* View Profile */}
        <ProfileDrawerItem
          title={t('profile.viewProfile')}
          icon={Icons.profile_circle}
          iconColor={DarkThemeColors.white_common}
          onPress={onViewProfilePress}
        />

        {/* Geo-locations */}
        <ProfileDrawerItem
          disabled
          title={t('profile.geoLocations')}
          icon={Icons.geo_locations}
          iconColor={DarkThemeColors.white_common}
          onPress={onGeoLocationsPress}
        />

        {/* Security */}
        <ProfileDrawerItem
          title={t('profile.security')}
          icon={Icons.security}
          iconColor={DarkThemeColors.white_common}
          onPress={onSecurityPress}
        />

        {/* Support & Learn */}
        <ProfileDrawerItem
          title={t('profile.supportAndLearn')}
          icon={Icons.support_learn}
          iconColor={DarkThemeColors.white_common}
          onPress={onSupportAndLearnPress}
        />

        {/* Logout */}
        <ProfileDrawerItem
          title={t('profile.logout')}
          icon={Icons.logout}
          iconColor={DarkThemeColors.white_common}
          onPress={onLogoutPress}
        />

        {/* Version */}
        <View style={styles.versionContainer}>
          <AppText size={hp(1.47)} style={styles.versionText}>
            {t('profile.version')}
          </AppText>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <LanguagePickerModal
        visible={isLanguageModalVisible}
        onClose={() => setIsLanguageModalVisible(false)}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  profileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(5),
    marginBottom: hp(3),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: hp(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBorder: {
    borderWidth: 4,
    borderColor: '#62C268',
    borderRadius: hp(15.6) / 2,
    overflow: 'hidden',
  },
  userName: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(2.7), // 22px equivalent
    lineHeight: hp(3.8), // 31px equivalent
    textAlign: 'center',
    color: DarkThemeColors.white_common,
    marginTop: hp(1),
  },
  memberText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(1.47), // 12px equivalent
    lineHeight: hp(1.96), // 16px equivalent
    textAlign: 'center',
    color: DarkThemeColors.white_common,
    marginTop: hp(0.5),
  },
  versionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(3),
    marginBottom: hp(2),
  },
  versionText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(1.47), // 12px equivalent
    lineHeight: hp(1.96), // 16px equivalent
    textAlign: 'center',
    color: '#ADADAD',
  },
});

