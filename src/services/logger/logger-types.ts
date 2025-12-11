/**
 * Type definitions for logger service
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export interface LogEntry {
  correlationId: string;
  timestamp: string;
  level: LogLevel;
  category: ErrorCategory;
  service: string;
  fileName: string;
  methodName: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  request?: {
    url?: string;
    method?: string;
    statusCode?: number;
    requestBody?: any;
    responseBody?: any;
  };
  user?: {
    id?: number;
    email?: string;
  };
  device?: {
    platform?: string;
    version?: string;
  };
  metadata?: Record<string, any>;
}

