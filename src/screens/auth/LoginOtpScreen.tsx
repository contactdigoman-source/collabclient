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
  TouchableOpacity,
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
  AccountLockedModal,
  AccountInactiveModal,
  PasswordExpiryModal,
} from '../../components';
import { FontTypes, hp, wp, Images } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../redux';
import { DarkThemeColors, LightThemeColors } from '../../themes';
import { verifyLoginOTP, resendOTP } from '../../services/auth/otp-service';
import { storeJWTToken } from '../../services/auth/login-service';
import {
  setJWTToken,
  setExpiresAt,
  setUserData,
  setAccountStatus,
  setIdpjourneyToken,
} from '../../redux';
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

interface LoginOtpScreenProps {
  route: RouteProp<RootStackParamList, 'LoginOtpScreen'> & {
    params?: {
      emailID?: string;
    };
  };
}

const LoginOtpScreen: React.FC<LoginOtpScreenProps> = ({ route }) => {
  const emailID = route?.params?.emailID || '';
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === 'dark' ? DarkThemeColors : LightThemeColors;
  const idpjourneyToken = useAppSelector(
    state => state.userState.idpjourneyToken,
  );

  const [otpValue, setOtpValue] = useState<string>('');
  const [timer, setTimer] = useState<number>(RESEND_TIMEOUT);
  const [resendActive, setResendActive] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');
  const [isAccountLockedModalVisible, setIsAccountLockedModalVisible] =
    useState<boolean>(false);
  const [isAccountInactiveModalVisible, setIsAccountInactiveModalVisible] =
    useState<boolean>(false);
  const [isPasswordExpiryModalVisible, setIsPasswordExpiryModalVisible] =
    useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string | null>(null); // Store token from OTP verification
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const emailMessage = useMemo(() => {
    if (!emailID) return '';
    try {
      const message = t('auth.otp.emailMessage', { email: emailID });
      // Replace {{email}} with actual email if interpolation didn't work
      const finalMessage =
        message && message !== 'auth.otp.emailMessage'
          ? message.replace(/\{\{email\}\}/g, emailID)
          : `Enter the OTP sent to ${emailID}`;
      return finalMessage;
    } catch (error) {
      return `Enter the OTP sent to ${emailID}`;
    }
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

  const handleResend = useCallback(async (): Promise<void> => {
    if (!resendActive || !emailID) return;

    try {
      await resendOTP({
        email: emailID,
        flowType: 'login',
      });

      startTimer();
      setOtpError('');
    } catch (error: any) {
      setOtpError(
        error.message ||
          t('auth.otp.resendFailed', 'Failed to resend OTP. Please try again.'),
      );
    }
  }, [resendActive, emailID, startTimer, t]);

  const onConfirmButtonPress = useCallback(async (): Promise<void> => {
    if (otpValue.trim().length !== 6) {
      return;
    }

    if (!idpjourneyToken) {
      setOtpError(
        t('auth.otp.tokenRequired', 'Session expired. Please login again.'),
      );
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      // Verify OTP with API using idpjourneyToken and otpValue
      const verifyResponse = await verifyLoginOTP({
        idpjourneyToken,
        otpValue: otpValue.trim(),
      });

      // Validate response structure
      if (!verifyResponse) {
        setOtpError(
          t(
            'auth.otp.verificationFailed',
            'Failed to verify OTP. Please try again.',
          ),
        );
        setIsVerifying(false);
        return;
      }

      if (!verifyResponse.success) {
        setOtpError(
          verifyResponse.message ||
            t('auth.otp.invalidOtp', 'Invalid OTP. Please try again.'),
        );
        setIsVerifying(false);
        return;
      }

      // Handle accountStatus first (locked/inactive -> show popup)
      const accountStatus = verifyResponse.accountStatus;
      if (accountStatus) {
        dispatch(setAccountStatus(accountStatus));
        if (accountStatus === 'locked') {
          setIsAccountLockedModalVisible(true);
          setIsVerifying(false);
          return;
        }
        if (accountStatus === 'inactive') {
          setIsAccountInactiveModalVisible(true);
          setIsVerifying(false);
          return;
        }
      }

      // Handle firstTimeLogin
      if (verifyResponse.firstTimeLogin === true) {
        // Save the new idpjourneyToken for first-time login flow
        if (verifyResponse.idpjourneyToken) {
          dispatch(setIdpjourneyToken(verifyResponse.idpjourneyToken));
        }
        // Navigate to FirstTimeLoginScreen
        navigation.replace('FirstTimeLoginScreen');
        setIsVerifying(false);
        return;
      }

      // If not firstTimeLogin, check accountStatus
      if (accountStatus === 'passwordExpired') {
        // Store token from OTP verification response for password reset
        // Prefer token field, fallback to idpjourneyToken if token not available
        if (verifyResponse.token) {
          setResetToken(verifyResponse.token);
        } else if (verifyResponse.idpjourneyToken) {
          // Use idpjourneyToken as reset token if token field not available
          setResetToken(verifyResponse.idpjourneyToken);
        }
        setIsPasswordExpiryModalVisible(true);
        setIsVerifying(false);
        return;
      }

      // If account is active and not firstTimeLogin, save all user data and tokens
      if (accountStatus === 'active' && !verifyResponse.firstTimeLogin) {
        // Store JWT token and refresh token securely
        if (verifyResponse.jwt && emailID) {
          await storeJWTToken(
            verifyResponse.jwt,
            verifyResponse.email || emailID,
            verifyResponse.refreshToken, // Optional: will be stored if provided
          );
          dispatch(setJWTToken(verifyResponse.jwt));
          
          // Log token storage for debugging
          logger.info('Tokens stored from OTP verification', {
            hasJWT: !!verifyResponse.jwt,
            hasRefreshToken: !!verifyResponse.refreshToken,
            hasExpiresAt: !!verifyResponse.expiresAt,
          });
        }

        if (verifyResponse.expiresAt) {
          dispatch(setExpiresAt(verifyResponse.expiresAt));
        } else {
          logger.warn('OTP verification response missing expiresAt');
        }
        
        if (!verifyResponse.refreshToken) {
          logger.warn('OTP verification response missing refreshToken');
        }

        // Store user data
        dispatch(
          setUserData({
            email: verifyResponse.email,
            firstName: verifyResponse.firstName,
            lastName: verifyResponse.lastName,
            phoneNumber: verifyResponse.contact,
            roles: verifyResponse.role ? [verifyResponse.role] : [],
          }),
        );

        // Navigate to Dashboard
        navigation.replace('DashboardScreen');
        setIsVerifying(false);
        return;
      }

      // Fallback error
      setOtpError(
        t(
          'auth.otp.verificationFailed',
          'Failed to verify OTP. Please try again.',
        ),
      );
      setIsVerifying(false);
    } catch (error: any) {
      setOtpError(
        error.message ||
          t(
            'auth.otp.verificationFailed',
            'Failed to verify OTP. Please try again.',
          ),
      );
      setIsVerifying(false);
    }
  }, [otpValue, idpjourneyToken, emailID, dispatch, navigation, t]);

  // memoized otp styles and theme to avoid re-render
  const otpTheme = useMemo(
    () =>
      ({
        containerStyle: styles.otpMainContainer,
        pinCodeContainerStyle: [
          styles.otpCodeContainer,
          { backgroundColor: themeColors.app_input_bg },
        ],
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor: colors.primary,
        },
      } as any), // Type assertion needed for OtpInput theme prop
    [colors, themeColors.app_input_bg],
  );

  const otpTextProps = useMemo(
    () => ({
      style: {
        color: colors.text || themeColors.white_common,
        fontSize: hp(2.2),
      },
    }),
    [colors.text, themeColors.white_common],
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
              <AppText
                size={hp(2.5)}
                fontType={FontTypes.medium}
                color={colors.text || themeColors.white_common}
              >
                {(() => {
                  try {
                    const text = t('auth.otp.authenticateAccount');
                    return text && text !== 'auth.otp.authenticateAccount'
                      ? text
                      : 'Authenticate Account';
                  } catch (error) {
                    return 'Authenticate Account';
                  }
                })()}
              </AppText>
              <AppText
                style={styles.description}
                color={colors.text || themeColors.white_common}
              >
                {emailMessage || 'Enter the OTP sent to your email'}
              </AppText>
            </View>

            <OtpInput
              disabled={isVerifying}
              type="numeric"
              blurOnFilled
              secureTextEntry={false}
              focusStickBlinkingDuration={500}
              numberOfDigits={6}
              onTextChange={text => {
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
                color={themeColors.red || '#FF4444'}
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
              <AppText color={colors.text || themeColors.white_common}>
                {t('auth.otp.didntReceive')}{' '}
              </AppText>
              <TouchableOpacity
                onPress={handleResend}
                disabled={!resendActive}
                style={styles.resendButton}
                activeOpacity={0.7}
              >
                <AppText
                  color={
                    resendActive
                      ? colors.primary
                      : colors.text || themeColors.white_common
                  }
                  style={styles.resendText}
                >
                  {t('auth.otp.resend')}
                </AppText>
              </TouchableOpacity>
            </View>

            <TimerDisplay timer={timer} color={colors.primary} />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Account Locked Modal */}
      <AccountLockedModal
        visible={isAccountLockedModalVisible}
        onClose={() => {
          setIsAccountLockedModalVisible(false);
          // Navigate back to login screen
          navigation.replace('LoginScreen');
        }}
      />

      {/* Account Inactive Modal */}
      <AccountInactiveModal
        visible={isAccountInactiveModalVisible}
        onClose={() => {
          setIsAccountInactiveModalVisible(false);
          // Navigate back to login screen
          navigation.replace('LoginScreen');
        }}
      />

      {/* Password Expiry Modal */}
      <PasswordExpiryModal
        visible={isPasswordExpiryModalVisible}
        onReset={() => {
          setIsPasswordExpiryModalVisible(false);
          // Navigate to ChangePasswordScreen with token (password expired from login flow)
          navigation.navigate('ChangePasswordScreen', { 
            emailID,
            token: resetToken || undefined,
          });
        }}
        onDismiss={() => setIsPasswordExpiryModalVisible(false)}
      />
    </AppContainer>
  );
};

export default React.memo(LoginOtpScreen);

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
    justifyContent: 'center',
    marginVertical: hp(2),
    width: '100%',
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
  resendText: {
    opacity: 0.7,
  },
});
