import React, { useRef, useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  AccountLockedModal,
} from '../../components';
import PasswordExpiryModal from '../../components/app-modals/PasswordExpiryModal';
import { hp, Icons, Images, MAIL_FORMAT } from '../../constants';
import { useAppDispatch, setUserData, setJWTToken, setAccountStatus } from '../../redux';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { loginUser, storeJWTToken, AccountStatus } from '../../services/auth/login-service';

export default function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [passError, setPassError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [isAccountLockedModalVisible, setIsAccountLockedModalVisible] =
    useState<boolean>(false);
  const [isPasswordExpiryModalVisible, setIsPasswordExpiryModalVisible] =
    useState<boolean>(false);

  const validateEmail = useCallback((): boolean => {
    if (!email.trim()) {
      setEmailError(t('auth.login.emailRequired'));
      return false;
    }
    if (!MAIL_FORMAT.test(email.trim())) {
      setEmailError(t('auth.login.emailInvalid'));
      return false;
    }
    setEmailError(null);
    return true;
  }, [email, t]);

  const onLoginPress = useCallback(async (): Promise<void> => {
    if (!validateEmail()) return;
    if (!password.trim()) {
      setPassError(t('auth.login.passwordRequired'));
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    setEmailError(null);
    setPassError(null);

    try {
      // Call login API
      const loginResponse = await loginUser({ email, password });

      // Store JWT token securely in Keychain
      await storeJWTToken(loginResponse.token, loginResponse.user.email);

      // Save user data and token to Redux store
      dispatch(setUserData({
        id: loginResponse.user.id,
        firstName: loginResponse.user.firstName,
        lastName: loginResponse.user.lastName,
        email: loginResponse.user.email,
        phoneNumber: loginResponse.user.phoneNumber,
        isEmailVerified: loginResponse.user.isEmailVerified,
        isPhoneVerified: loginResponse.user.isPhoneVerified,
        requiresPasswordChange: loginResponse.user.requiresPasswordChange,
        roles: loginResponse.user.roles,
        firstTimeLogin: loginResponse.user.firstTimeLogin,
      }));
      dispatch(setJWTToken(loginResponse.token));
      dispatch(setAccountStatus(loginResponse.accountStatus));

      // Handle account status
      // Possible values: "active" | "locked" | "password expired" | "inactive"
      const accountStatus = loginResponse.accountStatus?.toLowerCase() as AccountStatus;
      
      if (accountStatus === 'locked') {
        // Show AccountLockedModal - user cannot proceed
        setIsAccountLockedModalVisible(true);
        setIsLoading(false);
        return;
      }

      if (accountStatus === 'password expired') {
        // Show PasswordExpiryModal - user can reset password or dismiss
        setIsPasswordExpiryModalVisible(true);
        setIsLoading(false);
        return;
      }

      if (accountStatus === 'inactive') {
        // Show error message - user cannot proceed
        setLoginError('Your account is inactive. Please contact support.');
        setIsLoading(false);
        return;
      }

      // accountStatus === 'active' - proceed with navigation

      // Always navigate to OTP screen after successful login
      // OTP screen will decide whether to go to dashboard or first-time login
      navigation.replace('OtpScreen', { emailID: email });
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || t('auth.login.loginFailed') || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, dispatch, navigation, validateEmail, t]);

  const handleCloseLockedModal = useCallback((): void => {
    setIsAccountLockedModalVisible(false);
  }, []);

  const handlePasswordExpiryReset = useCallback((): void => {
    setIsPasswordExpiryModalVisible(false);
    // Navigate to change password screen
    navigation.navigate('ChangeForgottenPassword', { emailID: email });
  }, [navigation, email]);

  const handlePasswordExpiryDismiss = useCallback((): void => {
    setIsPasswordExpiryModalVisible(false);
    // User chose to dismiss - they should reset password via the modal
    // Navigation will be handled by handlePasswordExpiryReset
  }, []);

  const onForgotPasswordPress = useCallback((): void => {
    navigation.navigate('ForgotPasswordScreen', { emailID: email });
  }, [navigation, email]);

  return (
    <AppContainer>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <AppImage
              size={hp('15%')}
              source={Images.app_logo}
              style={styles.logo}
            />

            {/* Welcome Text */}
            <View style={styles.welcomeContainer}>
              <AppText style={styles.welcomeText}>
                {t('auth.login.welcome')}
              </AppText>
              <AppText style={styles.loginSubtitle}>
                {t('auth.login.subtitle')}
              </AppText>
            </View>

            <AppInput
              icon={Icons.email}
              isBorderFocused={!!emailError}
              value={email}
              placeholder={t('auth.login.email')}
              onChangeText={(text: string) => {
                setEmail(text);
                if (emailError) setEmailError(null);
              }}
              error={emailError}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <AppInput
              icon={Icons.password}
              isBorderFocused={!!passError}
              refName={passwordRef}
              value={password}
              placeholder={t('auth.login.password')}
              onChangeText={(text: string) => {
                setPassword(text);
                if (passError) setPassError(null);
              }}
              secureTextEntry
              error={passError}
              returnKeyType="done"
              onSubmitEditing={onLoginPress}
            />

            {loginError && (
              <AppText
                size={hp(1.8)}
                color="#E53131"
                style={styles.errorText}
              >
                {loginError}
              </AppText>
            )}

            <AppButton
              title={isLoading ? t('auth.login.loading') || 'Logging in...' : t('auth.login.title')}
              style={styles.button}
              onPress={onLoginPress}
              disabled={isLoading}
              loading={isLoading}
            />

            <View style={styles.forgotPassword}>
              <TouchableOpacity
                onPress={onForgotPasswordPress}
                activeOpacity={0.7}
              >
                <AppText size={hp(1.74)} color={colors.primary}>
                  {t('auth.login.forgotPassword')}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Account Locked Modal */}
      <AccountLockedModal
        visible={isAccountLockedModalVisible}
        onClose={handleCloseLockedModal}
      />

      {/* Password Expiry Modal */}
      <PasswordExpiryModal
        visible={isPasswordExpiryModalVisible}
        onReset={handlePasswordExpiryReset}
        onDismiss={handlePasswordExpiryDismiss}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp(4.35),
  },
  logo: {
    alignSelf: 'center',
    margin: hp(5),
  },
  welcomeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(5),
  },
  welcomeText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: hp(3.1), // 24.8921px equivalent
    lineHeight: hp(4.25), // 34px equivalent
    textAlign: 'center',
    color: '#FFFFFF',
    marginBottom: hp(0.5),
  },
  loginSubtitle: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(2), // 16px equivalent
    lineHeight: hp(2.75), // 22px equivalent
    textAlign: 'center',
    color: '#FFFFFF',
  },
  button: {
    marginTop: hp(1.24),
  },
  forgotPassword: {
    marginTop: hp(6.21),
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: hp(1),
    marginBottom: hp(1),
    textAlign: 'center',
  },
});
