import { logger, getCorrelationId } from '../logger';
import { store } from '../../redux';

/**
 * Global error handler for JavaScript errors
 * This catches errors that aren't caught by React Error Boundaries
 */
const globalErrorHandler = (error: Error, isFatal: boolean = false): void => {
  try {
    const correlationId = getCorrelationId();
    const state = store.getState();
    const userData = state.userState?.userData;

    // Log error with full context
    logger.error(
      isFatal ? 'Fatal JavaScript Error' : 'JavaScript Error',
      error,
      undefined, // request parameter - not needed for global JavaScript errors
      {
        isFatal,
        correlationId,
        userId: userData?.id,
        userEmail: userData?.email,
        errorType: 'javascript',
        stack: error.stack,
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString(),
      }
    );

    // In production, you might want to show a user-friendly error screen
    // For now, we just log it and let React Native handle it
    if (isFatal && __DEV__) {
      console.error('FATAL ERROR:', error);
    }
  } catch (loggingError) {
    // Fallback if logger itself fails
    console.error('Error in global error handler:', loggingError);
    console.error('Original error:', error);
  }
};

/**
 * Handle unhandled promise rejections
 * Note: Currently unused as React Native doesn't support unhandled promise rejection handlers
 * Kept for potential future use or if a library adds support
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unhandledRejectionHandler = (reason: any): void => {
  try {
    const correlationId = getCorrelationId();
    const state = store.getState();
    const userData = state.userState?.userData;

    // Convert reason to Error if it's not already
    const error = reason instanceof Error
      ? reason
      : new Error(String(reason));

    logger.error(
      'Unhandled Promise Rejection',
      error,
      undefined, // request parameter - not needed for promise rejections
      {
        correlationId,
        userId: userData?.id,
        userEmail: userData?.email,
        errorType: 'unhandled_promise_rejection',
        reason: typeof reason === 'object' ? JSON.stringify(reason) : String(reason),
        stack: error.stack,
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (loggingError) {
    console.error('Error in unhandled rejection handler:', loggingError);
    console.error('Original rejection:', reason);
  }
};

/**
 * Initialize global error handlers
 * Call this once when the app starts (in App.tsx)
 */
export const initializeGlobalErrorHandlers = (): void => {
  try {
    // Set global error handler for React Native
    // This catches JavaScript errors that aren't caught by try-catch
    // ErrorUtils is a global object in React Native, available as global.ErrorUtils
    const ErrorUtils = (typeof global !== 'undefined' ? (global as any).ErrorUtils : undefined);
    
    if (!ErrorUtils) {
      logger.warn('ErrorUtils not available, skipping global error handler initialization');
      return;
    }
    
    if (typeof ErrorUtils.getGlobalHandler !== 'function') {
      logger.warn('ErrorUtils.getGlobalHandler is not a function, skipping global error handler initialization');
      return;
    }
    
    const originalGlobalHandler = ErrorUtils.getGlobalHandler();
    
    if (typeof ErrorUtils.setGlobalHandler !== 'function') {
      logger.warn('ErrorUtils.setGlobalHandler is not a function, skipping global error handler initialization');
      return;
    }
    
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      // Call our custom handler
      globalErrorHandler(error, isFatal || false);
      
      // Call original handler to maintain default behavior
      if (originalGlobalHandler && typeof originalGlobalHandler === 'function') {
        originalGlobalHandler(error, isFatal);
      }
    });

    // Note: React Native doesn't have native support for unhandled promise rejections
    // Developers should use try-catch or .catch() on promises to handle errors
    // The global error handler will still catch errors that are thrown from promise callbacks

    logger.info('Global error handlers initialized');
  } catch (error) {
    // If initialization fails, log it but don't crash
    // Use console.error instead of logger to avoid circular dependencies
    console.error('Failed to initialize global error handlers:', error);
  }
};

/**
 * Capture and log console errors (for development)
 * Useful for catching console.error calls
 */
export const captureConsoleErrors = (): void => {
  if (!__DEV__) {
    return; // Only in development
  }

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      // Log to our logger
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      logger.error('Console Error', new Error(message), undefined, {
        errorType: 'console_error',
        originalArgs: args,
      });
    } catch (error) {
      // If logging fails, continue with original console.error
    }
    
    // Call original console.error
    originalConsoleError.apply(console, args);
  };
};

