import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import ImagePicker, { ImageOrVideo } from 'react-native-image-crop-picker';

import {
  AnimatedSwitch,
  AppContainer,
  AppText,
  BackHeader,
  ProfileDrawerItem,
  UserImage,
  LanguagePickerModal,
} from '../../components';
import { hp, wp, Icons } from '../../constants';
import { useAppDispatch, useAppSelector, setUserData } from '../../redux';
import { setAppTheme } from '../../redux';
import { APP_THEMES, DarkThemeColors } from '../../themes';
import { logoutUser } from '../../services';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProfileDrawerScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp>();
  const { t, currentLanguage } = useTranslation();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData } = useAppSelector(state => state.userState);

  const [isDisplayCheckoutStatus, setIsDisplayCheckoutStatus] = useState<boolean>(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState<boolean>(false);
  
  const getLanguageDisplayName = (code: string): string => {
    const languages: Record<string, string> = {
      en: t('profile.language.english', 'English'),
      es: t('profile.language.spanish', 'Spanish'),
      hi: t('profile.language.hindi', 'Hindi'),
      bn: t('profile.language.bengali', 'Bengali'),
    };
    return languages[code] || code;
  };

  const handleEditPhoto = useCallback(() => {
    Alert.alert(
      t('auth.profilePhoto.title'),
      t('auth.profilePhoto.subtitle'),
      [
        {
          text: t('auth.profilePhoto.takePhoto'),
          onPress: () => {
            ImagePicker.openCamera({
              width: 300,
              height: 300,
              cropping: true,
              mediaType: 'photo',
            })
              .then((image: ImageOrVideo) => {
                if (userData) {
                  const updatedUser = { ...userData, profilePhoto: image.path };
                  dispatch(setUserData(updatedUser));
                }
              })
              .catch((e: any) => {
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error'), e.message);
                }
              });
          },
        },
        {
          text: t('auth.profilePhoto.chooseFromGallery'),
          onPress: () => {
            ImagePicker.openPicker({
              width: 300,
              height: 300,
              cropping: true,
              mediaType: 'photo',
            })
              .then((image: ImageOrVideo) => {
                if (userData) {
                  const updatedUser = { ...userData, profilePhoto: image.path };
                  dispatch(setUserData(updatedUser));
                }
              })
              .catch((e: any) => {
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error'), e.message);
                }
              });
          },
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ],
    );
  }, [t, dispatch, userData]);


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


  const onGeoLocationsPress = useCallback((): void => {
    //TODO: Navigate to Geo-locations screen
  }, []);

  const onSecurityPress = useCallback((): void => {
    //TODO: Navigate to Security screen
  }, []);

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
            <TouchableOpacity
              style={[styles.editIconContainer, { backgroundColor: colors.card }]}
              onPress={handleEditPhoto}
            >
              <Image
                source={Icons.edit}
                style={[styles.editIcon, { tintColor: colors.text }]}
              />
            </TouchableOpacity>
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
          disabled
          title={t('profile.displayBreakStatus')}
          icon={Icons.display_break_status}
          iconColor={DarkThemeColors.white_common}
          rightContent={
            <AnimatedSwitch
              disabled
              value={isDisplayCheckoutStatus}
              onValueChange={setIsDisplayCheckoutStatus}
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
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: wp(2),
    borderRadius: 20,
    padding: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
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

