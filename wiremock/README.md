# WireMock API Stubs for Nexval Attendance API

This directory contains WireMock stub mappings for all API endpoints in the Nexval Attendance API. WireMock allows you to simulate the API responses without running the actual backend service.

## Directory Structure

```
wiremock/
├── README.md (this file)
└── mappings/
    ├── __files/ (response body files, if needed)
    └── *.json (stub mapping files)
```

## Quick Start

### Using Docker (Recommended for Development)

**Option 1: Docker Compose (Current Setup - with volume mounting)**
```bash
cd wiremock
docker-compose up -d
```

**Option 2: Docker Run (with volume mounting)**
```bash
cd wiremock
docker run -it --rm \
  -p 8080:8080 \
  -v $(pwd)/mappings:/home/wiremock/mappings \
  wiremock/wiremock:latest
```

**Option 3: Custom Image (Production - mappings baked in)**
```bash
# Build custom image
docker build -t colabclient-wiremock:latest .

# Run
docker run -p 8080:8080 colabclient-wiremock:latest
```

> 📖 **Why Docker?** See [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) for detailed explanation
> 📦 **Build & Push:** See [BUILD_AND_PUSH.md](./BUILD_AND_PUSH.md) for building and pushing to registry

### Using Java

1. Download WireMock JAR from [wiremock.org](https://wiremock.org/docs/download-and-installation/)
2. Run:
```bash
java -jar wiremock-jre8-standalone.jar --port 8080 --root-dir ./mappings
```

### Using npm

```bash
npx wiremock --port 8080 --root-dir ./mappings
```

## API Base URL

After starting WireMock, all APIs will be available at:
```
http://localhost:8080/api
```

## Viewing All Mappings

WireMock doesn't have Swagger, but provides several ways to view all API stubs:

### Quick View
```bash
# List all endpoints
npm run wiremock:list

# Or use curl
curl http://localhost:8080/__admin/mappings | jq .
```

### Admin UI
If using WireMock Standalone 2.35.0+, open in browser:
```
http://localhost:8080/__admin/webapp
```

### Admin API Endpoints
- **List all mappings:** `GET http://localhost:8080/__admin/mappings`
- **Health check:** `GET http://localhost:8080/__admin/health`
- **Request logs:** `GET http://localhost:8080/__admin/requests`

> 📖 **See [VIEWING_MAPPINGS.md](./VIEWING_MAPPINGS.md) for detailed information**

## New APIs Added for Mobile App

The following APIs have been added specifically for the CollabClient mobile app:

- `POST /api/auth/resend-email-otp` - Resend email OTP
- `POST /api/auth/first-time-login` - First time login password update
- `POST /api/aadhaar/request-otp` - Request Aadhaar OTP
- `POST /api/aadhaar/verify-otp` - Verify Aadhaar OTP
- `POST /api/attendance/sync` - Sync unsynced attendance records

**📖 See `API_REQUIREMENTS_DOCUMENT.md` for complete documentation of all APIs including enhanced fields, request/response bodies, and missing APIs.**

## Available API Endpoints

### Authentication APIs (`/api/auth`)

- **POST** `/api/auth/register` - Register a new user
- **POST** `/api/auth/register-saas` - Register a new SaaS user with organization
- **POST** `/api/auth/login` - User login (enhanced with mobile app fields)
- **POST** `/api/auth/resend-email-otp` - Resend email OTP (NEW for mobile)
- **POST** `/api/auth/first-time-login` - First time login password update (NEW for mobile)
- **POST** `/api/auth/verify-email` - Verify email address (enhanced with mobile app fields)
- **POST** `/api/auth/verify-phone` - Verify phone number
- **POST** `/api/auth/forgot-password` - Request password reset
- **POST** `/api/auth/reset-password` - Reset password with token
- **POST** `/api/auth/change-password` - Change password (requires auth)
- **GET** `/api/auth/profile` - Get complete user profile with Aadhaar verification (NEW for mobile)
- **POST** `/api/auth/update-profile` - Update user profile (requires auth, enhanced response)
- **POST** `/api/auth/upload-profile-photo` - Upload profile photo (NEW for mobile)
- **GET** `/api/user/configuration` - Get user working hours and reminder settings (NEW for mobile)
- **PUT** `/api/user/configuration` - Update user working hours and reminder settings (NEW for mobile)
- **POST** `/api/auth/regenerate-verification-link` - Regenerate email verification link

### Aadhaar APIs (`/api/aadhaar`) - NEW for Mobile App

- **POST** `/api/aadhaar/request-otp` - Request OTP for Aadhaar verification
- **POST** `/api/aadhaar/verify-otp` - Verify Aadhaar OTP

### Attendance APIs (`/api/attendance`)

- **POST** `/api/attendance/punch-in` - Punch in for attendance (requires auth, enhanced fields)
- **POST** `/api/attendance/punch-out/{id}` - Punch out from attendance (requires auth, enhanced fields)
- **POST** `/api/attendance/sync` - Sync unsynced attendance records (NEW for mobile)
- **GET** `/api/attendance/current` - Get current active attendance (requires auth, enhanced fields)
- **GET** `/api/attendance` - Get all attendances with optional date filters (requires auth, enhanced fields)
- **GET** `/api/attendance/{id}` - Get attendance by ID (requires auth)

### Invite APIs (`/api/invite`)

- **POST** `/api/invite/invite` - Invite a user (requires auth)
- **POST** `/api/invite/bulk-invite` - Bulk invite users (requires auth)
- **POST** `/api/invite/accept` - Accept an invitation
- **GET** `/api/invite` - Get all invitations (requires auth)
- **GET** `/api/invite/token/{token}` - Get invitation by token
- **POST** `/api/invite/{id}/resend` - Resend invitation (requires auth)
- **POST** `/api/invite/{id}/cancel` - Cancel invitation (requires auth)

### License APIs (`/api/license`)

- **GET** `/api/license` - Get all licenses (requires auth)
- **GET** `/api/license/{id}` - Get license by ID (requires auth)
- **POST** `/api/license` - Create a new license (requires auth)
- **PUT** `/api/license/{id}` - Update license (requires auth)
- **DELETE** `/api/license/{id}` - Delete license (requires auth)
- **GET** `/api/license/{id}/invitation-codes` - Get invitation codes for a license (requires auth)
- **POST** `/api/license/{id}/invitation-codes` - Generate invitation codes (requires auth)
- **DELETE** `/api/license/invitation-codes/{id}` - Delete invitation code (requires auth)
- **POST** `/api/license/validate-invitation-code` - Validate invitation code
- **GET** `/api/license/{id}/organizations` - Get organizations under a license (requires auth)
- **GET** `/api/license/approval-requests/pending` - Get pending approval requests (requires auth)
- **POST** `/api/license/approval-requests/{id}/approve` - Approve license request (requires auth)
- **POST** `/api/license/approval-requests/{id}/reject` - Reject license request (requires auth)
- **GET** `/api/license/settings` - Get license settings (requires auth)
- **GET** `/api/license/settings/invite-only-mode` - Get invite-only mode status
- **PUT** `/api/license/settings/{key}` - Update license setting (requires auth)

### Members APIs (`/api/members`)

- **GET** `/api/members/active` - Get active members (requires auth)
- **GET** `/api/members/invited` - Get invited members (requires auth)
- **GET** `/api/members/archived` - Get archived members (requires auth)
- **GET** `/api/members/search?q={query}` - Search members (requires auth)
- **POST** `/api/members/archive` - Archive members (requires auth)
- **POST** `/api/members/reactivate` - Reactivate members (requires auth)
- **PUT** `/api/members/{id}/role` - Update member role (requires auth)

### Organization APIs (`/api/organization`)

- **POST** `/api/organization/setup` - Setup organization (requires auth)
- **POST** `/api/organization/{id}/complete-setup` - Complete organization setup (requires auth)
- **POST** `/api/organization/{id}/deactivate` - Deactivate organization (requires auth)
- **GET** `/api/organization/{id}` - Get organization by ID (requires auth)
- **POST** `/api/organization/create` - Create organization (requires auth)
- **GET** `/api/organization` - Get all organizations (requires auth)

### Seed APIs (`/api/seed`)

- **GET** `/api/seed/run` - Run database seeding
- **GET** `/api/seed/status` - Get database seeding status
- **POST** `/api/seed/test-login` - Test login credentials

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

The WireMock stubs accept any token value that matches the pattern `Bearer .+`.

## Request/Response Examples

### Login Request
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Login Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-12-31T23:59:59Z",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "roles": ["ORGUSER"]
  }
}
```

## Customizing Responses

You can modify the JSON files in the `mappings/` directory to customize the responses. Each file contains:
- `request`: Criteria for matching requests
- `response`: The response to return

## Testing

You can test the WireMock stubs using curl, Postman, or any HTTP client:

```bash
# Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Test get current attendance (requires auth token)
curl -X GET http://localhost:8080/api/attendance/current \
  -H "Authorization: Bearer your-token-here"
```

## Notes

- All dates are in ISO 8601 format (UTC)
- JWT tokens in responses are example tokens and won't work with actual authentication
- Response bodies are based on the actual API DTOs from the NexvalAttendanceAPI project
- Some endpoints support query parameters for filtering (e.g., `?startDate=...&endDate=...`)

## Troubleshooting

1. **Port already in use**: Change the port with `--port 8081` or stop the service using port 8080
2. **Mappings not loading**: Ensure the `mappings/` directory path is correct
3. **CORS issues**: WireMock by default allows all origins. You may need to configure CORS headers in the response mappings if needed

