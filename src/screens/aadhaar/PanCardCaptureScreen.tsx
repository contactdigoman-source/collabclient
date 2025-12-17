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
import { setIsPanCardVerified, setUserAadhaarFaceValidated } from '../../redux';
import { logger } from '../../services/logger';
import {
  requestLocationPermission,
  isLocationEnabled,
} from '../../services';

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

    // Mark PAN card as verified
    dispatch(setIsPanCardVerified(true));
    dispatch(setUserAadhaarFaceValidated(true));

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
  }, [panCardFront, panCardBack, dispatch, navigation]);

  const isContinueDisabled = !panCardFront || !panCardBack || loading;

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
          title="Continue"
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

