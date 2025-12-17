import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';

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
import { profileSyncService } from '../../services/sync/profile-sync-service';
import { logger } from '../../services/logger';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProfileDrawerScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { t, currentLanguage } = useTranslation();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData, displayBreakStatus } = useAppSelector(state => state.userState);

  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState<boolean>(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load profile data from DB
  const loadProfileFromDB = useCallback(async () => {
    if (!userData?.email) return;
    
      try {
        // Load profile from SQLite (offline-first)
        const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
        if (dbProfile) {
          // Load all profile data from DB
          setProfilePhoto(dbProfile.profilePhotoUrl || null);
      } else {
        // Fallback to Redux if DB is empty
        setProfilePhoto(userData?.profilePhotoUrl || userData?.profilePhoto || null);
      }
    } catch (dbError) {
      logger.warn('Error loading profile from DB', dbError);
      // Fallback to Redux
      setProfilePhoto(userData?.profilePhotoUrl || userData?.profilePhoto || null);
    }
  }, [userData?.email, userData?.profilePhoto, userData?.profilePhotoUrl]);

  // Load profile data on mount - load from DB
  useEffect(() => {
    loadProfileFromDB();
  }, [loadProfileFromDB]);

  // Handle pull-to-refresh - sync profile from server
  const onRefresh = useCallback(async () => {
    if (!userData?.email) {
      setRefreshing(false);
      return;
    }
    
    setRefreshing(true);
    
    try {
      // Call getProfile() to sync from server (only updates DB if server.lastSyncedAt >= local.lastUpdatedAt)
      await getProfile();
      
      // Reload from DB after sync
      await loadProfileFromDB();
    } catch (error: any) {
      // Silently fail - app should work even if profile service is down
      logger.warn('[ProfileDrawer] Failed to sync profile (service may be down)', error);
      // Still reload from DB in case there's cached data
      await loadProfileFromDB();
    } finally {
      setRefreshing(false);
    }
  }, [userData?.email, loadProfileFromDB]);
  
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
    navigation.navigate('AttendanceLogsScreen', { filterToday: true });
  }, [navigation]);

  const onViewProfilePress = useCallback((): void => {
    navigation.navigate('ViewProfileScreen');
  }, [navigation]);

  const onDatabaseViewerPress = useCallback((): void => {
    navigation.navigate('DatabaseViewerScreen');
  }, [navigation]);


  const onGeoLocationsPress = useCallback((): void => {
    navigation.navigate('GeoLocationsScreen', { filterToday: true });
  }, [navigation]);

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
      logger.error('Error during logout', error);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.profileContainer}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorder}>
              <UserImage
                size={hp(15.6)} // 127px equivalent
                source={profilePhoto ? { uri: profilePhoto } : null}
                userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || undefined}
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
          iconColor={colors.text}
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
          iconColor={colors.text}
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
          iconColor={colors.text}
          rightContent={
            <AppText
              size={hp(1.8)}
              style={{ marginEnd: hp(2), opacity: 0.7 }}
              color={colors.text}
            >
              {getLanguageDisplayName(currentLanguage)}
            </AppText>
          }
          onPress={onLanguagePress}
        />

        {/* Attendance Logs */}
        <ProfileDrawerItem
          title={t('profile.attendanceLogs')}
          icon={Icons.attendance_logs}
          iconColor={colors.text}
          onPress={onAttendanceLogsPress}
        />

        {/* View Profile */}
        <ProfileDrawerItem
          title={t('profile.viewProfile')}
          icon={Icons.profile_circle}
          iconColor={colors.text}
          onPress={onViewProfilePress}
        />

        {/* Database Viewer (Debug - Dev Mode Only) */}
        {__DEV__ && (
          <ProfileDrawerItem
            title="Database Viewer"
            icon={Icons.profile_circle}
            iconColor={colors.text}
            onPress={onDatabaseViewerPress}
          />
        )}

        {/* Geo-locations */}
        <ProfileDrawerItem
          title={t('profile.geoLocations')}
          icon={Icons.geo_locations}
          iconColor={colors.text}
          onPress={onGeoLocationsPress}
        />

        {/* Security */}
        <ProfileDrawerItem
          title={t('profile.security')}
          icon={Icons.security}
          iconColor={colors.text}
          onPress={onSecurityPress}
        />

        {/* Support & Learn */}
        <ProfileDrawerItem
          title={t('profile.supportAndLearn')}
          icon={Icons.support_learn}
          iconColor={colors.text}
          onPress={onSupportAndLearnPress}
        />

        {/* Logout */}
        <ProfileDrawerItem
          title={t('profile.logout')}
          icon={Icons.logout}
          iconColor={colors.text}
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

