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
import { useAppDispatch } from '../../redux';
import { setUserAadhaarFaceValidated } from '../../redux';
import { storeAadhaarNumber } from '../../services/aadhaar';
import {
  hasCompletedFirstTimeLogin,
  requestLocationPermission,
  isLocationEnabled,
} from '../../services';
import { NavigationProp, RootStackParamList } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

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

interface OtpScreenProps {
  route: RouteProp<RootStackParamList, 'OtpScreen'> & {
    params?: {
      emailID?: string;
      isAadhaarFallback?: boolean;
      aadhaarNumber?: string;
    };
  };
}

const OtpScreen: React.FC<OtpScreenProps> = ({ route }) => {
  const emailID = route?.params?.emailID || '';
  const isAadhaarFallback = route?.params?.isAadhaarFallback || false;
  const aadhaarNumber = route?.params?.aadhaarNumber || '';
  const isPasswordReset = route?.params?.isPasswordReset || false;
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [otpValue, setOtpValue] = useState<string>('');
  const [timer, setTimer] = useState<number>(RESEND_TIMEOUT);
  const [resendActive, setResendActive] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const emailMessage = useMemo(() => {
    if (isAadhaarFallback) {
      return t('auth.otp.aadhaarMessage', { email: emailID });
    }
    return t('auth.otp.emailMessage', { email: emailID });
  }, [emailID, isAadhaarFallback, t]);

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

  const handleResend = useCallback((): void => {
    if (!resendActive) return;
    // TODO: Call resend API
    startTimer();
  }, [resendActive, startTimer]);

  const onConfirmButtonPress = useCallback(async (): Promise<void> => {
    // TODO: API call for OTP verification
    if (otpValue.trim().length === 6) {
      if (isAadhaarFallback) {
        // Handle Aadhaar fallback: Mark as validated and navigate to location capture
        // TODO: Verify OTP with backend before marking as validated
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
      } else if (isPasswordReset) {
        // Password reset flow: go to change password screen
        navigation.replace('ChangeForgottenPassword', { emailID });
      } else if (emailID) {
        // Login flow: Check if first-time login
        const isFirstTime = !hasCompletedFirstTimeLogin();
        if (isFirstTime) {
          navigation.replace('FirstTimeLoginScreen');
        } else {
          navigation.replace('DashboardScreen');
        }
      }
    }
  }, [otpValue, isAadhaarFallback, isPasswordReset, emailID, dispatch, navigation]);

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
                {isAadhaarFallback
                  ? t('auth.otp.verifyAadhaar')
                  : isPasswordReset
                  ? t('auth.otp.verifyEmail')
                  : t('auth.otp.authenticateAccount')}
              </AppText>
              <AppText style={styles.description}>
                {isAadhaarFallback
                  ? emailMessage
                  : isPasswordReset
                  ? emailMessage
                  : emailID
                  ? t('auth.otp.loginDescription')
                  : emailMessage}
              </AppText>
            </View>

            <OtpInput
              disabled={false}
              type="numeric"
              blurOnFilled
              secureTextEntry={false}
              focusStickBlinkingDuration={500}
              numberOfDigits={6}
              onTextChange={setOtpValue}
              onFilled={setOtpValue}
              textInputProps={{ value: otpValue }}
              textProps={otpTextProps}
              theme={otpTheme}
            />

            <AppButton
              title={t('auth.otp.confirm')}
              style={styles.confirmButton}
              onPress={onConfirmButtonPress}
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

export default React.memo(OtpScreen);

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
});

