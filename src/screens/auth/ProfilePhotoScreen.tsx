import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContainer, AppText, AppButton, AppImage, BackHeader } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, FontTypes, Images } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector, setUserData, setFirstTimeLoginData } from '../../redux';
import { submitFirstTimeLogin } from '../../services/auth/first-time-login-service';

// Try to import ImagePicker, fallback if not available
let ImagePicker: any = null;
try {
  ImagePicker = require('react-native-image-crop-picker');
} catch (e) {
  console.log('react-native-image-crop-picker not installed');
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
          console.error('Camera error:', error);
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
          console.error('Gallery error:', error);
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
        
        // Save profile photo to Redux after successful API call
        if (userData) {
          const updatedUser = { ...userData, profilePhoto: profileImage };
          dispatch(setUserData(updatedUser));
        }
        
        // Clear temporary first-time login data
        dispatch(setFirstTimeLoginData(null));
      } else {
        // No first-time login data, just save photo to Redux
        if (userData) {
          const updatedUser = { ...userData, profilePhoto: profileImage };
          dispatch(setUserData(updatedUser));
        }
        console.log('Profile photo saved:', profileImage);
      }

      // Navigate to dashboard
      navigation.replace('DashboardScreen');
    } catch (error: any) {
      console.error('Error saving profile photo or submitting data:', error);
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

        <View style={[styles.content, { paddingTop: insets.top + hp(2) }]}>
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
            >
              <AppText size={hp(1.8)} style={styles.skipText} color={colors.text}>
                {t('auth.profilePhoto.skip')}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(5),
    paddingBottom: hp(4),
  },
  title: {
    textAlign: 'center',
    marginBottom: hp(1),
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: hp(4),
    opacity: 0.8,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: hp(4),
    minHeight: hp(25),
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
    marginVertical: hp(2),
  },
  actionButton: {
    marginBottom: hp(2),
  },
  galleryButton: {
    backgroundColor: '#333333',
    marginBottom: hp(2),
  },
  footerButtons: {
    marginTop: hp(4),
  },
  continueButton: {
    marginBottom: hp(2),
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: hp(1),
  },
  skipText: {
    opacity: 0.7,
    textDecorationLine: 'underline',
  },
});

