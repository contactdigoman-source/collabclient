import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { store } from '../../redux';
import { setUserData, setUserAadhaarFaceValidated, setIsPanCardVerified, setLastAadhaarVerificationDate } from '../../redux/reducers/userReducer';
import { profileSyncService } from '../sync/profile-sync-service';
import { networkService } from '../network/network-service';
import { apiQueueService, RequestPriority } from '../api';
import apiClient from '../api/api-client';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

// Geofencing area type for check-in validation
export interface GeofenceArea {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // Radius in meters
  isActive?: boolean;
}

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
  organization?: string; // Organization ID or name
  department?: string;
  roles: string[]; // User roles (e.g., ["ORGUSER", "ADMIN"])
  createdAt?: string;
  lastLoginAt?: string;
  lastSyncedAt?: string; // ISO 8601 timestamp from server
  shiftStartTime?: string; // Shift start time in HH:mm format (e.g., "09:00")
  shiftEndTime?: string; // Shift end time in HH:mm format (e.g., "18:00")
  minimumWorkingHours?: number; // Minimum working hours required per day (e.g., 9)
  // Geofencing data for check-in validation
  allowedGeofenceAreas?: GeofenceArea[]; // List of allowed geofence areas for check-in
  // Timezone and time data
  timezone?: string; // User's timezone (e.g., "Asia/Kolkata")
  timezoneOffset?: number; // Offset in minutes from UTC
  currentTime?: string; // Current server time in ISO 8601 format
  // Aadhaar and PAN verification
  aadhaarVerification?: {
    isVerified: boolean;
    verificationMethod?: string; // "face-rd" | "otp" | "pan-card"
    lastVerifiedDate?: string; // Format: YYYY-MM-DD
    maskedAadhaarNumber?: string;
    isPanCardVerified?: boolean; // If verified using PAN card instead of Aadhaar
  };
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO 8601 format (YYYY-MM-DD)
  employmentType?: string;
  designation?: string;
  profilePhoto?: string; // Local file path (e.g., /path/to/image.jpg or file://...)
  profilePhotoUrl?: string; // Server URL (e.g., https://...)
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
  lastSyncedAt?: string; // ISO 8601 timestamp from server
  shiftStartTime?: string; // Shift start time in HH:mm format (e.g., "09:00")
  shiftEndTime?: string; // Shift end time in HH:mm format (e.g., "18:00")
  aadhaarVerification?: {
    isVerified: boolean;
    verificationMethod?: string;
    lastVerifiedDate?: string;
    maskedAadhaarNumber?: string;
    isPanCardVerified?: boolean;
  };
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

    const response = await apiQueueService.enqueue(
      {
        method: 'get',
        url: `/api/auth/profile`,
        timeout: 30000,
      },
      RequestPriority.HIGH,
      true, // Use cache
      60000 // 1 minute cache TTL
    ) as any as { data: ProfileResponse };

    // Load local profile data with per-property timestamps
    let localProfile: any = null;
    let syncStatus: any = null;
    try {
      const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
      if (dbProfile) {
        localProfile = dbProfile;
      }
    // Get sync status with single lastUpdatedAt timestamp
    syncStatus = await profileSyncService.getProfileSyncStatus(userData.email);
    } catch (dbError) {
      logger.error('Error loading profile from DB', dbError as Error, undefined, {
        operation: 'load_from_db',
      });
    }

    // Get server's lastSyncedAt timestamp
    const serverLastSyncedAt = response.data.lastSyncedAt 
      ? new Date(response.data.lastSyncedAt).getTime() 
      : null;

    // Compare single timestamps: use whichever is greater
    // lastUpdatedAt is only updated from local changes, server_lastSyncedAt is only from server
    const lastUpdatedAt = syncStatus?.lastUpdatedAt || null;
    
    // Only use server data if server_lastSyncedAt >= lastUpdatedAt
    // If server_lastSyncedAt < lastUpdatedAt, local data is newer, so keep it (don't overwrite DB)
    const useServerData = lastUpdatedAt === null || 
      (serverLastSyncedAt !== null && serverLastSyncedAt >= lastUpdatedAt);

    const finalProfile: ProfileResponse = { ...response.data };

    if (localProfile && syncStatus) {
      if (useServerData) {
        // Server is newer or equal - use all server data and update DB
        logger.debug(`Using server data (local: ${lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : 'null'}, server: ${serverLastSyncedAt ? new Date(serverLastSyncedAt).toISOString() : 'null'})`);
        
        // Merge server data directly (this updates server_lastSyncedAt)
        await profileSyncService.mergeServerProfileData(userData.email, response.data);
        
        // If server_lastSyncedAt >= lastUpdatedAt, sync lastUpdatedAt with server_lastSyncedAt
        if (serverLastSyncedAt !== null && serverLastSyncedAt >= (lastUpdatedAt || 0)) {
          await profileSyncService.syncLastUpdatedAtWithServer(userData.email, serverLastSyncedAt);
        }
      } else {
        // Local is newer - use all local data, don't overwrite DB
        logger.debug(`Keeping local data (local: ${new Date(lastUpdatedAt!).toISOString()}, server: ${serverLastSyncedAt ? new Date(serverLastSyncedAt).toISOString() : 'null'})`);
        
        finalProfile.firstName = localProfile.firstName || response.data.firstName;
        finalProfile.lastName = localProfile.lastName || response.data.lastName;
        // Prefer local profilePhoto (local file path) if it exists, otherwise use server URL
        // Only use server URL if local doesn't have a photo or if server timestamp is >= local
        finalProfile.profilePhotoUrl = localProfile.profilePhoto || localProfile.profilePhotoUrl || response.data.profilePhotoUrl;
        finalProfile.dateOfBirth = localProfile.dateOfBirth || response.data.dateOfBirth;
        finalProfile.employmentType = localProfile.employmentType || response.data.employmentType;
        finalProfile.designation = localProfile.designation || response.data.designation;
        finalProfile.shiftStartTime = response.data.shiftStartTime; // Always use server shift times (read-only)
        finalProfile.shiftEndTime = response.data.shiftEndTime; // Always use server shift times (read-only)
      }
    } else if (response.data) {
      // No local data - use server data and save to local
      if (response.data.firstName) {
        await profileSyncService.saveProfileProperty(userData.email, 'firstName', response.data.firstName);
        await profileSyncService.markPropertyAsSynced(userData.email, 'firstName');
      }
      if (response.data.lastName) {
        await profileSyncService.saveProfileProperty(userData.email, 'lastName', response.data.lastName);
        await profileSyncService.markPropertyAsSynced(userData.email, 'lastName');
      }
      if (response.data.profilePhotoUrl) {
        await profileSyncService.saveProfileProperty(userData.email, 'profilePhoto', response.data.profilePhotoUrl);
        await profileSyncService.markPropertyAsSynced(userData.email, 'profilePhoto');
      }
      if (response.data.dateOfBirth) {
        await profileSyncService.saveProfileProperty(userData.email, 'dateOfBirth', response.data.dateOfBirth);
        await profileSyncService.markPropertyAsSynced(userData.email, 'dateOfBirth');
      }
      if (response.data.employmentType) {
        await profileSyncService.saveProfileProperty(userData.email, 'employmentType', response.data.employmentType);
        await profileSyncService.markPropertyAsSynced(userData.email, 'employmentType');
      }
      if (response.data.designation) {
        await profileSyncService.saveProfileProperty(userData.email, 'designation', response.data.designation);
        await profileSyncService.markPropertyAsSynced(userData.email, 'designation');
      }
      // Note: shiftStartTime and shiftEndTime are read-only from server, stored only in Redux, not in DB
    }

    // Update server_lastSyncedAt in database (for tracking, but doesn't affect property comparison)
    if (response.data.lastSyncedAt) {
      await profileSyncService.updateServerLastSyncedAt(userData.email, new Date(response.data.lastSyncedAt).getTime());
    }

    // Load final merged data from DB (which now has the latest merged data)
    const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
    const finalDbProfile: ProfileResponse & { profilePhoto?: string } = dbProfile ? {
      ...response.data,
      ...dbProfile,
      profilePhotoUrl: dbProfile.profilePhotoUrl || response.data.profilePhotoUrl,
      profilePhoto: (dbProfile as any).profilePhoto, // Local file path from DB
    } : finalProfile;

    // Update Redux store with final profile data from DB
    if (finalDbProfile) {
      // Prefer local profilePhoto (file path) if it exists, otherwise use profilePhotoUrl (server URL)
      // This ensures local picked photos are shown immediately until server syncs
      const photoToUse = (dbProfile as any)?.profilePhoto || finalDbProfile.profilePhotoUrl;
      
      store.dispatch(setUserData({
        ...userData,
        ...finalDbProfile,
        profilePhoto: photoToUse, // Use local path if available, otherwise server URL
        profilePhotoUrl: finalDbProfile.profilePhotoUrl, // Always store server URL for reference
        // Include new fields for geofencing, timezone, verification status, shift times
        organization: finalDbProfile.organization || finalDbProfile.organizationName,
        organizationName: finalDbProfile.organizationName,
        timezone: finalDbProfile.timezone,
        timezoneOffset: finalDbProfile.timezoneOffset,
        currentTime: finalDbProfile.currentTime,
        allowedGeofenceAreas: finalDbProfile.allowedGeofenceAreas,
        aadhaarVerification: finalDbProfile.aadhaarVerification,
        shiftStartTime: finalDbProfile.shiftStartTime, // Shift start time from profile API
        shiftEndTime: finalDbProfile.shiftEndTime, // Shift end time from profile API
      }));

      // Sync Aadhaar/PAN verification status from profile data to Redux state
      // This ensures BottomTabBar and other components use the server's verification status
      if (finalDbProfile.aadhaarVerification) {
        const { isVerified, isPanCardVerified, lastVerifiedDate } = finalDbProfile.aadhaarVerification;
        
        // Update verification status based on profile data
        if (isVerified) {
          // Update PAN card verification status first
          if (isPanCardVerified !== undefined) {
            store.dispatch(setIsPanCardVerified(isPanCardVerified));
          }
          
          // Set verified status (this will set date to today in the reducer)
          store.dispatch(setUserAadhaarFaceValidated(true));
          
          // Override with the actual date from profile if available
          // This must be done AFTER setUserAadhaarFaceValidated because the reducer sets it to today
          if (lastVerifiedDate) {
            store.dispatch(setLastAadhaarVerificationDate(lastVerifiedDate));
          }
        } else {
          // If not verified in profile, reset verification status
          store.dispatch(setUserAadhaarFaceValidated(false));
          store.dispatch(setIsPanCardVerified(false));
          store.dispatch(setLastAadhaarVerificationDate(null));
        }
      }
    }

    // Return final merged data from DB
    return finalDbProfile;
  } catch (error: any) {
    logger.error('Failed to get profile', error, {
          url: `${API_BASE_URL}/api/auth/profile`,
          method: 'GET',
          statusCode: error?.response?.status,
          responseBody: error?.response?.data,
    }, {
          hasResponse: !!error?.response,
          hasRequest: !!error?.request,
    });

    // Don't throw errors - just log them and let the caller handle gracefully
    // This prevents the app from crashing when services are down
    if (error?.response) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch profile';
      logger.warn(`API error: ${errorMessage}`, error);
      throw new Error(errorMessage);
    } else if (error?.request) {
      // Network error - service might be down
      logger.warn('Network error - service may be unavailable', error);
      throw new Error('Network error. Please check your internet connection.');
    } else {
      logger.warn(`Request setup error: ${error.message}`, error);
      throw new Error('Failed to fetch profile. Please try again.');
    }
  }
};

/**
 * Update user profile (firstName, lastName, etc.)
 * If profilePhoto (file path) is provided, it will be uploaded as FormData.
 * If profilePhotoUrl (server URL) is provided, it will be sent as a regular field.
 * Saves each property to SQLite with isSynced=0, then syncs if online or queues if offline.
 * Updates local lastUpdatedAt timestamp.
 */
export const updateProfile = async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email) {
      throw new Error('User email not found');
    }

    const email = userData.email;
    const now = Date.now();

    // Update lastUpdatedAt BEFORE making the API call (as requested)
    await profileSyncService.updateLastUpdatedAt(email, now);

    // Save each property to SQLite with isSynced=0
    if (data.firstName !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'firstName', data.firstName);
    }
    if (data.lastName !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'lastName', data.lastName);
    }
    if (data.dateOfBirth !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'dateOfBirth', data.dateOfBirth);
    }
    if (data.employmentType !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'employmentType', data.employmentType);
    }
    if (data.designation !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'designation', data.designation);
    }
    // Save profilePhoto (local path) if provided
    if (data.profilePhoto !== undefined) {
      await profileSyncService.saveProfileProperty(email, 'profilePhoto', data.profilePhoto);
    } else if (data.profilePhotoUrl !== undefined) {
      // If only profilePhotoUrl is provided (server URL), save it to profilePhoto
      await profileSyncService.saveProfileProperty(email, 'profilePhoto', data.profilePhotoUrl);
    }

    // Check if online - if yes, sync immediately; if no, it's already queued
    const isOnline = await networkService.isConnected();
    if (isOnline) {
      // Try to sync immediately
      try {
        // Check if we need to send FormData (when profilePhoto is a local file path)
        const isLocalPhoto = data.profilePhoto && (data.profilePhoto.startsWith('/') || data.profilePhoto.startsWith('file://'));
        
        let response: any;
        
        if (isLocalPhoto) {
          // Create FormData for multipart/form-data when uploading photo
          const formData = new FormData();
          
          if (data.firstName !== undefined) {
            formData.append('firstName', data.firstName);
          }
          if (data.lastName !== undefined) {
            formData.append('lastName', data.lastName);
          }
          if (data.dateOfBirth !== undefined) {
            formData.append('dateOfBirth', data.dateOfBirth);
          }
          if (data.employmentType !== undefined) {
            formData.append('employmentType', data.employmentType);
          }
          if (data.designation !== undefined) {
            formData.append('designation', data.designation);
          }
          formData.append('profilePhoto', {
            uri: data.profilePhoto,
            type: 'image/jpeg',
            name: 'profile.jpg',
          } as any);

          response = await apiClient.post<UpdateProfileResponse>(
            `/api/auth/update-profile`,
            formData,
            {
              headers: {
                'Accept': 'application/json',
                // Content-Type will be set automatically by apiClient (interceptor handles FormData)
              },
              timeout: 60000, // 60 seconds for file upload
            }
          );
        } else {
          // Regular JSON request when no local photo
          response = await apiClient.post<UpdateProfileResponse>(
            `/api/auth/update-profile`,
            {
              firstName: data.firstName,
              lastName: data.lastName,
              ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
              ...(data.employmentType && { employmentType: data.employmentType }),
              ...(data.designation && { designation: data.designation }),
              ...(data.profilePhotoUrl && { profilePhotoUrl: data.profilePhotoUrl }),
            },
            {
              timeout: 30000,
            }
          );
        }

        // Don't overwrite DB with server response - only getProfile() should update DB from server
        // Just mark properties as synced if server's lastSyncedAt >= local lastUpdatedAt
        const syncStatus = await profileSyncService.getProfileSyncStatus(email);
        const serverLastSyncedAt = response.data.lastSyncedAt 
          ? new Date(response.data.lastSyncedAt).getTime() 
          : now;

        // Compare single timestamps: only mark as synced if server's lastSyncedAt >= local lastUpdatedAt
        // This ensures we don't overwrite newer local data with older server data
        const lastUpdatedAt = syncStatus?.lastUpdatedAt || null;
        const canMarkAsSynced = lastUpdatedAt === null || serverLastSyncedAt >= lastUpdatedAt;

        if (canMarkAsSynced) {
          // Server is newer or equal - mark all updated properties as synced
          if (data.firstName !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'firstName');
          }
          if (data.lastName !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'lastName');
          }
          if (data.dateOfBirth !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'dateOfBirth');
          }
          if (data.employmentType !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'employmentType');
          }
          if (data.designation !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'designation');
          }
          if (data.profilePhoto !== undefined || data.profilePhotoUrl !== undefined) {
            await profileSyncService.markPropertyAsSynced(email, 'profilePhoto');
          }
        }

        // Update server_lastSyncedAt in database with server's lastSyncedAt
        if (response.data.lastSyncedAt) {
          await profileSyncService.updateServerLastSyncedAt(email, new Date(response.data.lastSyncedAt).getTime());
        } else {
          // If server doesn't provide lastSyncedAt, use current time
          await profileSyncService.updateServerLastSyncedAt(email, now);
        }

        // Don't overwrite DB with server response - return data from DB (which has local changes)
        // getProfile() will be called separately to merge server data properly
        const dbProfile = await profileSyncService.loadProfileFromDB(email);
        const finalProfile: UpdateProfileResponse = dbProfile ? {
          ...response.data,
          ...dbProfile,
          profilePhotoUrl: dbProfile.profilePhotoUrl || response.data.profilePhotoUrl,
        } : response.data;

        // Update Redux store with data from DB (not server response)
        if (finalProfile) {
          // Prefer local profilePhoto (file path) if it exists, otherwise use profilePhotoUrl (server URL)
          // This ensures local picked photos are shown immediately until server syncs
          const photoToUse = (dbProfile as any)?.profilePhoto || finalProfile.profilePhotoUrl;
          
          store.dispatch(setUserData({
            ...userData,
            ...finalProfile,
            profilePhoto: photoToUse, // Use local path if available, otherwise server URL
            profilePhotoUrl: finalProfile.profilePhotoUrl, // Always store server URL for reference
            // Include new fields for geofencing, timezone, verification status
            // Note: UpdateProfileResponse may not have all fields, so use type assertion
            organization: (finalProfile as any).organization || (finalProfile as any).organizationName,
            organizationName: (finalProfile as any).organizationName,
            timezone: (finalProfile as any).timezone,
            timezoneOffset: (finalProfile as any).timezoneOffset,
            currentTime: (finalProfile as any).currentTime,
            allowedGeofenceAreas: (finalProfile as any).allowedGeofenceAreas,
            aadhaarVerification: finalProfile.aadhaarVerification,
            shiftStartTime: (finalProfile as any).shiftStartTime, // Shift start time from profile API
            shiftEndTime: (finalProfile as any).shiftEndTime, // Shift end time from profile API
          }));
        }

        // After update, call getProfile to sync lastUpdatedAt with server_lastSyncedAt if server is newer or equal
        try {
          await getProfile();
        } catch (getProfileError) {
          logger.warn('Failed to sync timestamps after update', getProfileError as Error);
        }

        return finalProfile;
      } catch (syncError: any) {
        // Sync failed, but data is saved locally and queued
        logger.warn('Immediate sync failed, data queued for later', syncError as Error);
        // Return the data as if it was successful (offline-first approach)
        return {
          id: userData.id || 0,
          email: email,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          employmentType: data.employmentType,
          designation: data.designation,
          profilePhotoUrl: data.profilePhotoUrl,
          isEmailVerified: userData.isEmailVerified || false,
          isPhoneVerified: userData.isPhoneVerified || false,
          roles: userData.roles || [],
        } as UpdateProfileResponse;
      }
    }

    // Offline or sync failed - return data from local storage
    return {
      id: userData.id || 0,
      email: email,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      employmentType: data.employmentType,
      designation: data.designation,
      profilePhotoUrl: data.profilePhotoUrl,
      isEmailVerified: userData.isEmailVerified || false,
      isPhoneVerified: userData.isPhoneVerified || false,
      roles: userData.roles || [],
    } as UpdateProfileResponse;
  } catch (error: any) {
    logger.error('Failed to update profile', error, {
          url: `${API_BASE_URL}/api/auth/update-profile`,
          method: 'POST',
          statusCode: error.response?.status,
      requestBody: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
          responseBody: error.response?.data,
    }, {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
    });

    // Don't crash the app if service is down
    if (error?.response) {
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      logger.warn(`Update error: ${errorMessage}`, error);
      throw new Error(errorMessage);
    } else if (error?.request) {
      logger.warn('Network error during update - service may be unavailable', error);
      throw new Error('Network error. Please check your internet connection.');
    } else {
      logger.warn(`Update request error: ${error.message}`, error);
      throw new Error('Failed to update profile. Please try again.');
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

    const response = await apiClient.post<ChangePasswordResponse>(
      `/api/auth/change-password`,
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      {
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to change password', error, {
          url: `${API_BASE_URL}/api/auth/change-password`,
          method: 'POST',
          statusCode: error.response?.status,
      requestBody: {
        // Don't log passwords
      },
          responseBody: error.response?.data,
    }, {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
    });

    // Don't crash the app if service is down
    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to change password';
      logger.warn(`Change password error: ${errorMessage}`, error);
      throw new Error(errorMessage);
    } else if (error.request) {
      logger.warn('Network error during password change - service may be unavailable', error);
      throw new Error('Network error. Please check your internet connection.');
    } else {
      logger.warn(`Password change request error: ${error.message}`, error);
      throw new Error('Failed to change password. Please try again.');
    }
  }
};
