# Build Scripts

This directory contains scripts for building and distributing the app.

## Android Builds

### Build APK
Builds a release APK file that can be installed directly on Android devices.

```bash
npm run build:android:apk
# or
bash scripts/build-android-apk.sh
```

The APK will be located at: `android/app/build/outputs/apk/release/app-release.apk`

### Build App Bundle (AAB)
Builds an Android App Bundle for Google Play Store distribution.

```bash
npm run build:android:bundle
# or
bash scripts/build-android-bundle.sh
```

The AAB will be located at: `android/app/build/outputs/bundle/release/app-release.aab`

### Build and Install APK
Builds the APK and automatically installs it on a connected Android device.

```bash
npm run build:android:install
# or
bash scripts/install-android-apk.sh
```

**Requirements:**
- Android device connected via USB
- USB debugging enabled
- `adb` (Android Debug Bridge) installed

## iOS Builds

### Build IPA
Builds an IPA file for iOS distribution.

```bash
npm run build:ios:ipa
# or
bash scripts/build-ios-ipa.sh
```

**Requirements:**
- macOS with Xcode installed
- Valid Apple Developer account
- Provisioning profile and signing certificates configured
- CocoaPods installed (`sudo gem install cocoapods`)

**Note:** Before building, you may need to:
1. Update `ios/build/ExportOptions.plist` with your Team ID
2. Configure signing in Xcode
3. Set the correct distribution method (development/ad-hoc/app-store/enterprise)

The IPA will be located at: `ios/build/ipa/colabclient.ipa`

## Manual Installation

### Android APK
1. Transfer the APK file to your Android device
2. Enable "Install from Unknown Sources" in Settings
3. Open the APK file and tap Install

### iOS IPA
1. For Ad Hoc/Enterprise: Use Apple Configurator or Xcode
2. For TestFlight: Upload to App Store Connect
3. For App Store: Upload via Transporter or Xcode

## Troubleshooting

### Android
- **Build fails**: Make sure you have Android SDK installed and `ANDROID_HOME` is set
- **APK not found**: Check `android/app/build/outputs/apk/release/` directory
- **Install fails**: Ensure USB debugging is enabled and device is authorized

### iOS
- **Xcode not found**: Install Xcode from App Store
- **Pod install fails**: Run `cd ios && pod install` manually
- **Signing errors**: Configure signing in Xcode project settings
- **Export fails**: Check ExportOptions.plist and ensure Team ID is correct

