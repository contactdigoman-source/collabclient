import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  Keyboard,
  TextInput,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  BackHeader,
} from '../../components';
import { FontTypes, hp, Icons, Images, PASSWORD_FORMAT } from '../../constants';
import { RootStackParamList } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { NavigationProp } from '../../types/navigation';
import { logger } from '../../services/logger';

const IMAGE_SIZE = hp(18.63);

interface ChangeForgottenPasswordProps {
  route: RouteProp<RootStackParamList, 'ChangeForgottenPassword'> & {
    params?: {
      emailID?: string;
    };
  };
}

const ChangeForgottenPassword: React.FC<ChangeForgottenPasswordProps> = ({
  route,
}) => {
  const emailID = route?.params?.emailID || '';
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passError, setPassError] = useState<string | null>(null);
  const [confirmPassError, setConfirmPassError] = useState<string | null>(
    null,
  );

  const passwordRef = useRef<TextInput>(null);
  const confPasswordRef = useRef<TextInput>(null);

  // ✅ Memoized input handlers
  const handleNewPasswordChange = useCallback(
    (text: string) => {
      setPassword(text);
      if (passError || confirmPassError) {
        setPassError(null);
        setConfirmPassError(null);
      }
    },
    [passError, confirmPassError],
  );

  const handleConfirmPasswordChange = useCallback(
    (text: string) => {
      setConfirmPassword(text);
      if (passError || confirmPassError) {
        setPassError(null);
        setConfirmPassError(null);
      }
    },
    [passError, confirmPassError],
  );

  // ✅ Clean validation logic
  const validatePassword = useCallback((): boolean => {
    if (!password.trim()) {
      setPassError(t('auth.changePassword.passwordEmpty'));
      return false;
    }

    if (!confirmPassword.trim()) {
      setConfirmPassError(t('auth.changePassword.confirmPasswordEmpty'));
      return false;
    }

    if (password.length < 14) {
      setPassError(t('auth.changePassword.passwordMinLength'));
      return false;
    }

    if (password.length > 28) {
      setPassError(t('auth.changePassword.passwordMaxLength'));
      return false;
    }

    if (password.toLowerCase().trim() === emailID.toLowerCase().trim()) {
      setPassError(t('auth.changePassword.passwordSameAsEmail'));
      return false;
    }

    if (!PASSWORD_FORMAT.test(password)) {
      setPassError(t('auth.changePassword.passwordFormat'));
      return false;
    }

    if (password !== confirmPassword) {
      setConfirmPassError(t('auth.changePassword.passwordsNotMatch'));
      return false;
    }

    return true;
  }, [password, confirmPassword, emailID, t]);

  const handleDonePress = useCallback((): void => {
    if (!validatePassword()) return;
    setPassError(null);
    setConfirmPassError(null);

    // TODO: Call your updatePassword API
    logger.debug('Password successfully validated and ready for update');
    navigation.navigate('LoginScreen');
  }, [validatePassword]);

  return (
    <AppContainer>
      <BackHeader />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback
          style={styles.flex1}
          onPress={Keyboard.dismiss}
        >
          <View style={styles.container}>
            <View style={styles.subContainer}>
              <AppImage
                size={IMAGE_SIZE}
                source={Images.forgot_pass_image}
                style={styles.image}
              />
              <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                {t('auth.changePassword.title')}
              </AppText>
              <AppText style={styles.description}>
                {t('auth.changePassword.description')}
              </AppText>
            </View>

            <AppInput
              refName={passwordRef}
              icon={Icons.password}
              isBorderFocused={!!passError}
              value={password}
              placeholder={t('auth.changePassword.newPassword')}
              onChangeText={handleNewPasswordChange}
              secureTextEntry
              returnKeyType="next"
              error={passError}
              maxLength={28}
            />

            <AppInput
              refName={confPasswordRef}
              icon={Icons.password}
              isBorderFocused={!!confirmPassError}
              value={confirmPassword}
              placeholder={t('auth.changePassword.confirmPassword')}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry
              returnKeyType="done"
              error={confirmPassError}
              maxLength={28}
            />

            <AppText style={styles.passwordHint}>
              {t('auth.changePassword.passwordHint')}
            </AppText>

            <AppButton
              title={t('auth.changePassword.done')}
              style={styles.doneButton}
              onPress={handleDonePress}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
};

export default React.memo(ChangeForgottenPassword);

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
    marginBottom: hp(5),
  },
  image: {
    marginBottom: hp(2),
  },
  description: {
    textAlign: 'center',
    marginVertical: hp(1),
  },
  passwordHint: {
    opacity: 0.7,
    marginTop: hp(1.5),
  },
  doneButton: {
    marginTop: hp(5),
  },
});

