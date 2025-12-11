# ✅ WireMock Configuration Complete

## What Was Configured

### 1. Environment Files
- ✅ Created `.env.example` template
- ✅ Created platform-specific templates (`.env.ios`, `.env.android`)
- ✅ Added `.env` to `.gitignore` for security

### 2. WireMock Scripts
- ✅ `scripts/start-wiremock.sh` - Start WireMock with Docker (macOS/Linux)
- ✅ `scripts/start-wiremock.bat` - Start WireMock with Docker (Windows)
- ✅ `scripts/start-wiremock-npm.sh` - Alternative npm method
- ✅ Updated `docker-compose.yml` to bind to all interfaces (0.0.0.0) for device access

### 3. Code Updates
- ✅ Updated `src/constants/configs.ts` to export `apiBaseUrl` from environment
- ✅ Updated `src/services/auth/login-service.ts` to use `Configs.apiBaseUrl`
- ✅ Updated `src/services/aadhaar/otp-service.ts` to use `Configs.apiBaseUrl`

### 4. NPM Scripts
- ✅ `npm run wiremock:start` - Start WireMock
- ✅ `npm run wiremock:stop` - Stop WireMock
- ✅ `npm run wiremock:logs` - View WireMock logs

### 5. Documentation
- ✅ `WIREMOCK_SETUP.md` - Complete setup guide
- ✅ `ENV_SETUP.md` - Environment configuration guide
- ✅ `QUICK_START_WIREMOCK.md` - Quick start guide

## 🚀 Getting Started

### 1. Create .env file
```bash
cd colabclient
cat > .env << EOF
API_BASE_URL=http://localhost:8080
GOOGLE_MAPS_API_KEY=AIzaSyDNd3TT1CZZc5AkcRgSoJRleo-m_PLcQE0
PRIVACY_POLICY_URL=https://colab.nexaei.com/privacy-andriod
TERM_AND_CONDITIONS_URL=https://colab.nexaei.com/terms-andriod
EOF
```

### 2. Start WireMock
```bash
npm run wiremock:start
```

### 3. Verify WireMock is Running
Open: http://localhost:8080/__admin

### 4. Run the App
```bash
# iOS
npm run ios

# Android (update .env to use 10.0.2.2)
npm run android
```

## 📝 Important Notes

### Platform-Specific URLs

- **iOS Simulator:** `http://localhost:8080`
- **Android Emulator:** `http://10.0.2.2:8080`
- **Physical Device:** `http://<your-ip>:8080`

### Available Mappings

WireMock has **70+ API endpoint mappings** ready to use, including:
- Authentication APIs (login, register, OTP, etc.)
- Aadhaar APIs (request/verify OTP)
- Attendance APIs (punch in/out, sync)
- Profile APIs (get, update, upload photo)
- User Configuration APIs (working hours, reminders)
- And many more!

### Testing

You can test APIs directly:
```bash
# Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## 📚 Documentation Files

- `WIREMOCK_SETUP.md` - Detailed setup and troubleshooting
- `ENV_SETUP.md` - Environment configuration details
- `QUICK_START_WIREMOCK.md` - Quick start guide
- `wiremock/API_REQUIREMENTS_DOCUMENT.md` - Complete API documentation

## ✅ Next Steps

1. ✅ Create `.env` file (see ENV_SETUP.md)
2. ✅ Start WireMock: `npm run wiremock:start`
3. ✅ Verify: http://localhost:8080/__admin
4. ✅ Run app and test login flow
5. ✅ Check console for "API Base URL: http://localhost:8080" message

All set! 🎉

