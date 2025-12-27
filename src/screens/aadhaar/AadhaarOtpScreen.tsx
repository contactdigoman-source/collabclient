import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation, useTheme, RouteProp } from '@react-navigation/native';
import { OtpInput } from 'react-native-otp-entry';
import {
  AppButton,
  AppContainer,
  AppImage,
  AppText,
  BackHeader,
  RippleButton,
} from '../../components';
import { FontTypes, hp, wp, Images } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../redux';
import { setUserAadhaarFaceValidated, setStoredAadhaarNumber } from '../../redux';
import { storeAadhaarNumber, requestAadhaarOTP, verifyAadhaarOTP } from '../../services/aadhaar';
import {
  requestLocationPermission,
  isLocationEnabled,
} from '../../services';
import { NavigationProp, RootStackParamList } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { logger } from '../../services/logger';

const IMAGE_SIZE = hp(18.63);
const RESEND_TIMEOUT = 120; // seconds

interface TimerDisplayProps {
  timer: number;
  color: string;
}

const TimerDisplay = React.memo<TimerDisplayProps>(({ timer, color }) => {
  const { t } = useTranslation();
  if (timer <= 0) return null;
  return (
    <View style={styles.timerContainer}>
      <AppText color={color}>{`${timer} ${t('auth.otp.seconds')}`}</AppText>
    </View>
  );
});

TimerDisplay.displayName = 'TimerDisplay';

interface AadhaarOtpScreenProps {
  route: RouteProp<RootStackParamList, 'AadhaarOtpScreen'>;
}

const AadhaarOtpScreen: React.FC<AadhaarOtpScreenProps> = ({ route }) => {
  // Get params from route, with fallback to Redux state if params are missing
  const routeParams = route?.params;
  const reduxEmail = useAppSelector(state => state.userState?.userData?.email);
  const emailID = routeParams?.emailID || reduxEmail || '';
  const aadhaarNumber = routeParams?.aadhaarNumber || '';
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [otpValue, setOtpValue] = useState<string>('');
  const [timer, setTimer] = useState<number>(RESEND_TIMEOUT);
  const [resendActive, setResendActive] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const emailMessage = useMemo(() => {
    return t('auth.otp.aadhaarMessage', { email: emailID });
  }, [emailID, t]);

  const startTimer = useCallback((): void => {
    setResendActive(false);
    setTimer(RESEND_TIMEOUT);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setResendActive(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTimer]);

  // Request OTP when screen loads
  useEffect(() => {
    if (aadhaarNumber && emailID) {
      // Request OTP when screen loads
      logger.debug('AadhaarOtpScreen: Requesting OTP', { 
        hasAadhaar: !!aadhaarNumber, 
        hasEmail: !!emailID,
        aadhaarLength: aadhaarNumber.length 
      });
      requestAadhaarOTP({
        aadhaarNumber: aadhaarNumber,
        emailID: emailID,
      }).catch(error => {
        logger.error('Failed to request OTP:', error);
        setOtpError(error.message || t('auth.otp.requestFailed', 'Failed to request OTP. Please try again.'));
      });
    } else {
      // Log warning if params are missing
      logger.warn('AadhaarOtpScreen: Missing params', { 
        hasAadhaar: !!aadhaarNumber, 
        hasEmail: !!emailID 
      });
      if (!emailID) {
        setOtpError(t('auth.otp.requestFailed', 'Email ID is missing. Please try again.'));
      } else if (!aadhaarNumber) {
        setOtpError(t('auth.otp.requestFailed', 'Aadhaar number is missing. Please try again.'));
      }
    }
  }, [aadhaarNumber, emailID, t]);

  const handleResend = useCallback(async (): Promise<void> => {
    if (!resendActive) return;
    
    try {
      if (aadhaarNumber) {
        // Resend Aadhaar OTP
        await requestAadhaarOTP({
          aadhaarNumber: aadhaarNumber,
          emailID: emailID,
        });
      }
      startTimer();
      setOtpError('');
    } catch (error: any) {
      logger.error('Failed to resend OTP:', error);
      setOtpError(error.message || t('auth.otp.resendFailed', 'Failed to resend OTP. Please try again.'));
    }
  }, [resendActive, aadhaarNumber, emailID, startTimer, t]);

  const onConfirmButtonPress = useCallback(async (): Promise<void> => {
    if (otpValue.trim().length !== 6) {
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      // Verify Aadhaar OTP
      const isValid = await verifyAadhaarOTP({
        aadhaarNumber: aadhaarNumber || '',
        otp: otpValue,
        emailID: emailID,
      });

      if (!isValid) {
        setOtpError(t('auth.otp.invalidOtp', 'Invalid OTP. Please try again.'));
        setIsVerifying(false);
        return;
      }

      // Store Aadhaar number if provided
      if (aadhaarNumber) {
        dispatch(setStoredAadhaarNumber(aadhaarNumber));
      }
      
      // Mark Aadhaar as validated
      dispatch(setUserAadhaarFaceValidated(true));
      await storeAadhaarNumber();
      
      // After Aadhaar authentication via OTP, navigate to location capture screen
      const onCancelPress = (): void => {
        navigation.replace('DashboardScreen');
      };
      
      const granted = await requestLocationPermission(onCancelPress);
      
      if (granted) {
        const isLocationOn = await isLocationEnabled();
        if (isLocationOn) {
          navigation.replace('CheckInScreen');
        } else {
          navigation.replace('DashboardScreen');
        }
      } else {
        navigation.replace('DashboardScreen');
      }
    } catch (error: any) {
      logger.error('Aadhaar OTP verification error:', error);
      setOtpError(error.message || t('auth.otp.verificationFailed', 'Failed to verify OTP. Please try again.'));
    } finally {
      setIsVerifying(false);
    }
  }, [otpValue, aadhaarNumber, emailID, dispatch, navigation, t]);

  // memoized otp styles and theme to avoid re-render
  const otpTheme = useMemo(
    () => ({
      containerStyle: styles.otpMainContainer,
      pinCodeContainerStyle: [
        styles.otpCodeContainer,
        { backgroundColor: colors.app_input_bg },
      ],
      focusedPinCodeContainerStyle: {
        borderWidth: 2,
        borderColor: colors.primary,
      },
    }),
    [colors],
  );

  const otpTextProps = useMemo(
    () => ({
      style: { color: colors.white, fontSize: hp(2.2) },
    }),
    [colors],
  );

  return (
    <AppContainer>
      <BackHeader />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.subContainer}>
              <AppImage
                size={IMAGE_SIZE}
                source={Images.forgot_pass_image}
                style={styles.image}
              />
              <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                {t('auth.otp.verifyAadhaar')}
              </AppText>
              <AppText style={styles.description}>
                {emailMessage}
              </AppText>
            </View>

            <OtpInput
              disabled={isVerifying}
              type="numeric"
              blurOnFilled
              secureTextEntry={false}
              focusStickBlinkingDuration={500}
              numberOfDigits={6}
              onTextChange={(text) => {
                setOtpValue(text);
                setOtpError(''); // Clear error when user types
              }}
              onFilled={setOtpValue}
              textInputProps={{ value: otpValue }}
              textProps={otpTextProps}
              theme={otpTheme}
            />

            {otpError ? (
              <AppText
                size={hp(1.6)}
                color={colors.error || '#FF4444'}
                style={styles.errorText}
              >
                {otpError}
              </AppText>
            ) : null}

            <AppButton
              title={t('auth.otp.confirm')}
              style={styles.confirmButton}
              onPress={onConfirmButtonPress}
              disabled={otpValue.trim().length !== 6 || isVerifying}
              loading={isVerifying}
            />

            <View style={styles.resendContainer}>
              <AppText>{t('auth.otp.didntReceive')} </AppText>
              <RippleButton
                style={styles.resendButton}
                onPress={handleResend}
                disabled={!resendActive}
              >
                <AppText
                  color={resendActive ? colors.primary : colors.white}
                  style={{ opacity: resendActive ? 1 : 0.7 }}
                >
                  {t('auth.otp.resend')}
                </AppText>
              </RippleButton>
            </View>

            <TimerDisplay timer={timer} color={colors.primary} />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
};

export default React.memo(AadhaarOtpScreen);

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp(4.35),
  },
  subContainer: {
    alignItems: 'center',
    marginBottom: hp(2),
  },
  image: {
    marginBottom: hp(2),
  },
  description: {
    textAlign: 'center',
    marginVertical: hp(1),
  },
  resendContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(2),
  },
  resendButton: {
    paddingEnd: wp(2),
    paddingVertical: wp(1),
  },
  timerContainer: {
    alignSelf: 'center',
  },
  otpMainContainer: {
    marginVertical: hp(2),
  },
  otpCodeContainer: {
    flexGrow: 1,
    margin: wp(1),
    borderWidth: 0,
  },
  confirmButton: {
    marginVertical: hp(3),
  },
  errorText: {
    marginTop: hp(1),
    textAlign: 'center',
  },
});

