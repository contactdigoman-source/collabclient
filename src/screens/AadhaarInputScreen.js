import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import {
  AppButton,
  AppContainer,
  AppImage,
  AppInput,
  AppText,
  BackHeader,
} from '../components';
import { hp, wp, Images } from '../constants';
import { useAppDispatch, useAppSelector } from '../redux';
import {
  getRawAadhaarNumber,
  startFaceAuth,
  storeAadhaarNumber,
} from '../services/aadhaar-facerd-service';
import {
  setIsAadhaarFaceValidated,
  setIsAuthenticatingFace,
} from '../redux/aadhaarReducer';
import { setUserAadhaarFaceValidated } from '../redux/userReducer';

const AADHAAR_LENGTH = 12;
const INPUT_LENGTH = 14;

export default function AadhaarInputScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const { isAuthenticatingFace, isAadhaarFaceValidated } = useAppSelector(
    state => ({
      isAuthenticatingFace: state.aadhaarState.isAuthenticatingFace,
      isAadhaarFaceValidated: state.aadhaarState.isAadhaarFaceValidated,
    }),
  );

  const [aadhaarInput, setAadhaarInput] = useState('');
  const [aadhaarNumberErr, setAadhaarNumberErr] = useState('');

  /** Reset face auth flag on unmount */
  useEffect(() => {
    return () => dispatch(setIsAuthenticatingFace(false));
  }, [dispatch]);

  /** Format Aadhaar input into XXXX XXXX XXXX */
  const formatAadhaar = useCallback(text => {
    const formatted = text
      .replace(/\D/g, '') // remove non-digits
      .slice(0, AADHAAR_LENGTH) // limit to 12 digits
      .replace(/(\d{4})(?=\d)/g, '$1 '); // space after every 4 digits
    setAadhaarInput(formatted);
  }, []);

  /** Capture Face button handler */
  const onCaptureFacePress = useCallback(() => {
    const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
    if (rawAadhaar?.length !== AADHAAR_LENGTH) {
      setAadhaarNumberErr(`Aadhaar Number should be ${AADHAAR_LENGTH} digits`);
      return;
    }

    setAadhaarNumberErr('');
    dispatch(setIsAuthenticatingFace(true));

    if (__DEV__) {
      dispatch(setIsAadhaarFaceValidated(true));
    } else {
      startFaceAuth(rawAadhaar);
    }
  }, [aadhaarInput, dispatch]);

  /** Continue button handler after verification */
  const onStoreAadhaarData = useCallback(() => {
    dispatch(setUserAadhaarFaceValidated(true));
    storeAadhaarNumber();
    navigation.navigate('DashboardScreen');
  }, [dispatch, navigation]);

  /** Open Privacy Policy screen */
  const onPrivacyPolicyPress = useCallback(() => {
    navigation.navigate('PrivacyPolicyScreen');
  }, [navigation]);

  const isButtonDisabled =
    aadhaarInput.length !== INPUT_LENGTH || isAuthenticatingFace;

  // ---------- UI ----------
  return (
    <AppContainer>
      <BackHeader title="Aadhaar Verification" isBottomBorder />

      <View style={styles.container}>
        {isAadhaarFaceValidated ? (
          <>
            <AppImage
              size={hp(10)}
              source={Images.aadhaar_logo}
              style={styles.logo}
            />
            <AppText size={hp(2.5)} style={styles.centerText}>
              Aadhaar Verification
            </AppText>

            <AppImage
              size={hp(15)}
              source={Images.aadhaar_verified}
              style={styles.verifiedLogo}
            />

            <AppText size={hp(2)} style={styles.centerText}>
              Aadhaar verified successfully
            </AppText>

            <AppButton
              title="Continue"
              style={styles.continueBtn}
              onPress={onStoreAadhaarData}
            />
          </>
        ) : (
          <>
            <AppImage
              size={hp(15)}
              source={Images.aadhaar_logo}
              style={styles.logo}
            />

            <AppInput
              value={aadhaarInput}
              placeholder="Enter Aadhaar Number"
              containerStyle={styles.inputContainer}
              keyboardType="numeric"
              onChangeText={formatAadhaar}
              error={aadhaarNumberErr}
              maxLength={INPUT_LENGTH}
            />

            <View style={styles.policyContainer}>
              <AppText
                size={hp('1.5%')}
                color={colors.white}
                style={styles.policyText}
              >
                I authorize use of my Aadhaar for attendance verification, and
                agree to its secure storage under the{' '}
                <AppText
                  size={hp('1.5%')}
                  color={colors.primary}
                  onPress={onPrivacyPolicyPress}
                >
                  Privacy Policy
                </AppText>
                .
              </AppText>
            </View>

            <AppButton
              disabled={isButtonDisabled}
              title={
                isAuthenticatingFace ? 'Authenticating...' : 'Capture Face'
              }
              onPress={onCaptureFacePress}
            />
          </>
        )}
      </View>
    </AppContainer>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: hp(4.35),
  },
  logo: {
    alignSelf: 'center',
  },
  inputContainer: {
    marginTop: hp('5%'),
  },
  policyContainer: {
    flexDirection: 'row',
    marginBottom: hp(3),
  },
  policyText: {
    marginLeft: wp('2%'),
    marginRight: wp('5.5%'),
  },
  verifiedLogo: {
    alignSelf: 'center',
    marginVertical: hp(3),
  },
  centerText: {
    textAlign: 'center',
  },
  continueBtn: {
    marginTop: hp(4),
  },
});
