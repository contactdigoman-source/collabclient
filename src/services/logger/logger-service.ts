import axios from 'axios';
import { Platform } from 'react-native';
import { Configs } from '../../constants/configs';
import { store } from '../../redux';
import { LogLevel, ErrorCategory, LogEntry } from './logger-types';

const API_BASE_URL = Configs.apiBaseUrl;

// Re-export types for convenience
export type { LogLevel, ErrorCategory, LogEntry } from './logger-types';

/**
 * Get correlation ID from Redux store
 * Creates a new one if it doesn't exist
 */
export const getCorrelationId = (): string => {
  const state = store.getState();
  let correlationId = state.appState?.correlationId;
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
    // Import action dynamically to avoid circular dependency issues
    try {
      const { setCorrelationId } = require('../../redux/reducers/appReducer');
      store.dispatch(setCorrelationId(correlationId));
    } catch (error) {
      // Fallback if action not available yet (during initial load)
      store.dispatch({ type: 'appState/setCorrelationId', payload: correlationId });
    }
  }
  
  return correlationId;
};

/**
 * Generate a new correlation ID
 */
export const generateCorrelationId = (): string => {
  // Generate a UUID-like string: timestamp + random string
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  
  // Format: corr-{timestamp}-{random1}-{random2}
  return `corr-${timestamp}-${randomPart}-${randomPart2}`;
};

/**
 * Reset correlation ID (useful for new user sessions)
 */
export const resetCorrelationId = (): void => {
  const newCorrelationId = generateCorrelationId();
  try {
    const { setCorrelationId } = require('../../redux/reducers/appReducer');
    store.dispatch(setCorrelationId(newCorrelationId));
  } catch (error) {
    store.dispatch({ type: 'appState/setCorrelationId', payload: newCorrelationId });
  }
};

/**
 * Get current user info from Redux store
 */
const getCurrentUser = (): { id?: number; email?: string } => {
  const state = store.getState();
  const userData = state.userState?.userData;
  
  return {
    id: userData?.id as number | undefined,
    email: userData?.email,
  };
};

/**
 * Get device information
 */
const getDeviceInfo = (): { platform?: string; version?: string } => {
  try {
    return {
      platform: Platform.OS,
      version: Platform.Version?.toString(),
    };
  } catch {
    return {};
  }
};

/**
 * Extract calling context from stack trace
 * Returns { service, fileName, methodName } from the caller
 */
const getCallingContext = (): { service: string; fileName: string; methodName: string } => {
  try {
    const stack = new Error().stack;
    if (!stack) {
      return { service: 'unknown', fileName: 'unknown', methodName: 'unknown' };
    }

    const stackLines = stack.split('\n');
    
    // Skip the first line (Error message) and the second line (this function)
    // The third line should be the logger method (info/warn/error)
    // The fourth line should be the actual caller
    let callerLine = stackLines[3] || stackLines[2] || '';
    
    
    // Extract service name from file path (e.g., /services/auth/login-service.ts -> auth)
    const serviceMatch = callerLine.match(/services\/([^/]+)\//);
    const service = serviceMatch ? serviceMatch[1] : 'unknown';
    
    // Extract file name (e.g., login-service.ts)
    const fileMatch = callerLine.match(/([^/\\]+\.(ts|tsx|js|jsx))(?::\d+)?/);
    const fileName = fileMatch ? fileMatch[1] : 'unknown';
    
    // Extract method name (e.g., at loginUser or at Object.loginUser)
    const methodMatch = callerLine.match(/at\s+(?:Object\.)?(\w+)/);
    const methodName = methodMatch ? methodMatch[1] : 'unknown';
    
    return { service, fileName, methodName };
  } catch (error) {
    return { service: 'unknown', fileName: 'unknown', methodName: 'unknown' };
  }
};

/**
 * Extract file name from stack trace or error (for backward compatibility)
 */
const extractFileName = (error?: Error, caller?: string): string => {
  if (caller) {
    const match = caller.match(/([^/\\]+\.(ts|tsx|js|jsx)):/);
    if (match) return match[1];
  }
  
  if (error?.stack) {
    const stackLines = error.stack.split('\n');
    for (const line of stackLines) {
      const match = line.match(/([^/\\]+\.(ts|tsx|js|jsx))/);
      if (match) return match[1];
    }
  }
  
  return 'unknown';
};

/**
 * Extract method name from stack trace or caller (for backward compatibility)
 */
const extractMethodName = (error?: Error, caller?: string, methodName?: string): string => {
  if (methodName) return methodName;
  
  if (caller) {
    const match = caller.match(/at\s+(\w+)/);
    if (match) return match[1];
  }
  
  if (error?.stack) {
    const stackLines = error.stack.split('\n');
    for (const line of stackLines) {
      const match = line.match(/at\s+(\w+)/);
      if (match) return match[1];
    }
  }
  
  return 'unknown';
};

/**
 * Determine error category from error type
 */
const determineErrorCategory = (error: any): ErrorCategory => {
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
    return ErrorCategory.NETWORK;
  }
  
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  if (error?.response?.status === 400 || error?.response?.status === 422) {
    return ErrorCategory.VALIDATION;
  }
  
  if (error?.response) {
    return ErrorCategory.API;
  }
  
  if (error?.message?.includes('storage') || error?.message?.includes('Keychain')) {
    return ErrorCategory.STORAGE;
  }
  
  return ErrorCategory.UNKNOWN;
};

/**
 * Log entry to console (only in dev mode)
 */
const logToConsole = (entry: LogEntry): void => {
  // Only log to console in dev mode
  if (!__DEV__) {
    return;
  }

  const logMessage = `[${entry.level}] [${entry.category}] ${entry.service}/${entry.fileName}:${entry.methodName} - ${entry.message}`;
  
  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(logMessage, entry);
      break;
    case LogLevel.INFO:
      console.log(logMessage, entry);
      break;
    case LogLevel.WARN:
      console.warn(logMessage, entry);
      break;
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(logMessage, entry);
      break;
  }
};

/**
 * Send log entry to logging API
 */
const sendLogToAPI = async (entry: LogEntry): Promise<void> => {
  try {
    await axios.post(
      `${API_BASE_URL}/api/logs`,
      entry,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 seconds timeout - don't block if logging fails
      }
    );
  } catch (error) {
    // Silently fail - we don't want logging failures to crash the app
    // But log to console as fallback
    console.error('Failed to send log to API:', error);
  }
};

/**
 * Main logging function
 */
export const logEntry = async (params: {
  level: LogLevel;
  service: string;
  fileName: string;
  methodName: string;
  message: string;
  error?: Error | any;
  request?: {
    url?: string;
    method?: string;
    statusCode?: number;
    requestBody?: any;
    responseBody?: any;
  };
  metadata?: Record<string, any>;
}): Promise<void> => {
  const correlationId = getCorrelationId();
  const user = getCurrentUser();
  const device = getDeviceInfo();
  
  const error = params.error;
  const category = error ? determineErrorCategory(error) : ErrorCategory.UNKNOWN;
  
  // Extract error details if available
  const errorDetails = error
    ? {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack,
      }
    : undefined;
  
  const entry: LogEntry = {
    correlationId,
    timestamp: new Date().toISOString(),
    level: params.level,
    category,
    service: params.service,
    fileName: params.fileName || extractFileName(error),
    methodName: params.methodName || extractMethodName(error),
    message: params.message,
    error: errorDetails,
    request: params.request,
    user: Object.keys(user).length > 0 ? user : undefined,
    device: Object.keys(device).length > 0 ? device : undefined,
    metadata: params.metadata,
  };
  
  // Always log to console (only in dev mode)
  logToConsole(entry);
  
  // Send to API only for FATAL level
  if (params.level === LogLevel.FATAL) {
    // Don't await - send async to not block execution
    sendLogToAPI(entry).catch(() => {
      // Silently handle API logging failures
    });
  }
};

/**
 * Convenience methods for different log levels
 * These methods automatically extract calling context from stack trace
 */
export const logger = {
  /**
   * Log debug message
   * Usage: logger.debug('Debug message', { key: 'value' })
   */
  debug: (message: string, metadata?: Record<string, any>) => {
    const context = getCallingContext();
    return logEntry({
      level: LogLevel.DEBUG,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      metadata,
    });
  },
  
  /**
   * Log info message
   * Usage: logger.info('Info message', { key: 'value' })
   */
  info: (message: string, metadata?: Record<string, any>) => {
    const context = getCallingContext();
    return logEntry({
      level: LogLevel.INFO,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      metadata,
    });
  },
  
  /**
   * Log warning message
   * Usage: logger.warn('Warning message', error, { key: 'value' })
   * If error is provided, automatically determines it's a warning and logs internally
   */
  warn: (message: string, error?: Error | any, metadata?: Record<string, any>) => {
    const context = getCallingContext();
    return logEntry({
      level: LogLevel.WARN,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      metadata,
    });
  },
  
  /**
   * Log error message
   * Usage: logger.error('Error message', error, request, { key: 'value' })
   * If error is provided, automatically determines it's an error and logs internally
   */
  error: (
    message: string,
    error?: Error | any,
    request?: {
      url?: string;
      method?: string;
      statusCode?: number;
      requestBody?: any;
      responseBody?: any;
    },
    metadata?: Record<string, any>
  ) => {
    const context = getCallingContext();
    return logEntry({
      level: LogLevel.ERROR,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      request,
      metadata,
    });
  },
  
  /**
   * Log fatal error message
   * Usage: logger.fatal('Fatal error message', error, request, { key: 'value' })
   * If error is provided, automatically determines it's fatal and logs internally
   * Fatal errors are always sent to the logging API service
   */
  fatal: (
    message: string,
    error?: Error | any,
    request?: {
      url?: string;
      method?: string;
      statusCode?: number;
      requestBody?: any;
      responseBody?: any;
    },
    metadata?: Record<string, any>
  ) => {
    const context = getCallingContext();
    return logEntry({
      level: LogLevel.FATAL,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      request,
      metadata,
    });
  },
};



