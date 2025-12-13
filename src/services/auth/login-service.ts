import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { Configs } from '../../constants/configs';
import { store, persistor } from '../../redux';
import { resetUserState } from '../../redux/reducers/userReducer';
import { logServiceError, resetCorrelationId } from '../logger';

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
 * - "password expired" - Password has expired, show PasswordExpiryModal
 * - "inactive" - Account is inactive, show error message
 */
export type AccountStatus = 'active' | 'locked' | 'password expired' | 'inactive';

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    requiresPasswordChange: boolean;
    roles: string[];
    firstTimeLogin?: boolean; // If true, navigate to FirstTimeLoginScreen
  };
  /**
   * Account Status - determines navigation and modal display
   * Possible values: "active" | "locked" | "password expired" | "inactive"
   */
  accountStatus: AccountStatus;
  requiresPasswordChange?: boolean;
}

/**
 * Login user with email and password
 */
export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await axios.post<LoginResponse>(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: credentials.email,
        password: credentials.password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    return response.data;
  } catch (error: any) {
    // Log service error with context
    logServiceError(
      'auth',
      'login-service.ts',
      'loginUser',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/login`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: { email: credentials.email },
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );
    
    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 'Login failed';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to login. Please try again.');
    }
  }
};

/**
 * Securely store JWT token in Keychain
 */
export const storeJWTToken = async (token: string, email: string): Promise<void> => {
  try {
    await Keychain.setGenericPassword('jwt_token', token, {
      service: `jwt_${email}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
    console.log('JWT token stored securely');
  } catch (error) {
    logServiceError(
      'auth',
      'login-service.ts',
      'storeJWTToken',
      error as Error,
      {
        metadata: { email },
      }
    );
    throw new Error('Failed to store authentication token');
  }
};

/**
 * Get stored JWT token from Keychain
 */
export const getJWTToken = async (email: string): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: `jwt_${email}`,
    });
    return credentials ? credentials.password : null;
  } catch (error) {
    logServiceError(
      'auth',
      'login-service.ts',
      'getJWTToken',
      error as Error,
      {
        metadata: { email },
      }
    );
    return null;
  }
};

/**
 * Clear JWT token from Keychain
 */
export const clearJWTToken = async (email: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({
      service: `jwt_${email}`,
    });
  } catch (error) {
    console.error('Error clearing JWT token:', error);
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
      logServiceError(
        'auth',
        'login-service.ts',
        'logoutUser',
        error as Error,
        {
          metadata: { email: userData.email },
        }
      );
    }
  }

  // Clear persisted Redux data
  await persistor.purge();
  
  // Reset correlation ID for new session
  resetCorrelationId();
  
  // Reset in-memory Redux state (including Aadhaar validated flag)
  store.dispatch(resetUserState());
};

