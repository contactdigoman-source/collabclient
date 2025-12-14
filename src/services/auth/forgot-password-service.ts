import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';

const API_BASE_URL = Configs.apiBaseUrl;

// Forgot Password API Types
export interface ForgotPasswordRequest {
  email: string;
}

export type AccountStatus = 'active' | 'locked' | 'password expired' | 'inactive';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  accountStatus?: AccountStatus; // Account status: 'active', 'locked', 'password expired', 'inactive'
  otpSent?: boolean; // Whether OTP was sent successfully
}

/**
 * Request password reset OTP
 * Sends OTP to user's email for password reset
 */
export const forgotPassword = async (
  params: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> => {
  try {
    const response = await axios.post<ForgotPasswordResponse>(
      `${API_BASE_URL}/api/auth/forgot-password`,
      {
        email: params.email,
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

