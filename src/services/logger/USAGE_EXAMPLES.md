# Logger Service Usage Examples

## Basic Error Logging

```typescript
import { logServiceError } from '../logger';

try {
  // Your service code
  const response = await axios.post('/api/endpoint', data);
} catch (error) {
  logServiceError(
    'your-service',
    'your-service.ts',
    'yourMethod',
    error,
    {
      request: {
        url: '/api/endpoint',
        method: 'POST',
        statusCode: error.response?.status,
      },
      metadata: { customField: 'value' },
    }
  );
  throw error;
}
```

## Logging with Request Context

```typescript
import { logger } from '../logger';

try {
  const response = await axios.get('/api/user/profile');
  return response.data;
} catch (error: any) {
  logger.error(
    'profile',
    'profile-service.ts',
    'getUserProfile',
    'Failed to fetch user profile',
    error,
    {
      url: '/api/user/profile',
      method: 'GET',
      statusCode: error.response?.status,
      responseBody: error.response?.data,
    },
    {
      userId: 123,
    }
  );
  throw error;
}
```

## Logging Different Levels

```typescript
import { logger, LogLevel } from '../logger';

// Debug
logger.debug('auth', 'auth-service.ts', 'validateToken', 'Token validation started');

// Info
logger.info('attendance', 'attendance-service.ts', 'punchIn', 'User punched in successfully', {
  userId: 1,
  timestamp: Date.now(),
});

// Warning
logger.warn('location', 'location-service.ts', 'getLocation', 'Location accuracy is low', error);

// Error (sent to API)
logger.error('auth', 'auth-service.ts', 'login', 'Login failed', error, request);

// Fatal (sent to API)
logger.fatal('payment', 'payment-service.ts', 'processPayment', 'Payment processing failed', error, request);
```

## Using Correlation ID

```typescript
import { getCorrelationId, resetCorrelationId } from '../logger';

// Get current correlation ID
const correlationId = getCorrelationId();
console.log('Current correlation ID:', correlationId);

// Reset for new session (e.g., on login)
resetCorrelationId();
```

## Integration in Existing Services

### Before
```typescript
catch (error: any) {
  console.error('Error:', error);
  throw error;
}
```

### After
```typescript
import { logServiceError } from '../logger';

catch (error: any) {
  logServiceError(
    'service-name',
    'service-file.ts',
    'methodName',
    error,
    {
      request: {
        url: apiUrl,
        method: 'POST',
        statusCode: error.response?.status,
      },
    }
  );
  throw error;
}
```

## What Gets Logged

Each log entry includes:
- ✅ Correlation ID (unique per session)
- ✅ Timestamp (ISO 8601)
- ✅ Log level (DEBUG, INFO, WARN, ERROR, FATAL)
- ✅ Error category (auto-determined)
- ✅ Service name
- ✅ File name
- ✅ Method name
- ✅ Error details (name, message, stack)
- ✅ Request context (if available)
- ✅ User info (if logged in)
- ✅ Device info (platform, version)
- ✅ Custom metadata

## Error Categories

Errors are automatically categorized:
- **NETWORK** - Network errors, timeouts
- **AUTHENTICATION** - 401, 403 responses
- **VALIDATION** - 400, 422 responses
- **API** - Other API errors
- **STORAGE** - Keychain, SQLite errors
- **UNKNOWN** - Other errors

## API Logging

Only ERROR and FATAL level logs are sent to the API endpoint: `POST /api/logs`

The logging to API is async and non-blocking - failures won't crash your app.

