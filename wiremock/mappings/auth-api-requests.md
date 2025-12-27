# Authentication API Request/Response Documentation

## Login API (`/api/auth/login`)

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "idpjourneyToken": "string",        // Required: Token to be used in OTP verification
  "message": "string",                // Required: Response message
  "accountStatus": "string"           // Optional: Account status - "active" | "locked" | "passwordExpired" | "inactive"
}
```

**Response Fields:**
- `idpjourneyToken` (required): IDP journey token received after login, used for OTP verification
- `message` (required): Success or error message from the server
- `accountStatus` (optional): 
  - `"active"`: Account is active, proceed to OTP screen
  - `"locked"`: Account is locked, show AccountLockedModal
  - `"passwordExpired"`: Password expired, will be handled in OTP flow
  - `"inactive"`: Account is inactive, show AccountInactiveModal

---

## Forgot Password API (`/api/auth/forgot-password`)

**Request:**
```json
{
  "email": "string"  // Required: User's email address
}
```

**Response:**
```json
{
  "success": "boolean",        // Required: Whether the request was successful
  "message": "string",         // Required: Response message
  "accountStatus": "string",   // Optional: Account status - "active" | "locked" | "passwordExpired" | "inactive"
  "otpSent": "boolean"        // Optional: Whether OTP was sent successfully
}
```

**Response Fields:**
- `success` (required): Boolean indicating if the forgot password request was successful
- `message` (required): Response message (e.g., "If the email exists, a password reset OTP has been sent to your email")
- `accountStatus` (optional): Account status at the time of request
  - `"active"`: Account is active, OTP will be sent
  - `"locked"`: Account is locked, OTP may not be sent (handled in OTP screen)
  - `"passwordExpired"`: Password expired (handled in OTP screen)
  - `"inactive"`: Account is inactive, OTP may not be sent (handled in OTP screen)
- `otpSent` (optional): Boolean indicating if OTP was successfully sent to the email (defaults to `true` if not present and `success` is `true`)

**Note:** This API is used when users forget their password. After successful request, user is navigated to OTP screen for password reset flow. Account status checks (locked/inactive) are handled in the OTP verification step, not in this initial request.

---

## Login OTP Verification API (`/api/auth/verify-otp`)

**Note:** This API has different request formats depending on the flow:
- **Login Flow:** Uses `idpjourneyToken` and `otpValue`
- **Password Reset Flow:** Uses `email`, `otp`, and `flowType: "password-reset"`
- **Punch Flow:** Uses `email`, `otp`, and `flowType: "punch"`

### Login Flow Request:
```json
{
  "idpjourneyToken": "string",  // Required: Token from login response
  "otpValue": "string"          // Required: OTP value entered by user
}
```

### Password Reset Flow Request:
```json
{
  "email": "string",            // Required: User's email address
  "otp": "string",              // Required: OTP value entered by user
  "flowType": "password-reset"  // Required: Flow type identifier
}
```

### Punch Flow Request:
```json
{
  "email": "string",            // Required: User's email address
  "otp": "string",              // Required: OTP value entered by user
  "flowType": "punch"           // Required: Flow type identifier
}
```

**Response:**
```json
{
  "success": "boolean",                    // Required: Whether OTP verification was successful
  "message": "string",                     // Required: Response message
  "accountStatus": "string",                // Optional: "active" | "locked" | "passwordExpired" | "inactive"
  "firstTimeLogin": "boolean",             // Optional: If true, user needs to complete first-time login flow
  "idpjourneyToken": "string",           // Optional: New token for first-time login (if firstTimeLogin is true)
  "token": "string",                       // Optional: Token for password reset (if accountStatus is "passwordExpired")
  "jwt": "string",                        // Optional: JWT access token (if accountStatus is "active" and not firstTimeLogin)
  "expiresAt": "string",                  // Optional: JWT expiration timestamp (ISO 8601 format)
  "refreshToken": "string",                // Optional: Refresh token for getting new JWT
  "firstName": "string",                   // Optional: User's first name
  "lastName": "string",                    // Optional: User's last name
  "email": "string",                       // Optional: User's email
  "contact": "string",                     // Optional: User's phone number
  "organization": "string",                // Optional: User's organization name
  "role": "string"                         // Optional: User's role (e.g., "ORGUSER")
}
```

**Response Fields:**
- `success` (required): Boolean indicating if OTP verification was successful
- `message` (required): Success or error message
- `accountStatus` (optional): Account status after OTP verification
  - `"active"`: Account is active, proceed with login
  - `"locked"`: Account is locked, show AccountLockedModal
  - `"passwordExpired"`: Password expired, show PasswordExpiryModal and navigate to ChangePasswordScreen
  - `"inactive"`: Account is inactive, show AccountInactiveModal
- `firstTimeLogin` (optional): If `true`, user needs to complete first-time login flow (permissions, profile photo)
- `idpjourneyToken` (optional): New token for first-time login flow (present if `firstTimeLogin` is `true`)
- `token` (optional): Token for password reset (present if `accountStatus` is `"passwordExpired"`)
- `jwt` (optional): JWT access token (present if `accountStatus` is `"active"` and `firstTimeLogin` is `false`)
- `expiresAt` (optional): JWT expiration timestamp in ISO 8601 format
- `refreshToken` (optional): Refresh token for obtaining new JWT tokens
- `firstName`, `lastName`, `email`, `contact`, `organization`, `role` (optional): User profile information (present if login is successful and not first-time login) - **Login Flow only**

**Flow-Specific Notes:**
- **Login Flow:** Returns full user data and JWT tokens on success. Used in `LoginOtpScreen`.
- **Password Reset Flow:** Returns `token` for password reset, navigates to `ChangePasswordScreen`. Used in `OtpScreen` with `isPasswordReset: true`.
- **Punch Flow:** Returns simple success response with `accountStatus`, navigates to `CheckInScreen`. Account status checks (locked/inactive) are handled here. Used in `OtpScreen` with `isPunchFlow: true`. - **Login Flow only**

**Flow-Specific Notes:**
- **Login Flow:** Returns full user data and JWT tokens on success. Used in `LoginOtpScreen`.
- **Password Reset Flow:** Returns `token` for password reset, navigates to `ChangePasswordScreen`. Used in `OtpScreen` with `isPasswordReset: true`.
- **Punch Flow:** Returns simple success response with `accountStatus`, navigates to `CheckInScreen`. Account status checks (locked/inactive) are handled here. Used in `OtpScreen` with `isPunchFlow: true`.

---

## Reset Password API (`/api/auth/reset-password`)

**Request:**
```json
{
  "token": "string",        // Required: Token from OTP verification (when accountStatus is "passwordExpired")
  "newPassword": "string"  // Required: New password to set
}
```

**Response:**
```json
{
  "message": "string",      // Required: Success message
  "success": "boolean"      // Optional: Boolean indicating success
}
```

**Response Fields:**
- `message` (required): Success message (e.g., "Password reset successfully")
- `success` (optional): Boolean indicating if password reset was successful (defaults to `true` if not present)

---

## Change Password API (`/api/auth/change-password`)

**Request:**
```json
{
  "currentPassword": "string",  // Required: User's current password (for logged-in users)
  "newPassword": "string"       // Required: New password to set
}
```

**Response:**
```json
{
  "message": "string",      // Required: Success message
  "success": "boolean"      // Optional: Boolean indicating success
}
```

**Response Fields:**
- `message` (required): Success message (e.g., "Password changed successfully")
- `success` (optional): Boolean indicating if password change was successful (defaults to `true` if not present)

**Note:** This API requires authentication (JWT token in Authorization header). Used when logged-in users change password from profile page.

---

## First Time Login API (`/api/auth/first-time-login`)

**Request:**
```json
{
  "idpjourneyToken": "string",      // Required: Token from OTP verification (when firstTimeLogin is true)
  "email": "string",                 // Required: User's email
  "firstName": "string",             // Required: User's first name
  "lastName": "string",              // Required: User's last name
  "newPassword": "string",           // Required: New password to set
  "deviceIdentifier": "string",      // Required: Unique device identifier
  "timestamp": "string",             // Required: ISO 8601 timestamp when form was submitted
  "consent": {                       // Required: Consent information
    "agreed": "boolean",             // Required: Whether user agreed to terms
    "timestamp": "string",           // Required: ISO 8601 timestamp when permissions were granted
    "permissions": "string[]"        // Required: Array of permission IDs that were consented to
  },
  "profilePhoto": "File"             // Optional: Profile photo file (sent as FormData)
}
```

**Note:** Request can be sent as JSON or FormData (if profilePhoto is included). If profilePhoto is present, Content-Type will be `multipart/form-data`. When using FormData, fields are sent as form fields (e.g., `consent[agreed]`, `consent[timestamp]`, `consent[permissions]`).

**Response:**
```json
{
  "success": "boolean",             // Required: Whether first-time login was successful
  "message": "string",              // Required: Success message
  "idpjourneyToken": "string",      // Optional: IDP journey token (if needed for further steps)
  "jwt": "string",                  // Optional: JWT access token
  "expiresAt": "string",            // Optional: JWT expiration timestamp (ISO 8601 format)
  "refreshToken": "string",         // Optional: Refresh token for getting new JWT
  "firstName": "string",            // Optional: User's first name
  "lastName": "string",            // Optional: User's last name
  "email": "string",                // Optional: User's email
  "contact": "string",              // Optional: User's phone number
  "organization": "string",         // Optional: User's organization name
  "role": "string"                  // Optional: User's role (e.g., "ORGUSER")
}
```

**Response Fields:**
- `success` (required): Boolean indicating if first-time login was completed successfully
- `message` (required): Success message (e.g., "First-time login completed successfully")
- `idpjourneyToken` (optional): IDP journey token if needed for further authentication steps
- `jwt` (optional): JWT access token for authenticated requests
- `expiresAt` (optional): JWT expiration timestamp in ISO 8601 format
- `refreshToken` (optional): Refresh token for obtaining new JWT tokens
- `firstName`, `lastName` (optional): User's name
- `email` (optional): User's email address
- `contact` (optional): User's phone number
- `organization` (optional): User's organization name
- `role` (optional): User's role (e.g., "ORGUSER", "ADMIN")

**Note:** Response structure matches the Login OTP Verification API response format for consistency. All user profile fields are optional and returned at the top level (not nested in a `user` object).

---

## Device Registration API (`/api/device/register`)

**Endpoint:** `POST /api/device/register`

**When Called:** Called automatically when the user lands on the HomeScreen after login.

**Request:**
```json
{
  "deviceId": "string",           // Required: Unique device identifier
  "platform": "string",           // Required: Platform name ("ios" or "android")
  "platformVersion": "string",    // Required: Platform version (e.g., "17.0", "13")
  "appVersion": "string",          // Optional: App version
  "deviceModel": "string",        // Optional: Device model
  "deviceManufacturer": "string"  // Optional: Device manufacturer
}
```

**Response:**
```json
{
  "success": "boolean",        // Required: Whether device registration was successful
  "message": "string",         // Required: Response message (e.g., "Device registered successfully")
  "deviceId": "string",        // Required: Device identifier that was registered
  "registeredAt": "string"     // Required: ISO 8601 timestamp when device was registered
}
```

**Response Fields:**
- `success` (required): Boolean indicating if device registration was successful
- `message` (required): Success message from the server
- `deviceId` (required): The device identifier that was registered
- `registeredAt` (required): ISO 8601 timestamp indicating when the device was registered on the server

**Note:** This API requires authentication (JWT token in Authorization header). The device registration data is stored in Redux state (`appState.deviceRegistration`) after successful registration.

---

## Current Time and Timezone API (`/api/time/current`)

**Endpoint:** `GET /api/time/current`

**When Called:** Called automatically when the user lands on the HomeScreen after login.

**Request:**
No request body required. This is a GET request.

**Response:**
```json
{
  "currentTime": "string",      // Required: Current server time in ISO 8601 format (e.g., "2024-12-27T12:00:00.000Z")
  "timezone": "string",         // Required: Timezone name (e.g., "Asia/Kolkata", "America/New_York")
  "timezoneOffset": "number",   // Required: Timezone offset in minutes from UTC (e.g., 330 for IST, -300 for EST)
  "timestamp": "number"         // Required: Unix timestamp in milliseconds
}
```

**Response Fields:**
- `currentTime` (required): Current server time in ISO 8601 format (UTC)
- `timezone` (required): IANA timezone name (e.g., "Asia/Kolkata", "America/New_York", "Europe/London")
- `timezoneOffset` (required): Timezone offset in minutes from UTC
  - Positive values: ahead of UTC (e.g., 330 for IST which is UTC+5:30)
  - Negative values: behind UTC (e.g., -300 for EST which is UTC-5:00)
- `timestamp` (required): Unix timestamp in milliseconds (same as `Date.now()`)

**Note:** This API requires authentication (JWT token in Authorization header). The timezone data is stored in Redux state (`appState.timeZoneData`) after successful fetch. This is used to synchronize client time with server time and handle timezone-specific operations.

---

## Get Profile API (`/api/auth/profile`)

**Endpoint:** `GET /api/auth/profile`

**When Called:** Called when viewing profile screen or refreshing profile data.

**Request:**
No request body required. This is a GET request. JWT token is required in Authorization header.

**Response:**
```json
{
  "id": "number",                    // Required: User ID
  "email": "string",                 // Required: User's email address
  "firstName": "string",             // Required: User's first name
  "lastName": "string",              // Required: User's last name
  "phoneNumber": "string",           // Optional: User's phone number
  "isEmailVerified": "boolean",      // Required: Whether email is verified
  "isPhoneVerified": "boolean",      // Required: Whether phone is verified
  "profilePhotoUrl": "string",       // Optional: URL to user's profile photo
  "dateOfActivation": "string",      // Optional: Date of account activation (ISO 8601)
  "dateOfBirth": "string",           // Optional: Date of birth (ISO 8601)
  "empId": "string",                 // Optional: Employee ID
  "employmentType": "string",        // Optional: Employment type (e.g., "Full Time")
  "designation": "string",           // Optional: Job designation
  "organizationName": "string",     // Optional: Organization name
  "organization": "string",         // Optional: Organization ID
  "department": "string",           // Optional: Department name
  "roles": ["string"],              // Required: Array of user roles (e.g., ["ORGUSER", "ADMIN"])
  "createdAt": "string",            // Optional: Account creation timestamp (ISO 8601)
  "lastLoginAt": "string",          // Optional: Last login timestamp (ISO 8601)
  "lastSyncedAt": "string",         // Optional: Last sync timestamp from server (ISO 8601)
  "shiftStartTime": "string",       // Optional: Shift start time in HH:mm format (e.g., "09:00")
  "shiftEndTime": "string",         // Optional: Shift end time in HH:mm format (e.g., "17:30")
  "timezone": "string",             // Optional: User's timezone (e.g., "Asia/Kolkata")
  "timezoneOffset": "number",       // Optional: Timezone offset in minutes from UTC
  "currentTime": "string",          // Optional: Current server time in ISO 8601 format
  "allowedGeofenceAreas": [         // Optional: List of allowed geofence areas for check-in
    {
      "id": "string",                // Required: Geofence area ID
      "name": "string",             // Required: Geofence area name
      "latitude": "number",         // Required: Center latitude
      "longitude": "number",        // Required: Center longitude
      "radius": "number",           // Required: Radius in meters
      "isActive": "boolean"         // Optional: Whether the area is active
    }
  ],
  "aadhaarVerification": {          // Optional: Aadhaar verification status
    "isVerified": "boolean",        // Required: Whether Aadhaar is verified
    "verificationMethod": "string", // Optional: Verification method ("face-rd" | "otp" | "pan-card")
    "lastVerifiedDate": "string",   // Optional: Last verification date (YYYY-MM-DD)
    "maskedAadhaarNumber": "string", // Optional: Masked Aadhaar number (e.g., "1234****9012")
    "isPanCardVerified": "boolean"  // Optional: Whether verified using PAN card instead of Aadhaar
  }
}
```

**Response Fields:**
- `id` (required): Unique user identifier
- `email` (required): User's email address
- `firstName`, `lastName` (required): User's name
- `phoneNumber` (optional): User's phone number
- `isEmailVerified`, `isPhoneVerified` (required): Verification status
- `profilePhotoUrl` (optional): URL to user's profile photo
- `dateOfActivation` (optional): Account activation date
- `dateOfBirth` (optional): User's date of birth
- `empId` (optional): Employee ID
- `employmentType` (optional): Employment type
- `designation` (optional): Job designation
- `organizationName`, `organization` (optional): Organization information
- `department` (optional): Department name
- `roles` (required): Array of user roles (e.g., ["ORGUSER", "ADMIN"])
- `createdAt`, `lastLoginAt` (optional): Timestamps
- `lastSyncedAt` (optional): Last sync timestamp from server
- `shiftStartTime`, `shiftEndTime` (optional): Shift timing in HH:mm format (in UTC timezone, e.g., "09:00", "17:00")
  - These times are interpreted as UTC (Coordinated Universal Time) when creating timestamps
  - Example: "09:00" means 9:00 AM UTC, "17:00" means 5:00 PM UTC
  - For same-day shifts: start time should be earlier than end time (e.g., "09:00" to "17:00" for 9am to 5pm UTC)
  - For 2-day shifts: end time is earlier than start time (e.g., "17:00" to "06:00" means 5 PM UTC to 6 AM UTC next day)
- `timezone`, `timezoneOffset`, `currentTime` (optional): Timezone and current time information
- `allowedGeofenceAreas` (optional): Array of geofence areas where check-in is allowed
  - Each area has `id`, `name`, `latitude`, `longitude`, `radius` (in meters), and `isActive` flag
  - Used to validate if user's check-in location is within allowed areas
- `aadhaarVerification` (optional): Aadhaar and PAN card verification status
  - `isVerified`: Whether Aadhaar is verified
  - `verificationMethod`: Method used ("face-rd", "otp", or "pan-card")
  - `lastVerifiedDate`: Last verification date
  - `maskedAadhaarNumber`: Masked Aadhaar number for display
  - `isPanCardVerified`: Whether verified using PAN card instead of Aadhaar

**Note:** This API requires authentication (JWT token in Authorization header). The profile data is stored in Redux state (`userState.userData`) and SQLite database for offline access. The geofencing data helps validate if user's check-in location is within allowed areas.

---

## Update Profile API (`/api/auth/update-profile`)

**Endpoint:** `POST /api/auth/update-profile`

**When Called:** Called when user updates their profile information (name, date of birth, employment type, designation, or profile photo).

**Request:**
- **If updating profile fields only (no photo):** Regular JSON request:
```json
{
  "firstName": "string",           // Optional: User's first name
  "lastName": "string",            // Optional: User's last name
  "dateOfBirth": "string",          // Optional: Date of birth in YYYY-MM-DD format
  "employmentType": "string",      // Optional: Employment type
  "designation": "string",          // Optional: Job designation
  "profilePhotoUrl": "string"      // Optional: Server URL of profile photo (if already uploaded)
}
```

- **If uploading profile photo:** Multipart form data (FormData) with all profile fields:
  - `firstName` (string, optional)
  - `lastName` (string, optional)
  - `dateOfBirth` (string, optional, YYYY-MM-DD format)
  - `employmentType` (string, optional)
  - `designation` (string, optional)
  - `profilePhoto` (file, optional): Image file to upload

**Response:**
Same structure as Get Profile API response, with updated fields and `lastSyncedAt` timestamp.

**Note:** 
- This API requires authentication (JWT token in Authorization header).
- When `profilePhoto` (local file path) is provided, the request is sent as multipart/form-data and the photo is uploaded along with other profile fields.
- When only `profilePhotoUrl` (server URL) is provided, the request is sent as regular JSON.
- All fields are optional - you can update just the photo, just the name, or any combination of fields.

---

## Refresh Token API (`/api/auth/refresh`)

**Endpoint:** `POST /api/auth/refresh`

**When Called:** Called automatically when the JWT token is about to expire (within 30 minutes of expiration) or when a 401 error is received.

**Authentication:** Not required (uses refresh token instead of JWT)

**Request:**
```json
{
  "refreshToken": "string",  // Required: Refresh token stored in Keychain
  "userId": "number"          // Required: User ID from user profile
}
```

**Response:**
```json
{
  "token": "string",          // Required: New JWT access token
  "refreshToken": "string",   // Optional: New refresh token (if rotated)
  "expiresAt": "string"       // Required: New JWT expiration timestamp (ISO 8601 format)
}
```

**Response Fields:**
- `token` (required): New JWT access token to use for authenticated requests
- `refreshToken` (optional): New refresh token if token rotation is enabled (if not present, use the same refresh token)
- `expiresAt` (required): New JWT expiration timestamp in ISO 8601 format

**Note:** This API is called automatically by the session service when checking if a session is about to expire. The new tokens are stored in Keychain and Redux state.

---

## Resend Email OTP API (`/api/auth/resend-email-otp`)

**Endpoint:** `POST /api/auth/resend-email-otp`

**When Called:** Called when user requests to resend OTP in the OTP verification screen.

**Request:**
```json
{
  "email": "string",          // Required: User's email address
  "flowType": "string"        // Optional: Flow type - "password-reset" | "punch" (defaults to "password-reset")
}
```

**Response:**
```json
{
  "success": "boolean",       // Required: Whether OTP was sent successfully
  "message": "string",        // Required: Response message (e.g., "OTP sent successfully to your email")
  "expiresIn": "number"       // Optional: OTP expiration time in seconds (e.g., 120 for 2 minutes)
}
```

**Response Fields:**
- `success` (required): Boolean indicating if OTP was sent successfully
- `message` (required): Success or error message
- `expiresIn` (optional): OTP expiration time in seconds (defaults to 120 if not present)

**Note:** This API is used in password reset flow and punch flow OTP screens. The OTP is sent to the user's registered email address.

---

## Get Attendance Days API (`/api/attendance/days`)

**Endpoint:** `GET /api/attendance/days`

**When Called:** Called when fetching attendance data for the Days tab or Home screen. Can be filtered by month using query parameters.

**Authentication:** Required (JWT token in Authorization header)

**Request:**
No request body. Query parameters (optional):
- `startDate` (string, optional): Start date in YYYY-MM-DD format
- `endDate` (string, optional): End date in YYYY-MM-DD format

**Response:**
```json
[
  {
    "dateOfPunch": "string",           // Required: Date in YYYY-MM-DD format
    "attendanceStatus": "string",       // Required: "PRESENT" | "ABSENT" | "PARTIAL"
    "totalDuration": "string",          // Required: Total working duration in HH:mm format (e.g., "8:30")
    "breakDuration": "string",          // Required: Total break duration in HH:mm format (e.g., "01:00")
    "records": [                        // Required: Array of attendance records for the day
      {
        "Timestamp": "number",          // Required: UTC timestamp in milliseconds (epoch)
        "PunchDirection": "string",     // Required: "IN" | "OUT"
        "AttendanceStatus": "string",   // Optional: Status like "LUNCH" (for break punches) or null
        "LatLon": "string",             // Optional: Latitude and longitude (e.g., "22.5726,88.3639")
        "Address": "string",            // Optional: Human-readable address
        "DateOfPunch": "string"         // Optional: Date in YYYY-MM-DD format
      }
    ]
  }
]
```

**Response Fields:**
- `dateOfPunch` (required): Date of attendance in YYYY-MM-DD format
- `attendanceStatus` (required): Overall attendance status for the day
  - `"PRESENT"`: User was present for the full day
  - `"ABSENT"`: User was absent
  - `"PARTIAL"`: User was present for part of the day
- `totalDuration` (required): Total working duration in HH:mm format (e.g., "8:30" for 8 hours 30 minutes)
- `breakDuration` (required): Total break duration in HH:mm format (e.g., "01:00" for 1 hour)
- `records` (required): Array of all punch records for the day
  - `Timestamp` (required): UTC timestamp in milliseconds (epoch time)
  - `PunchDirection` (required): Direction of punch - "IN" for check-in, "OUT" for check-out
  - `AttendanceStatus` (optional): Status like "LUNCH" for break punches, or null for regular punches
  - `LatLon` (optional): Comma-separated latitude and longitude
  - `Address` (optional): Human-readable address from reverse geocoding
  - `DateOfPunch` (optional): Date in YYYY-MM-DD format

**Note:** 
- All timestamps in the response are in UTC (milliseconds since epoch).
- The response is an array of days, sorted by date (most recent first).
- Each day can have multiple records (e.g., check-in, lunch break out, lunch break in, check-out).
- The API merges server data with local database, preserving local records that don't exist on the server.

---

## Punch In API (`/api/attendance/punch-in`)

**Endpoint:** `POST /api/attendance/punch-in`

**When Called:** Called when user performs check-in action from the CheckInScreen.

**Authentication:** Required (JWT token in Authorization header)

**Request:**
```json
{
  "timestamp": "number",           // Required: UTC timestamp in milliseconds (epoch)
  "latLon": "string",              // Optional: Comma-separated latitude and longitude (e.g., "22.5726,88.3639")
  "address": "string",             // Optional: Human-readable address from reverse geocoding
  "punchType": "string",           // Optional: Type of punch (e.g., "QR", "MANUAL", "BIOMETRIC")
  "moduleID": "string",           // Optional: Module identifier
  "tripType": "string",           // Optional: Trip type identifier
  "passengerID": "string",       // Optional: Passenger ID (for travel-related punches)
  "allowanceData": "string",     // Optional: Allowance data in JSON string format
  "isCheckoutQrScan": "boolean", // Optional: Whether this is a checkout QR scan
  "travelerName": "string",      // Optional: Traveler name
  "phoneNumber": "string"        // Optional: Phone number
}
```

**Response:**
```json
{
  "id": "number",                  // Required: Attendance record ID
  "userId": "number",              // Required: User ID
  "punchInTime": "string",         // Required: Punch-in time in ISO 8601 format (UTC) or UTC timestamp
  "punchOutTime": "null",          // Always null for punch-in
  "location": "string",            // Optional: Location name
  "latitude": "string",            // Optional: Latitude
  "longitude": "string",           // Optional: Longitude
  "notes": "string"                // Optional: Additional notes
}
```

**Response Fields:**
- `id` (required): Unique attendance record ID
- `userId` (required): User ID
- `punchInTime` (required): Punch-in timestamp (can be ISO 8601 string or UTC milliseconds)
- `punchOutTime` (always null): Always null for punch-in records
- `location` (optional): Location name
- `latitude`, `longitude` (optional): Coordinates
- `notes` (optional): Additional notes

**Note:** 
- The `timestamp` in request must be in UTC (milliseconds since epoch).
- The response timestamp is converted to UTC ticks and stored in local database.
- After successful punch-in, the record is marked as synced in the local database.

---

## Punch Out API (`/api/attendance/punch-out`)

**Endpoint:** `POST /api/attendance/punch-out/{attendanceId}`

**When Called:** Called when user performs check-out action from the CheckInScreen.

**Authentication:** Required (JWT token in Authorization header)

**Request:**
```json
{
  "punchOutTime": "number"          // Required: UTC timestamp in milliseconds (epoch)
}
```

**Note:** The URL path includes the attendance record ID from the previous punch-in (e.g., `/api/attendance/punch-out/1`).

**Response:**
```json
{
  "id": "number",                  // Required: Attendance record ID
  "userId": "number",              // Required: User ID
  "punchInTime": "string",         // Required: Original punch-in time in ISO 8601 format (UTC) or UTC timestamp
  "punchOutTime": "string",        // Required: Punch-out time in ISO 8601 format (UTC) or UTC timestamp
  "location": "string",            // Optional: Location name
  "latitude": "string",            // Optional: Latitude
  "longitude": "string",           // Optional: Longitude
  "notes": "string"                // Optional: Additional notes
}
```

**Response Fields:**
- `id` (required): Unique attendance record ID (same as punch-in)
- `userId` (required): User ID
- `punchInTime` (required): Original punch-in timestamp (ISO 8601 string or UTC milliseconds)
- `punchOutTime` (required): Punch-out timestamp (ISO 8601 string or UTC milliseconds)
- `location` (optional): Location name
- `latitude`, `longitude` (optional): Coordinates
- `notes` (optional): Additional notes

**Note:** 
- The `punchOutTime` in request must be in UTC (milliseconds since epoch).
- The response timestamps are converted to UTC ticks and stored in local database.
- After successful punch-out, the record is marked as synced in the local database.

---

## Request Aadhaar OTP API (`/api/aadhaar/request-otp`)

**Endpoint:** `POST /api/aadhaar/request-otp`

**When Called:** Called when user requests OTP for Aadhaar verification (fallback when Face RD fails or on iOS).

**Authentication:** Required (JWT token in Authorization header)

**Request:**
```json
{
  "aadhaarNumber": "string",       // Required: User's Aadhaar number (12 digits)
  "emailID": "string"               // Required: User's email address
}
```

**Response:**
```json
{
  "success": "boolean",             // Required: Whether OTP request was successful
  "message": "string",              // Required: Response message (e.g., "OTP sent to registered mobile number")
  "txnId": "string",                // Optional: Transaction ID for OTP verification
  "expiresIn": "number"              // Optional: OTP expiration time in seconds (e.g., 300 for 5 minutes)
}
```

**Response Fields:**
- `success` (required): Boolean indicating if OTP was sent successfully
- `message` (required): Success or error message
- `txnId` (optional): Transaction ID that may be required for OTP verification
- `expiresIn` (optional): OTP expiration time in seconds (defaults to 300 if not present)

**Note:** 
- This API sends OTP to the mobile number registered with the Aadhaar number.
- Used as a fallback when Face RD (Face Recognition) authentication fails or is not available (e.g., iOS).
- The OTP is sent via SMS to the registered mobile number.

---

## Verify Aadhaar OTP API (`/api/aadhaar/verify-otp`)

**Endpoint:** `POST /api/aadhaar/verify-otp`

**When Called:** Called when user enters OTP for Aadhaar verification.

**Authentication:** Required (JWT token in Authorization header)

**Request:**
```json
{
  "aadhaarNumber": "string",       // Required: User's Aadhaar number (12 digits)
  "otp": "string",                 // Required: OTP value entered by user
  "emailID": "string"               // Required: User's email address
}
```

**Response:**
```json
{
  "verified": "boolean",            // Required: Whether Aadhaar was verified successfully
  "success": "boolean",             // Required: Whether verification was successful
  "message": "string",              // Required: Response message (e.g., "Aadhaar verified successfully")
  "aadhaarDetails": {              // Optional: Aadhaar details (if verification successful)
    "name": "string",               // Required: Name from Aadhaar (e.g., "JOHN DOE")
    "dob": "string",                // Required: Date of birth in DD-MM-YYYY format (e.g., "01-01-1990")
    "gender": "string",             // Required: Gender (e.g., "M", "F", "T")
    "maskedAadhaar": "string"       // Required: Masked Aadhaar number (e.g., "1234****9012")
  },
  "isValidated": "boolean"         // Required: Whether Aadhaar is validated (same as verified)
}
```

**Response Fields:**
- `verified` (required): Boolean indicating if Aadhaar was verified successfully
- `success` (required): Boolean indicating if the API call was successful
- `message` (required): Success or error message
- `aadhaarDetails` (optional): Aadhaar details returned after successful verification
  - `name` (required): Full name from Aadhaar card
  - `dob` (required): Date of birth in DD-MM-YYYY format
  - `gender` (required): Gender code (M, F, or T)
  - `maskedAadhaar` (required): Masked Aadhaar number for display
- `isValidated` (required): Boolean indicating if Aadhaar is validated (same as `verified`)

**Note:** 
- After successful verification, the Aadhaar verification status is updated in Redux state and profile.
- The verification is valid for the current day only (needs to be re-verified daily for check-in).
- Used as a fallback when Face RD authentication fails or is not available.

---

## Logger API (`/api/logs`)

**Endpoint:** `POST /api/logs`

**When Called:** Called automatically by the logger service for FATAL level logs only.

**Authentication:** Not required (this endpoint is excluded from authentication requirements)

**Request:**
```json
{
  "correlationId": "string",       // Required: Unique correlation ID for tracking
  "level": "string",               // Required: Log level - "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"
  "service": "string",              // Required: Service name (e.g., "auth", "attendance", "sync")
  "fileName": "string",             // Required: Source file name
  "methodName": "string",           // Required: Method or function name
  "message": "string",              // Required: Log message
  "metadata": {},                   // Optional: Additional metadata object
  "error": {},                      // Optional: Error object (for ERROR and FATAL levels)
  "request": {                      // Optional: Request details (for API-related logs)
    "url": "string",
    "method": "string",
    "statusCode": "number"
  },
  "timestamp": "string"             // Required: ISO 8601 timestamp when log was created
}
```

**Response:**
```json
{
  "success": "boolean",             // Required: Whether log entry was saved successfully
  "message": "string",              // Required: Response message (e.g., "Log entry saved successfully")
  "logId": "string"                 // Optional: Unique log entry ID
}
```

**Response Fields:**
- `success` (required): Boolean indicating if log entry was saved successfully
- `message` (required): Success or error message
- `logId` (optional): Unique log entry ID for tracking

**Note:** 
- Only FATAL level logs are sent to this API to avoid overwhelming the server.
- The logger service uses raw axios (not apiClient) to avoid circular dependencies.
- Logging failures are silently ignored to prevent app crashes.
- This endpoint is excluded from authentication requirements in the API client.

---

## Upload PAN Card API (`/api/aadhaar/upload-pan-card`)

**Endpoint:** `POST /api/aadhaar/upload-pan-card`

**When Called:** Called when user uploads PAN card images (front and back) for verification in the PanCardCaptureScreen.

**Authentication:** Required (JWT token in Authorization header)

**Request:**
Multipart form data (FormData) with the following fields:
- `panCardFront` (file, required): Front side image of PAN card (JPEG/PNG)
- `panCardBack` (file, required): Back side image of PAN card (JPEG/PNG)

**Note:** The request is sent as `multipart/form-data` with Content-Type header set to `multipart/form-data`.

**Response:**
```json
{
  "success": "boolean",             // Required: Whether PAN card upload was successful
  "message": "string",              // Required: Response message (e.g., "PAN card uploaded and verified successfully")
  "isVerified": "boolean",          // Optional: Whether PAN card was verified successfully
  "panCardDetails": {              // Optional: PAN card details (if verification successful)
    "panNumber": "string",          // Optional: Masked PAN number (e.g., "ABCDE****F")
    "name": "string",               // Optional: Name from PAN card (e.g., "JOHN DOE")
    "dob": "string",                // Optional: Date of birth from PAN card in DD-MM-YYYY format (e.g., "01-01-1990")
    "verifiedAt": "string"          // Optional: ISO 8601 timestamp when verified
  }
}
```

**Response Fields:**
- `success` (required): Boolean indicating if PAN card upload was successful
- `message` (required): Success or error message
- `isVerified` (optional): Boolean indicating if PAN card was verified successfully (defaults to `true` if not present and `success` is `true`)
- `panCardDetails` (optional): PAN card details returned after successful verification
  - `panNumber` (optional): Masked PAN number for display (e.g., "ABCDE****F")
  - `name` (optional): Full name from PAN card
  - `dob` (optional): Date of birth in DD-MM-YYYY format
  - `verifiedAt` (optional): ISO 8601 timestamp when verification was completed

**Note:** 
- After successful upload and verification, the PAN card verification status is updated in Redux state.
- The verification is valid for the current day only (needs to be re-verified daily for check-in).
- Used as an alternative to Aadhaar Face RD verification when Face RD is not available or fails.
- Both front and back images of the PAN card are required for verification.
- The images are uploaded as multipart/form-data with a 60-second timeout.

