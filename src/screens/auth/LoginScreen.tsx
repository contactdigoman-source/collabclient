import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
  TextInput,
  BackHandler,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  AccountLockedModal,
  AccountInactiveModal,
} from '../../components';
import { hp, Icons, Images, MAIL_FORMAT } from '../../constants';
import { useAppDispatch, setIdpjourneyToken, setAccountStatus } from '../../redux';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { loginUser } from '../../services/auth/login-service';
import { logger } from '../../services/logger';

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
  const [isAccountLockedModalVisible, setIsAccountLockedModalVisible] = useState<boolean>(false);
  const [isAccountInactiveModalVisible, setIsAccountInactiveModalVisible] = useState<boolean>(false);

  // Prevent hardware back button from going back (exit app instead)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // On Android, this will exit the app
      return true;
    });

    return () => backHandler.remove();
  }, []);

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

      // Handle account status from response
      if (loginResponse.accountStatus) {
        dispatch(setAccountStatus(loginResponse.accountStatus));

        if (loginResponse.accountStatus === 'locked') {
          setIsAccountLockedModalVisible(true);
          setIsLoading(false);
          return;
        }

        if (loginResponse.accountStatus === 'inactive') {
          setIsAccountInactiveModalVisible(true);
          setIsLoading(false);
          return;
        }

        // For passwordExpired, continue to OTP screen (will be handled there)
        // For active, continue to OTP screen
      }

      // Save idpjourney token to Redux store (will be used in OTP verification)
      dispatch(setIdpjourneyToken(loginResponse.idpjourneyToken));

      // Always navigate to Login OTP screen after successful login
      // Login OTP screen will use the idpjourneyToken for verification
      navigation.navigate('LoginOtpScreen', { emailID: email });
    } catch (error: any) {
      logger.error('Login error', error);
      setLoginError(error.message || t('auth.login.loginFailed') || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, dispatch, navigation, validateEmail, t]);

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
              <AppText style={styles.welcomeText} color={colors.text || '#FFFFFF'}>
                {t('auth.login.welcome')}
              </AppText>
              <AppText style={styles.loginSubtitle} color={colors.text || '#FFFFFF'}>
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
        onClose={() => setIsAccountLockedModalVisible(false)}
      />

      {/* Account Inactive Modal */}
      <AccountInactiveModal
        visible={isAccountInactiveModalVisible}
        onClose={() => setIsAccountInactiveModalVisible(false)}
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
    marginBottom: hp(0.5),
  },
  loginSubtitle: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(2), // 16px equivalent
    lineHeight: hp(2.75), // 22px equivalent
    textAlign: 'center',
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
