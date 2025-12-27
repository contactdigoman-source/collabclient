import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import apiClient from '../api/api-client';

const API_BASE_URL = Configs.apiBaseUrl;

// Account Status Types (same as login service)
export type AccountStatus = 'active' | 'locked' | 'passwordExpired' | 'inactive';

// OTP API Types for Login Flow
export interface VerifyOTPRequest {
  idpjourneyToken: string; // IDP journey token from login (required for login flow)
  otpValue: string; // OTP value entered by user
}

// Legacy OTP API Types (for backward compatibility with existing OtpScreen)
export interface LegacyVerifyOTPRequest {
  email: string;
  otp: string;
  flowType?: 'login' | 'password-reset' | 'punch';
  idpjourneyToken?: string;
}

export interface LegacyVerifyOTPResponse {
  success: boolean;
  message: string;
  token?: string;
  expiresAt?: string;
  accountStatus?: AccountStatus;
  requiresPasswordChange?: boolean;
  firstTimeLogin?: boolean;
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

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  accountStatus?: AccountStatus; // Account status: 'active', 'locked', 'passwordExpired', 'inactive'
  firstTimeLogin?: boolean; // If true, response contains idpjourneyToken for first-time login flow
  idpjourneyToken?: string; // IDP journey token (present in all successful OTP verification responses)
  token?: string; // Token for password reset (present when accountStatus is 'passwordExpired')
  // Fields present when firstTimeLogin is false and accountStatus is 'active'
  jwt?: string; // JWT token
  expiresAt?: string; // Token expiration timestamp
  refreshToken?: string; // Refresh token
  firstName?: string;
  lastName?: string;
  email?: string;
  contact?: string; // Phone number
  organization?: string; // Organization name
  role?: string; // User role
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
 * Verify OTP for login flow (new implementation)
 * Request body: { idpjourneyToken, otpValue }
 */
export const verifyLoginOTP = async (params: VerifyOTPRequest): Promise<VerifyOTPResponse> => {
  try {
    const requestBody = {
      idpjourneyToken: params.idpjourneyToken,
      otpValue: params.otpValue,
    };

    const response = await apiClient.post<VerifyOTPResponse>(
      `/api/auth/verify-otp`,
      requestBody,
      {
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
    logger.error('Failed to verify login OTP', error, {
      url: `${API_BASE_URL}/api/auth/verify-otp`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        idpjourneyToken: params.idpjourneyToken ? '***' : undefined,
        otpValue: '***', // Don't log OTP value for security
      },
      responseBody: error.response?.data,
    });

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
 * Legacy verifyOTP function for backward compatibility (used by existing OtpScreen)
 */
export const verifyOTP = async (params: LegacyVerifyOTPRequest): Promise<LegacyVerifyOTPResponse> => {
  try {
    const requestBody: any = {
      email: params.email,
      otp: params.otp,
      flowType: params.flowType || 'login',
    };
    
    // Include idpjourneyToken for login flow
    if (params.idpjourneyToken) {
      requestBody.idpjourneyToken = params.idpjourneyToken;
    }

    const response = await apiClient.post<LegacyVerifyOTPResponse>(
      `/api/auth/verify-otp`,
      requestBody,
      {
        timeout: 30000,
      }
    );

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    const responseData = response.data;
    if (typeof responseData.success === 'undefined') {
      return {
        ...responseData,
        success: true,
      } as LegacyVerifyOTPResponse;
    }

    return responseData;
  } catch (error: any) {
    logger.error('Failed to verify OTP', error, {
      url: `${API_BASE_URL}/api/auth/verify-otp`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        email: params.email,
        flowType: params.flowType,
        otp: '***',
      },
      responseBody: error.response?.data,
    }, {
      flowType: params.flowType,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Invalid OTP';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to verify OTP. Please try again.');
    }
  }
};

/**
 * Resend OTP for login, password reset, or punch flow
 */
export const resendOTP = async (params: ResendOTPRequest): Promise<ResendOTPResponse> => {
  try {
    const response = await apiClient.post<ResendOTPResponse>(
      `/api/auth/resend-email-otp`,
      {
        email: params.email,
        flowType: params.flowType || 'login',
      },
      {
        timeout: 30000, // 30 seconds timeout
      }
    );

    return response.data;
  } catch (error: any) {
    // Log service error with context
    logger.error('Failed to resend OTP', error, {
      url: `${API_BASE_URL}/api/auth/resend-email-otp`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        email: params.email,
        flowType: params.flowType,
      },
      responseBody: error.response?.data,
    }, {
      flowType: params.flowType,
    });

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

