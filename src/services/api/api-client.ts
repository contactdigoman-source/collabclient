import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Configs } from '../../constants/configs';
import { getJWTToken } from '../auth/token-service';
import { refreshAccessToken } from '../auth/refresh-token-service';
import { logoutUser } from '../auth/login-service';
import { store } from '../../redux';
import { logger, getCorrelationId } from '../logger';
import { navigationHelper } from '../navigation/navigation-helper';

/**
 * Create axios instance with base configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: Configs.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  maxContentLength: Infinity, // Allow large file uploads (e.g., images)
  maxBodyLength: Infinity, // Allow large request bodies
});

/**
 * List of endpoints that don't require authentication
 */
const NO_AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-saas',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/verify-otp',
  '/api/auth/resend-email-otp',
  '/api/auth/first-time-login',
  '/api/auth/refresh', // Refresh token endpoint doesn't require auth
  '/api/logs', // Logger API doesn't require auth (used for error logging)
];

/**
 * Check if an endpoint requires authentication
 */
const requiresAuth = (url: string | undefined): boolean => {
  if (!url) return true;
  return !NO_AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

/**
 * Sanitize headers for logging (remove sensitive data)
 */
const sanitizeHeaders = (headers: any): any => {
  const sanitized = { ...headers };
  if (sanitized.Authorization) {
    sanitized.Authorization = 'Bearer ***';
  }
  return sanitized;
};

/**
 * Sanitize request/response body for logging (remove sensitive data)
 */
const sanitizeBody = (body: any, url?: string): any => {
  if (!body) return body;
  
  // If it's FormData, return a placeholder
  if (body instanceof FormData) {
    return '[FormData]';
  }
  
  // If it's not an object, return as is
  if (typeof body !== 'object') {
    return body;
  }
  
  // Create a copy to avoid mutating original
  const sanitized = { ...body };
  
  // List of sensitive fields to mask
  const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'otp', 'otpValue', 'token', 'refreshToken', 'jwt', 'idpjourneyToken'];
  
  // Mask sensitive fields
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  });
  
  // Also check nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  });
  
  return sanitized;
};

/**
 * Request interceptor - runs before every request
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Skip auth for specific endpoints
      if (!requiresAuth(config.url)) {
        // Still add correlation ID
        if (config.headers) {
          config.headers['X-Correlation-ID'] = getCorrelationId();
        }

        // Build full URL
        const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;

        // Log request with URL, method, headers, and sanitized body
        logger.debug('API Request (no auth)', {
          _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' },
          method: config.method?.toUpperCase(),
          url: fullUrl,
          endpoint: config.url,
          headers: sanitizeHeaders(config.headers),
          data: sanitizeBody(config.data, config.url),
        });
        return config;
      }

      // Get user email and token info from Redux store
      const userState = store.getState().userState;
      const userData = userState?.userData;
      const expiresAt = userState?.expiresAt;
      const jwtToken = userState?.jwtToken;

      if (userData?.email && config.headers) {
        // Get JWT token from Keychain
        const token = await getJWTToken(userData.email);

        if (token) {
          // Add Authorization header
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // Add correlation ID header
      if (config.headers) {
        config.headers['X-Correlation-ID'] = getCorrelationId();
      }

      // Don't override Content-Type if it's FormData (let browser set it)
      if (config.data instanceof FormData && config.headers) {
        delete config.headers['Content-Type'];
      }

      // Build full URL
      const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;

      // Log request with URL, method, headers, sanitized body, and token info
      logger.debug('API Request', {
        _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' },
        method: config.method?.toUpperCase(),
        url: fullUrl,
        endpoint: config.url,
        headers: sanitizeHeaders(config.headers),
        data: sanitizeBody(config.data, config.url),
        tokenInfo: {
          expiresAt: expiresAt || null,
          hasJWT: !!jwtToken,
          email: userData?.email || null,
        },
      });

      return config;
    } catch (error) {
      logger.error('Error in request interceptor', error as Error, undefined, {
        _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' },
      });
      return Promise.reject(error);
    }
  },
  (error: AxiosError) => {
    // Handle request error
    logger.error('Request interceptor error', error, undefined, {
      _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' },
    });
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - runs after every response
 */
apiClient.interceptors.response.use(
  (response) => {
    // Build full URL
    const fullUrl = response.config.baseURL ? `${response.config.baseURL}${response.config.url}` : response.config.url;

    // Get token info from Redux store for logging
    const userState = store.getState().userState;
    const expiresAt = userState?.expiresAt;
    const jwtToken = userState?.jwtToken;

    // Log successful response with URL, status, headers, sanitized body, and token info
    logger.debug('API Response', {
      _context: { service: 'api', fileName: 'api-client.ts', methodName: 'responseInterceptor' },
      status: response.status,
      statusText: response.statusText,
      url: fullUrl,
      endpoint: response.config.url,
      headers: sanitizeHeaders(response.headers),
      data: sanitizeBody(response.data, response.config.url),
      tokenInfo: {
        expiresAt: expiresAt || null,
        hasJWT: !!jwtToken,
        email: userState?.userData?.email || null,
      },
    });

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Skip refresh for auth endpoints (login, register, etc.)
        if (!requiresAuth(originalRequest.url)) {
          return Promise.reject(error);
        }

        // 401 error detected - attempt token refresh

        // Attempt token refresh
        await refreshAccessToken();

        // Get new token and retry original request
        const userData = store.getState().userState?.userData;
        if (userData?.email && originalRequest.headers) {
          const newToken = await getJWTToken(userData.email);
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
        }

        // Token refreshed - retrying original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user and navigate to login
        logger.error('Token refresh failed - logging out user', refreshError, undefined, {
          _context: { service: 'api', fileName: 'api-client.ts', methodName: 'responseInterceptor' },
        });
        try {
          await logoutUser();
          // Emit navigation event to navigate to login screen
          navigationHelper.navigateToLogin();
        } catch (logoutError) {
          logger.error('Error during logout after refresh failure', logoutError, undefined, {
            _context: { service: 'api', fileName: 'api-client.ts', methodName: 'responseInterceptor' },
          });
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden - don't refresh, just reject (service will log if needed)
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    // Handle network errors - reject original error so service can detect it properly
    // Services will check error.request to determine if it's a network error
    // Don't wrap in new Error - preserve the AxiosError structure
    
    // Log error response with URL, status, and sanitized body
    const errorContext = { _context: { service: 'api', fileName: 'api-client.ts', methodName: 'responseInterceptor' } };
    if (error.response) {
      const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url;
      logger.error('API Error Response', error, {
        url: fullUrl,
        method: error.config?.method?.toUpperCase(),
        statusCode: error.response.status,
        requestBody: sanitizeBody(error.config?.data, error.config?.url),
        responseBody: sanitizeBody(error.response.data, error.config?.url),
      }, {
        ...errorContext,
        statusText: error.response.statusText,
        endpoint: error.config?.url,
        headers: sanitizeHeaders(error.response.headers),
      });
    } else if (error.request) {
      // Network error - log request details with more context
      const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url;
      
      // Extract network error details
      const networkErrorDetails: any = {
        url: fullUrl,
        method: error.config?.method?.toUpperCase(),
        endpoint: error.config?.url,
        requestBody: sanitizeBody(error.config?.data, error.config?.url),
        timeout: error.config?.timeout,
        baseURL: error.config?.baseURL,
      };
      
      // Add error message if available
      if (error.message) {
        networkErrorDetails.errorMessage = error.message;
      }
      
      // Add code if available (e.g., 'ECONNABORTED' for timeout, 'ERR_NETWORK' for network error)
      if (error.code) {
        networkErrorDetails.errorCode = error.code;
      }
      
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        networkErrorDetails.isTimeout = true;
        networkErrorDetails.timeoutMs = error.config?.timeout || 30000;
      }
      
      // Check if it's a network connectivity issue
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        networkErrorDetails.isNetworkError = true;
      }
      
      logger.error('API Network Error', error, networkErrorDetails, {
        ...errorContext,
        errorType: 'network',
        hasRequest: !!error.request,
        hasResponse: !!error.response,
        hasConfig: !!error.config,
      });
    } else {
      // Request setup error - log with more context
      const setupErrorDetails: any = {
        errorMessage: error.message,
        errorCode: error.code,
        errorName: error.name,
      };
      
      if (error.config) {
        setupErrorDetails.url = error.config.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config.url;
        setupErrorDetails.method = error.config.method?.toUpperCase();
        setupErrorDetails.endpoint = error.config.url;
      }
      
      logger.error('API Request Setup Error', error, setupErrorDetails, {
        ...errorContext,
        errorType: 'setup',
        hasRequest: !!error.request,
        hasResponse: !!error.response,
        hasConfig: !!error.config,
      });
    }
    
    // For all errors, just reject the original error
    // Services handle error message formatting with proper context
    return Promise.reject(error);
  }
);

export default apiClient;

