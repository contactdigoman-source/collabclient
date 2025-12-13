import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, DeviceEventEmitter, Platform, TouchableOpacity } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  BackHeader,
  FaceRDNotInstalledModal,
} from '../../components';
import { hp, wp, Images } from '../../constants';
import { useAppDispatch, useAppSelector, store } from '../../redux';
import {
  getRawAadhaarNumber,
  startFaceAuth,
  storeAadhaarNumber,
  requestLocationPermission,
  isLocationEnabled,
  isFaceRDAppInstalled,
} from '../../services';
import {
  setIsAadhaarFaceValidated,
  setIsAuthenticatingFace,
  setUserAadhaarFaceValidated,
  setStoredAadhaarNumber,
} from '../../redux';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

const AADHAAR_LENGTH = 12;
const INPUT_LENGTH = 14;

export default function AadhaarInputScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();


  const { isAuthenticatingFace, isAadhaarFaceValidated } = useAppSelector(
    state => ({
      isAuthenticatingFace: state.aadhaarState.isAuthenticatingFace,
      isAadhaarFaceValidated: state.aadhaarState.isAadhaarFaceValidated,
    }),
  );

  const [aadhaarInput, setAadhaarInput] = useState<string>('');
  const [aadhaarNumberErr, setAadhaarNumberErr] = useState<string>('');
  const [aadhaarNotAvailable, setAadhaarNotAvailable] = useState<boolean>(false);
  const [showFaceRDNotInstalledModal, setShowFaceRDNotInstalledModal] = useState<boolean>(false);

  /** Reset face auth flag on unmount */
  useEffect(() => {
    return () => {
      dispatch(setIsAuthenticatingFace(false));
    };
  }, [dispatch]);

  /** Listen for Face RD success/failure events */
  useEffect(() => {
    // Only set up listeners if we're on Android and Face RD is being used
    if (Platform.OS !== 'android') {
      return;
    }

    const successListener = DeviceEventEmitter.addListener(
      'FaceAuthSuccess',
      (data: any) => {
        console.log('Face RD Success:', data);
        dispatch(setIsAuthenticatingFace(false));
        dispatch(setIsAadhaarFaceValidated(true));
        // Store Aadhaar number in Redux for future Face RD verifications
        const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
        if (rawAadhaar && rawAadhaar.length === AADHAAR_LENGTH) {
          dispatch(setStoredAadhaarNumber(rawAadhaar));
        }
      },
    );

    const failureListener = DeviceEventEmitter.addListener(
      'FaceAuthFailure',
      (error: any) => {
        console.log('Face RD Failure:', error);
        dispatch(setIsAuthenticatingFace(false));
        // Hard fallback: Navigate to OTP screen ONLY when Face RD fails
        const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
        if (rawAadhaar && rawAadhaar.length === AADHAAR_LENGTH) {
          navigation.navigate('AadhaarOtpScreen', {
            emailID: store.getState().userState?.userData?.email || '',
            aadhaarNumber: rawAadhaar,
          });
        } else {
          // If Aadhaar is invalid, show error
          setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
        }
      },
    );

    return () => {
      successListener.remove();
      failureListener.remove();
    };
  }, [dispatch, navigation, aadhaarInput, t]);

  /** Format Aadhaar input into XXXX XXXX XXXX */
  const formatAadhaar = useCallback((text: string): void => {
    const formatted = text
      .replace(/\D/g, '') // remove non-digits
      .slice(0, AADHAAR_LENGTH) // limit to 12 digits
      .replace(/(\d{4})(?=\d)/g, '$1 '); // space after every 4 digits
    setAadhaarInput(formatted);
  }, []);

  /** Handle Aadhaar not available - navigate to PAN card screen */
  const onAadhaarNotAvailablePress = useCallback((): void => {
    navigation.navigate('PanCardCaptureScreen');
  }, [navigation]);

  /** Capture Face button handler - Android: Face RD first, OTP is hard fallback only. iOS: OTP only */
  const onCaptureFacePress = useCallback(async (): Promise<void> => {
    const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
    if (rawAadhaar?.length !== AADHAAR_LENGTH) {
      setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
      return;
    }

    setAadhaarNumberErr('');
    
    // iOS: Always use OTP-based authentication (Aadhaar OTP only, one time per day)
    if (Platform.OS === 'ios') {
      // iOS: Navigate directly to Aadhaar OTP screen (no Face RD on iOS)
      navigation.navigate('AadhaarOtpScreen', {
        emailID: store.getState().userState?.userData?.email || '',
        aadhaarNumber: rawAadhaar,
      });
    } else {
      // Android: Check if Face RD app is installed first
      const isInstalled = await isFaceRDAppInstalled();
      
      if (!isInstalled) {
        // Show modal to download FaceRD app
        setShowFaceRDNotInstalledModal(true);
        return;
      }

      // Android: ALWAYS attempt Face RD first, OTP is hard fallback only on failure
      dispatch(setIsAuthenticatingFace(true));

      // Check if Face RD module is available
      const { NativeModules } = require('react-native');
      const { FaceAuth } = NativeModules;
      
      if (!FaceAuth) {
        // Hard fallback: Face RD module not available, use Aadhaar OTP
        console.log('Face RD module not available, using Aadhaar OTP as hard fallback');
        dispatch(setIsAuthenticatingFace(false));
        navigation.navigate('AadhaarOtpScreen', {
          emailID: store.getState().userState?.userData?.email || '',
          aadhaarNumber: rawAadhaar,
        });
        return;
      }

      // Always attempt Face RD authentication first (irrespective of dev/prod mode)
      // OTP is hard fallback - only used when Face RD fails (via FaceAuthFailure event listener)
      startFaceAuth(rawAadhaar);
    }
  }, [aadhaarInput, dispatch, t, navigation]);

  /** Continue button handler after verification */
  const onStoreAadhaarData = useCallback(async (): Promise<void> => {
    dispatch(setUserAadhaarFaceValidated(true));
    // Store Aadhaar number in Redux for future Face RD verifications
    const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
    dispatch(setStoredAadhaarNumber(rawAadhaar));
    await storeAadhaarNumber();
    
    // After Aadhaar authentication, navigate to location capture screen
    const onCancelPress = (): void => {
      // If permission denied, go to dashboard
      navigation.navigate('DashboardScreen');
    };
    
    const granted = await requestLocationPermission(onCancelPress);
    
    if (granted) {
      const isLocationOn = await isLocationEnabled();
      if (isLocationOn) {
        navigation.navigate('CheckInScreen');
      } else {
        // Location is off, go to dashboard
        navigation.navigate('DashboardScreen');
      }
    } else {
      // Permission denied, go to dashboard
      navigation.navigate('DashboardScreen');
    }
  }, [dispatch, navigation, aadhaarInput]);

  /** Open Privacy Policy screen */
  const onPrivacyPolicyPress = useCallback((): void => {
    navigation.navigate('PrivacyPolicyScreen');
  }, [navigation]);

  const isButtonDisabled =
    aadhaarInput.length !== INPUT_LENGTH || isAuthenticatingFace;

  // ---------- UI ----------
  return (
    <AppContainer>
      <BackHeader title={t('aadhaar.title')} isBottomBorder />

      <View style={styles.container}>
        {isAadhaarFaceValidated ? (
          <>
            <AppImage
              size={hp(10)}
              source={Images.aadhaar_logo}
              style={styles.logo}
            />
            <AppText size={hp(2.5)} style={styles.centerText} color={colors.text}>
              {t('aadhaar.title')}
            </AppText>

            <AppImage
              size={hp(15)}
              source={Images.aadhaar_verified}
              style={styles.verifiedLogo}
            />

            <AppText size={hp(2)} style={styles.centerText} color={colors.text}>
              {t('aadhaar.verified')}
            </AppText>

            <AppButton
              title={t('aadhaar.continue')}
              style={styles.continueBtn}
              onPress={onStoreAadhaarData}
            />
          </>
        ) : (
          <>
            <AppImage
              size={hp(15)}
              source={Images.aadhaar_logo}
              style={styles.logo}
            />

            <AppInput
              value={aadhaarInput}
              placeholder={t('aadhaar.enterAadhaar')}
              containerStyle={styles.inputContainer}
              keyboardType="numeric"
              onChangeText={formatAadhaar}
              error={aadhaarNumberErr}
              maxLength={INPUT_LENGTH}
              editable={!aadhaarNotAvailable}
            />

            {/* Aadhaar not available checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                setAadhaarNotAvailable(!aadhaarNotAvailable);
                if (!aadhaarNotAvailable) {
                  setAadhaarInput(''); // Clear input when checked
                }
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: aadhaarNotAvailable
                      ? colors.primary
                      : 'transparent',
                    borderColor: colors.primary,
                  },
                ]}
              >
                {aadhaarNotAvailable && (
                  <AppText size={hp(1.5)} color={colors.text}>
                    ✓
                  </AppText>
                )}
              </View>
              <AppText
                size={hp('1.5%')}
                color={colors.text}
                style={styles.checkboxLabel}
              >
                Aadhaar not available
              </AppText>
            </TouchableOpacity>

            {aadhaarNotAvailable ? (
              <AppButton
                title="Continue with PAN Card"
                style={styles.continueBtn}
                onPress={onAadhaarNotAvailablePress}
              />
            ) : (
              <>
            <View style={styles.policyContainer}>
              <AppText
                size={hp('1.5%')}
                color={colors.text}
                style={styles.policyText}
              >
                {t('aadhaar.authorize')}{' '}
                <AppText
                  size={hp('1.5%')}
                  color={colors.primary}
                  onPress={onPrivacyPolicyPress}
                >
                  {t('aadhaar.privacyPolicy')}
                </AppText>
                .
              </AppText>
            </View>

            <AppButton
              disabled={isButtonDisabled}
              title={
                isAuthenticatingFace
                  ? t('aadhaar.authenticating')
                  : Platform.OS === 'ios'
                  ? 'Verify with OTP'
                  : t('aadhaar.captureFace')
              }
              onPress={onCaptureFacePress}
            />
              </>
            )}
          </>
        )}
      </View>
      <FaceRDNotInstalledModal
        visible={showFaceRDNotInstalledModal}
        onClose={() => setShowFaceRDNotInstalledModal(false)}
      />
    </AppContainer>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp(4.35),
  },
  logo: {
    alignSelf: 'center',
  },
  inputContainer: {
    marginTop: hp('5%'),
  },
  policyContainer: {
    flexDirection: 'row',
    marginBottom: hp(3),
  },
  policyText: {
    marginLeft: wp('2%'),
    marginRight: wp('5.5%'),
  },
  verifiedLogo: {
    alignSelf: 'center',
    marginVertical: hp(3),
  },
  centerText: {
    textAlign: 'center',
  },
  continueBtn: {
    marginTop: hp(4),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(2),
    marginBottom: hp(2),
  },
  checkbox: {
    width: wp(5.9),
    height: wp(5.9),
    borderRadius: wp(1.6),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(4.5),
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: hp(2.1),
  },
});

