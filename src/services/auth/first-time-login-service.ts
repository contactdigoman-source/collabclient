import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { getDeviceUniqueIdentifier } from '../device/device-identifier-service';
import { store } from '../../redux';
import { setUserData, setJWTToken, setExpiresAt } from '../../redux/reducers/userReducer';
import { profileSyncService } from '../sync/profile-sync-service';

// FormData is available globally in React Native
declare const FormData: any;

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
    profilePhotoUrl?: string; // Profile photo URL from server
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
  permissionsTimestamp?: string; // Optional: timestamp when permissions were granted
  profilePhoto?: string; // Optional: path to profile photo file
}): Promise<FirstTimeLoginResponse> => {
  try {
    // Get device unique identifier
    const deviceIdentifier = await getDeviceUniqueIdentifier();

    // Get current timestamp for form submission
    const timestamp = new Date().toISOString();

    // Use provided permissions timestamp or current timestamp
    const consentTimestamp = data.permissionsTimestamp || timestamp;

    let response: axios.AxiosResponse<FirstTimeLoginResponse>;

    // If profile photo is provided, use FormData (multipart/form-data)
    if (data.profilePhoto) {
      // Use React Native's built-in FormData
      const formData = new FormData();

      // Add text fields
      formData.append('email', data.email);
      formData.append('firstName', data.firstName);
      formData.append('lastName', data.lastName);
      formData.append('newPassword', data.newPassword);
      formData.append('deviceIdentifier', deviceIdentifier);
      formData.append('timestamp', timestamp);
      formData.append('consent[agreed]', 'true');
      formData.append('consent[timestamp]', consentTimestamp);
      formData.append('consent[permissions]', JSON.stringify(data.permissions));

      // Add profile photo
      formData.append('profilePhoto', {
        uri: data.profilePhoto,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      // Make API call with FormData
      // Note: Don't set Content-Type header - axios will set it automatically with boundary
      response = await axios.post<FirstTimeLoginResponse>(
        `${API_BASE_URL}/api/auth/first-time-login`,
        formData,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
      );
    } else {
      // No photo, use JSON
      const requestData: FirstTimeLoginRequest = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        newPassword: data.newPassword,
        consent: {
          agreed: true,
          timestamp: consentTimestamp,
          permissions: data.permissions,
        },
        deviceIdentifier: deviceIdentifier,
        timestamp: timestamp,
      };

      // Make API call
      response = await axios.post<FirstTimeLoginResponse>(
        `${API_BASE_URL}/api/auth/first-time-login`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // If successful, update Redux store and SQLite
    if (response.data.success && response.data.user) {
      const userEmail = response.data.user.email;
      
      // Determine which profile photo to use: server URL (preferred) or local path
      const profilePhotoToSave = response.data.user.profilePhotoUrl || data.profilePhoto;
      
      // Save profile photo to SQLite (prefer server URL over local path)
      if (profilePhotoToSave && userEmail) {
        try {
          await profileSyncService.saveProfileProperty(userEmail, 'profilePhoto', profilePhotoToSave);
          // Mark as synced if we got a server URL
          if (response.data.user.profilePhotoUrl) {
            await profileSyncService.markPropertyAsSynced(userEmail, 'profilePhoto');
          }
        } catch (dbError) {
          logger.error('Error saving profile photo to SQLite', dbError as Error);
          // Continue even if SQLite save fails
        }
      }
      
      // Update user data
      const updatedUserData = {
        ...response.data.user,
        firstTimeLogin: false, // Mark as completed
        profilePhoto: profilePhotoToSave,
        profilePhotoUrl: response.data.user.profilePhotoUrl || profilePhotoToSave,
      };
      
      store.dispatch(setUserData(updatedUserData));

      // Store JWT token if provided
      if (response.data.token) {
        store.dispatch(setJWTToken(response.data.token));
      }
      
      // Store expiration time if provided
      if (response.data.expiresAt) {
        store.dispatch(setExpiresAt(response.data.expiresAt));
      }
    }

    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Failed to submit first-time login data';

    logger.error('Failed to submit first-time login', error, {
      url: `${API_BASE_URL}/api/auth/first-time-login`,
      method: 'POST',
      statusCode: error.response?.status,
      requestBody: {
        email: data.email,
        firstName: data.firstName,
        // Don't log password
      },
      responseBody: error.response?.data,
    }, {
      email: data.email,
    });

    throw new Error(errorMessage);
  }
};

