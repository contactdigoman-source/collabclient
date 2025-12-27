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
    
    // Find the first stack line that contains our source code (not node_modules or React internals)
    // Skip: Error message (line 0), getCallingContext (line 1), logger method (line 2-3)
    // Look for lines with our source files
    let callerLine = '';
    let callerIndex = -1;
    
    for (let i = 2; i < Math.min(stackLines.length, 15); i++) {
      const line = stackLines[i];
      // Skip React internals, node_modules, and logger internals
      if (line && 
          !line.includes('node_modules') && 
          !line.includes('logger-service') &&
          !line.includes('getCallingContext') &&
          !line.includes('logEntry') &&
          !line.includes('logger.debug') &&
          !line.includes('logger.info') &&
          !line.includes('logger.warn') &&
          !line.includes('logger.error') &&
          !line.includes('logger.fatal') &&
          (line.includes('services/') || line.includes('screens/') || line.includes('components/') || line.includes('utils/'))) {
        callerLine = line;
        callerIndex = i;
        break;
      }
    }
    
    // If we found a caller line, try to get more context from surrounding lines
    // Sometimes the actual function name is in the previous line
    if (callerLine && callerIndex > 2) {
      // Check previous line for function name context
      const prevLine = stackLines[callerIndex - 1];
      if (prevLine && (prevLine.includes('at ') || prevLine.includes('Object.'))) {
        // Use previous line if it has better context
        if (prevLine.includes('services/') || prevLine.includes('screens/') || prevLine.includes('components/') || prevLine.includes('utils/')) {
          callerLine = prevLine;
        }
      }
    }
    
    if (!callerLine) {
      // Fallback to first non-internal line
      callerLine = stackLines[3] || stackLines[2] || '';
    }
    
    // Extract service name from file path (e.g., /services/auth/login-service.ts -> auth)
    // Also check for screens/, components/, and utils/
    let service = 'unknown';
    const serviceMatch = callerLine.match(/(?:services|screens|components|utils)\/([^/]+)\//);
    if (serviceMatch) {
      service = serviceMatch[1];
    } else {
      // Try to extract from full path (e.g., src/services/location/location-service.ts)
      const pathMatch = callerLine.match(/(?:src\/)?(?:services|screens|components|utils)\/([^/]+)\//);
      if (pathMatch) {
        service = pathMatch[1];
      } else {
        // Try alternative: look for any directory before the file
        const altPathMatch = callerLine.match(/([^/\\]+)\/([^/\\]+\.(ts|tsx|js|jsx))/);
        if (altPathMatch && !altPathMatch[1].includes('node_modules')) {
          service = altPathMatch[1];
        }
      }
    }
    
    // Extract file name (e.g., login-service.ts or device-registration-service.ts)
    // Try multiple patterns to catch different formats
    let fileName = 'unknown';
    const fileMatch = callerLine.match(/([^/\\]+\.(ts|tsx|js|jsx))(?::\d+)?/);
    if (fileMatch) {
      fileName = fileMatch[1];
    } else {
      // Try pattern with path
      const pathFileMatch = callerLine.match(/([^/\\]+\.(ts|tsx|js|jsx))(?:\?|:)/);
      if (pathFileMatch) {
        fileName = pathFileMatch[1];
      }
    }
    
    // Extract method name (e.g., at registerDevice, at Object.registerDevice, at async registerDevice)
    // Handle anonymous functions, arrow functions, and async functions
    let methodName = 'unknown';
    
    // Try to extract from the caller line itself
    const methodMatch = callerLine.match(/at\s+(?:async\s+)?(?:Object\.)?(\w+)/);
    if (methodMatch && methodMatch[1] !== 'anonymous' && methodMatch[1] !== 'anon') {
      methodName = methodMatch[1];
    } else {
      // Try alternative patterns for arrow functions and anonymous functions
      const arrowMatch = callerLine.match(/(\w+)\s*=>/);
      if (arrowMatch) {
        methodName = arrowMatch[1];
      } else {
        // Try to extract from function call pattern
        const funcMatch = callerLine.match(/(\w+)\s*\(/);
        if (funcMatch && funcMatch[1] !== 'at' && funcMatch[1] !== 'Object') {
          methodName = funcMatch[1];
        } else {
          // For anonymous functions, try to get context from surrounding lines
          if (callerIndex > 2) {
            const contextLine = stackLines[callerIndex - 1];
            if (contextLine) {
              const contextMatch = contextLine.match(/(?:at\s+)?(?:async\s+)?(?:Object\.)?(\w+)/);
              if (contextMatch && contextMatch[1] !== 'anonymous' && contextMatch[1] !== 'anon') {
                methodName = contextMatch[1];
              }
            }
          }
          
          // If still unknown and we have a file name, try to infer from file name
          if (methodName === 'unknown' && fileName !== 'unknown') {
            // Remove extension and use file name as method name hint
            const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
            // Convert kebab-case to camelCase for method names
            methodName = baseName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          }
        }
      }
    }
    
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
 * Uses raw axios to avoid circular dependency with api-client (which uses logger)
 */
const sendLogToAPI = async (entry: LogEntry): Promise<void> => {
  try {
    // Use raw axios here to avoid circular dependency
    // api-client uses logger, and logger uses api-client would create a circular dependency
    // This is a low-risk endpoint that doesn't need interceptors
    const axios = require('axios').default;
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
 * Send log entry to logging API (public function for external use)
 * This can be called from services that need to log to the API
 */
export const sendLogToLoggerAPI = async (entry: LogEntry): Promise<void> => {
  return sendLogToAPI(entry);
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
  
  // Send to API for ERROR and FATAL levels
  if (params.level === LogLevel.ERROR || params.level === LogLevel.FATAL) {
    // Don't await - send async to not block execution
    sendLogToAPI(entry).catch(() => {
      // Silently handle API logging failures
    });
  }
};

/**
 * Convenience methods for different log levels
 * These methods automatically extract calling context from stack trace
 * 
 * For better context in logs, you can also pass a context object as the second parameter:
 * logger.debug('Message', { _context: { service: 'location', fileName: 'location-service.ts', methodName: 'getLocationFromLatLon' }, ...otherMetadata })
 */
export const logger = {
  /**
   * Log debug message
   * Usage: logger.debug('Debug message', { key: 'value' })
   * Or with explicit context: logger.debug('Debug message', { _context: { service: 'location', fileName: 'location-service.ts', methodName: 'getLocationFromLatLon' }, ...otherMetadata })
   */
  debug: (message: string, metadata?: Record<string, any>) => {
    // Check if explicit context is provided
    let context = getCallingContext();
    let finalMetadata = metadata;
    if (metadata?._context) {
      context = { ...context, ...metadata._context };
      // Remove _context from metadata before logging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _context, ...restMetadata } = metadata;
      finalMetadata = restMetadata;
    }
    return logEntry({
      level: LogLevel.DEBUG,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      metadata: finalMetadata,
    });
  },
  
  /**
   * Log info message
   * Usage: logger.info('Info message', { key: 'value' })
   * Or with explicit context: logger.info('Info message', { _context: { service: 'location', fileName: 'location-service.ts', methodName: 'getLocationFromLatLon' }, ...otherMetadata })
   */
  info: (message: string, metadata?: Record<string, any>) => {
    // Check if explicit context is provided
    let context = getCallingContext();
    let finalMetadata = metadata;
    if (metadata?._context) {
      context = { ...context, ...metadata._context };
      // Remove _context from metadata before logging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _context, ...restMetadata } = metadata;
      finalMetadata = restMetadata;
    }
    return logEntry({
      level: LogLevel.INFO,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      metadata: finalMetadata,
    });
  },
  
  /**
   * Log warning message
   * Usage: logger.warn('Warning message', error, { key: 'value' })
   * Or with explicit context: logger.warn('Warning message', error, { _context: { service: 'location', fileName: 'location-service.ts', methodName: 'getLocationFromLatLon' }, ...otherMetadata })
   * If error is provided, automatically determines it's a warning and logs internally
   */
  warn: (message: string, error?: Error | any, metadata?: Record<string, any>) => {
    // Check if explicit context is provided
    let context = getCallingContext();
    let finalMetadata = metadata;
    if (metadata?._context) {
      context = { ...context, ...metadata._context };
      // Remove _context from metadata before logging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _context, ...restMetadata } = metadata;
      finalMetadata = restMetadata;
    }
    return logEntry({
      level: LogLevel.WARN,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      metadata: finalMetadata,
    });
  },
  
  /**
   * Log error message
   * Usage: logger.error('Error message', error, request, { key: 'value' })
   * Or with explicit context: logger.error('Error message', error, request, { _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' }, ...otherMetadata })
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
    // Check if explicit context is provided
    let context = getCallingContext();
    let finalMetadata = metadata;
    if (metadata?._context) {
      context = { ...context, ...metadata._context };
      // Remove _context from metadata before logging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _context, ...restMetadata } = metadata;
      finalMetadata = restMetadata;
    }
    return logEntry({
      level: LogLevel.ERROR,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      request,
      metadata: finalMetadata,
    });
  },
  
  /**
   * Log fatal error message
   * Usage: logger.fatal('Fatal error message', error, request, { key: 'value' })
   * Or with explicit context: logger.fatal('Fatal error message', error, request, { _context: { service: 'api', fileName: 'api-client.ts', methodName: 'requestInterceptor' }, ...otherMetadata })
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
    // Check if explicit context is provided
    let context = getCallingContext();
    let finalMetadata = metadata;
    if (metadata?._context) {
      context = { ...context, ...metadata._context };
      // Remove _context from metadata before logging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _context, ...restMetadata } = metadata;
      finalMetadata = restMetadata;
    }
    return logEntry({
      level: LogLevel.FATAL,
      service: context.service,
      fileName: context.fileName,
      methodName: context.methodName,
      message,
      error,
      request,
      metadata: finalMetadata,
    });
  },
};
