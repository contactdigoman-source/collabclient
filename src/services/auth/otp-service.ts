import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logServiceError } from '../logger/logger-service';

const API_BASE_URL = Configs.apiBaseUrl;

// Account Status Types (same as login service)
export type AccountStatus = 'active' | 'locked' | 'password expired' | 'inactive';

// OTP API Types
export interface VerifyOTPRequest {
  email: string;
  otp: string;
  flowType?: 'login' | 'password-reset' | 'punch';
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  token?: string; // JWT token for login flow
  expiresAt?: string;
  accountStatus?: AccountStatus; // Account status: 'active', 'locked', 'password expired', 'inactive'
  requiresPasswordChange?: boolean;
  firstTimeLogin?: boolean; // If true, navigate to FirstTimeLoginScreen
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
    firstTimeLogin?: boolean;
  };
}

export interface ResendOTPRequest {
  email: string;
  flowType?: 'login' | 'password-reset' | 'punch';
}

export interface ResendOTPResponse {
  success: boolean;
  message: string;
  expiresIn?: number; // OTP expiration time in seconds
}

/**
 * Verify OTP for login, password reset, or punch flow
 */
export const verifyOTP = async (params: VerifyOTPRequest): Promise<VerifyOTPResponse> => {
  try {
    const response = await axios.post<VerifyOTPResponse>(
      `${API_BASE_URL}/api/auth/verify-otp`,
      {
        email: params.email,
        otp: params.otp,
        flowType: params.flowType || 'login',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    // Ensure response.data exists and has required structure
    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    // Ensure success property exists
    const responseData = response.data;
    if (typeof responseData.success === 'undefined') {
      // If success is not defined, assume it's successful if we got a 200 response
      return {
        ...responseData,
        success: true,
      } as VerifyOTPResponse;
    }

    return responseData;
  } catch (error: any) {
    // Log service error with context
    logServiceError(
      'auth',
      'otp-service.ts',
      'verifyOTP',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/verify-otp`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: {
            email: params.email,
            flowType: params.flowType,
            // Don't log OTP value for security
            otp: '***',
          },
          responseBody: error.response?.data,
        },
        metadata: {
          flowType: params.flowType,
        },
      }
    );

    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 'Invalid OTP';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to verify OTP. Please try again.');
    }
  }
};

/**
 * Resend OTP for login, password reset, or punch flow
 */
export const resendOTP = async (params: ResendOTPRequest): Promise<ResendOTPResponse> => {
  try {
    const response = await axios.post<ResendOTPResponse>(
      `${API_BASE_URL}/api/auth/resend-email-otp`,
      {
        email: params.email,
        flowType: params.flowType || 'login',
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
      'otp-service.ts',
      'resendOTP',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/resend-email-otp`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: {
            email: params.email,
            flowType: params.flowType,
          },
          responseBody: error.response?.data,
        },
        metadata: {
          flowType: params.flowType,
        },
      }
    );

    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 'Failed to resend OTP';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to resend OTP. Please try again.');
    }
  }
};

