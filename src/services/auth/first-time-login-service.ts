import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import apiClient from '../api/api-client';
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
  idpjourneyToken: string; // IDP journey token from OTP verification
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
  idpjourneyToken?: string; // IDP journey token (if needed for further steps)
  jwt?: string; // JWT access token
  expiresAt?: string; // JWT expiration timestamp (ISO 8601 format)
  refreshToken?: string; // Refresh token for getting new JWT
  firstName?: string; // User's first name
  lastName?: string; // User's last name
  email?: string; // User's email
  contact?: string; // User's phone number
  organization?: string; // User's organization name
  role?: string; // User's role (e.g., "ORGUSER")
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
  idpjourneyToken: string; // IDP journey token from OTP verification
}): Promise<FirstTimeLoginResponse> => {
  try {
    // Get device unique identifier
    const deviceIdentifier = await getDeviceUniqueIdentifier();

    // Get current timestamp for form submission
    const timestamp = new Date().toISOString();

    // Use provided permissions timestamp or current timestamp
    const consentTimestamp = data.permissionsTimestamp || timestamp;

    let response;

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
      formData.append('idpjourneyToken', data.idpjourneyToken);
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
      // Note: Content-Type will be set automatically by apiClient interceptor
      response = await apiClient.post<FirstTimeLoginResponse>(
        `/api/auth/first-time-login`,
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
        idpjourneyToken: data.idpjourneyToken,
        consent: {
          agreed: true,
          timestamp: consentTimestamp,
          permissions: data.permissions,
        },
        deviceIdentifier: deviceIdentifier,
        timestamp: timestamp,
      };

      // Make API call
      response = await apiClient.post<FirstTimeLoginResponse>(
        `/api/auth/first-time-login`,
        requestData,
      );
    }

    // If successful, update Redux store and SQLite
    if (response.data.success) {
      const userEmail = response.data.email || data.email;
      
      // Save profile photo to SQLite if provided
      if (data.profilePhoto && userEmail) {
        try {
          await profileSyncService.saveProfileProperty(userEmail, 'profilePhoto', data.profilePhoto);
        } catch (dbError) {
          logger.error('Error saving profile photo to SQLite', dbError as Error);
          // Continue even if SQLite save fails
        }
      }
      
      // Update user data from response
      if (userEmail) {
        const updatedUserData = {
          id: 0, // ID not provided in new response structure
          email: response.data.email || userEmail,
          firstName: response.data.firstName || data.firstName,
          lastName: response.data.lastName || data.lastName,
          phoneNumber: response.data.contact,
          isEmailVerified: true, // Assumed after first-time login
          isPhoneVerified: false,
          requiresPasswordChange: false,
          roles: response.data.role ? [response.data.role] : [],
          firstTimeLogin: false, // Mark as completed
          profilePhoto: data.profilePhoto,
          profilePhotoUrl: data.profilePhoto,
        };
        
        store.dispatch(setUserData(updatedUserData));
      }

      // Store JWT token if provided
      if (response.data.jwt) {
        store.dispatch(setJWTToken(response.data.jwt));
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

