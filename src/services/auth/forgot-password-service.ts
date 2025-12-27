import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import apiClient from '../api/api-client';

const API_BASE_URL = Configs.apiBaseUrl;

// Forgot Password API Types
export interface ForgotPasswordRequest {
  email: string;
}

export type AccountStatus = 'active' | 'locked' | 'passwordExpired' | 'inactive';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  accountStatus?: AccountStatus; // Account status: 'active', 'locked', 'passwordExpired', 'inactive'
  otpSent?: boolean; // Whether OTP was sent successfully
}

// Reset Password API Types
export interface ResetPasswordRequest {
  token: string; // Token from OTP verification
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
  success?: boolean;
}

/**
 * Request password reset OTP
 * Sends OTP to user's email for password reset
 */
export const forgotPassword = async (
  params: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> => {
  try {
    const response = await apiClient.post<ForgotPasswordResponse>(
      `/api/auth/forgot-password`,
      {
        email: params.email,
      },
      {
        timeout: 30000, // 30 seconds timeout
      }
    );

    // Ensure response.data exists and has required structure
    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    const responseData = response.data;
    
    // Ensure success property exists
    if (typeof responseData.success === 'undefined') {
      return {
        ...responseData,
        success: true,
        otpSent: true,
      } as ForgotPasswordResponse;
    }

    return responseData;
  } catch (error: any) {
    // Log service error with context
    logger.error('Failed to send password reset OTP', error, {
      url: `${API_BASE_URL}/api/auth/forgot-password`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        email: params.email,
      },
      responseBody: error.response?.data,
    });

    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 'Failed to send password reset OTP';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to request password reset. Please try again.');
    }
  }
};

/**
 * Reset password after OTP verification (for forgot password flow)
 * Requires token from OTP verification and new password
 */
export const resetPassword = async (
  params: ResetPasswordRequest,
): Promise<ResetPasswordResponse> => {
  try {
    const response = await apiClient.post<ResetPasswordResponse>(
      `/api/auth/reset-password`,
      {
        token: params.token,
        newPassword: params.newPassword,
      },
      {
        timeout: 30000, // 30 seconds timeout
      }
    );

    // Ensure response.data exists
    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    const responseData = response.data;
    
    // Ensure success property exists
    if (typeof responseData.success === 'undefined') {
      return {
        ...responseData,
        success: true,
      } as ResetPasswordResponse;
    }

    return responseData;
  } catch (error: any) {
    // Log service error with context
    logger.error('Failed to reset password', error, {
      url: `${API_BASE_URL}/api/auth/reset-password`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        token: params.token ? '***' : undefined,
        newPassword: '***', // Don't log password
      },
      responseBody: error.response?.data,
    });

    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 'Failed to reset password';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to reset password. Please try again.');
    }
  }
};

