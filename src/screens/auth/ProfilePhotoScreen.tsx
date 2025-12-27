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
import { useAppDispatch, useAppSelector, setUserData, setFirstTimeLoginData, setJWTToken, setExpiresAt } from '../../redux';
import { submitFirstTimeLogin } from '../../services/auth/first-time-login-service';
import { storeJWTToken } from '../../services/auth/login-service';
import { updateProfile } from '../../services';
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
  const { userData, firstTimeLoginData, idpjourneyToken } = useAppSelector(state => state.userState);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Determine if this is registration flow (coming from PermissionsScreen)
  const isRegistrationFlow = !!firstTimeLoginData;

  // Load profile photo from SQLite on mount (only for update profile flow)
  useEffect(() => {
    const loadProfilePhoto = async () => {
      // Skip loading for registration flow (no DB data yet)
      if (isRegistrationFlow || !userData?.email) return;

      try {
        // Try to load from SQLite first
        const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
        if (dbProfile?.profilePhotoUrl) {
          setProfileImage(dbProfile.profilePhotoUrl);
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
  }, [userData?.email, userData?.profilePhoto, userData?.profilePhotoUrl, isRegistrationFlow]);

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
      avoidEmptySpaceAroundImage: true, // Enable to fill the circle properly
      compressImageQuality: 0.9, // Higher quality
      cropperRotateButtonsHidden: true,
      freeStyleCropEnabled: false, // Disable free-style to lock to circle
      forceJpg: true, // Ensure consistent format
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
      avoidEmptySpaceAroundImage: true, // Enable to fill the circle properly
      compressImageQuality: 0.9, // Higher quality
      cropperRotateButtonsHidden: true,
      freeStyleCropEnabled: false, // Disable free-style to lock to circle
      forceJpg: true, // Ensure consistent format
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

  // Shared function to handle first-time login submission and response
  const handleFirstTimeLoginSubmission = useCallback(async (profilePhoto?: string): Promise<void> => {
    if (!firstTimeLoginData || !userData?.email) {
      // No first-time login data, just navigate
      navigation.replace('DashboardScreen');
      return;
    }

    if (!idpjourneyToken) {
      Alert.alert(
        t('auth.profilePhoto.error'),
        t('auth.profilePhoto.missingToken', 'Session expired. Please login again.'),
      );
      return;
    }

    setLoading(true);
    try {
      // Submit first-time login data (with or without profile photo)
      const response = await submitFirstTimeLogin({
        email: userData.email,
        firstName: firstTimeLoginData.firstName,
        lastName: firstTimeLoginData.lastName,
        newPassword: firstTimeLoginData.newPassword,
        permissions: firstTimeLoginData.permissions || [],
        permissionsTimestamp: firstTimeLoginData.permissionsTimestamp,
        profilePhoto: profilePhoto, // Optional: Include profile photo if provided
        idpjourneyToken: idpjourneyToken, // Include idpjourneyToken from OTP verification
      });
      
      // Store JWT token and refresh token securely (like LoginOtpScreen)
      if (response.jwt && userData.email) {
        await storeJWTToken(
          response.jwt,
          response.email || userData.email,
          response.refreshToken, // Optional: will be stored if provided
        );
        dispatch(setJWTToken(response.jwt));
        
        // Log token storage for debugging
        logger.info('Tokens stored from first-time login', {
          hasJWT: !!response.jwt,
          hasRefreshToken: !!response.refreshToken,
          hasExpiresAt: !!response.expiresAt,
        });
      }

      if (response.expiresAt) {
        dispatch(setExpiresAt(response.expiresAt));
      } else {
        logger.warn('First-time login response missing expiresAt');
      }
      
      if (!response.refreshToken) {
        logger.warn('First-time login response missing refreshToken');
      }

      // Store user data from response
      const userDataToStore: any = {
        email: response.email || userData.email,
        firstName: response.firstName || firstTimeLoginData.firstName,
        lastName: response.lastName || firstTimeLoginData.lastName,
        phoneNumber: response.contact,
        roles: response.role ? [response.role] : [],
        firstTimeLogin: false, // Mark as completed
      };

      // Include profile photo if provided
      if (profilePhoto) {
        userDataToStore.profilePhoto = profilePhoto;
        userDataToStore.profilePhotoUrl = profilePhoto;
      }

      dispatch(setUserData(userDataToStore));
      
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
  }, [firstTimeLoginData, userData, idpjourneyToken, dispatch, navigation, t]);

  const handleSkip = useCallback(async (): Promise<void> => {
    // Submit first-time login data without profile photo
    await handleFirstTimeLoginSubmission();
  }, [handleFirstTimeLoginSubmission]);

  const handleContinue = useCallback(async (): Promise<void> => {
    if (!profileImage) {
      Alert.alert(
        t('auth.profilePhoto.error'),
        t('auth.profilePhoto.noImageSelected'),
      );
      return;
    }

    // Registration flow: Upload photo along with first-time login submission
    if (isRegistrationFlow && firstTimeLoginData && userData?.email) {
      await handleFirstTimeLoginSubmission(profileImage);
      return;
    }

    // Update profile flow: Update profile with photo
    setLoading(true);
    try {
      if (userData?.email && profileImage) {
        // Update profile with photo - if it's a local file path, it will be uploaded as FormData
        await updateProfile({
          profilePhoto: profileImage, // Will be uploaded if it's a local file path
        });
        logger.debug('Profile photo updated successfully', { email: userData.email });
      }
      
      // Update Redux state with the photo
      if (userData && profileImage) {
        const updatedUser = { 
          ...userData, 
          profilePhoto: profileImage,
          profilePhotoUrl: profileImage.startsWith('http://') || profileImage.startsWith('https://') 
            ? profileImage 
            : userData.profilePhotoUrl || profileImage,
        };
        dispatch(setUserData(updatedUser));
        logger.debug('Profile photo updated in Redux', { profileImage });
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
  }, [profileImage, navigation, t, dispatch, userData, firstTimeLoginData, isRegistrationFlow, handleFirstTimeLoginSubmission]);

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

