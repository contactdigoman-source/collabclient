import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Platform } from 'react-native';
import { logger } from '../logger';

// Initialize with allowDeviceCredentials to enable device password fallback
// Authentication priority order (enforced by native systems):
// 1. Face ID (iOS) / Face Unlock (Android) - Highest priority
// 2. Fingerprint (Touch ID on iOS, Fingerprint on Android) - Second priority
// 3. Device Password/PIN/Pattern - Fallback (lowest priority)
// This is CRITICAL for Android to show Face Unlock or device password when fingerprints aren't enrolled
const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true, // Enable device PIN/pattern/password fallback (priority 3)
});

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
    
    // Log available authentication methods
    logger.info('Biometric availability check - Available authentication methods', {
      _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'isBiometricAvailable' },
      platform: Platform.OS,
      available: available,
      biometryType: biometryType,
      error: error,
      detectedMethods: {
        faceID: Platform.OS === 'ios' && biometryType === BiometryTypes.FaceID,
        touchID: Platform.OS === 'ios' && biometryType === BiometryTypes.TouchID,
        faceUnlock: Platform.OS === 'android' && (biometryType === 'Biometrics' || biometryType?.toLowerCase().includes('face')),
        fingerprint: Platform.OS === 'android' && (biometryType === 'Biometrics' || biometryType?.toLowerCase().includes('fingerprint')),
        devicePassword: true, // Always available as fallback when allowDeviceCredentials is true
      },
      priorityOrder: Platform.OS === 'ios' 
        ? 'Face ID > Touch ID > Device Password'
        : 'Face Unlock > Fingerprint > Device Password',
    });
    
    // On Android, if the error is about fingerprints not being enrolled,
    // but Face Unlock might be available, we should still consider biometrics available
    // The system will automatically use Face Unlock if available
    let isActuallyAvailable = available;
    let actualError = error;
    
    if (Platform.OS === 'android' && !available && error) {
      const errorStr = String(error).toLowerCase();
      if (errorStr.includes('no fingerprints enrolled') || errorStr.includes('fingerprints enrolled')) {
        // Fingerprint not enrolled, but Face Unlock might be available
        // We'll still allow authentication attempt - the system will use Face Unlock if available
        logger.debug('Fingerprint not enrolled, but Face Unlock might be available. Allowing authentication attempt', {
          _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'isBiometricAvailable' },
          originalError: error,
          note: 'Android BiometricPrompt will show Face Unlock if available, even without fingerprint',
        });
        isActuallyAvailable = true; // Allow authentication attempt
        actualError = undefined; // Clear error to allow attempt
      }
    }
    
    logger.debug('Biometric sensor availability check result', {
      _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'isBiometricAvailable' },
      available: isActuallyAvailable,
      originalAvailable: available,
      biometryType,
      error: actualError,
      originalError: error,
      platform: Platform.OS,
      expectedFaceID: Platform.OS === 'ios' ? 'FaceID' : 'Face Unlock',
    });
    
    return { available: isActuallyAvailable, biometryType, error: actualError };
  } catch (error: any) {
    logger.error('Biometric check error', error, undefined, {
      _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'isBiometricAvailable' },
      errorMessage: error?.message,
      errorCode: error?.code,
      platform: Platform.OS,
    });
    
    // On Android, if error is about fingerprints, still allow attempt (Face Unlock might work)
    if (Platform.OS === 'android') {
      const errorStr = String(error?.message || error || '').toLowerCase();
      if (errorStr.includes('no fingerprints enrolled') || errorStr.includes('fingerprints enrolled')) {
        logger.debug('Fingerprint error in catch, but allowing Face Unlock attempt', {
          _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'isBiometricAvailable' },
          originalError: error,
          note: 'Will attempt authentication - Android BiometricPrompt may show Face Unlock',
        });
        return { available: true, error: undefined }; // Allow authentication attempt
      }
    }
    
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
    // Store prompt message in outer scope for use in catch block
    let promptMsg = promptMessage;
    
    try {
      // Check if biometric is available (but don't block if check fails)
      let available = false;
      let biometryType: string | undefined;
      let availabilityError: string | undefined;
      
      try {
        const availabilityResult = await isBiometricAvailable();
        available = availabilityResult.available;
        biometryType = availabilityResult.biometryType;
        availabilityError = availabilityResult.error;
      } catch (checkError: any) {
        // If availability check fails, we'll still try to show the prompt
        // The system should handle showing Face Unlock or device password
        logger.warn('Biometric availability check failed, but will still attempt authentication', {
          checkError,
          platform: Platform.OS,
        });
        // Set defaults - we'll still try to show the prompt
        available = false;
        biometryType = undefined;
        availabilityError = checkError?.message;
      }
      
      // Log available authentication methods before attempting prompt
      logger.info('Biometric authentication - Available methods before prompt', {
        _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'authenticateWithBiometric' },
        platform: Platform.OS,
        available: available,
        biometryType: biometryType,
        availabilityError: availabilityError,
        availableMethods: {
          faceID: Platform.OS === 'ios' && biometryType === BiometryTypes.FaceID,
          touchID: Platform.OS === 'ios' && biometryType === BiometryTypes.TouchID,
          faceUnlock: Platform.OS === 'android' && (biometryType === 'Biometrics' || biometryType?.toLowerCase().includes('face')),
          fingerprint: Platform.OS === 'android' && (biometryType === 'Biometrics' || biometryType?.toLowerCase().includes('fingerprint')),
          devicePassword: true, // Always available as fallback
        },
        expectedPriority: Platform.OS === 'ios' 
          ? 'Face ID > Touch ID > Device Password'
          : 'Face Unlock > Fingerprint > Device Password',
        note: Platform.OS === 'android' 
          ? 'Android BiometricPrompt will automatically show the highest priority available method'
          : 'iOS LocalAuthentication will automatically show the highest priority available method',
      });
      
      logger.debug('Biometric availability check', {
        available,
        biometryType,
        error: availabilityError,
        platform: Platform.OS,
      });
      
      // Determine the prompt message based on biometry type and platform
      // Authentication priority order (enforced by native systems):
      // 1. Face ID (iOS) / Face Unlock (Android) - Highest priority
      // 2. Fingerprint (Touch ID on iOS, Fingerprint on Android) - Second priority
      // 3. Device Password/PIN/Pattern - Fallback (lowest priority)
      // The native systems (BiometricPrompt on Android, LocalAuthentication on iOS) automatically
      // follow this priority order - we just need to ensure allowDeviceCredentials is enabled
      promptMsg = promptMessage;
      
      if (Platform.OS === 'ios') {
        // iOS specific handling
        // iOS LocalAuthentication automatically prioritizes: Face ID > Touch ID > Device Password
        if (biometryType === BiometryTypes.FaceID) {
          promptMsg = promptMessage || 'Authenticate with Face ID';
          logger.debug('iOS: Using Face ID for authentication (Priority 1)');
        } else if (biometryType === BiometryTypes.TouchID) {
          promptMsg = promptMessage || 'Authenticate with Touch ID';
          logger.warn('iOS: Touch ID detected instead of Face ID (Priority 2) - Face ID may not be available or not enrolled', {
            biometryType,
            available,
          });
        } else {
          // No biometric available - will use device password (Priority 3)
          promptMsg = promptMessage || 'Enter device password';
          logger.warn('iOS: No biometric available, will use device password (Priority 3)', { 
            biometryType,
            available,
            error: availabilityError,
          });
        }
      } else if (Platform.OS === 'android') {
        // Android specific handling
        // Android BiometricPrompt automatically prioritizes: Face Unlock > Fingerprint > Device Password
        // The system will show the highest priority available method
        if (biometryType === 'Biometrics') {
          // On Android, this could be fingerprint or face unlock
          // The system will automatically choose Face Unlock if available (Priority 1),
          // otherwise Fingerprint (Priority 2)
          promptMsg = promptMessage || 'Authenticate with biometric';
          logger.debug('Android: Using biometric authentication - system will prioritize Face Unlock (Priority 1) > Fingerprint (Priority 2)', {
            biometryType,
            available,
          });
        } else if (biometryType) {
          // Some Android devices might return specific types
          promptMsg = promptMessage || 'Authenticate with biometric';
          logger.debug('Android: Using biometric authentication', { biometryType, available });
        } else {
          // No biometric available - will use device password (Priority 3)
          promptMsg = promptMessage || 'Enter device password';
          logger.warn('Android: No biometric available, will use device password (Priority 3)', { 
            biometryType,
            available,
            error: availabilityError,
          });
        }
      } else {
        // Fallback for other platforms
        promptMsg = promptMessage || 'Authenticate';
        logger.debug('Unknown platform, using generic prompt', { platform: Platform.OS });
      }

      // Log the biometric type detected
      if (available && biometryType) {
        logger.debug('Biometric type detected', { biometryType, available });
      } else {
        logger.warn('Biometric not available or type not detected, but will still attempt prompt', {
          available,
          biometryType,
          error: availabilityError,
        });
      }
      
      // IMPORTANT: Even if availability check failed, we should still try to show the prompt
      // The Android system will show Face Unlock if available, or device password as fallback
      // We don't want to block the prompt just because the availability check failed
      //
      // On Android, BiometricPrompt will automatically show:
      // 1. Face Unlock if enrolled (even if fingerprint is not enrolled)
      // 2. Fingerprint if enrolled (and Face Unlock is not available)
      // 3. Device password as fallback
      // The library should still attempt the prompt even if availability check fails

      // Perform biometric authentication with fallback to device password
      // Authentication priority order (enforced by native systems):
      // 1. Face ID (iOS) / Face Unlock (Android) - Highest priority
      // 2. Fingerprint (Touch ID on iOS, Fingerprint on Android) - Second priority
      // 3. Device Password/PIN/Pattern - Fallback (lowest priority)
      // 
      // The native systems automatically follow this priority:
      // - iOS LocalAuthentication: Face ID > Touch ID > Device Password
      // - Android BiometricPrompt: Face Unlock > Fingerprint > Device Password
      // 
      // We just need to ensure allowDeviceCredentials is enabled (which it is)
      logger.debug('Calling simplePrompt', { 
        promptMessage: promptMsg,
        platform: Platform.OS,
        detectedBiometryType: biometryType,
        available,
        availabilityError,
        priorityOrder: Platform.OS === 'ios' 
          ? 'Face ID > Touch ID > Device Password'
          : 'Face Unlock > Fingerprint > Device Password',
        note: Platform.OS === 'android' 
          ? 'Android BiometricPrompt will automatically show Face Unlock if available, even if availability check failed'
          : undefined,
      });
      
      const promptOptions: any = {
        promptMessage: promptMsg,
        cancelButtonText: 'Cancel',
        fallbackPromptMessage: 'Use device password', // Fallback message for Priority 3
      };
      
      // On Android, configure to allow both biometric and device credentials
      // This ensures the priority order: Face Unlock (Priority 1) > Fingerprint (Priority 2) > Device Password (Priority 3)
      if (Platform.OS === 'android') {
        // Allow device credentials (PIN/pattern/password) as fallback (Priority 3)
        // The Android BiometricPrompt will automatically prioritize:
        // 1. Face Unlock if enrolled (even if fingerprint is not enrolled)
        // 2. Fingerprint if enrolled (and Face Unlock is not available)
        // 3. Device password as fallback
        // 
        // IMPORTANT: On Android, even if availability check fails (e.g., no fingerprint enrolled),
        // we should still attempt to show the BiometricPrompt. The system will automatically
        // show Face Unlock if available, even if fingerprint check failed.
        promptOptions.disableDeviceFallback = false; // Allow device password fallback (Priority 3)
        
        // On Android, if availability check failed but we suspect Face Unlock might be available
        // (e.g., error about fingerprints not enrolled), we should still attempt the prompt
        // The BiometricPrompt will show Face Unlock if available
        if (!available && availabilityError) {
          const errorStr = String(availabilityError).toLowerCase();
          if (errorStr.includes('no fingerprints enrolled') || errorStr.includes('fingerprints enrolled')) {
            logger.debug('Android: Availability check failed (no fingerprint), but will attempt prompt - Face Unlock may be available', {
              availabilityError,
            });
            // Force attempt - don't let availability check block us
            // The BiometricPrompt will show Face Unlock if available
          }
        }
      }
      
      // On iOS, LocalAuthentication automatically prioritizes:
      // 1. Face ID if available and enrolled
      // 2. Touch ID if Face ID is not available
      // 3. Device password as fallback
      
      logger.debug('Calling simplePrompt with options', {
        ...promptOptions,
        platform: Platform.OS,
      });
      
      let promptResult;
      try {
        // Always attempt to show the prompt - let the Android system decide what to show
        // On Android, BiometricPrompt will automatically show Face Unlock if available,
        // even if fingerprint isn't enrolled
        logger.info('Attempting biometric prompt - System will show available authentication method', {
          _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'authenticateWithBiometric' },
          platform: Platform.OS,
          available: available,
          biometryType: biometryType,
          promptOptions: {
            promptMessage: promptOptions.promptMessage,
            cancelButtonText: promptOptions.cancelButtonText,
            fallbackPromptMessage: promptOptions.fallbackPromptMessage,
            disableDeviceFallback: promptOptions.disableDeviceFallback,
          },
          expectedBehavior: Platform.OS === 'android'
            ? 'Android BiometricPrompt will show: Face Unlock (if available) > Fingerprint (if available) > Device Password'
            : 'iOS LocalAuthentication will show: Face ID (if available) > Touch ID (if available) > Device Password',
        });
        
        promptResult = await rnBiometrics.simplePrompt(promptOptions);
        
        // Log what authentication method was actually used
        logger.info('Biometric prompt completed', {
          _context: { service: 'biometric', fileName: 'biometric-service.ts', methodName: 'authenticateWithBiometric' },
          platform: Platform.OS,
          success: promptResult?.success,
          error: promptResult?.error,
          note: 'Check device logs or user interaction to see which authentication method was actually used (Face Unlock/Fingerprint/Password)',
        });
      } catch (promptError: any) {
        // On Android, if we get "No fingerprints enrolled" error but Face Unlock might be available,
        // the library might be blocking the prompt. However, the Android BiometricPrompt API
        // should automatically show Face Unlock if available, even if fingerprint check fails.
        // 
        // The issue might be that the library is checking for fingerprint availability internally
        // and refusing to show the prompt. In this case, we should log the error but still
        // attempt to show the prompt if possible.
        if (Platform.OS === 'android') {
          const errorMsg = String(promptError?.message || promptError || '').toLowerCase();
          logger.warn('Android biometric prompt error', {
            error: promptError,
            errorMessage: errorMsg,
            available,
            biometryType,
            availabilityError,
          });
          
          if (errorMsg.includes('no fingerprints enrolled') || errorMsg.includes('fingerprints enrolled')) {
            logger.warn('Fingerprint not enrolled error, but Face Unlock might be available', {
              originalError: promptError,
              note: 'The library may have blocked the prompt. Android BiometricPrompt should show Face Unlock if available.',
              suggestion: 'User should ensure Face Unlock is enabled in device settings',
            });
            
            // The library might have blocked the prompt due to fingerprint check
            // However, on Android, BiometricPrompt should still show Face Unlock if available
            // Provide a helpful error message that guides the user
            const helpfulMessage = 'Biometric authentication is not available. Please ensure Face Unlock is enabled in your device settings:\n\nSettings > Security > Face Unlock\n\nIf Face Unlock is already enabled, please try again.';
            throw new Error(helpfulMessage);
          } else if (errorMsg.includes('not available') || errorMsg.includes('unavailable')) {
            // Biometric not available - provide helpful message
            logger.warn('Biometric not available', {
              error: promptError,
              suggestion: 'User may need to enable Face Unlock or fingerprint in device settings',
            });
            throw new Error('Biometric authentication is not available. Please enable Face Unlock or fingerprint in your device settings (Settings > Security).');
          } else {
            // For other errors, throw as normal
            throw promptError;
          }
        } else {
          // For iOS, throw as normal
          throw promptError;
        }
      }

      const { success, error } = promptResult || { success: false, error: null };

      logger.debug('simplePrompt result', { 
        success, 
        error,
        errorType: typeof error,
        errorString: error?.toString?.(),
        platform: Platform.OS,
      });

      if (success) {
        logger.debug('Biometric authentication successful');
        resolve();
      } else {
        // Enhanced error handling for failed authentication
        let errorMessage = 'Authentication cancelled';
        
        if (error) {
          // Handle different error formats
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error?.message) {
            errorMessage = error.message;
          } else if (typeof error === 'object') {
            // Try to extract meaningful error from object
            try {
              const errorStr = JSON.stringify(error);
              errorMessage = errorStr !== '{}' ? errorStr : 'Authentication failed';
            } catch {
              errorMessage = error?.toString?.() || 'Authentication failed';
            }
          } else {
            errorMessage = String(error) || 'Authentication failed';
          }
          
          // Android-specific error messages
          if (Platform.OS === 'android') {
            const errorStr = String(errorMessage).toLowerCase();
            if (errorStr.includes('no fingerprints enrolled') || errorStr.includes('fingerprints enrolled')) {
              // If fingerprint is not enrolled but face unlock might be available
              // Guide user to use face unlock or device password
              // Note: The system should automatically show Face Unlock if available,
              // but if it doesn't, we guide the user
              errorMessage = 'Fingerprint not enrolled. Please use Face Unlock (if available) or device password. If Face Unlock is not working, please enable it in device settings (Settings > Security > Face Unlock)';
            } else if (errorStr.includes('not enrolled') || errorStr.includes('no biometric')) {
              errorMessage = 'No biometric credentials enrolled. Please set up Face Unlock or fingerprint in device settings (Settings > Security)';
            } else if (errorStr.includes('not available') || errorStr.includes('unavailable')) {
              errorMessage = 'Biometric authentication is not available on this device';
            } else if (errorStr.includes('cancel') || errorStr.includes('cancelled')) {
              errorMessage = 'Biometric authentication was cancelled';
            } else if (errorStr.includes('locked') || errorStr.includes('temporarily disabled')) {
              errorMessage = 'Biometric authentication is temporarily disabled. Please try again later or use device password';
            }
          }
        }
        
        logger.warn('Biometric authentication failed or cancelled', { 
          error,
          errorMessage,
          errorType: typeof error,
          platform: Platform.OS,
        });
        reject(new Error(errorMessage));
      }
    } catch (error: any) {
      // Enhanced error logging for Android
      const errorDetails: any = {
        platform: Platform.OS,
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
      };
      
      // Android-specific error details
      if (Platform.OS === 'android') {
        errorDetails.androidError = error?.androidError || error?.nativeError;
        errorDetails.errorCode = error?.errorCode;
        errorDetails.userCancel = error?.userCancel;
        errorDetails.biometricNotAvailable = error?.biometricNotAvailable;
        errorDetails.biometricNotEnrolled = error?.biometricNotEnrolled;
        errorDetails.biometricHwUnavailable = error?.biometricHwUnavailable;
      }
      
      // iOS-specific error details
      if (Platform.OS === 'ios') {
        errorDetails.iosError = error?.iosError || error?.nativeError;
        errorDetails.localizedDescription = error?.localizedDescription;
      }
      
      logger.error('Biometric authentication error', error, errorDetails);
      
      // Create a more descriptive error message
      let errorMessage = 'Biometric authentication failed';
      if (Platform.OS === 'android') {
        const errorMsg = error?.message || '';
        const errorStr = errorMsg.toLowerCase();
        
        // Check for specific error messages first
        if (errorStr.includes('no fingerprints enrolled') || errorStr.includes('fingerprints enrolled')) {
          // If fingerprint is not enrolled but face unlock might be available
          // Try one more time - the system should show Face Unlock or device password
          logger.warn('Fingerprint check failed, but Face Unlock might still work. Attempting to show biometric prompt anyway', {
            originalError: error,
          });
          
          try {
            // Retry with explicit device fallback enabled
            // The system should show Face Unlock if available, or device password
            // Note: disableDeviceFallback is not a valid option - device fallback is enabled by default
            // when allowDeviceCredentials: true is set in the constructor
            const retryResult = await rnBiometrics.simplePrompt({
              promptMessage: promptMsg || 'Authenticate to continue',
              cancelButtonText: 'Cancel',
              fallbackPromptMessage: 'Use device password',
            });
            
            if (retryResult.success) {
              logger.debug('Biometric authentication successful on retry after fingerprint error');
              resolve();
              return; // Success - exit early, don't reject
            } else {
              // Still failed - use appropriate error message
              // retryResult.error can be a string or an object with a message property
              const retryError = retryResult.error;
              const retryErrorMsg = typeof retryError === 'string' 
                ? retryError.toLowerCase()
                : (typeof retryError === 'object' && retryError !== null && 'message' in retryError)
                  ? String((retryError as any).message || '').toLowerCase()
                  : String(retryError || '').toLowerCase();
              if (retryErrorMsg.includes('cancel') || retryErrorMsg.includes('cancelled')) {
                errorMessage = 'Biometric authentication was cancelled';
              } else {
                errorMessage = 'Fingerprint not enrolled. Please use Face Unlock (if available) or device password. If Face Unlock is not working, please enable it in device settings (Settings > Security > Face Unlock)';
              }
            }
          } catch (retryError: any) {
            // Retry also failed - use the original error message
            logger.warn('Retry after fingerprint error also failed', { retryError });
            errorMessage = 'Fingerprint not enrolled. Please use Face Unlock (if available) or device password. If Face Unlock is not working, please enable it in device settings (Settings > Security > Face Unlock)';
          }
        } else if (error?.biometricNotAvailable) {
          errorMessage = 'Biometric authentication is not available on this device';
        } else if (error?.biometricNotEnrolled || errorStr.includes('not enrolled') || errorStr.includes('no biometric')) {
          errorMessage = 'No biometric credentials enrolled. Please set up fingerprint or face unlock in device settings';
        } else if (error?.biometricHwUnavailable) {
          errorMessage = 'Biometric hardware is not available';
        } else if (error?.userCancel || errorStr.includes('cancel') || errorStr.includes('cancelled')) {
          errorMessage = 'Biometric authentication was cancelled';
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else {
          errorMessage = 'Biometric authentication failed. Please try again or use device password';
        }
      } else if (Platform.OS === 'ios') {
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.localizedDescription) {
          errorMessage = error.localizedDescription;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      }
      
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Verify biometric or device password for punch (check-in/check-out)
 * Authentication priority order (enforced by native systems):
 * 1. Face ID (iOS) / Face Unlock (Android) - Highest priority
 * 2. Fingerprint (Touch ID on iOS, Fingerprint on Android) - Second priority
 * 3. Device Password/PIN/Pattern - Fallback (lowest priority)
 * 
 * This is COMPULSORY for both iOS and Android before proceeding to Aadhaar verification
 * The native systems automatically follow this priority order
 */
export async function verifyBiometricForPunch(): Promise<void> {
  try {
    logger.debug('verifyBiometricForPunch: Starting biometric/device password verification', {
      priorityOrder: Platform.OS === 'ios' 
        ? 'Face ID > Touch ID > Device Password'
        : 'Face Unlock > Fingerprint > Device Password',
    });
    
    // Always attempt authentication
    // The native system will automatically use the highest priority available method:
    // - Face ID (iOS) / Face Unlock (Android) if available
    // - Fingerprint if Face ID/Unlock is not available
    // - Device password as fallback
    // This is compulsory - user must authenticate with one of these methods
    await authenticateWithBiometric('Authenticate to proceed with check-in/check-out');
    logger.debug('verifyBiometricForPunch: Biometric/device password verification successful');
  } catch (error: any) {
    logger.warn('verifyBiometricForPunch: Error', error);
    throw error;
  }
}

