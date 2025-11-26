import React, { useRef, useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
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
  RippleButton,
} from '../../components';
import { hp, Icons, Images, MAIL_FORMAT } from '../../constants';
import { useAppDispatch, setUserData } from '../../redux';
import { hasCompletedFirstTimeLogin } from '../../services';
import { NavigationProp } from '../../types/navigation';

interface EmailName {
  firstName: string;
  lastName: string;
  email: string;
}

export default function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();

  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [passError, setPassError] = useState<string | null>(null);

  const validateEmail = useCallback((): boolean => {
    if (!email.trim()) {
      setEmailError('Email required');
      return false;
    }
    if (!MAIL_FORMAT.test(email.trim())) {
      setEmailError('Email address not valid');
      return false;
    }
    setEmailError(null);
    return true;
  }, [email]);

  // Helper to capitalize first letter
  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function getNameFromEmail(email: string): EmailName {
    if (!email || typeof email !== 'string')
      return { firstName: '', lastName: '', email: '' };

    // Extract the part before '@'
    const namePart = email.split('@')[0];

    // Replace dots, underscores, or hyphens with spaces
    const parts = namePart.split(/[._-]+/).filter(Boolean);

    const firstName = parts[0] ? capitalize(parts[0]) : '';
    const lastName = parts[1] ? capitalize(parts[1]) : '';

    return { firstName, lastName, email };
  }

  const onLoginPress = useCallback(async (): Promise<void> => {
    if (!validateEmail()) return;
    // TODO: Add real validation
    if (!password.trim()) {
      setPassError('Password is required');
      return;
    }

    // Dispatch user data after login
    await dispatch(setUserData(getNameFromEmail(email)));

    // Check if this is first-time login
    const isFirstTime = !hasCompletedFirstTimeLogin();

    if (isFirstTime) {
      // Navigate to first-time login screen (flow: Login -> FirstTimeLogin -> Privacy -> Permissions -> Dashboard)
      navigation.replace('FirstTimeLoginScreen');
    } else {
      // Second time login: go directly to Dashboard
      navigation.replace('DashboardScreen');
    }
  }, [email, password, dispatch, navigation, validateEmail]);

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

            <AppInput
              icon={Icons.email}
              isBorderFocused={!!emailError}
              value={email}
              placeholder="Email Address"
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
              placeholder="Password"
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
              title="Login"
              style={styles.button}
              onPress={onLoginPress}
              accessibilityRole="button"
            />

            <View style={styles.forgotPassword}>
              <RippleButton
                onPress={onForgotPasswordPress}
                accessibilityRole="button"
              >
                <AppText size={hp(1.74)} color={colors.primary}>
                  Forgot Password?
                </AppText>
              </RippleButton>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
