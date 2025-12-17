import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { getJWTToken } from '../auth/login-service';
import { networkService } from '../network/network-service';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

// News API Types
export interface News {
  id?: number;
  title: string;
  content?: string;
  publishedDate?: string;
  category?: string;
  author?: string;
  documentUrl?: string;
  documentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadNewsDocumentResponse {
  success: boolean;
  message: string;
  documentUrl: string;
  documentName?: string;
}

export interface CreateNewsRequest {
  title: string;
  content?: string;
  publishedDate?: string;
  category?: string;
  author?: string;
  documentUrl?: string;
}

export interface UpdateNewsRequest {
  title?: string;
  content?: string;
  publishedDate?: string;
  category?: string;
  author?: string;
  documentUrl?: string;
}

/**
 * Upload news document
 * @param documentPath - Local file path to upload
 * @param userEmail - User email for authentication
 * @returns Promise with upload response
 */
export const uploadNewsDocument = async (
  documentPath: string,
  userEmail: string
): Promise<UploadNewsDocumentResponse> => {
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

    const response = await axios.post<UploadNewsDocumentResponse>(
      `${API_BASE_URL}/api/administrators/news/upload-document`,
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
    logger.error('Failed to upload news document', error, {
      url: `${API_BASE_URL}/api/administrators/news/upload-document`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    }, {
      hasResponse: !!error.response,
      hasRequest: !!error.request,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to upload news document';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to upload news document. Please try again.');
    }
  }
};

/**
 * Create news
 * @param data - News data
 * @param userEmail - User email for authentication
 * @returns Promise with created news
 */
export const createNews = async (
  data: CreateNewsRequest,
  userEmail: string
): Promise<News> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post<News>(
      `${API_BASE_URL}/api/administrators/news`,
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
    logger.error('Failed to create news', error, {
      url: `${API_BASE_URL}/api/administrators/news`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to create news';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to create news. Please try again.');
    }
  }
};

/**
 * Update news
 * @param newsId - News ID
 * @param data - News update data
 * @param userEmail - User email for authentication
 * @returns Promise with updated news
 */
export const updateNews = async (
  newsId: number,
  data: UpdateNewsRequest,
  userEmail: string
): Promise<News> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.put<News>(
      `${API_BASE_URL}/api/administrators/news/${newsId}`,
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
    logger.error('Failed to update news', error, {
      url: `${API_BASE_URL}/api/administrators/news/${newsId}`,
      method: 'PUT',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to update news';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to update news. Please try again.');
    }
  }
};

/**
 * Get all news
 * @param userEmail - User email for authentication
 * @returns Promise with list of news
 */
export const getAllNews = async (userEmail: string): Promise<News[]> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<News[]>(
      `${API_BASE_URL}/api/administrators/news`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get news', error, {
      url: `${API_BASE_URL}/api/administrators/news`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get news';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get news. Please try again.');
    }
  }
};

/**
 * Get news by ID
 * @param newsId - News ID
 * @param userEmail - User email for authentication
 * @returns Promise with news
 */
export const getNewsById = async (newsId: number, userEmail: string): Promise<News> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<News>(
      `${API_BASE_URL}/api/administrators/news/${newsId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get news', error, {
      url: `${API_BASE_URL}/api/administrators/news/${newsId}`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get news';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get news. Please try again.');
    }
  }
};

/**
 * Delete news
 * @param newsId - News ID
 * @param userEmail - User email for authentication
 * @returns Promise<void>
 */
export const deleteNews = async (newsId: number, userEmail: string): Promise<void> => {
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
      `${API_BASE_URL}/api/administrators/news/${newsId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    logger.error('Failed to delete news', error, {
      url: `${API_BASE_URL}/api/administrators/news/${newsId}`,
      method: 'DELETE',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to delete news';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to delete news. Please try again.');
    }
  }
};

