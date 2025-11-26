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
import { markFirstTimeLoginCompleted } from '../../services';
import { NavigationProp } from '../../types/navigation';
import { hp, Icons, Images } from '../../constants';
import { useAppDispatch, setUserData } from '../../redux';

export default function FirstTimeLoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();

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
      setFirstNameError('First name is required');
      return false;
    }
    if (firstName.trim().length < 2) {
      setFirstNameError('First name must be at least 2 characters');
      return false;
    }
    setFirstNameError(null);
    return true;
  }, [firstName]);

  const validateLastName = useCallback((): boolean => {
    if (!lastName.trim()) {
      setLastNameError('Last name is required');
      return false;
    }
    if (lastName.trim().length < 2) {
      setLastNameError('Last name must be at least 2 characters');
      return false;
    }
    setLastNameError(null);
    return true;
  }, [lastName]);

  const validateNewPassword = useCallback((): boolean => {
    if (!newPassword.trim()) {
      setNewPasswordError('Password is required');
      return false;
    }
    if (newPassword.length < 14) {
      setNewPasswordError('Password must be at least 14 characters');
      return false;
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one uppercase letter');
      return false;
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one lowercase letter');
      return false;
    }
    
    // Check for number
    if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one number');
      return false;
    }
    
    // Check for allowed symbols: @$!%*?&
    if (!/[@$!%*?&]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one symbol (@$!%*?&)');
      return false;
    }
    
    setNewPasswordError(null);
    return true;
  }, [newPassword]);

  const validateConfirmPassword = useCallback((): boolean => {
    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  }, [confirmPassword, newPassword]);

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

    // Navigate to privacy policy screen first, then permissions
    navigation.replace('PrivacyPolicyScreen');
  }, [
    firstName,
    lastName,
    validateAllFields,
    dispatch,
    navigation,
  ]);

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
                Update your name and password
              </AppText>

          
              <AppInput
                icon={Icons.name}
                placeholder="First Name"
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
                placeholder="Last Name"
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
                placeholder="New Password"
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
                placeholder="Confirm New Password"
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
                title="Continue"
                style={styles.button}
                onPress={handleContinue}
              />
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
});
