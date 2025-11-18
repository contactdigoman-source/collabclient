import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'react-native-crypto-js';

import { store } from '../redux/store';
import { setIsAuthenticatingFace } from '../redux/aadhaarReducer';

export const ERROR_MESSAGES = {
  user_abort: 'User abort',
  aadhaar_number_and_face_not_matching:
    'Could not fetch Aadhaar Reference Number from ADV.',
  request_failed: 'Failed to send request to Aadhaar server, Please try again.',
  capture_failed: 'Face Capture failed or canceled',
  service_not_installed: 'UIDAI RD Service is NOT installed or blocked.',
  could_not_authenticate: 'Could Not Authenticate Aadhaar.',
  network_issue: 'Network issue occured,Please try after some time',
};

export const getRawAadhaarNumber = formatted => {
  return formatted.replace(/\s/g, '');
};

export const storeAadhaarNumber = async () => {
  const userLoginData = store.getState().userState?.userData;
  // const {aadhaarInput} = store.getState().aadhaarAuthState;

  let username = userLoginData?.email;
  let password = `aadhaarVarified_${userLoginData?.email}`;
  // let password = getRawAadhaarNumber(aadhaarInput);

  try {
    let ciphertext = CryptoJS.AES.encrypt(
      password,
      userLoginData?.email,
    ).toString();
    console.log('ciphertext', ciphertext);
    await Keychain.setGenericPassword(username, ciphertext, {
      service: userLoginData?.email,
    });
    // store.dispatch(setAadhaarInput(''));
  } catch (e) {
    console.log('storeAadhaarNumber', e);
  }
};

export function startFaceAuth(aadhaarNo) {
  if (aadhaarNo) {
    store.dispatch(setIsAuthenticatingFace(true));
    const { FaceAuth } = NativeModules;
    FaceAuth.startFaceAuth(
      aadhaarNo,
      'MDczRjUyNDJDQUFGRjBBOUMzMUZGQUVEOTA4QkYzOEU2RENBNEQ4OTIwMzRGQzY1NDA0QzIyMjk3RkJENkNDMghtG==',
    );
  }
}

export const checkAadhaarDataAvailability = () => {
  const userLoginData = store.getState().userState.userData;

  return new Promise((resolve, reject) => {
    Keychain.getGenericPassword({
      service: userLoginData?.email,
    })
      .then(credentials => {
        if (credentials?.password) {
          // Resolve with data if credentials exist
          resolve({
            success: true,
            password: credentials.password,
          });
        } else {
          // Resolve gracefully if no credentials found
          resolve({
            success: false,
            message: 'No credentials stored',
          });
        }
      })
      .catch(error => {
        console.log('Failed to access Keychain', error);
        reject(error);
      });
  });
};
