import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'react-native-crypto-js';

import { store, setIsAuthenticatingFace } from '../../redux';

export const ERROR_MESSAGES = {
  user_abort: 'User abort',
  aadhaar_number_and_face_not_matching:
    'Could not fetch Aadhaar Reference Number from ADV.',
  request_failed: 'Failed to send request to Aadhaar server, Please try again.',
  capture_failed: 'Face Capture failed or canceled',
  service_not_installed: 'UIDAI RD Service is NOT installed or blocked.',
  could_not_authenticate: 'Could Not Authenticate Aadhaar.',
  network_issue: 'Network issue occured,Please try after some time',
} as const;

export const getRawAadhaarNumber = (formatted: string): string => {
  return formatted.replace(/\s/g, '');
};

export const storeAadhaarNumber = async (): Promise<void> => {
  const userLoginData = store.getState().userState?.userData;
  // const {aadhaarInput} = store.getState().aadhaarAuthState;

  const username = userLoginData?.email;
  const password = `aadhaarVarified_${userLoginData?.email}`;
  // const password = getRawAadhaarNumber(aadhaarInput);

  if (!username) {
    console.log('storeAadhaarNumber: No username found');
    return;
  }

  try {
    const ciphertext = CryptoJS.AES.encrypt(
      password,
      userLoginData?.email || '',
    ).toString();
    console.log('ciphertext', ciphertext);
    await Keychain.setGenericPassword(username, ciphertext, {
      service: userLoginData?.email || '',
    });
    // store.dispatch(setAadhaarInput(''));
  } catch (e) {
    console.log('storeAadhaarNumber', e);
  }
};

interface FaceAuthModule {
  startFaceAuth: (aadhaarNo: string, key: string) => void;
}

const { FaceAuth } = NativeModules as {
  FaceAuth?: FaceAuthModule;
};

export function startFaceAuth(aadhaarNo: string): void {
  if (aadhaarNo && FaceAuth) {
    store.dispatch(setIsAuthenticatingFace(true));
    FaceAuth.startFaceAuth(
      aadhaarNo,
      'MDczRjUyNDJDQUFGRjBBOUMzMUZGQUVEOTA4QkYzOEU2RENBNEQ4OTIwMzRGQzY1NDA0QzIyMjk3RkJENkNDMghtG==',
    );
  }
}

interface AadhaarCheckResult {
  success: boolean;
  password?: string;
  message?: string;
}

export const checkAadhaarDataAvailability = (): Promise<AadhaarCheckResult> => {
  const userLoginData = store.getState().userState.userData;

  return new Promise((resolve, reject) => {
    if (!userLoginData?.email) {
      resolve({
        success: false,
        message: 'No user email found',
      });
      return;
    }

    Keychain.getGenericPassword({
      service: userLoginData.email,
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

