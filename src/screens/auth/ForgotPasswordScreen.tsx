import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  BackHeader,
} from '../../components';
import { Icons, Images, MAIL_FORMAT, hp } from '../../constants';
import { NavigationProp, RootStackParamList } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { forgotPassword } from '../../services/auth/forgot-password-service';
import { logger } from '../../services/logger';

interface ForgotPasswordScreenProps {
  route: RouteProp<RootStackParamList, 'ForgotPasswordScreen'> & {
    params?: {
      emailID?: string;
    };
  };
}

export default function ForgotPasswordScreen({
  route,
}: ForgotPasswordScreenProps): React.JSX.Element {
  const emailID = route?.params?.emailID || '';
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>(emailID || '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);


  const validateEmail = useCallback((): boolean => {
    if (!email.trim()) {
      setEmailError(t('auth.forgotPassword.emailRequired'));
      return false;
    }
    if (!MAIL_FORMAT.test(email.trim())) {
      setEmailError(t('auth.forgotPassword.emailInvalid'));
      return false;
    }
    setEmailError(null);
    return true;
  }, [email, t]);

  const onNextPress = useCallback(async (): Promise<void> => {
    if (!validateEmail()) return;
    Keyboard.dismiss();

    setIsLoading(true);
    setEmailError(null);

    try {
      const response = await forgotPassword({ email: email.trim() });

      // If OTP was sent successfully, navigate to OTP screen
      if (response.success && response.otpSent) {
        navigation.navigate('OtpScreen', {
          emailID: email.trim(),
          isPasswordReset: true,
        });
      } else {
        setEmailError(response.message || t('auth.forgotPassword.requestFailed', 'Failed to send password reset OTP. Please try again.'));
      }
    } catch (error: any) {
      logger.error('Forgot password error', error);
      setEmailError(error.message || t('auth.forgotPassword.requestFailed', 'Failed to send password reset OTP. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [email, validateEmail, navigation, t]);

  return (
    <AppContainer>
      <BackHeader />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.imageWrapper}>
              <AppImage size={hp('18.63%')} source={Images.forgot_pass_image} />
            </View>

            <View style={styles.welcomeContainer}>
              <AppText size={hp('2.48%')} style={styles.welcomeText}>
                {t('auth.forgotPassword.title')}
              </AppText>
              <AppText size={hp('1.74%')} style={styles.loginText}>
                {t('auth.forgotPassword.description')}
              </AppText>
            </View>

            <AppInput
              icon={Icons.email}
              isBorderFocused={!!emailError}
              value={email}
              placeholder={t('auth.forgotPassword.email')}
              onChangeText={(text: string) => {
                setEmail(text);
                if (emailError) setEmailError(null);
              }}
              error={emailError}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={onNextPress}
            />

            <AppButton
              title={t('auth.forgotPassword.next')}
              style={styles.button}
              onPress={onNextPress}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp('4.35%'),
    marginBottom: hp('8.69%'),
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp('1.86%'),
  },
  welcomeText: {
    fontWeight: 'bold',
    marginBottom: hp('0.62%'),
  },
  loginText: {
    marginBottom: hp('6.45%'),
  },
  button: {
    marginTop: hp('3.72%'),
  },
});

