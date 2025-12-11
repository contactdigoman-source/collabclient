# Environment Configuration Setup

## Quick Setup

1. **Create `.env` file in the project root:**
   ```bash
   cd colabclient
   cp .env.example .env
   ```

2. **For iOS Simulator (default):**
   ```bash
   # .env
   API_BASE_URL=http://localhost:8080
   ```

3. **For Android Emulator:**
   ```bash
   # .env
   API_BASE_URL=http://10.0.2.2:8080
   ```

4. **For Physical Device:**
   ```bash
   # .env
   API_BASE_URL=http://192.168.1.100:8080  # Replace with your computer's IP
   ```

## Environment File Template

Create a `.env` file in the `colabclient` directory with the following:

```bash
# API Configuration
# For Android Emulator: Use 10.0.2.2 instead of localhost
# For iOS Simulator: Use localhost
# For Physical Device: Use your computer's IP address

API_BASE_URL=http://localhost:8080

# Google Maps API Key
GOOGLE_MAPS_API_KEY=AIzaSyDNd3TT1CZZc5AkcRgSoJRleo-m_PLcQE0

# Privacy Policy URL
PRIVACY_POLICY_URL=https://colab.nexaei.com/privacy-andriod

# Terms and Conditions URL
TERM_AND_CONDITIONS_URL=https://colab.nexaei.com/terms-andriod
```

## Platform-Specific Notes

### iOS Simulator
- Can use `localhost` or `127.0.0.1`
- API_BASE_URL=http://localhost:8080

### Android Emulator
- Must use `10.0.2.2` to access host machine's localhost
- API_BASE_URL=http://10.0.2.2:8080

### Physical Device
- Use your computer's local network IP address
- Find IP: `ifconfig` (macOS/Linux) or `ipconfig` (Windows)
- Example: API_BASE_URL=http://192.168.1.100:8080
- Ensure device and computer are on the same network

## Verifying Configuration

After setting up the `.env` file:

1. **Restart Metro bundler:**
   ```bash
   npm run start:reset
   ```

2. **Rebuild the app:**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

3. **Check console logs:**
   - You should see: `API Base URL: http://localhost:8080` (or your configured URL)
   - This confirms the environment variable is being read correctly

## Troubleshooting

### Environment variable not loading

1. **Make sure `.env` is in the project root (`colabclient/` directory)**
2. **Clear Metro cache and rebuild:**
   ```bash
   npm run start:reset
   rm -rf node_modules
   npm install
   ```
3. **For iOS, clean build:**
   ```bash
   cd ios
   pod install
   cd ..
   npm run ios
   ```
4. **For Android, clean build:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run android
   ```

### React Native Config not reading .env

Make sure `react-native-config` is installed:
```bash
npm install react-native-config
```

For iOS, link the config:
```bash
cd ios
pod install
```

## Important Notes

- `.env` file is git-ignored for security (don't commit API keys)
- Copy `.env.example` to `.env` and customize as needed
- Restart Metro bundler after changing `.env` file
- Rebuild the app after changing environment variables

