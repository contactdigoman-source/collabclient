import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { getJWTToken } from '../auth/login-service';
import { networkService } from '../network/network-service';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

// Celebrity API Types
export interface Celebrity {
  id?: number;
  name: string;
  bio?: string;
  dateOfBirth?: string;
  nationality?: string;
  profession?: string;
  documentUrl?: string;
  documentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadCelebrityDocumentResponse {
  success: boolean;
  message: string;
  documentUrl: string;
  documentName?: string;
}

export interface CreateCelebrityRequest {
  name: string;
  bio?: string;
  dateOfBirth?: string;
  nationality?: string;
  profession?: string;
  documentUrl?: string;
}

export interface UpdateCelebrityRequest {
  name?: string;
  bio?: string;
  dateOfBirth?: string;
  nationality?: string;
  profession?: string;
  documentUrl?: string;
}

/**
 * Upload celebrity document
 * @param documentPath - Local file path to upload
 * @param userEmail - User email for authentication
 * @returns Promise with upload response
 */
export const uploadCelebrityDocument = async (
  documentPath: string,
  userEmail: string
): Promise<UploadCelebrityDocumentResponse> => {
  try {
    // Check if online - must be online to upload document
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection to upload document.');
    }

    // Get authentication token
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Create FormData for multipart/form-data
    const formData = new FormData();
    formData.append('document', {
      uri: documentPath,
      type: 'application/pdf',
      name: 'document.pdf',
    } as any);

    const response = await axios.post<UploadCelebrityDocumentResponse>(
      `${API_BASE_URL}/api/administrators/celebrities/upload-document`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Don't set Content-Type - axios will set it automatically with boundary
        },
        timeout: 120000, // 120 seconds for file upload
      }
    );

    if (!response.data.success || !response.data.documentUrl) {
      throw new Error('Failed to upload document: No URL returned from server');
    }

    return response.data;
  } catch (error: any) {
    logger.error('Failed to upload celebrity document', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities/upload-document`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    }, {
      hasResponse: !!error.response,
      hasRequest: !!error.request,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to upload celebrity document';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to upload celebrity document. Please try again.');
    }
  }
};

/**
 * Create celebrity
 * @param data - Celebrity data
 * @param userEmail - User email for authentication
 * @returns Promise with created celebrity
 */
export const createCelebrity = async (
  data: CreateCelebrityRequest,
  userEmail: string
): Promise<Celebrity> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post<Celebrity>(
      `${API_BASE_URL}/api/administrators/celebrities`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to create celebrity', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to create celebrity';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to create celebrity. Please try again.');
    }
  }
};

/**
 * Update celebrity
 * @param celebrityId - Celebrity ID
 * @param data - Celebrity update data
 * @param userEmail - User email for authentication
 * @returns Promise with updated celebrity
 */
export const updateCelebrity = async (
  celebrityId: number,
  data: UpdateCelebrityRequest,
  userEmail: string
): Promise<Celebrity> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.put<Celebrity>(
      `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to update celebrity', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      method: 'PUT',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to update celebrity';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to update celebrity. Please try again.');
    }
  }
};

/**
 * Get all celebrities
 * @param userEmail - User email for authentication
 * @returns Promise with list of celebrities
 */
export const getAllCelebrities = async (userEmail: string): Promise<Celebrity[]> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<Celebrity[]>(
      `${API_BASE_URL}/api/administrators/celebrities`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get celebrities', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get celebrities';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get celebrities. Please try again.');
    }
  }
};

/**
 * Get celebrity by ID
 * @param celebrityId - Celebrity ID
 * @param userEmail - User email for authentication
 * @returns Promise with celebrity
 */
export const getCelebrityById = async (celebrityId: number, userEmail: string): Promise<Celebrity> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<Celebrity>(
      `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get celebrity', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get celebrity';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get celebrity. Please try again.');
    }
  }
};

/**
 * Delete celebrity
 * @param celebrityId - Celebrity ID
 * @param userEmail - User email for authentication
 * @returns Promise<void>
 */
export const deleteCelebrity = async (celebrityId: number, userEmail: string): Promise<void> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    await axios.delete(
      `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    logger.error('Failed to delete celebrity', error, {
      url: `${API_BASE_URL}/api/administrators/celebrities/${celebrityId}`,
      method: 'DELETE',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to delete celebrity';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to delete celebrity. Please try again.');
    }
  }
};

