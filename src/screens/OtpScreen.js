import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { OtpInput } from 'react-native-otp-entry';

import {
  AppButton,
  AppContainer,
  AppImage,
  AppText,
  BackHeader,
  RippleButton,
} from '../components';
import { FontTypes, hp, wp, Images } from '../constants';

const IMAGE_SIZE = hp(18.63);
const RESEND_TIMEOUT = 120; // seconds

const TimerDisplay = React.memo(({ timer, color }) => {
  if (timer <= 0) return null;
  return (
    <View style={styles.timerContainer}>
      <AppText color={color}>{`${timer} sec`}</AppText>
    </View>
  );
});

const OtpScreen = ({ route }) => {
  const emailID = route?.params?.emailID || '';
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [otpValue, setOtpValue] = useState('');
  const [timer, setTimer] = useState(RESEND_TIMEOUT);
  const [resendActive, setResendActive] = useState(false);
  const intervalRef = useRef(null);

  const emailMessage = useMemo(
    () =>
      `Please enter the six digit verification code sent to your email ${emailID}`,
    [emailID],
  );

  const startTimer = useCallback(() => {
    setResendActive(false);
    setTimer(RESEND_TIMEOUT);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setResendActive(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTimer]);

  const handleResend = useCallback(() => {
    if (!resendActive) return;
    // TODO: Call resend API
    startTimer();
  }, [resendActive, startTimer]);

  const onConfirmButtonPress = useCallback(() => {
    // TODO: API call for OTP verification
    if (otpValue.trim().length === 6) {
      navigation.navigate('ChangeForgottenPassword');
    }
  }, [otpValue]);

  // memoized otp styles and theme to avoid re-render
  const otpTheme = useMemo(
    () => ({
      containerStyle: styles.otpMainContainer,
      pinCodeContainerStyle: [
        styles.otpCodeContainer,
        { backgroundColor: colors.app_input_bg },
      ],
      focusedPinCodeContainerStyle: {
        borderWidth: 2,
        borderColor: colors.primary,
      },
    }),
    [colors],
  );

  const otpTextProps = useMemo(
    () => ({
      style: { color: colors.white, fontSize: hp(2.2) },
    }),
    [colors],
  );

  return (
    <AppContainer>
      <BackHeader />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.subContainer}>
              <AppImage
                size={IMAGE_SIZE}
                source={Images.forgot_pass_image}
                style={styles.image}
              />
              <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                Verify your Email Address
              </AppText>
              <AppText style={styles.description}>{emailMessage}</AppText>
            </View>

            <OtpInput
              disabled={false}
              type="numeric"
              blurOnFilled
              secureTextEntry={false}
              focusStickBlinkingDuration={500}
              numberOfDigits={6}
              onTextChange={setOtpValue}
              onFilled={setOtpValue}
              textInputProps={{ value: otpValue }}
              textProps={otpTextProps}
              theme={otpTheme}
            />

            <AppButton
              title="Confirm"
              style={styles.confirmButton}
              onPress={onConfirmButtonPress}
            />

            <View style={styles.resendContainer}>
              <AppText>Didn't receive the code? </AppText>
              <RippleButton
                style={styles.resendButton}
                onPress={handleResend}
                disabled={!resendActive}
              >
                <AppText
                  color={resendActive ? colors.primary : colors.white}
                  style={{ opacity: resendActive ? 1 : 0.7 }}
                >
                  Resend
                </AppText>
              </RippleButton>
            </View>

            <TimerDisplay timer={timer} color={colors.primary} />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
};

export default React.memo(OtpScreen);

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
    marginBottom: hp(2),
  },
  image: {
    marginBottom: hp(2),
  },
  description: {
    textAlign: 'center',
    marginVertical: hp(1),
  },
  resendContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(2),
  },
  resendButton: {
    paddingEnd: wp(2),
    paddingVertical: wp(1),
  },
  timerContainer: {
    alignSelf: 'center',
  },
  otpMainContainer: {
    marginVertical: hp(2),
  },
  otpCodeContainer: {
    flexGrow: 1,
    margin: wp(1),
    borderWidth: 0,
  },
  confirmButton: {
    marginVertical: hp(3),
  },
});
