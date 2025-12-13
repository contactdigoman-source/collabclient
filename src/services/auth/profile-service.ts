import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logServiceError } from '../logger';
import { getJWTToken } from './login-service';
import { store } from '../../redux';
import { setUserData } from '../../redux/reducers/userReducer';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

// Profile API Types
export interface ProfileResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profilePhotoUrl?: string;
  dateOfActivation?: string;
  dateOfBirth?: string;
  empId?: string;
  employmentType?: string;
  designation?: string;
  organizationName?: string;
  department?: string;
  roles: string[];
  createdAt?: string;
  lastLoginAt?: string;
  aadhaarVerification?: {
    isVerified: boolean;
    verificationMethod?: string;
    lastVerifiedDate?: string;
    maskedAadhaarNumber?: string;
    isPanCardVerified?: boolean;
  };
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string; // ISO 8601 format (YYYY-MM-DD)
  employmentType?: string;
  designation?: string;
}

export interface UpdateProfileResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profilePhotoUrl?: string;
  dateOfActivation?: string;
  dateOfBirth?: string;
  empId?: string;
  employmentType?: string;
  designation?: string;
  roles: string[];
  requiresPasswordChange?: boolean;
  aadhaarVerification?: {
    isVerified: boolean;
    verificationMethod?: string;
    lastVerifiedDate?: string;
    maskedAadhaarNumber?: string;
    isPanCardVerified?: boolean;
  };
}

export interface UploadProfilePhotoResponse {
  success: boolean;
  message: string;
  profilePhotoUrl: string;
  thumbnailUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

/**
 * Get user profile data
 */
export const getProfile = async (): Promise<ProfileResponse> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email) {
      throw new Error('User email not found');
    }

    const token = await getJWTToken(userData.email);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<ProfileResponse>(
      `${API_BASE_URL}/api/auth/profile`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Update Redux store with profile data
    if (response.data) {
      store.dispatch(setUserData({
        ...userData,
        ...response.data,
      }));
    }

    return response.data;
  } catch (error: any) {
    logServiceError(
      'auth',
      'profile-service.ts',
      'getProfile',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/profile`,
          method: 'GET',
          statusCode: error.response?.status,
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );

    // Don't throw errors - just log them and let the caller handle gracefully
    // This prevents the app from crashing when services are down
    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to fetch profile';
      console.warn('[Profile Service] API error:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.request) {
      // Network error - service might be down
      console.warn('[Profile Service] Network error - service may be unavailable');
      throw new Error('Network error. Please check your internet connection.');
    } else {
      console.warn('[Profile Service] Request setup error:', error.message);
      throw new Error('Failed to fetch profile. Please try again.');
    }
  }
};

/**
 * Update user profile (firstName, lastName)
 */
export const updateProfile = async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email) {
      throw new Error('User email not found');
    }

    const token = await getJWTToken(userData.email);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post<UpdateProfileResponse>(
      `${API_BASE_URL}/api/auth/update-profile`,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        ...(data.employmentType && { employmentType: data.employmentType }),
        ...(data.designation && { designation: data.designation }),
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Update Redux store with updated profile data
    if (response.data) {
      store.dispatch(setUserData({
        ...userData,
        ...response.data,
      }));
    }

    return response.data;
  } catch (error: any) {
    logServiceError(
      'auth',
      'profile-service.ts',
      'updateProfile',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/update-profile`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );

    // Don't crash the app if service is down
    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to update profile';
      console.warn('[Profile Service] Update error:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.request) {
      console.warn('[Profile Service] Network error during update - service may be unavailable');
      throw new Error('Network error. Please check your internet connection.');
    } else {
      console.warn('[Profile Service] Update request error:', error.message);
      throw new Error('Failed to update profile. Please try again.');
    }
  }
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (photoPath: string): Promise<UploadProfilePhotoResponse> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email) {
      throw new Error('User email not found');
    }

    const token = await getJWTToken(userData.email);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Create FormData for multipart/form-data
    const formData = new FormData();
    formData.append('profilePhoto', {
      uri: photoPath,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as any);

    const response = await axios.post<UploadProfilePhotoResponse>(
      `${API_BASE_URL}/api/auth/upload-profile-photo`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Don't set Content-Type - axios will set it automatically with boundary
        },
        timeout: 60000, // 60 seconds for file upload
      }
    );

    // Update Redux store with new profile photo URL
    if (response.data.success && response.data.profilePhotoUrl && userData) {
      store.dispatch(setUserData({
        ...userData,
        profilePhoto: photoPath, // Store local path
        profilePhotoUrl: response.data.profilePhotoUrl,
      }));
    }

    return response.data;
  } catch (error: any) {
    logServiceError(
      'auth',
      'profile-service.ts',
      'uploadProfilePhoto',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/upload-profile-photo`,
          method: 'POST',
          statusCode: error.response?.status,
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );

    // Don't crash the app if service is down
    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to upload profile photo';
      console.warn('[Profile Service] Photo upload error:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.request) {
      console.warn('[Profile Service] Network error during photo upload - service may be unavailable');
      throw new Error('Network error. Please check your internet connection.');
    } else {
      console.warn('[Profile Service] Photo upload request error:', error.message);
      throw new Error('Failed to upload profile photo. Please try again.');
    }
  }
};

/**
 * Change user password
 */
export const changePassword = async (data: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email) {
      throw new Error('User email not found');
    }

    const token = await getJWTToken(userData.email);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post<ChangePasswordResponse>(
      `${API_BASE_URL}/api/auth/change-password`,
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error: any) {
    logServiceError(
      'auth',
      'profile-service.ts',
      'changePassword',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/auth/change-password`,
          method: 'POST',
          statusCode: error.response?.status,
          requestBody: {
            // Don't log passwords
          },
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );

    // Don't crash the app if service is down
    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to change password';
      console.warn('[Profile Service] Change password error:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.request) {
      console.warn('[Profile Service] Network error during password change - service may be unavailable');
      throw new Error('Network error. Please check your internet connection.');
    } else {
      console.warn('[Profile Service] Password change request error:', error.message);
      throw new Error('Failed to change password. Please try again.');
    }
  }
};
