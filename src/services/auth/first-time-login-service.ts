import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logServiceError } from '../logger';
import { getDeviceUniqueIdentifier } from '../device/device-identifier-service';
import { store } from '../../redux';
import { setUserData, setJWTToken } from '../../redux/reducers/userReducer';

const API_BASE_URL = Configs.apiBaseUrl;

// First Time Login API Types
export interface FirstTimeLoginRequest {
  email: string;
  firstName: string;
  lastName: string;
  newPassword: string;
  consent: {
    agreed: boolean;
    timestamp: string; // ISO 8601 format
    permissions: string[]; // List of permission IDs that were consented to
  };
  deviceIdentifier: string;
  timestamp: string; // ISO 8601 format - time when form was submitted
}

export interface FirstTimeLoginResponse {
  success: boolean;
  message: string;
  token?: string; // JWT token
  expiresAt?: string;
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    requiresPasswordChange: boolean;
    roles: string[];
    firstTimeLogin: boolean;
  };
}

/**
 * Submits first-time login data including consent information
 * @param {Object} data - First time login data
 * @param {string} data.email - User email
 * @param {string} data.firstName - User first name
 * @param {string} data.lastName - User last name
 * @param {string} data.newPassword - New password
 * @param {string[]} data.permissions - List of permission IDs that were consented to
 * @returns {Promise<FirstTimeLoginResponse>} API response
 */
export const submitFirstTimeLogin = async (data: {
  email: string;
  firstName: string;
  lastName: string;
  newPassword: string;
  permissions: string[];
}): Promise<FirstTimeLoginResponse> => {
  try {
    // Get device unique identifier
    const deviceIdentifier = await getDeviceUniqueIdentifier();

    // Get current timestamp
    const timestamp = new Date().toISOString();

    // Prepare request payload
    const requestData: FirstTimeLoginRequest = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      newPassword: data.newPassword,
      consent: {
        agreed: true,
        timestamp: timestamp,
        permissions: data.permissions,
      },
      deviceIdentifier: deviceIdentifier,
      timestamp: timestamp,
    };

    // Make API call
    const response = await axios.post<FirstTimeLoginResponse>(
      `${API_BASE_URL}/api/auth/first-time-login`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // If successful, update Redux store
    if (response.data.success && response.data.user) {
      // Update user data
      store.dispatch(
        setUserData({
          ...response.data.user,
          firstTimeLogin: false, // Mark as completed
        }),
      );

      // Store JWT token if provided
      if (response.data.token) {
        store.dispatch(setJWTToken(response.data.token));
      }
    }

    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Failed to submit first-time login data';

    logServiceError(
      'auth',
      'first-time-login-service.ts',
      'submitFirstTimeLogin',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/first-time-login`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: {
            email: data.email,
            firstName: data.firstName,
            // Don't log password
          },
          responseBody: error.response?.data,
        },
        metadata: {
          email: data.email,
        },
      },
    );

    throw new Error(errorMessage);
  }
};

