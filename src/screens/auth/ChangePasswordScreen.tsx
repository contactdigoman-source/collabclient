import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  Keyboard,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, CommonActions, RouteProp } from '@react-navigation/native';
import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  BackHeader,
} from '../../components';
import { FontTypes, hp, Icons, Images, PASSWORD_FORMAT } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { NavigationProp, RootStackParamList } from '../../types/navigation';
import { useAppSelector } from '../../redux';
import { changePassword, resetPassword } from '../../services';

const IMAGE_SIZE = hp(18.63);

interface ChangePasswordScreenProps {
  route: RouteProp<RootStackParamList, 'ChangePasswordScreen'>;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { userData } = useAppSelector(state => state.userState);
  
  // ChangePasswordScreen handles two cases:
  // 1. Password expired from login flow (has token, no current password needed)
  // 2. Change password from profile (no token, requires current password, user is logged in)
  const routeParams = route?.params;
  const resetToken = routeParams?.token;
  const isPasswordExpired = !!resetToken; // If token exists, it's password expired from login flow
  const emailID = routeParams?.emailID || userData?.email || '';
  
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [currentPassError, setCurrentPassError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [confirmPassError, setConfirmPassError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const currentPasswordRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confPasswordRef = useRef<TextInput>(null);

  // Memoized input handlers
  const handleCurrentPasswordChange = useCallback(
    (text: string) => {
      setCurrentPassword(text);
      if (currentPassError) {
        setCurrentPassError(null);
      }
    },
    [currentPassError],
  );

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

  // Validation logic
  const validatePassword = useCallback((): boolean => {
    // Only require current password if NOT password expired from login flow
    if (!isPasswordExpired && !currentPassword.trim()) {
      setCurrentPassError(t('auth.changePassword.passwordEmpty', 'Current password is required'));
      return false;
    }

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

    if (emailID && password.toLowerCase().trim() === emailID.toLowerCase().trim()) {
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
  }, [password, confirmPassword, currentPassword, emailID, isPasswordExpired, t]);

  const handleDonePress = useCallback(async (): Promise<void> => {
    if (!validatePassword()) return;
    
    setCurrentPassError(null);
    setPassError(null);
    setConfirmPassError(null);

    try {
      setIsLoading(true);
      
      if (isPasswordExpired) {
        // Password expired from login flow: use reset-password API
        if (!resetToken) {
          throw new Error('Reset token is required');
        }
        
        await resetPassword({
          token: resetToken,
          newPassword: password,
        });

        Alert.alert(
          t('common.success'),
          t('auth.changePassword.done', 'Password changed successfully'),
          [
            {
              text: t('common.okay', 'Okay'),
              onPress: () => {
                // Clear navigation stack and navigate to LoginScreen
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'LoginScreen' }],
                  })
                );
              },
            },
          ]
        );
      } else {
        // Change password from profile: use change-password API
        await changePassword({
          currentPassword,
          newPassword: password,
        });

        Alert.alert(
          t('common.success'),
          t('auth.changePassword.done', 'Password changed successfully'),
          [
            {
              text: t('common.okay', 'Okay'),
              onPress: () => {
                // Clear navigation stack and navigate to LoginScreen
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'LoginScreen' }],
                  })
                );
              },
            },
          ]
        );
      }
    } catch (error: any) {
      const errorMessage = error.message || (isPasswordExpired ? 'Failed to change password' : 'Failed to change password');
      
      // Check if it's a wrong current password error (only for profile change password)
      if (!isPasswordExpired && (errorMessage.toLowerCase().includes('current') || errorMessage.toLowerCase().includes('incorrect'))) {
        setCurrentPassError(errorMessage);
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [validatePassword, currentPassword, password, isPasswordExpired, resetToken, t, navigation]);

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

            {/* Only show current password field if NOT password expired from login flow */}
            {!isPasswordExpired && (
              <AppInput
                refName={currentPasswordRef}
                icon={Icons.password}
                isBorderFocused={!!currentPassError}
                value={currentPassword}
                placeholder={t('profile.currentPassword', 'Current Password')}
                onChangeText={handleCurrentPasswordChange}
                secureTextEntry
                returnKeyType="next"
                error={currentPassError}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}

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
              onSubmitEditing={() => confPasswordRef.current?.focus()}
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
              onSubmitEditing={handleDonePress}
            />

            <AppText style={styles.passwordHint}>
              {t('auth.changePassword.passwordHint')}
            </AppText>

            <AppButton
              title={t('auth.changePassword.done')}
              style={styles.doneButton}
              onPress={handleDonePress}
              disabled={isLoading}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
};

export default React.memo(ChangePasswordScreen);

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

