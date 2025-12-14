import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';

const API_BASE_URL = Configs.apiBaseUrl;

export interface RequestOTPParams {
  aadhaarNumber: string;
  emailID: string;
}

export interface VerifyOTPParams {
  aadhaarNumber: string;
  otp: string;
  emailID: string;
}

/**
 * Request OTP for Aadhaar verification
 * This calls your backend API which should then call UIDAI OTP API or third-party service
 */
export const requestAadhaarOTP = async (params: RequestOTPParams): Promise<boolean> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/aadhaar/request-otp`,
      {
        aadhaarNumber: params.aadhaarNumber,
        emailID: params.emailID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );
    
    return response.data?.success === true;
  } catch (error: any) {
    logger.error('Failed to request Aadhaar OTP', error, {
      url: `${API_BASE_URL}/api/aadhaar/request-otp`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: { aadhaarNumber: params.aadhaarNumber, emailID: params.emailID },
      responseBody: error.response?.data,
    }, {
      aadhaarNumber: params.aadhaarNumber ? `${params.aadhaarNumber.substring(0, 4)}****${params.aadhaarNumber.substring(8)}` : undefined,
      emailID: params.emailID,
    });
    
    if (error.response) {
      // Server responded with error
      throw new Error(error.response.data?.message || 'Failed to request OTP');
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your internet connection.');
    } else {
      // Error setting up request
      throw new Error('Failed to request OTP. Please try again.');
    }
  }
};

/**
 * Verify OTP for Aadhaar verification
 * This calls your backend API which should then verify with UIDAI or third-party service
 */
export const verifyAadhaarOTP = async (params: VerifyOTPParams): Promise<boolean> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/aadhaar/verify-otp`,
      {
        aadhaarNumber: params.aadhaarNumber,
        otp: params.otp,
        emailID: params.emailID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );
    
    return response.data?.verified === true && response.data?.success === true;
  } catch (error: any) {
    logger.error('Failed to verify Aadhaar OTP', error, {
      url: `${API_BASE_URL}/api/aadhaar/verify-otp`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: { aadhaarNumber: params.aadhaarNumber, emailID: params.emailID },
      responseBody: error.response?.data,
    }, {
      aadhaarNumber: params.aadhaarNumber ? `${params.aadhaarNumber.substring(0, 4)}****${params.aadhaarNumber.substring(8)}` : undefined,
      emailID: params.emailID,
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

