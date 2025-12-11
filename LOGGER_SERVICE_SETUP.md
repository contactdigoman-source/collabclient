# ✅ Logger Service Setup Complete

## Overview

A comprehensive logging service has been created to track all service failures with proper structure, correlation IDs, and automatic context capture.

## ✅ What Was Created

### 1. Core Logger Service
- **`src/services/logger/logger-service.ts`** - Main logging service
- **`src/services/logger/logger-types.ts`** - Type definitions
- **`src/services/logger/index.ts`** - Exports
- **`src/services/logger/README.md`** - Documentation
- **`src/services/logger/USAGE_EXAMPLES.md`** - Usage examples

### 2. Redux Integration
- **Updated `src/redux/types/appTypes.ts`** - Added `correlationId` to AppState
- **Updated `src/redux/reducers/appReducer.ts`** - Added actions for correlation ID management
  - `setCorrelationId(payload: string)` - Set correlation ID
  - `resetCorrelationId()` - Reset correlation ID

### 3. Service Integrations
- ✅ **`src/services/auth/login-service.ts`** - Integrated error logging
- ✅ **`src/services/aadhaar/otp-service.ts`** - Integrated error logging

### 4. App Initialization
- **Updated `App.tsx`** - Initializes correlation ID on app startup

### 5. WireMock API Mapping
- **`webel-new/wiremock/mappings/logs-create.json`** - WireMock stub for POST /api/logs

## 🔑 Key Features

### Correlation ID
- ✅ Unique ID per user session stored in Redux
- ✅ Automatically generated on first use
- ✅ Persists across app restarts (via Redux Persist)
- ✅ Resets on logout for new session tracking

### Structured Logging
- ✅ Consistent log format with all context
- ✅ Automatic error categorization (NETWORK, AUTHENTICATION, etc.)
- ✅ File name and method name tracking
- ✅ User and device info automatically included

### API Integration
- ✅ ERROR and FATAL logs sent to `POST /api/logs`
- ✅ Non-blocking async logging (won't crash app if API fails)
- ✅ Console logging for all levels (for debugging)

## 📋 Log Entry Structure

```typescript
{
  correlationId: "corr-xxx-xxx-xxx",    // Unique session ID
  timestamp: "2024-01-15T10:30:00.000Z", // ISO 8601
  level: "ERROR",                        // DEBUG|INFO|WARN|ERROR|FATAL
  category: "NETWORK",                   // Auto-determined
  service: "auth",                       // Service name
  fileName: "login-service.ts",          // Source file
  methodName: "loginUser",               // Method name
  message: "Login failed",               // Error message
  error: {                               // Error details
    name: "AxiosError",
    message: "Network Error",
    stack: "..."
  },
  request: {                             // Request context
    url: "/api/auth/login",
    method: "POST",
    statusCode: 500
  },
  user: {                                // User info (if logged in)
    id: 1,
    email: "user@example.com"
  },
  device: {                              // Device info
    platform: "ios",
    version: "17.0"
  },
  metadata: {                            // Custom data
    customField: "value"
  }
}
```

## 🚀 Quick Usage

### Log Service Error (Recommended)

```typescript
import { logServiceError } from '../logger';

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
        statusCode: error.response?.status,
      },
      metadata: { email: 'user@example.com' },
    }
  );
  throw error;
}
```

### Use Logger Directly

```typescript
import { logger } from '../logger';

logger.error(
  'service-name',
  'file-name.ts',
  'methodName',
  'Error message',
  error,
  requestContext,
  metadata
);
```

### Get/Reset Correlation ID

```typescript
import { getCorrelationId, resetCorrelationId } from '../logger';

const correlationId = getCorrelationId();
resetCorrelationId(); // On logout
```

## 🔧 Error Categories

Errors are automatically categorized:
- **NETWORK** - Network errors, timeouts
- **AUTHENTICATION** - 401, 403 responses
- **VALIDATION** - 400, 422 responses
- **API** - Other API errors (500, 503, etc.)
- **STORAGE** - Keychain, SQLite errors
- **UNKNOWN** - Other errors

## 📡 API Endpoint

- **URL:** `POST /api/logs`
- **WireMock:** Available at `http://localhost:8080/api/logs`
- **Only ERROR and FATAL logs are sent to API**
- **Non-blocking** - failures won't crash the app

## ✅ Services Already Integrated

1. ✅ `auth/login-service.ts`
   - `loginUser` - Login errors
   - `storeJWTToken` - Token storage errors
   - `getJWTToken` - Token retrieval errors
   - `logoutUser` - Logout errors

2. ✅ `aadhaar/otp-service.ts`
   - `requestAadhaarOTP` - OTP request errors
   - `verifyAadhaarOTP` - OTP verification errors

## 🔄 Next Steps - Integrate in Other Services

You can integrate the logger in any service by:

1. Import the logger:
   ```typescript
   import { logServiceError } from '../logger';
   ```

2. Wrap error handlers:
   ```typescript
   catch (error) {
     logServiceError('service-name', 'file.ts', 'method', error, context);
     throw error;
   }
   ```

## 📚 Documentation

- **`src/services/logger/README.md`** - Complete API documentation
- **`src/services/logger/USAGE_EXAMPLES.md`** - Usage examples

## ✨ Benefits

1. ✅ **Centralized Logging** - All errors logged consistently
2. ✅ **Correlation Tracking** - Track user-specific issues with correlation ID
3. ✅ **Rich Context** - Automatic capture of file, method, user, device info
4. ✅ **Error Categorization** - Automatic error type detection
5. ✅ **API Integration** - Errors sent to backend for analysis
6. ✅ **Non-Blocking** - Won't affect app performance or stability
7. ✅ **Easy Integration** - Simple API for all services

## 🎯 Testing

Test the logger by:
1. Triggering an error in a service
2. Check console for log output
3. Check WireMock logs endpoint (if ERROR/FATAL)
4. Verify correlation ID in Redux store

All set! 🎉

