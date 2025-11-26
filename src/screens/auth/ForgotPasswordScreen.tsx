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
import { useAppDispatch } from '../../redux';
import { NavigationProp, RootStackParamList } from '../../types/navigation';

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
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState<string>(emailID || '');
  const [emailError, setEmailError] = useState<string | null>(null);

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

  const onNextPress = useCallback(async (): Promise<void> => {
    if (!validateEmail()) return;

    Keyboard.dismiss();
    navigation.navigate('OtpScreen', { emailID: email });
    // Example API call placeholder
    // const response = await dispatch(sendOtpForForgotPassword(email.trim()));
    // if (response.data.success) {
    //   navigation.navigate('VerifyEmailScreen', { emailID: email.trim() });
    // } else {
    //   setEmailError('Email address not registered with us');
    // }
  }, [email, validateEmail, dispatch, navigation]);

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
                Forgot Password?
              </AppText>
              <AppText size={hp('1.74%')} style={styles.loginText}>
                Enter your registered email address
              </AppText>
            </View>

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
              returnKeyType="done"
              onSubmitEditing={onNextPress}
            />

            <AppButton
              title="Next"
              style={styles.button}
              onPress={onNextPress}
              accessibilityRole="button"
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

