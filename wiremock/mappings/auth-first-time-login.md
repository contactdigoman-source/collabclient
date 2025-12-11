# First Time Login API

## Endpoint
`POST /api/auth/first-time-login`

## Expected Request Body
```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "newPassword": "NewPassword123!@#",
  "consent": {
    "agreed": true,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "permissions": ["location", "storage", "camera", "time", "personal", "device", "microphone", "phone"]
  },
  "deviceIdentifier": "ios-1705312200000-abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Response
- **Status**: 200 OK
- **Body**: Contains `success`, `message`, `token`, `expiresAt`, and `user` object with updated user data

