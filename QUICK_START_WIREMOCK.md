# Quick Start: WireMock Setup

## 🚀 Quick Setup (3 Steps)

### Step 1: Create Environment File

```bash
cd colabclient

# Create .env file
cat > .env << EOF
API_BASE_URL=http://localhost:8080
GOOGLE_MAPS_API_KEY=AIzaSyDNd3TT1CZZc5AkcRgSoJRleo-m_PLcQE0
PRIVACY_POLICY_URL=https://colab.nexaei.com/privacy-andriod
TERM_AND_CONDITIONS_URL=https://colab.nexaei.com/terms-andriod
EOF
```

**For Android Emulator, use:**
```bash
API_BASE_URL=http://10.0.2.2:8080
```

### Step 2: Start WireMock

```bash
# Using npm script
npm run wiremock:start

# OR manually
cd wiremock
docker-compose up -d
```

### Step 3: Verify

Open in browser: http://localhost:8080/__admin

You should see the WireMock admin interface.

## 📱 Running the App

### iOS
```bash
npm run ios
```

### Android
```bash
# Make sure .env has: API_BASE_URL=http://10.0.2.2:8080
npm run android
```

## 🛠️ Useful Commands

```bash
# Start WireMock
npm run wiremock:start

# Stop WireMock
npm run wiremock:stop

# View WireMock logs
npm run wiremock:logs

# View all WireMock stubs
open http://localhost:8080/__admin
```

## 📋 Check Environment is Loaded

Check console logs when app starts:
```
API Base URL: http://localhost:8080
```

If you see this, the environment is configured correctly!

## 🔧 Troubleshooting

**Port 8080 in use?**
```bash
lsof -i :8080  # Find process
kill -9 <PID>  # Kill it
```

**Android can't connect?**
- Use `10.0.2.2` instead of `localhost`
- Check WireMock is running: `curl http://localhost:8080/__admin/health`

**iOS can't connect?**
- Use `localhost` (not `127.0.0.1`)
- Check WireMock is running

**Need to restart app?**
```bash
# Clear cache and restart
npm run start:reset
```

For more details, see `WIREMOCK_SETUP.md` and `ENV_SETUP.md`.

