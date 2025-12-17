import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContainer, AppText, AppButton, AppImage, BackHeader } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, FontTypes, Images } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector, setUserData, setFirstTimeLoginData } from '../../redux';
import { submitFirstTimeLogin } from '../../services/auth/first-time-login-service';
import { profileSyncService } from '../../services/sync/profile-sync-service';
import { logger } from '../../services/logger';

// Try to import ImagePicker, fallback if not available
let ImagePicker: any = null;
try {
  ImagePicker = require('react-native-image-crop-picker');
} catch (e) {
  // ImagePicker not installed - will be handled gracefully
}

export default function ProfilePhotoScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { userData, firstTimeLoginData } = useAppSelector(state => state.userState);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Load profile photo from SQLite on mount
  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!userData?.email) return;

      try {
        // Try to load from SQLite first
        const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
        if (dbProfile?.profilePhoto) {
          setProfileImage(dbProfile.profilePhoto);
          return;
        }

        // Fallback to Redux state
        if (userData.profilePhoto || userData.profilePhotoUrl) {
          setProfileImage(userData.profilePhoto || userData.profilePhotoUrl || null);
        }
      } catch (error) {
        logger.warn('Error loading profile photo from DB', error);
        // Fallback to Redux state
        if (userData?.profilePhoto || userData?.profilePhotoUrl) {
          setProfileImage(userData.profilePhoto || userData.profilePhotoUrl || null);
        }
      }
    };

    loadProfilePhoto();
  }, [userData?.email]);

  const handleCapturePhoto = useCallback((): void => {
    if (!ImagePicker) {
      Alert.alert(
        t('auth.profilePhoto.error'),
        t('auth.profilePhoto.libraryNotInstalled'),
      );
      return;
    }

    ImagePicker.openCamera({
      mediaType: 'photo',
      cropping: true,
      cropperCircleOverlay: true,
      cropperChooseText: t('auth.profilePhoto.save'),
      cropperCancelText: t('auth.profilePhoto.cancel'),
      cropperToolbarTitle: t('auth.profilePhoto.cropPhoto'),
      cropperActiveWidgetColor: colors.primary,
      width: 1000,
      height: 1000,
      avoidEmptySpaceAroundImage: true,
      compressImageQuality: 0.8,
    })
      .then((image: any) => {
        setProfileImage(image.path);
      })
      .catch((error: any) => {
        if (error.code !== 'E_PICKER_CANCELLED') {
          logger.error('Camera error', error);
          Alert.alert(t('auth.profilePhoto.error'), t('auth.profilePhoto.cameraError'));
        }
      });
  }, [colors.primary, t]);

  const handleSelectFromGallery = useCallback((): void => {
    if (!ImagePicker) {
      Alert.alert(
        t('auth.profilePhoto.error'),
        t('auth.profilePhoto.libraryNotInstalled'),
      );
      return;
    }

    ImagePicker.openPicker({
      mediaType: 'photo',
      cropping: true,
      cropperCircleOverlay: true,
      cropperChooseText: t('auth.profilePhoto.save'),
      cropperCancelText: t('auth.profilePhoto.cancel'),
      cropperToolbarTitle: t('auth.profilePhoto.cropPhoto'),
      cropperActiveWidgetColor: colors.primary,
      width: 1000,
      height: 1000,
      avoidEmptySpaceAroundImage: true,
      compressImageQuality: 0.8,
    })
      .then((image: any) => {
        setProfileImage(image.path);
      })
      .catch((error: any) => {
        if (error.code !== 'E_PICKER_CANCELLED') {
          logger.error('Gallery error', error);
          Alert.alert(t('auth.profilePhoto.error'), t('auth.profilePhoto.galleryError'));
        }
      });
  }, [colors.primary, t]);

  const handleSkip = useCallback(async (): Promise<void> => {
    // If we have first-time login data, submit it even if skipping photo
    if (firstTimeLoginData && userData?.email) {
      setLoading(true);
      try {
        await submitFirstTimeLogin({
          email: userData.email,
          firstName: firstTimeLoginData.firstName,
          lastName: firstTimeLoginData.lastName,
          newPassword: firstTimeLoginData.newPassword,
          permissions: firstTimeLoginData.permissions || [],
          permissionsTimestamp: firstTimeLoginData.permissionsTimestamp,
        });
        
        // Clear temporary first-time login data
        dispatch(setFirstTimeLoginData(null));
        
        // Navigate to dashboard
        navigation.replace('DashboardScreen');
      } catch (error: any) {
        Alert.alert(
          t('auth.profilePhoto.error'),
          error.message || t('auth.profilePhoto.submitError', 'Failed to submit data. Please try again.'),
        );
      } finally {
        setLoading(false);
      }
    } else {
      // No first-time login data, just navigate
      navigation.replace('DashboardScreen');
    }
  }, [navigation, firstTimeLoginData, userData, dispatch, t]);

  const handleContinue = useCallback(async (): Promise<void> => {
    if (!profileImage) {
      Alert.alert(
        t('auth.profilePhoto.error'),
        t('auth.profilePhoto.noImageSelected'),
      );
      return;
    }

    setLoading(true);
    try {
      // TODO: Upload profile photo to server
      // Example:
      // const formData = new FormData();
      // formData.append('profilePhoto', {
      //   uri: profileImage,
      //   type: 'image/jpeg',
      //   name: 'profile.jpg',
      // });
      // await uploadProfilePhoto(formData);

      // Submit first-time login data with profile photo if available
      if (firstTimeLoginData && userData?.email) {
        await submitFirstTimeLogin({
          email: userData.email,
          firstName: firstTimeLoginData.firstName,
          lastName: firstTimeLoginData.lastName,
          newPassword: firstTimeLoginData.newPassword,
          permissions: firstTimeLoginData.permissions || [],
          permissionsTimestamp: firstTimeLoginData.permissionsTimestamp,
          profilePhoto: profileImage, // Include profile photo in API call
        });
        
        // Profile photo is already saved to SQLite in submitFirstTimeLogin
        // Update Redux with the photo
        if (userData) {
          const updatedUser = { ...userData, profilePhoto: profileImage };
          dispatch(setUserData(updatedUser));
        }
        
        // Clear temporary first-time login data
        dispatch(setFirstTimeLoginData(null));
      } else {
        // No first-time login data, save photo to SQLite and Redux
        if (userData?.email && profileImage) {
          try {
            await profileSyncService.saveProfileProperty(userData.email, 'profilePhoto', profileImage);
          } catch (dbError) {
            logger.warn('Error saving profile photo to SQLite', dbError);
          }
        }
        
        if (userData) {
          const updatedUser = { ...userData, profilePhoto: profileImage };
          dispatch(setUserData(updatedUser));
        }
        logger.debug('Profile photo saved', { profileImage });
      }

      // Navigate to dashboard
      navigation.replace('DashboardScreen');
    } catch (error: any) {
      logger.error('Error saving profile photo or submitting data', error);
      Alert.alert(
        t('auth.profilePhoto.error'),
        error.message || t('auth.profilePhoto.saveError'),
      );
    } finally {
      setLoading(false);
    }
  }, [profileImage, navigation, t, dispatch, userData, firstTimeLoginData]);

  return (
    <AppContainer>
      <View style={styles.container}>
        <BackHeader
          onBackPress={() => navigation.goBack()}
          rightContent={
            <View style={{ width: hp('2.48%'), height: hp('2.48%') }} />
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + hp(1), paddingBottom: insets.bottom + hp(1) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <AppText
            size={hp(2.5)}
            fontType={FontTypes.medium}
            style={styles.title}
            color={colors.text}
          >
            {t('auth.profilePhoto.title')}
          </AppText>

          {/* Subtitle */}
          <AppText size={hp(1.8)} style={styles.subtitle} color={colors.text}>
            {t('auth.profilePhoto.subtitle')}
          </AppText>

          {/* Profile Image Preview */}
          <View style={styles.imageContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderContainer}>
                <AppImage
                  size={hp(15)}
                  source={Images.app_logo}
                  style={styles.placeholderImage}
                />
                <AppText size={hp(1.6)} style={styles.placeholderText} color={colors.text}>
                  {t('auth.profilePhoto.noPhoto')}
                </AppText>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <AppButton
              title={t('auth.profilePhoto.takePhoto')}
              style={styles.actionButton}
              onPress={handleCapturePhoto}
            />

            <AppButton
              title={t('auth.profilePhoto.chooseFromGallery')}
              style={styles.galleryButton}
              onPress={handleSelectFromGallery}
            />
          </View>

          {/* Continue and Skip Buttons */}
          <View style={styles.footerButtons}>
            <AppButton
              title={t('auth.profilePhoto.continue')}
              style={styles.continueButton}
              onPress={handleContinue}
              disabled={!profileImage || loading}
            />

            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              disabled={loading}
              activeOpacity={0.7}
            >
              <AppText size={hp(1.8)} fontType={FontTypes.medium} style={styles.skipText} color={colors.text}>
                {t('auth.profilePhoto.skip')}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: wp(5),
    flexGrow: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: hp(0.5),
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: hp(2),
    opacity: 0.8,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: hp(2),
    minHeight: hp(20),
  },
  profileImage: {
    width: hp(20),
    height: hp(20),
    borderRadius: hp(10),
    borderWidth: 3,
    borderColor: '#62C268',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderImage: {
    opacity: 0.5,
    marginBottom: hp(2),
  },
  placeholderText: {
    opacity: 0.6,
  },
  buttonContainer: {
    marginVertical: hp(1.5),
  },
  actionButton: {
    marginBottom: hp(1.5),
  },
  galleryButton: {
    backgroundColor: '#333333',
    marginBottom: hp(1.5),
  },
  footerButtons: {
    marginTop: hp(2),
    marginBottom: hp(1),
  },
  continueButton: {
    marginBottom: hp(1),
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: hp(1.5),
    marginTop: hp(1),
  },
  skipText: {
    opacity: 0.8,
    textDecorationLine: 'underline',
  },
});

