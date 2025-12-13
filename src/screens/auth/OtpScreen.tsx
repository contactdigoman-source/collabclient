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
  Alert,
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
  PasswordExpiryModal,
} from '../../components';
import { FontTypes, hp, wp, Images } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../redux';
import { DarkThemeColors, LightThemeColors } from '../../themes';
// Removed Aadhaar OTP imports - now handled in AadhaarOtpScreen
import {
  requestLocationPermission,
  isLocationEnabled,
} from '../../services';
import { verifyOTP, resendOTP } from '../../services/auth/otp-service';
import { storeJWTToken } from '../../services/auth/login-service';
import { setJWTToken, setExpiresAt, setUserData, setAccountStatus } from '../../redux';
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
      isPasswordReset?: boolean;
      isPunchFlow?: boolean;
    };
  };
}

const OtpScreen: React.FC<OtpScreenProps> = ({ route }) => {
  const emailID = route?.params?.emailID || '';
  const isPasswordReset = route?.params?.isPasswordReset || false;
  const isPunchFlow = route?.params?.isPunchFlow || false;
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === 'dark' ? DarkThemeColors : LightThemeColors;

  const [otpValue, setOtpValue] = useState<string>('');
  const [timer, setTimer] = useState<number>(RESEND_TIMEOUT);
  const [resendActive, setResendActive] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');
  const [isAccountLockedModalVisible, setIsAccountLockedModalVisible] = useState<boolean>(false);
  const [isPasswordExpiryModalVisible, setIsPasswordExpiryModalVisible] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const emailMessage = useMemo(() => {
    if (!emailID) return '';
    try {
      const message = t('auth.otp.emailMessage');
      return message && message !== 'auth.otp.emailMessage' ? `${message} ${emailID}` : `Enter the OTP sent to ${emailID}`;
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

  // Request OTP when screen loads (for login/password reset flows)
  useEffect(() => {
    if (emailID && !isPasswordReset && !isPunchFlow) {
      // For login flow, OTP is typically sent after login attempt
      // So we don't request it here, it should already be sent
      // For password reset and punch flow, OTP should be requested from previous screen
    }
  }, [emailID, isPasswordReset, isPunchFlow]);

  const handleResend = useCallback(async (): Promise<void> => {
    if (!resendActive || !emailID) return;
    
    try {
      // Determine flow type for resend
      const flowType = isPasswordReset ? 'password-reset' : isPunchFlow ? 'punch' : 'login';
      
      await resendOTP({
        email: emailID,
        flowType: flowType as 'login' | 'password-reset' | 'punch',
      });
      
      startTimer();
      setOtpError('');
    } catch (error: any) {
      // Error is already logged in otp-service.ts via logServiceError
      setOtpError(error.message || t('auth.otp.resendFailed', 'Failed to resend OTP. Please try again.'));
    }
  }, [resendActive, emailID, isPasswordReset, isPunchFlow, startTimer, t]);

  const onConfirmButtonPress = useCallback(async (): Promise<void> => {
    if (otpValue.trim().length !== 6) {
      return;
    }

    if (!emailID) {
      setOtpError(t('auth.otp.emailRequired', 'Email is required'));
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      // Determine flow type for verification
      const flowType = isPasswordReset ? 'password-reset' : isPunchFlow ? 'punch' : 'login';
      
      // Verify OTP with API
      const verifyResponse = await verifyOTP({
        email: emailID,
        otp: otpValue,
        flowType: flowType as 'login' | 'password-reset' | 'punch',
      });

      // Validate response structure
      if (!verifyResponse) {
        setOtpError(t('auth.otp.verificationFailed', 'Failed to verify OTP. Please try again.'));
        setIsVerifying(false);
        return;
      }

      if (!verifyResponse.success) {
        setOtpError(verifyResponse.message || t('auth.otp.invalidOtp', 'Invalid OTP. Please try again.'));
        setIsVerifying(false);
        return;
      }

      // Handle account status from response
      const accountStatus = verifyResponse.accountStatus;
      if (accountStatus) {
        dispatch(setAccountStatus(accountStatus));

        if (accountStatus === 'locked') {
          setIsAccountLockedModalVisible(true);
          setIsVerifying(false);
          return;
        }

        if (accountStatus === 'password expired') {
          setIsPasswordExpiryModalVisible(true);
          setIsVerifying(false);
          return;
        }

        if (accountStatus === 'inactive') {
          setOtpError(t('auth.otp.accountInactive', 'Your account is inactive. Please contact support.'));
          setIsVerifying(false);
          return;
        }
      }

      // Store user data if returned in response
      if (verifyResponse.user) {
        dispatch(setUserData({
          id: verifyResponse.user.id,
          firstName: verifyResponse.user.firstName,
          lastName: verifyResponse.user.lastName,
          email: verifyResponse.user.email,
          phoneNumber: verifyResponse.user.phoneNumber,
          isEmailVerified: verifyResponse.user.isEmailVerified,
          isPhoneVerified: verifyResponse.user.isPhoneVerified,
          requiresPasswordChange: verifyResponse.user.requiresPasswordChange,
          roles: verifyResponse.user.roles,
          firstTimeLogin: verifyResponse.user.firstTimeLogin,
        }));
      }

      // If token is returned (login flow), store it securely
      if (verifyResponse.token) {
        await storeJWTToken(verifyResponse.token, emailID);
        dispatch(setJWTToken(verifyResponse.token));
        if (verifyResponse.expiresAt) {
          dispatch(setExpiresAt(verifyResponse.expiresAt));
        }
      }

      // Handle navigation based on flow type
      if (isPunchFlow) {
        // Handle punch flow OTP: After OTP success, check Aadhaar validation, then proceed to CheckInScreen
        // TODO: Verify OTP with backend before proceeding
        
        // Check if Aadhaar validation is needed (once per day)
        const { store } = require('../../redux');
        const { userAadhaarFaceValidated, lastAadhaarVerificationDate } = store.getState().userState;
        
        let isAadhaarVerificationNeeded = false;
        if (!userAadhaarFaceValidated) {
          isAadhaarVerificationNeeded = true;
        } else if (lastAadhaarVerificationDate) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          if (lastAadhaarVerificationDate !== today) {
            isAadhaarVerificationNeeded = true;
          }
        } else {
          isAadhaarVerificationNeeded = true;
        }
        
        if (isAadhaarVerificationNeeded) {
          // Navigate to Aadhaar input screen
          navigation.replace('AadhaarInputScreen');
          return;
        }
        
        // If Aadhaar is validated, proceed with location permission check and CheckInScreen
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
        // Password reset flow: Show success message and navigate to login
        Alert.alert(
          t('auth.otp.success', 'Success'),
          t('auth.otp.passwordResetSuccess', 'Password reset OTP verified successfully. You can now login with your new password.'),
          [
            {
              text: t('auth.otp.ok', 'OK'),
              onPress: () => {
                navigation.replace('LoginScreen');
              },
            },
          ],
          { cancelable: false }
        );
      } else if (emailID) {
        // Login flow: Use API response to decide navigation
        // Priority: 1. Response firstTimeLogin field, 2. User object firstTimeLogin
        const isFirstTime = verifyResponse.firstTimeLogin ?? verifyResponse.user?.firstTimeLogin ?? false;
        
        if (isFirstTime) {
          navigation.replace('FirstTimeLoginScreen');
        } else {
          navigation.replace('DashboardScreen');
        }
      }
    } catch (error: any) {
      // Error is already logged in otp-service.ts via logServiceError
      setOtpError(error.message || t('auth.otp.verificationFailed', 'Failed to verify OTP. Please try again.'));
      setIsVerifying(false);
    }
  }, [otpValue, isPunchFlow, isPasswordReset, emailID, dispatch, navigation, t]);

  // memoized otp styles and theme to avoid re-render
  const otpTheme = useMemo(
    () => ({
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
      style: { color: themeColors.white_common, fontSize: hp(2.2) },
    }),
    [themeColors],
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
                {(() => {
                  try {
                    if (isPasswordReset) {
                      const text = t('auth.otp.verifyEmail');
                      return text && text !== 'auth.otp.verifyEmail' ? text : 'Verify Email';
                    } else {
                      const text = t('auth.otp.authenticateAccount');
                      return text && text !== 'auth.otp.authenticateAccount' ? text : 'Authenticate Account';
                    }
                  } catch (error) {
                    return isPasswordReset ? 'Verify Email' : 'Authenticate Account';
                  }
                })()}
              </AppText>
              <AppText style={styles.description}>
                {(() => {
                  try {
                    if (isPasswordReset) {
                      return emailMessage;
                    } else if (emailID) {
                      const text = t('auth.otp.loginDescription');
                      return text && text !== 'auth.otp.loginDescription' ? text : emailMessage;
                    } else {
                      return emailMessage;
                    }
                  } catch (error) {
                    return emailMessage || 'Enter the OTP sent to your email';
                  }
                })()}
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
              <AppText>{t('auth.otp.didntReceive')} </AppText>
              <TouchableOpacity
                onPress={handleResend}
                disabled={!resendActive}
                style={styles.resendButton}
                activeOpacity={0.7}
              >
                <AppText
                  color={resendActive ? colors.primary : themeColors.white_common}
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
        onClose={() => setIsAccountLockedModalVisible(false)}
      />

      {/* Password Expiry Modal */}
      <PasswordExpiryModal
        visible={isPasswordExpiryModalVisible}
        onReset={() => {
          setIsPasswordExpiryModalVisible(false);
          navigation.navigate('ChangeForgottenPassword', { emailID });
        }}
        onDismiss={() => setIsPasswordExpiryModalVisible(false)}
      />
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
  errorText: {
    marginTop: hp(1),
    textAlign: 'center',
  },
  resendText: {
    opacity: 0.7,
  },
});

