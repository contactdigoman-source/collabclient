import { DeviceEventEmitter, Platform } from 'react-native';
import { logger } from '../logger';
import { startFaceAuth } from './aadhaar-facerd-service';
import { getRawAadhaarNumber } from './aadhaar-facerd-service';
import { store } from '../../redux';

/**
 * Verifies Face RD for punch (check-in/check-out) action
 * Returns a Promise that resolves on success or rejects on failure
 */
export function verifyFaceRDForPunch(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get stored Aadhaar number from Redux
    const storedAadhaar = store.getState().userState?.storedAadhaarNumber;
    
    if (!storedAadhaar) {
      reject(new Error('Aadhaar number not found. Please verify Aadhaar first.'));
      return;
    }

    // On iOS, Face RD is not available, so we should reject immediately
    // The caller should handle OTP fallback
    if (Platform.OS === 'ios') {
      reject(new Error('Face RD not available on iOS'));
      return;
    }

    // Use the stored Aadhaar number for verification
    verifyFaceRDForPunchWithAadhaar(storedAadhaar)
      .then(() => resolve())
      .catch((error) => reject(error));
  });
}

/**
 * Verifies Face RD for punch with Aadhaar number
 * @param aadhaarNumber - The 12-digit Aadhaar number (can be formatted or raw)
 */
export function verifyFaceRDForPunchWithAadhaar(aadhaarNumber: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate Aadhaar number
    const rawAadhaar = getRawAadhaarNumber(aadhaarNumber);
    if (rawAadhaar.length !== 12) {
      reject(new Error('Invalid Aadhaar number'));
      return;
    }

    // Check if FaceAuth module is available
    const { NativeModules } = require('react-native');
    const { FaceAuth } = NativeModules;
    
    if (!FaceAuth) {
      reject(new Error('Face RD service not available'));
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let isResolved = false;

    // Set up event listeners
    const successListener = DeviceEventEmitter.addListener(
      'FaceAuthSuccess',
      (data: any) => {
        if (isResolved) return;
        isResolved = true;
        logger.debug('Face RD Success for Punch:', data);
        if (timeoutId) clearTimeout(timeoutId);
        successListener.remove();
        failureListener.remove();
        resolve();
      },
    );

    const failureListener = DeviceEventEmitter.addListener(
      'FaceAuthFailure',
      (error: any) => {
        if (isResolved) return;
        isResolved = true;
        logger.debug('Face RD Failure for Punch:', error);
        if (timeoutId) clearTimeout(timeoutId);
        successListener.remove();
        failureListener.remove();
        reject(new Error(error?.message || 'Face RD verification failed'));
      },
    );

    // Start Face RD authentication
    try {
      startFaceAuth(rawAadhaar);
      
      // Set a timeout to prevent hanging (e.g., 60 seconds)
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          successListener.remove();
          failureListener.remove();
          reject(new Error('Face RD verification timeout'));
        }
      }, 60000);
    } catch (error) {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        successListener.remove();
        failureListener.remove();
        reject(error);
      }
    }
  });
}
