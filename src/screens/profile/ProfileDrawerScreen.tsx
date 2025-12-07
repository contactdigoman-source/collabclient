import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import ImagePicker, { ImageOrVideo } from 'react-native-image-crop-picker';

import {
  AnimatedSwitch,
  AppContainer,
  AppText,
  BackHeader,
  ProfileDrawerItem,
  UserImage,
} from '../../components';
import { hp, Icons } from '../../constants';
import { useAppDispatch, useAppSelector, setUserData } from '../../redux';
import { setAppTheme } from '../../redux';
import { APP_THEMES } from '../../themes';
import { logoutUser } from '../../services';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProfileDrawerScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const { appTheme } = useAppSelector(state => state.appState);
  const { userData } = useAppSelector(state => state.userState);

  const [isDisplayCheckoutStatus, setIsDisplayCheckoutStatus] = useState<boolean>(false);

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
        <View>
          <UserImage
            size={hp(15)}
            source={userData?.profilePhoto ? { uri: userData.profilePhoto } : null}
            userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
            isAttendanceStatusVisible={false}
          />
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
        <AppText numberOfLines={1} size={hp(2.73)} style={styles.userName}>
          {`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        </AppText>
        <AppText>{t('profile.member')}</AppText>
      </View>
      <ProfileDrawerItem
        disabled
        title={t('profile.displayBreakStatus')}
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
        title={t('profile.darkMode')}
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
        title={t('profile.attendanceLogs')}
        icon={Icons.attendance_logs}
        iconColor={colors.white}
        onPress={onAttendanceLogsPress}
      />
      <ProfileDrawerItem
        title={t('profile.viewProfile')}
        icon={Icons.profile_circle}
        iconColor={colors.white}
        onPress={onViewProfilePress}
      />
      <ProfileDrawerItem
        title={t('profile.supportAndLearn')}
        icon={Icons.support_learn}
        iconColor={colors.white}
        onPress={onSupportAndLearnPress}
      />
      <ProfileDrawerItem
        title={t('profile.logout')}
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
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
});

