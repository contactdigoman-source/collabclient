import { NativeModules, DeviceEventEmitter } from 'react-native';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';

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
  // TODO: Replace this hardcoded license key with your actual license key from UIDAI or provider
  // For production, use: const licenseKey = Config.AADHAAR_LICENSE_KEY || '';
  // This is a placeholder/test key - REPLACE WITH YOUR ACTUAL LICENSE KEY
  const licenseKey = Config.AADHAAR_LICENSE_KEY || 'MDczRjUyNDJDQUFGRjBBOUMzMUZGQUVEOTA4QkYzOEU2RENBNEQ4OTIwMzRGQzY1NDA0QzIyMjk3RkJENkNDMghtG==';
  
  // Validate Aadhaar number
  if (!aadhaarNo || aadhaarNo.length !== 12) {
    console.error('Invalid Aadhaar number provided to startFaceAuth');
    DeviceEventEmitter.emit('FaceAuthFailure', {
      message: 'Invalid Aadhaar number',
      code: 'INVALID_AADHAAR',
    });
    return;
  }
  
  // Check if license key is configured
  if (!licenseKey) {
    console.error('Aadhaar license key not configured');
    DeviceEventEmitter.emit('FaceAuthFailure', {
      message: 'License key not configured',
      code: 'LICENSE_MISSING',
    });
    return;
  }
  
  // Check if Face RD module is available
  if (!FaceAuth) {
    console.error('Face RD module not available');
    DeviceEventEmitter.emit('FaceAuthFailure', {
      message: 'Face RD service not available',
      code: 'SERVICE_NOT_AVAILABLE',
    });
    return;
  }
  
  try {
    store.dispatch(setIsAuthenticatingFace(true));
    console.log('Starting Face RD authentication with license key');
    // Use hardcoded license key (replace with your actual key)
    FaceAuth.startFaceAuth(aadhaarNo, licenseKey);
  } catch (error: any) {
    console.error('Error starting Face RD:', error);
    store.dispatch(setIsAuthenticatingFace(false));
    DeviceEventEmitter.emit('FaceAuthFailure', {
      message: error?.message || 'Failed to start Face RD',
      code: 'START_FAILED',
    });
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

