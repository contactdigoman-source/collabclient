import React, { useRef, useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  RippleButton,
} from '../components';
import { hp, Icons, Images, MAIL_FORMAT } from '../constants';
import { useAppDispatch } from '../redux';
import { setUserData } from '../redux/userReducer';
import { checkAadhaarDataAvailability } from '../services/aadhaar-facerd-service';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();

  const passwordRef = useRef();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(null);

  const validateEmail = useCallback(() => {
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
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function getNameFromEmail(email) {
    if (!email || typeof email !== 'string')
      return { firstName: '', lastName: '' };

    // Extract the part before '@'
    const namePart = email.split('@')[0];

    // Replace dots, underscores, or hyphens with spaces
    const parts = namePart.split(/[._-]+/).filter(Boolean);

    const firstName = parts[0] ? capitalize(parts[0]) : '';
    const lastName = parts[1] ? capitalize(parts[1]) : '';

    return { firstName, lastName, email };
  }

  const onLoginPress = useCallback(async () => {
    if (!validateEmail()) return;
    // TODO: Add real validation
    if (!password.trim()) {
      setPassError('Password is required');
      return;
    }

    // Simulate login
    // Alert.alert('Login Press');
    await dispatch(setUserData(getNameFromEmail(email)));
    navigation.navigate('DashboardScreen');
    // checkAadhaarDataAvailability()
    //   .then(result => {
    //     if (result?.success) {
    //       console.log('Password:', result?.password);
    //       navigation.navigate('DashboardScreen');
    //     } else {
    //       console.log(result?.message);
    //       navigation.navigate('AadhaarInputScreen');
    //     }
    //   })
    //   .catch(error => {
    //     console.log('Error accessing Aadhaar data:', error);
    //     navigation.navigate('DashboardScreen');
    //   });
  }, [email, password, dispatch]);

  const onForgotPasswordPress = useCallback(() => {
    navigation.navigate('ForgotPasswordScreen', { emailID: email });
  }, [navigation, email]);

  return (
    <AppContainer>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
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
              onChangeText={text => {
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
              onChangeText={text => {
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
