import * as Keychain from 'react-native-keychain';
import { Configs } from '../../constants/configs';
import { store, persistor } from '../../redux';
import { resetUserState } from '../../redux/reducers/userReducer';
import { logger, resetCorrelationId } from '../logger';
import apiClient from '../api/api-client';
import { clearJWTToken } from './token-service';

// Re-export token functions for backward compatibility
export { storeJWTToken, getJWTToken, getRefreshToken, clearJWTToken } from './token-service';

const API_BASE_URL = Configs.apiBaseUrl;

// Login API Types
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Account Status Types
 * Possible values:
 * - "active" - Account is active and user can proceed with login
 * - "locked" - Account is locked, show AccountLockedModal
 * - "passwordExpired" - Password has expired, show PasswordExpiryModal
 * - "inactive" - Account is inactive, show error message
 */
export type AccountStatus = 'active' | 'locked' | 'passwordExpired' | 'inactive';

export interface LoginResponse {
  idpjourneyToken: string; // IDP journey token to be used in OTP verification
  message: string; // Response message
  accountStatus?: AccountStatus; // Account status: 'active', 'locked', 'passwordExpired', 'inactive'
}

/**
 * Login user with email and password
 */
export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  try {
    logger.debug('Login request starting', { email: credentials.email });
    
    const response = await apiClient.post<LoginResponse>(
      `/api/auth/login`,
      {
        email: credentials.email,
        password: credentials.password,
      },
      {
        timeout: 30000, // 30 seconds timeout
      }
    );

    logger.debug('Login request successful', { email: credentials.email });
    return response.data;
  } catch (error: any) {
    // Determine error type and message
    let errorMessage = 'Failed to login. Please try again.';
    const hasResponse = !!error.response;
    const hasRequest = !!error.request;
    
    if (hasResponse) {
      // Server responded with error
      errorMessage = error.response.data?.message || 'Login failed';
    } else if (hasRequest) {
      // Request made but no response (network error)
      errorMessage = 'Network error. Please check your internet connection.';
    } else {
      // Error setting up request (config error, timeout during setup, etc.)
      // Check if it's a timeout or other specific error
      if (error.message) {
        errorMessage = error.message;
      }
    }
    
    // Log service error with context
    logger.error(
      'Failed to login',
      error instanceof Error ? error : new Error(String(error)),
      {
        url: `${API_BASE_URL}/api/auth/login`,
        method: 'POST',
        statusCode: error.response?.status,
        requestBody: { email: credentials.email },
        responseBody: error.response?.data,
      },
      {
        hasResponse,
        hasRequest,
        errorCode: error.code,
        errorMessage: error.message,
      }
    );
    
    throw new Error(errorMessage);
  }
};


export const logoutUser = async (): Promise<void> => {
  // Clear Aadhaar data from Keychain before logout
  const userData = store.getState().userState?.userData;
  if (userData?.email) {
    try {
      // Clear JWT token
      await clearJWTToken(userData.email);
      
      // Clear Aadhaar data
      await Keychain.resetGenericPassword({
        service: userData.email,
      });
    } catch (error) {
      logger.error('Failed to clear JWT token during logout', error as Error, undefined, {
        email: userData.email,
      });
    }
  }

  // Clear persisted Redux data
  await persistor.purge();
  
  // Reset correlation ID for new session
  resetCorrelationId();
  
  // Reset in-memory Redux state (including Aadhaar validated flag)
  store.dispatch(resetUserState());
};

