import React, { useRef, useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppText,
  AppInput,
} from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, Icons, Images } from '../../constants';
import { useAppDispatch, setUserData } from '../../redux';
import { useTranslation } from '../../hooks/useTranslation';

export default function FirstTimeLoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  // Refs for input focus management
  const lastNameRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // State for form fields
  const [firstName, setFirstName] = useState<string>('');
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  
  const [lastName, setLastName] = useState<string>('');
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Validation functions
  const validateFirstName = useCallback((): boolean => {
    if (!firstName.trim()) {
      setFirstNameError(t('auth.firstTimeLogin.firstNameRequired'));
      return false;
    }
    if (firstName.trim().length < 2) {
      setFirstNameError(t('auth.firstTimeLogin.firstNameMinLength'));
      return false;
    }
    setFirstNameError(null);
    return true;
  }, [firstName, t]);

  const validateLastName = useCallback((): boolean => {
    if (!lastName.trim()) {
      setLastNameError(t('auth.firstTimeLogin.lastNameRequired'));
      return false;
    }
    if (lastName.trim().length < 2) {
      setLastNameError(t('auth.firstTimeLogin.lastNameMinLength'));
      return false;
    }
    setLastNameError(null);
    return true;
  }, [lastName, t]);

  const validateNewPassword = useCallback((): boolean => {
    if (!newPassword.trim()) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordRequired'));
      return false;
    }
    if (newPassword.length < 14) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordMinLength'));
      return false;
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordUppercase'));
      return false;
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordLowercase'));
      return false;
    }
    
    // Check for number
    if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordNumber'));
      return false;
    }
    
    // Check for allowed symbols: @$!%*?&
    if (!/[@$!%*?&]/.test(newPassword)) {
      setNewPasswordError(t('auth.firstTimeLogin.passwordSymbol'));
      return false;
    }
    
    setNewPasswordError(null);
    return true;
  }, [newPassword, t]);

  const validateConfirmPassword = useCallback((): boolean => {
    if (!confirmPassword.trim()) {
      setConfirmPasswordError(t('auth.firstTimeLogin.confirmPasswordRequired'));
      return false;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(t('auth.firstTimeLogin.passwordsNotMatch'));
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  }, [confirmPassword, newPassword, t]);

  const validateAllFields = useCallback((): boolean => {
    const isFirstNameValid = validateFirstName();
    const isLastNameValid = validateLastName();
    const isNewPasswordValid = validateNewPassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    return (
      isFirstNameValid &&
      isLastNameValid &&
      isNewPasswordValid &&
      isConfirmPasswordValid
    );
  }, [
    validateFirstName,
    validateLastName,
    validateNewPassword,
    validateConfirmPassword,
  ]);

  const handleContinue = useCallback(async (): Promise<void> => {
    if (!validateAllFields()) {
      return;
    }

    // Update user data with first name and last name
    await dispatch(
      setUserData({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: '', // Email will be set from login screen data
      }),
    );

    // Don't mark as completed yet - wait until PermissionsScreen is completed
    // markFirstTimeLoginCompleted() will be called in PermissionsScreen

    // TODO: Save the new password securely (e.g., update password via API)
    // For now, we'll just navigate to privacy policy screen
    console.log('New password set:', { firstName, lastName });

    // Navigate to PermissionsScreen after successful validation
    navigation.replace('PermissionsScreen');
  }, [
    firstName,
    lastName,
    validateAllFields,
    dispatch,
    navigation,
  ]);

  const handlePrivacyPolicyPress = useCallback((): void => {
    navigation.navigate('PrivacyPolicyScreen');
  }, [navigation]);

  const handleTermsPress = useCallback((): void => {
    navigation.navigate('TermsAndConditionsScreen');
  }, [navigation]);

  return (
    <AppContainer>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              <AppImage
                size={hp('15%')}
                source={Images.app_logo}
                style={styles.logo}
              />

              <AppText size={hp(2)} style={styles.title}>
                {t('auth.firstTimeLogin.title')}
              </AppText>

          
              <AppInput
                icon={Icons.name}
                placeholder={t('auth.firstTimeLogin.firstName')}
                value={firstName}
                onChangeText={(text: string) => {
                  setFirstName(text);
                  if (firstNameError) setFirstNameError(null);
                }}
                error={firstNameError}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />

              <AppInput
                refName={lastNameRef}
                icon={Icons.name}
                placeholder={t('auth.firstTimeLogin.lastName')}
                value={lastName}
                onChangeText={(text: string) => {
                  setLastName(text);
                  if (lastNameError) setLastNameError(null);
                }}
                error={lastNameError}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => newPasswordRef.current?.focus()}
              />

              <AppInput
                refName={newPasswordRef}
                icon={Icons.password}
                placeholder={t('auth.firstTimeLogin.newPassword')}
                value={newPassword}
                onChangeText={(text: string) => {
                  setNewPassword(text);
                  if (newPasswordError) setNewPasswordError(null);
                  // Clear confirm password error if passwords match now
                  if (confirmPassword && text === confirmPassword) {
                    setConfirmPasswordError(null);
                  }
                }}
                error={newPasswordError}
                secureTextEntry
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />

              <AppInput
                refName={confirmPasswordRef}
                icon={Icons.password}
                placeholder={t('auth.firstTimeLogin.confirmPassword')}
                value={confirmPassword}
                onChangeText={(text: string) => {
                  setConfirmPassword(text);
                  if (confirmPasswordError) setConfirmPasswordError(null);
                }}
                error={confirmPasswordError}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />

              <AppButton
                title={t('auth.firstTimeLogin.continue')}
                style={styles.button}
                onPress={handleContinue}
              />

              {/* Privacy Policy and Terms Agreement Text */}
              <View style={styles.agreementContainer}>
                <AppText size={hp(1.5)} style={styles.agreementText}>
                  {t('auth.firstTimeLogin.agreementText')}{' '}
                  <AppText
                    size={hp(1.5)}
                    style={styles.linkText}
                    onPress={handlePrivacyPolicyPress}
                  >
                    {t('auth.firstTimeLogin.privacyPolicy')}
                  </AppText>
                  {' '}
                  {t('auth.firstTimeLogin.and')}{' '}
                  <AppText
                    size={hp(1.5)}
                    style={styles.linkText}
                    onPress={handleTermsPress}
                  >
                    {t('auth.firstTimeLogin.termsAndConditions')}
                  </AppText>
                </AppText>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: hp(4),
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp(4.35),
  },
  logo: {
    alignSelf: 'center',
    marginBottom: hp(3),
  },
  title: {
    fontWeight: 'bold',
    marginBottom: hp(4),
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: hp(4),
    textAlign: 'center',
    opacity: 0.8,
  },
  button: {
    marginTop: hp(2),
  },
  agreementContainer: {
    position: 'absolute',
    width: wp(86.67), // 325px equivalent
    height: hp(4), // 32px equivalent
    left: wp(6.67), // 25px equivalent
    top: hp(90.75), // 758px equivalent
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreementText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(1.5), // 12px equivalent
    lineHeight: hp(2), // 16px equivalent
    textAlign: 'center',
    color: '#FFFFFF', // White color for main text
  },
  linkText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(1.5), // 12px equivalent
    lineHeight: hp(2), // 16px equivalent
    textAlign: 'center',
    color: '#62C268', // Green color for hyperlinks only
    textDecorationLine: 'underline',
  },
});
