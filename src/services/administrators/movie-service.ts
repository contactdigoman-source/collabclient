import axios from 'axios';
import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { getJWTToken } from '../auth/login-service';
import { networkService } from '../network/network-service';

// FormData is available globally in React Native
declare const FormData: any;

const API_BASE_URL = Configs.apiBaseUrl;

// Movie API Types
export interface Movie {
  id?: number;
  title: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  rating?: number;
  documentUrl?: string;
  documentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadMovieDocumentResponse {
  success: boolean;
  message: string;
  documentUrl: string;
  documentName?: string;
}

export interface CreateMovieRequest {
  title: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  rating?: number;
  documentUrl?: string;
}

export interface UpdateMovieRequest {
  title?: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  rating?: number;
  documentUrl?: string;
}

/**
 * Upload movie document
 * @param documentPath - Local file path to upload
 * @param userEmail - User email for authentication
 * @returns Promise with upload response
 */
export const uploadMovieDocument = async (
  documentPath: string,
  userEmail: string
): Promise<UploadMovieDocumentResponse> => {
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

    const response = await axios.post<UploadMovieDocumentResponse>(
      `${API_BASE_URL}/api/administrators/movie/upload-document`,
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
    logger.error('Failed to upload movie document', error, {
      url: `${API_BASE_URL}/api/administrators/movie/upload-document`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    }, {
      hasResponse: !!error.response,
      hasRequest: !!error.request,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to upload movie document';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to upload movie document. Please try again.');
    }
  }
};

/**
 * Create movie
 * @param data - Movie data
 * @param userEmail - User email for authentication
 * @returns Promise with created movie
 */
export const createMovie = async (
  data: CreateMovieRequest,
  userEmail: string
): Promise<Movie> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post<Movie>(
      `${API_BASE_URL}/api/administrators/movie`,
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
    logger.error('Failed to create movie', error, {
      url: `${API_BASE_URL}/api/administrators/movie`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to create movie';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to create movie. Please try again.');
    }
  }
};

/**
 * Update movie
 * @param movieId - Movie ID
 * @param data - Movie update data
 * @param userEmail - User email for authentication
 * @returns Promise with updated movie
 */
export const updateMovie = async (
  movieId: number,
  data: UpdateMovieRequest,
  userEmail: string
): Promise<Movie> => {
  try {
    const isOnline = await networkService.isConnected();
    if (!isOnline) {
      throw new Error('Network error. Please check your internet connection.');
    }

    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.put<Movie>(
      `${API_BASE_URL}/api/administrators/movie/${movieId}`,
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
    logger.error('Failed to update movie', error, {
      url: `${API_BASE_URL}/api/administrators/movie/${movieId}`,
      method: 'PUT',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to update movie';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to update movie. Please try again.');
    }
  }
};

/**
 * Get all movies
 * @param userEmail - User email for authentication
 * @returns Promise with list of movies
 */
export const getAllMovies = async (userEmail: string): Promise<Movie[]> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<Movie[]>(
      `${API_BASE_URL}/api/administrators/movie`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get movies', error, {
      url: `${API_BASE_URL}/api/administrators/movie`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get movies';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get movies. Please try again.');
    }
  }
};

/**
 * Get movie by ID
 * @param movieId - Movie ID
 * @param userEmail - User email for authentication
 * @returns Promise with movie
 */
export const getMovieById = async (movieId: number, userEmail: string): Promise<Movie> => {
  try {
    const token = await getJWTToken(userEmail);
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get<Movie>(
      `${API_BASE_URL}/api/administrators/movie/${movieId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get movie', error, {
      url: `${API_BASE_URL}/api/administrators/movie/${movieId}`,
      method: 'GET',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to get movie';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to get movie. Please try again.');
    }
  }
};

/**
 * Delete movie
 * @param movieId - Movie ID
 * @param userEmail - User email for authentication
 * @returns Promise<void>
 */
export const deleteMovie = async (movieId: number, userEmail: string): Promise<void> => {
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
      `${API_BASE_URL}/api/administrators/movie/${movieId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    logger.error('Failed to delete movie', error, {
      url: `${API_BASE_URL}/api/administrators/movie/${movieId}`,
      method: 'DELETE',
      statusCode: error.response?.status,
    });

    if (error.response) {
      const errorMessage = error.response.data?.message || 'Failed to delete movie';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error('Failed to delete movie. Please try again.');
    }
  }
};

