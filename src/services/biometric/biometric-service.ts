import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Platform } from 'react-native';

const rnBiometrics = new ReactNativeBiometrics();

/**
 * Check if device biometric is available
 */
export async function isBiometricAvailable(): Promise<{
  available: boolean;
  biometryType?: string;
  error?: string;
}> {
  try {
    const { available, biometryType, error } = await rnBiometrics.isSensorAvailable();
    return { available, biometryType, error };
  } catch (error: any) {
    console.log('Biometric check error:', error);
    return { available: false, error: error?.message || 'Biometric check failed' };
  }
}

/**
 * Authenticate using device biometric (Face ID/Touch ID/Fingerprint)
 * Returns a Promise that resolves on success or rejects on failure
 */
export async function authenticateWithBiometric(
  promptMessage: string = 'Authenticate to continue',
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if biometric is available
      const { available, biometryType } = await isBiometricAvailable();
      
      if (!available) {
        reject(new Error('Biometric authentication not available on this device'));
        return;
      }

      // Determine the prompt message based on biometry type
      // Note: On Android, the system will show fingerprint or face based on device capabilities
      // We can't force Face ID - it depends on what's available and configured
      let promptMsg = promptMessage;
      if (biometryType === BiometryTypes.FaceID) {
        promptMsg = promptMessage || 'Authenticate with Face ID';
      } else if (biometryType === BiometryTypes.TouchID) {
        promptMsg = promptMessage || 'Authenticate with Touch ID';
      } else if (biometryType === 'Biometrics') {
        // On Android, this could be fingerprint or face unlock
        promptMsg = promptMessage || 'Authenticate with biometric';
      }

      // Perform biometric authentication
      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage: promptMsg,
        cancelButtonText: 'Cancel',
      });

      if (success) {
        resolve();
      } else {
        reject(new Error(error || 'Biometric authentication failed'));
      }
    } catch (error: any) {
      console.log('Biometric authentication error:', error);
      reject(error);
    }
  });
}

/**
 * Verify biometric for punch (check-in/check-out)
 * This uses device Face ID/Touch ID/Fingerprint, NOT UIDAI Face RD
 */
export async function verifyBiometricForPunch(): Promise<void> {
  try {
    console.log('verifyBiometricForPunch: Starting biometric verification');
    
    // Check availability first
    const availability = await isBiometricAvailable();
    console.log('verifyBiometricForPunch: Biometric available:', availability);
    
    if (!availability.available) {
      const errorMsg = availability.error || 'Biometric authentication not available on this device';
      console.log('verifyBiometricForPunch: Biometric not available:', errorMsg);
      throw new Error(errorMsg);
    }
    
    await authenticateWithBiometric('Authenticate to proceed with check-in/check-out');
    console.log('verifyBiometricForPunch: Biometric verification successful');
  } catch (error: any) {
    console.log('verifyBiometricForPunch: Error:', error);
    throw error;
  }
}

