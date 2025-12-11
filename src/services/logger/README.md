# Logger Service

A comprehensive logging service for tracking errors and service failures across the application.

## Features

- ✅ **Correlation ID**: Unique ID for tracking user-specific operations
- ✅ **Structured Logging**: Consistent log format with metadata
- ✅ **Automatic Context**: Captures file name, method name, user info, device info
- ✅ **API Integration**: Sends ERROR and FATAL logs to backend API
- ✅ **Error Categories**: Automatically categorizes errors (NETWORK, AUTHENTICATION, etc.)
- ✅ **Redux Integration**: Stores correlation ID in Redux state

## Quick Start

### Basic Usage

```typescript
import { logger, logServiceError } from '../logger';

// Log an error with automatic context
try {
  // Your code
} catch (error) {
  logServiceError(
    'auth',
    'login-service.ts',
    'loginUser',
    error,
    {
      request: {
        url: '/api/auth/login',
        method: 'POST',
        statusCode: 500,
      },
      metadata: { email: 'user@example.com' },
    }
  );
}

// Or use logger directly
logger.error(
  'auth',
  'login-service.ts',
  'loginUser',
  'Login failed',
  error,
  {
    url: '/api/auth/login',
    method: 'POST',
  }
);
```

## API

### `logServiceError(service, fileName, methodName, error, context?)`

Convenience function to log service errors with automatic context extraction.

**Parameters:**
- `service`: Service name (e.g., 'auth', 'attendance', 'aadhaar')
- `fileName`: Source file name (e.g., 'login-service.ts')
- `methodName`: Method/function name (e.g., 'loginUser')
- `error`: Error object
- `context`: Optional context object
  - `request`: Request details (url, method, statusCode, etc.)
  - `metadata`: Additional metadata

**Example:**
```typescript
logServiceError(
  'auth',
  'login-service.ts',
  'loginUser',
  error,
  {
    request: {
      url: '/api/auth/login',
      method: 'POST',
      statusCode: 401,
    },
    metadata: { email: 'user@example.com' },
  }
);
```

### `logger.error(service, fileName, methodName, message, error?, request?, metadata?)`

Log an error message.

### `logger.fatal(service, fileName, methodName, message, error?, request?, metadata?)`

Log a fatal error (also sent to API).

### `logger.warn(service, fileName, methodName, message, error?, metadata?)`

Log a warning.

### `logger.info(service, fileName, methodName, message, metadata?)`

Log an info message.

### `logger.debug(service, fileName, methodName, message, metadata?)`

Log a debug message.

## Correlation ID

The correlation ID is automatically generated and stored in Redux. It's used to track all logs related to a specific user session or operation.

### Get Correlation ID

```typescript
import { getCorrelationId } from '../logger';

const correlationId = getCorrelationId();
```

### Reset Correlation ID

```typescript
import { resetCorrelationId } from '../logger';

// Useful when user logs in or session changes
resetCorrelationId();
```

## Log Entry Structure

```typescript
{
  correlationId: "corr-xxx-xxx-xxx",
  timestamp: "2024-01-15T10:30:00.000Z",
  level: "ERROR",
  category: "NETWORK",
  service: "auth",
  fileName: "login-service.ts",
  methodName: "loginUser",
  message: "Login failed",
  error: {
    name: "AxiosError",
    message: "Network Error",
    stack: "..."
  },
  request: {
    url: "/api/auth/login",
    method: "POST",
    statusCode: 500
  },
  user: {
    id: 1,
    email: "user@example.com"
  },
  device: {
    platform: "ios",
    version: "17.0"
  },
  metadata: {
    customField: "value"
  }
}
```

## Error Categories

Errors are automatically categorized:
- `NETWORK` - Network-related errors
- `AUTHENTICATION` - Auth errors (401, 403)
- `VALIDATION` - Validation errors (400, 422)
- `API` - API errors
- `STORAGE` - Storage/Keychain errors
- `UNKNOWN` - Other errors

## API Endpoint

Logs are sent to: `POST /api/logs`

Only ERROR and FATAL level logs are sent to the API. Other levels are logged to console only.

## Integration

The logger is automatically integrated into:
- ✅ `auth/login-service.ts`
- ✅ `aadhaar/otp-service.ts`
- ✅ More services can be integrated similarly

## Example Integration

```typescript
// Before
catch (error: any) {
  console.error('Service error:', error);
  throw error;
}

// After
catch (error: any) {
  logServiceError(
    'your-service',
    'your-service.ts',
    'yourMethod',
    error,
    {
      request: {
        url: apiUrl,
        method: 'POST',
        statusCode: error.response?.status,
      },
      metadata: { /* custom data */ },
    }
  );
  throw error;
}
```

