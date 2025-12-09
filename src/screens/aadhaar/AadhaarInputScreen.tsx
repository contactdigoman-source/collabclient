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
} from '../../components';
import { hp, wp, Images } from '../../constants';
import { useAppDispatch, useAppSelector, store } from '../../redux';
import {
  getRawAadhaarNumber,
  startFaceAuth,
  storeAadhaarNumber,
  requestLocationPermission,
  isLocationEnabled,
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

  /** Reset face auth flag on unmount */
  useEffect(() => {
    return () => dispatch(setIsAuthenticatingFace(false));
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
        // Navigate to OTP screen as fallback
        const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
        if (rawAadhaar && rawAadhaar.length === AADHAAR_LENGTH) {
          navigation.navigate('OtpScreen', {
            emailID: store.getState().userState?.userData?.email || '',
            isAadhaarFallback: true,
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

  /** Capture Face button handler - Android uses Face RD, iOS uses OTP */
  const onCaptureFacePress = useCallback((): void => {
    const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
    if (rawAadhaar?.length !== AADHAAR_LENGTH) {
      setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
      return;
    }

    setAadhaarNumberErr('');
    
    // On iOS or if face RD fails, use OTP-based authentication
    if (Platform.OS === 'ios') {
      // iOS: Navigate directly to OTP screen
      navigation.navigate('OtpScreen', {
        emailID: store.getState().userState?.userData?.email || '',
        isAadhaarFallback: true,
        aadhaarNumber: rawAadhaar,
      });
    } else {
      // Android: Use Face RD
      dispatch(setIsAuthenticatingFace(true));

      // Check if Face RD module is available
      const { NativeModules } = require('react-native');
      const { FaceAuth } = NativeModules;
      
      if (!FaceAuth) {
        // Face RD not available, fallback to OTP
        console.log('Face RD module not available, using OTP fallback');
        dispatch(setIsAuthenticatingFace(false));
        navigation.navigate('OtpScreen', {
          emailID: store.getState().userState?.userData?.email || '',
          isAadhaarFallback: true,
          aadhaarNumber: rawAadhaar,
        });
        return;
      }

      if (__DEV__) {
        // In dev mode, skip Face RD for testing
        dispatch(setIsAadhaarFaceValidated(true));
        const rawAadhaarForStorage = getRawAadhaarNumber(aadhaarInput);
        dispatch(setStoredAadhaarNumber(rawAadhaarForStorage));
      } else {
        // Production: Start Face RD authentication
        startFaceAuth(rawAadhaar);
      }
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
  }, [dispatch, navigation]);

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
            <AppText size={hp(2.5)} style={styles.centerText}>
              {t('aadhaar.title')}
            </AppText>

            <AppImage
              size={hp(15)}
              source={Images.aadhaar_verified}
              style={styles.verifiedLogo}
            />

            <AppText size={hp(2)} style={styles.centerText}>
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
                  <AppText size={hp(1.5)} color={colors.white}>
                    ✓
                  </AppText>
                )}
              </View>
              <AppText
                size={hp('1.5%')}
                color={colors.white}
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
                color={colors.white}
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

