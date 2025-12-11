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
 * Falls back to device password if biometric is not available
 * Returns a Promise that resolves on success or rejects on failure
 */
export async function authenticateWithBiometric(
  promptMessage: string = 'Authenticate to continue',
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if biometric is available
      const { available, biometryType } = await isBiometricAvailable();
      
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
      } else {
        // No biometric available - will use device password
        promptMsg = promptMessage || 'Enter device password';
      }

      // Perform biometric authentication with fallback to device password
      // The library automatically falls back to device password on iOS if biometric fails
      // On Android, it will use device PIN/pattern/password if biometric is not available
      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage: promptMsg,
        cancelButtonText: 'Cancel',
        fallbackPromptMessage: 'Use device password', // Fallback message
      });

      if (success) {
        resolve();
      } else {
        // If user cancels, reject
        reject(new Error(error || 'Authentication cancelled'));
      }
    } catch (error: any) {
      console.log('Biometric authentication error:', error);
      reject(error);
    }
  });
}

/**
 * Verify biometric or device password for punch (check-in/check-out)
 * This uses device Face ID/Touch ID/Fingerprint, or falls back to device password
 * This is COMPULSORY for both iOS and Android before proceeding to Aadhaar verification
 */
export async function verifyBiometricForPunch(): Promise<void> {
  try {
    console.log('verifyBiometricForPunch: Starting biometric/device password verification');
    
    // Always attempt authentication (will use biometric if available, device password if not)
    // This is compulsory - user must authenticate with either biometric or device password
    await authenticateWithBiometric('Authenticate to proceed with check-in/check-out');
    console.log('verifyBiometricForPunch: Biometric/device password verification successful');
  } catch (error: any) {
    console.log('verifyBiometricForPunch: Error:', error);
    throw error;
  }
}

