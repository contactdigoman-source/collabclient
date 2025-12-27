import React, { useState, useCallback } from 'react';
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
import {
  AppContainer,
  AppText,
  AppButton,
  AppImage,
  BackHeader,
} from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, FontTypes } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch } from '../../redux';
import { setIsPanCardVerified, setUserAadhaarFaceValidated, setLastAadhaarVerificationDate } from '../../redux';
import { logger } from '../../services/logger';
import {
  requestLocationPermission,
  isLocationEnabled,
  uploadPanCard,
} from '../../services';
import moment from 'moment';

// Try to import ImagePicker, fallback if not available
let ImagePicker: any = null;
try {
  ImagePicker = require('react-native-image-crop-picker');
} catch (e) {
  logger.debug('react-native-image-crop-picker not installed');
}

type PanCardSide = 'front' | 'back';

export default function PanCardCaptureScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [panCardFront, setPanCardFront] = useState<string | null>(null);
  const [panCardBack, setPanCardBack] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [currentSide, setCurrentSide] = useState<PanCardSide>('front');

  const handleCapturePhoto = useCallback(
    (side: PanCardSide): void => {
      if (!ImagePicker) {
        Alert.alert(
          'Error',
          'Image picker is not available. Please install react-native-image-crop-picker',
        );
        return;
      }

      setLoading(true);
      ImagePicker.openCamera({
        mediaType: 'photo',
        cropping: false,
        width: 800,
        height: 500,
        quality: 0.8,
      })
        .then((image: any) => {
          if (side === 'front') {
            setPanCardFront(image.path);
          } else {
            setPanCardBack(image.path);
          }
          setLoading(false);
        })
        .catch((error: any) => {
          logger.debug('Image picker error:', error);
          setLoading(false);
          if (error.code !== 'E_PICKER_CANCELLED') {
            Alert.alert('Error', 'Failed to capture image');
          }
        });
    },
    [],
  );

  const handleSelectFromGallery = useCallback(
    (side: PanCardSide): void => {
      if (!ImagePicker) {
        Alert.alert(
          'Error',
          'Image picker is not available. Please install react-native-image-crop-picker',
        );
        return;
      }

      setLoading(true);
      ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        width: 800,
        height: 500,
        quality: 0.8,
      })
        .then((image: any) => {
          if (side === 'front') {
            setPanCardFront(image.path);
          } else {
            setPanCardBack(image.path);
          }
          setLoading(false);
        })
        .catch((error: any) => {
          logger.debug('Image picker error:', error);
          setLoading(false);
          if (error.code !== 'E_PICKER_CANCELLED') {
            Alert.alert('Error', 'Failed to select image');
          }
        });
    },
    [],
  );

  const handleContinue = useCallback(async (): Promise<void> => {
    if (!panCardFront || !panCardBack) {
      Alert.alert('Error', 'Please capture both sides of PAN card');
      return;
    }

    setUploading(true);
    try {
      // Upload PAN card images to server
      logger.debug('Uploading PAN card images', {
        frontPath: panCardFront,
        backPath: panCardBack,
      });

      const uploadResponse = await uploadPanCard({
        panCardFront,
        panCardBack,
      });

      if (uploadResponse.success && (uploadResponse.isVerified !== false)) {
        // Mark PAN card as verified
        dispatch(setIsPanCardVerified(true));
        dispatch(setUserAadhaarFaceValidated(true));
        
        // Store today's date in UTC format (YYYY-MM-DD) when PAN card is verified
        const today = moment.utc().format('YYYY-MM-DD');
        dispatch(setLastAadhaarVerificationDate(today));

        logger.info('PAN card verified successfully', {
          panCardDetails: uploadResponse.panCardDetails,
        });

        // After PAN card verification, navigate to location capture screen
        const onCancelPress = (): void => {
          navigation.navigate('DashboardScreen');
        };

        const granted = await requestLocationPermission(onCancelPress);

        if (granted) {
          const isLocationOn = await isLocationEnabled();
          if (isLocationOn) {
            navigation.navigate('CheckInScreen');
          } else {
            navigation.navigate('DashboardScreen');
          }
        } else {
          navigation.navigate('DashboardScreen');
        }
      } else {
        Alert.alert(
          'Verification Failed',
          uploadResponse.message || 'PAN card verification failed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      logger.error('Failed to upload PAN card', error);
      
      // Filter out WireMock-specific error messages and provide user-friendly messages
      let errorMessage = 'Failed to upload PAN card. Please check your internet connection and try again.';
      
      if (error?.message) {
        const errorMsg = error.message.toLowerCase();
        
        // Filter out WireMock-specific debugging messages
        if (
          errorMsg.includes('wiremock') ||
          errorMsg.includes('cannot reach the server at') ||
          errorMsg.includes('wiremock is running') ||
          errorMsg.includes('same network') ||
          errorMsg.includes('firewall settings')
        ) {
          // Use generic network error message for WireMock-related errors
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('network error') || errorMsg.includes('network')) {
          // Generic network error
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (errorMsg.includes('file too large')) {
          errorMessage = 'Image file is too large. Please use smaller images and try again.';
        } else if (errorMsg.includes('unsupported file type')) {
          errorMessage = 'Unsupported file type. Please use JPEG images.';
        } else if (errorMsg.includes('authentication failed') || errorMsg.includes('401')) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (errorMsg.includes('permission denied') || errorMsg.includes('403')) {
          errorMessage = 'Permission denied. You do not have access to upload PAN card.';
        } else if (errorMsg.includes('server error') || errorMsg.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          // For other errors, use a sanitized version if it's user-friendly
          // Otherwise use the generic message
          const sanitizedMsg = error.message.trim();
          if (sanitizedMsg && sanitizedMsg.length < 100 && !sanitizedMsg.includes('http://') && !sanitizedMsg.includes('192.168.')) {
            errorMessage = sanitizedMsg;
          }
        }
      }
      
      Alert.alert(
        'Upload Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
    }
  }, [panCardFront, panCardBack, dispatch, navigation]);

  const isContinueDisabled = !panCardFront || !panCardBack || loading || uploading;

  return (
    <AppContainer>
      <BackHeader title="PAN Card Verification" isBottomBorder />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + hp(2) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText
          size={hp(2.2)}
          fontType={FontTypes.regular}
          style={styles.instructionText}
        >
          Please capture both sides of your PAN card
        </AppText>

        {/* Front Side */}
        <View style={styles.section}>
          <AppText
            size={hp(2)}
            fontType={FontTypes.bold}
            style={styles.sectionTitle}
          >
            Front Side
          </AppText>

          {panCardFront ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: panCardFront }} style={styles.capturedImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setPanCardFront(null)}
              >
                <AppText color={colors.white} size={hp(1.5)}>
                  Remove
                </AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureContainer}>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: colors.primary }]}
                onPress={() => handleCapturePhoto('front')}
                disabled={loading}
              >
                <AppText color={colors.white} size={hp(1.8)}>
                  {loading ? 'Capturing...' : 'Capture Front'}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: colors.grey_dark_37 }]}
                onPress={() => handleSelectFromGallery('front')}
                disabled={loading}
              >
                <AppText color={colors.white} size={hp(1.8)}>
                  Select from Gallery
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Back Side */}
        <View style={styles.section}>
          <AppText
            size={hp(2)}
            fontType={FontTypes.bold}
            style={styles.sectionTitle}
          >
            Back Side
          </AppText>

          {panCardBack ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: panCardBack }} style={styles.capturedImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setPanCardBack(null)}
              >
                <AppText color={colors.white} size={hp(1.5)}>
                  Remove
                </AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureContainer}>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: colors.primary }]}
                onPress={() => handleCapturePhoto('back')}
                disabled={loading}
              >
                <AppText color={colors.white} size={hp(1.8)}>
                  {loading ? 'Capturing...' : 'Capture Back'}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, { backgroundColor: colors.grey_dark_37 }]}
                onPress={() => handleSelectFromGallery('back')}
                disabled={loading}
              >
                <AppText color={colors.white} size={hp(1.8)}>
                  Select from Gallery
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <AppButton
          title={uploading ? t('common.uploading') : t('common.continue')}
          style={styles.continueButton}
          disabled={isContinueDisabled}
          onPress={handleContinue}
        />
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: hp(2),
  },
  instructionText: {
    textAlign: 'center',
    marginBottom: hp(3),
    opacity: 0.9,
  },
  section: {
    marginBottom: hp(3),
  },
  sectionTitle: {
    marginBottom: hp(1.5),
  },
  captureContainer: {
    gap: hp(1.5),
  },
  captureButton: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(5),
    borderRadius: hp(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginTop: hp(1),
  },
  capturedImage: {
    width: '100%',
    height: hp(25),
    borderRadius: hp(1),
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  removeButton: {
    position: 'absolute',
    top: hp(1),
    right: wp(2),
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(3),
    borderRadius: hp(0.5),
  },
  continueButton: {
    marginTop: hp(2),
  },
});

