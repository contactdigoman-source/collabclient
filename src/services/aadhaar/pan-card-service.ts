import { Platform } from 'react-native';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import apiClient from '../api/api-client';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

export interface UploadPanCardRequest {
  panCardFront: string; // Local file path for front side image
  panCardBack: string;  // Local file path for back side image
}

export interface UploadPanCardResponse {
  success: boolean;
  message: string;
  panCardDetails?: {
    panNumber?: string;        // Masked PAN number (e.g., "ABCDE****F")
    name?: string;              // Name from PAN card
    dob?: string;               // Date of birth from PAN card
    verifiedAt?: string;        // ISO 8601 timestamp when verified
  };
  isVerified?: boolean;
}

/**
 * Upload PAN card images (front and back) to the server for verification
 * @param params - PAN card image file paths
 * @returns Promise with verification response
 */
export const uploadPanCard = async (params: UploadPanCardRequest): Promise<UploadPanCardResponse> => {
  try {
    // Validate file paths
    if (!params.panCardFront || !params.panCardBack) {
      throw new Error('Both front and back PAN card images are required');
    }

    // Create FormData for multipart/form-data request (React Native FormData)
    // ImagePicker returns paths that are already in the correct format
    const formData = new FormData();

    // Normalize file paths for React Native
    // On Android, ensure path starts with file:// if it doesn't already
    // On iOS, use absolute path as-is
    const normalizePath = (path: string): string => {
      if (Platform.OS === 'android' && !path.startsWith('file://') && !path.startsWith('content://')) {
        // Android: prepend file:// if it's a local file path
        return `file://${path}`;
      }
      // iOS: use path as-is (ImagePicker already returns correct format)
      return path;
    };

    const frontPath = normalizePath(params.panCardFront);
    const backPath = normalizePath(params.panCardBack);

    // Add front side image
    formData.append('panCardFront', {
      uri: frontPath,
      type: 'image/jpeg',
      name: 'pan_card_front.jpg',
    } as any);

    // Add back side image
    formData.append('panCardBack', {
      uri: backPath,
      type: 'image/jpeg',
      name: 'pan_card_back.jpg',
    } as any);

    // Verify file paths exist and are accessible
    logger.debug('Uploading PAN card images', {
      _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
      originalFrontPath: params.panCardFront,
      originalBackPath: params.panCardBack,
      normalizedFrontPath: frontPath,
      normalizedBackPath: backPath,
      platform: Platform.OS,
      formDataKeys: ['panCardFront', 'panCardBack'],
      hasFormData: formData instanceof FormData,
      apiBaseUrl: API_BASE_URL,
      fullUrl: `${API_BASE_URL}/api/aadhaar/upload-pan-card`,
    });

    // Make the API call
    // Note: apiClient will automatically handle FormData and set Content-Type
    // The request interceptor will remove Content-Type header for FormData
    // React Native FormData is compatible with axios - no special handling needed
    const response = await apiClient.post<UploadPanCardResponse>(
      `/api/aadhaar/upload-pan-card`,
      formData,
      {
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type - let axios set it automatically for FormData
          // The interceptor will handle this by removing Content-Type
        },
        timeout: 60000, // 60 seconds timeout for image upload
        // Note: maxContentLength and maxBodyLength should be set on axios instance, not per-request
        // These are set in api-client.ts
      }
    );

    logger.info('PAN card uploaded successfully', {
      _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
      success: response.data?.success,
      isVerified: response.data?.isVerified,
      hasPanCardDetails: !!response.data?.panCardDetails,
      responseMessage: response.data?.message,
    });

    if (!response.data) {
      logger.error('PAN card upload: Empty response data', undefined, {
        _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error: any) {
    logger.error('Failed to upload PAN card', error, {
      _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
      url: `${API_BASE_URL}/api/aadhaar/upload-pan-card`,
      method: 'POST',
      statusCode: error.response?.status,
      statusText: error.response?.statusText,
      responseBody: error.response?.data,
      requestBody: error.config?.data instanceof FormData ? '[FormData]' : error.config?.data,
      errorMessage: error.message,
      errorCode: error.code,
    });

    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || 
                          (error.response.status === 413 ? 'File too large. Please use smaller images.' :
                           error.response.status === 415 ? 'Unsupported file type. Please use JPEG images.' :
                           error.response.status === 400 ? 'Invalid request. Please check the images and try again.' :
                           error.response.status === 401 ? 'Authentication failed. Please login again.' :
                           error.response.status === 403 ? 'Permission denied. You do not have access to upload PAN card.' :
                           error.response.status === 500 ? 'Server error. Please try again later.' :
                           `Failed to upload PAN card (${error.response.status})`);
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response - this is a network connectivity issue
      logger.error('PAN card upload: Network request failed - no response from server', error, {
        _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
        url: `${API_BASE_URL}/api/aadhaar/upload-pan-card`,
        hasRequest: !!error.request,
        errorCode: error.code,
        errorMessage: error.message,
      });
      
      // Provide user-friendly error message (don't include WireMock-specific debugging info)
      let networkErrorMessage = 'Network error. ';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        networkErrorMessage += 'Request timed out. Please try again.';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        // Generic network error message - don't expose WireMock/server details to users
        networkErrorMessage += 'Please check your internet connection and try again.';
      } else {
        networkErrorMessage += 'Please check your internet connection and try again.';
      }
      
      throw new Error(networkErrorMessage);
    } else {
      // Error setting up request
      logger.error('PAN card upload: Request setup error', error, {
        _context: { service: 'aadhaar', fileName: 'pan-card-service.ts', methodName: 'uploadPanCard' },
        errorMessage: error.message,
        errorCode: error.code,
      });
      throw new Error(error.message || 'Failed to upload PAN card. Please try again.');
    }
  }
};

