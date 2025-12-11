# WireMock Setup Guide

This guide explains how to run WireMock locally and configure the mobile app to use it.

## Prerequisites

- Docker installed and running (recommended), OR
- Node.js and npm installed (alternative method)

## Quick Start

### Option 1: Using Docker (Recommended)

1. **Start WireMock:**
   ```bash
   cd colabclient
   ./scripts/start-wiremock.sh
   ```

   Or on Windows:
   ```cmd
   cd colabclient
   scripts\start-wiremock.bat
   ```

2. **Verify WireMock is running:**
   - Open http://localhost:8080/__admin in your browser
   - You should see the WireMock admin interface

3. **Check API endpoints:**
   - Test: http://localhost:8080/api/auth/login
   - Admin UI: http://localhost:8080/__admin

### Option 2: Using npm

```bash
cd colabclient/wiremock
npm install -g wiremock
./scripts/start-wiremock-npm.sh
```

## Environment Configuration

### For iOS Simulator

1. **Use the `.env` or `.env.ios` file:**
   ```bash
   # .env.ios
   API_BASE_URL=http://localhost:8080
   ```

2. **Start the app:**
   ```bash
   cd colabclient
   npx react-native run-ios
   ```

### For Android Emulator

1. **Update `.env` or use `.env.android`:**
   ```bash
   # .env.android - Android emulator uses 10.0.2.2 instead of localhost
   API_BASE_URL=http://10.0.2.2:8080
   ```

2. **Copy the env file:**
   ```bash
   cp .env.android .env
   ```

3. **Start the app:**
   ```bash
   cd colabclient
   npx react-native run-android
   ```

### For Physical Device

1. **Find your computer's IP address:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. **Update `.env` with your IP:**
   ```bash
   API_BASE_URL=http://192.168.1.100:8080  # Replace with your IP
   ```

3. **Make sure your device and computer are on the same network**

4. **Start WireMock:**
   ```bash
   # Make WireMock accessible on all interfaces (not just localhost)
   # Update docker-compose.yml or use:
   docker run -p 0.0.0.0:8080:8080 -v $(pwd)/wiremock/mappings:/home/wiremock/mappings wiremock/wiremock:latest
   ```

## Available Endpoints

All endpoints are available at: `http://localhost:8080/api/`

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-email-otp`
- And more...

### Aadhaar
- `POST /api/aadhaar/request-otp`
- `POST /api/aadhaar/verify-otp`

### Attendance
- `POST /api/attendance/punch-in`
- `POST /api/attendance/punch-out/{id}`
- `GET /api/attendance/current`
- `POST /api/attendance/sync`

### Profile
- `GET /api/auth/profile`
- `POST /api/auth/upload-profile-photo`
- `POST /api/auth/update-profile`

### Configuration
- `GET /api/user/configuration`
- `PUT /api/user/configuration`

See `wiremock/API_REQUIREMENTS_DOCUMENT.md` for complete API documentation.

## Stopping WireMock

### Docker:
```bash
cd colabclient/wiremock
docker-compose down
```

### npm:
Press `Ctrl+C` in the terminal where WireMock is running

## Viewing Logs

```bash
cd colabclient/wiremock
docker-compose logs -f
```

## Troubleshooting

### Port 8080 Already in Use

If port 8080 is already in use:

1. **Find what's using the port:**
   ```bash
   # macOS/Linux
   lsof -i :8080
   
   # Windows
   netstat -ano | findstr :8080
   ```

2. **Stop the service or change WireMock port:**
   ```yaml
   # In docker-compose.yml, change:
   ports:
     - "8081:8080"  # Use 8081 instead
   ```

3. **Update .env:**
   ```bash
   API_BASE_URL=http://localhost:8081
   ```

### Android Emulator Can't Connect

- Make sure you're using `10.0.2.2` instead of `localhost`
- Check that WireMock is running: `curl http://localhost:8080/__admin/health`
- Verify firewall isn't blocking port 8080

### iOS Simulator Can't Connect

- Make sure you're using `localhost` (not `127.0.0.1`)
- Check that WireMock is running
- Try restarting the simulator

### Physical Device Can't Connect

- Verify both device and computer are on the same Wi-Fi network
- Check your computer's firewall allows connections on port 8080
- Make sure WireMock is bound to `0.0.0.0` not just `localhost`
- Try accessing `http://<your-ip>:8080/__admin` from a browser on your device

## Testing APIs

You can test the APIs using curl:

```bash
# Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Test profile (requires auth token)
curl -X GET http://localhost:8080/api/auth/profile \
  -H "Authorization: Bearer your-token-here"
```

## Admin UI

WireMock provides a web UI to view and manage stubs:

- **URL:** http://localhost:8080/__admin
- **Features:**
  - View all stubs
  - Create/edit stubs
  - View request logs
  - Reset stubs

## Development Tips

1. **Modify stubs:** Edit JSON files in `wiremock/mappings/` and restart WireMock
2. **Add new stubs:** Create new JSON files in `wiremock/mappings/`
3. **Debug requests:** Check WireMock logs to see incoming requests
4. **View request history:** Use the Admin UI at http://localhost:8080/__admin

