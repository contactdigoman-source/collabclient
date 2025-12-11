# Login API Mock Response

## Account Status Values

The `accountStatus` field in the login response can have the following values:

- **"active"** - Account is active and user can proceed with login flow
  - Navigate to FirstTimeLoginScreen if `firstTimeLogin === true`
  - Otherwise navigate to OtpScreen

- **"locked"** - Account is locked
  - Show AccountLockedModal
  - User cannot proceed with login

- **"password expired"** - User's password has expired
  - Show PasswordExpiryModal
  - User can reset password or dismiss (not recommended)

- **"inactive"** - Account is inactive
  - Show error message: "Your account is inactive. Please contact support."
  - User cannot proceed with login

## Example Response Structure

```json
{
  "token": "JWT_TOKEN_HERE",
  "expiresAt": "2024-12-31T23:59:59Z",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "requiresPasswordChange": false,
    "roles": ["ORGUSER"],
    "firstTimeLogin": false
  },
  "accountStatus": "active",
  "requiresPasswordChange": false
}
```

## Testing Different Statuses

To test different account statuses, modify the `accountStatus` field in `auth-login.json`:
- Change to `"locked"` to test locked account flow
- Change to `"password expired"` to test password expiry flow
- Change to `"inactive"` to test inactive account flow
- Keep as `"active"` for normal login flow

