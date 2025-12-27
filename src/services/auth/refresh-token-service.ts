import { Configs } from '../../constants/configs';
import { logger } from '../logger';
import { getRefreshToken, storeJWTToken, getJWTToken } from './token-service';
import { store } from '../../redux';
import apiClient from '../api/api-client';

const API_BASE_URL = Configs.apiBaseUrl;

/**
 * Refresh Token Response from backend
 */
interface RefreshTokenResponse {
  token: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Refresh Token Request to backend
 */
interface RefreshTokenRequest {
  refreshToken: string;
  userId: number;
}

/**
 * Refresh the access token using the refresh token
 * @returns New access token and expiration time
 */
export const refreshAccessToken = async (): Promise<{ token: string; expiresAt: string }> => {
  try {
    const userData = store.getState().userState?.userData;
    if (!userData?.email || !userData?.id) {
      throw new Error('User data not found');
    }

    const refreshToken = await getRefreshToken(userData.email);
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const response = await apiClient.post<RefreshTokenResponse>(
      `/api/auth/refresh`,
      {
        refreshToken,
        userId: userData.id,
      } as RefreshTokenRequest,
      {
        timeout: 30000,
      }
    );

    // Store the new tokens
    if (response.data.token) {
      await storeJWTToken(
        response.data.token,
        userData.email,
        response.data.refreshToken
      );

      // Update Redux store with new token and expiration
      const { setJWTToken, setExpiresAt } = require('../../redux/reducers/userReducer');
      store.dispatch(setJWTToken(response.data.token));
      if (response.data.expiresAt) {
        store.dispatch(setExpiresAt(response.data.expiresAt));
      }

      logger.info('Access token refreshed successfully');
    }

    return {
      token: response.data.token,
      expiresAt: response.data.expiresAt,
    };
  } catch (error: any) {
    logger.error('Failed to refresh access token', error, {
      url: `${API_BASE_URL}/api/auth/refresh`,
      method: 'POST',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    });
    throw error;
  }
};

