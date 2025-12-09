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
import { useAppDispatch, setUserData } from '../../redux';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import {
  isAccountLocked,
  incrementLoginAttempts,
  resetLoginAttempts,
  incrementSuccessfulLoginCount,
} from '../../services';

interface EmailName {
  firstName: string;
  lastName: string;
  email: string;
}

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
  const [isAccountLockedModalVisible, setIsAccountLockedModalVisible] =
    useState<boolean>(false);
  const [isPasswordExpiryModalVisible, setIsPasswordExpiryModalVisible] =
    useState<boolean>(false);

  // Check if account is locked on mount
  useEffect(() => {
    if (isAccountLocked()) {
      setIsAccountLockedModalVisible(true);
    }
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
    // Check if account is locked
    if (isAccountLocked()) {
      setIsAccountLockedModalVisible(true);
      return;
    }

    if (!validateEmail()) return;
    // TODO: Add real validation
    if (!password.trim()) {
      setPassError(t('auth.login.passwordRequired'));
      return;
    }

    // Increment login attempts (for demo: locks on every 3rd attempt)
    const attempts = incrementLoginAttempts();

    // Check if account should be locked after this attempt
    if (attempts % 3 === 0) {
      setIsAccountLockedModalVisible(true);
      return;
    }

    // Helper to capitalize first letter
    const capitalize = (str: string): string => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Extract name from email
    const getNameFromEmail = (emailAddress: string): EmailName => {
      if (!emailAddress || typeof emailAddress !== 'string')
        return { firstName: '', lastName: '', email: '' };

      // Extract the part before '@'
      const namePart = emailAddress.split('@')[0];

      // Replace dots, underscores, or hyphens with spaces
      const parts = namePart.split(/[._-]+/).filter(Boolean);

      const firstName = parts[0] ? capitalize(parts[0]) : '';
      const lastName = parts[1] ? capitalize(parts[1]) : '';

      return { firstName, lastName, email: emailAddress };
    };

    // Reset login attempts on successful login
    resetLoginAttempts();

    // Dispatch user data after login
    await dispatch(setUserData(getNameFromEmail(email)));

    // Always navigate to OTP screen first after login
    // OTP screen will then navigate to FirstTimeLoginScreen or DashboardScreen
    navigation.replace('OtpScreen', { emailID: email });
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
    // Continue with normal login flow
    dispatch(setUserData(getNameFromEmail(email)));
    navigation.replace('OtpScreen', { emailID: email });
  }, [dispatch, navigation, email]);

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

            <AppButton
              title={t('auth.login.title')}
              style={styles.button}
              onPress={onLoginPress}
            />

            <View style={styles.forgotPassword}>
              <TouchableOpacity onPress={onForgotPasswordPress} activeOpacity={0.7}>
                <AppText 
                  size={hp(1.74)} 
                  color={colors.primary}
                >
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
});
